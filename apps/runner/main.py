from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from typing import Optional, List
import asyncio
import uvicorn
import re
import json
import os
import secrets

from services.docker_service import DockerService
from handlers.python_handler import PythonHandler
from handlers.node_handler import NodeHandler
from handlers.java_handler import JavaHandler
from handlers.cpp_handler import CppHandler
from handlers.base_handler import TestCase

app = FastAPI(
    title="GrindUp Runner",
    description="Sandboxed code execution service",
    version="0.1.0"
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

docker_service = DockerService()
handlers = {
    "python": PythonHandler(),
    "javascript": NodeHandler(),
    "java": JavaHandler(),
    "cpp": CppHandler(),
}

RUNNER_TOKEN_HEADER = "x-runner-token"
DEFAULT_MAX_CONCURRENT_EXECUTIONS = 2
DEFAULT_EXECUTION_QUEUE_TIMEOUT_MS = 0


def parse_int_env(name: str, default: int, min_value: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default

    try:
        value = int(raw_value)
    except ValueError:
        return default

    if value < min_value:
        return default

    return value


MAX_CONCURRENT_EXECUTIONS = parse_int_env(
    "RUNNER_MAX_CONCURRENT_EXECUTIONS",
    DEFAULT_MAX_CONCURRENT_EXECUTIONS,
    min_value=1,
)
EXECUTION_QUEUE_TIMEOUT_MS = parse_int_env(
    "RUNNER_EXECUTION_QUEUE_TIMEOUT_MS",
    DEFAULT_EXECUTION_QUEUE_TIMEOUT_MS,
    min_value=0,
)
execution_limiter = asyncio.Semaphore(MAX_CONCURRENT_EXECUTIONS)


async def acquire_execution_slot() -> None:
    if EXECUTION_QUEUE_TIMEOUT_MS == 0:
        if execution_limiter.locked():
            raise HTTPException(
                status_code=429,
                detail="Runner is busy; try again shortly",
            )
        await execution_limiter.acquire()
        return

    try:
        await asyncio.wait_for(
            execution_limiter.acquire(),
            timeout=EXECUTION_QUEUE_TIMEOUT_MS / 1000,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=429,
            detail="Runner is busy; try again shortly",
        )


@app.middleware("http")
async def require_runner_secret(request: Request, call_next):
    shared_secret = os.environ.get("RUNNER_SHARED_SECRET")

    if shared_secret and request.method == "POST" and request.url.path == "/execute":
        supplied_secret = request.headers.get(RUNNER_TOKEN_HEADER)
        if not supplied_secret:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing runner token"},
            )
        if not secrets.compare_digest(supplied_secret, shared_secret):
            return JSONResponse(
                status_code=403,
                content={"detail": "Invalid runner token"},
            )

    return await call_next(request)


class SubmissionRequest(BaseModel):
    code: str
    language: str
    test_cases: List[TestCase]
    time_limit_ms: int = 2000
    memory_limit_kb: int = 256000

class TestResult(BaseModel):
    test_case_id: str
    passed: bool
    actual_output: Optional[str] = None
    runtime_ms: int
    is_hidden: bool
    error: Optional[str] = None

class SubmissionResult(BaseModel):
    status: str  # 'accepted', 'wrong_answer', 'tle', 'mle', 'error'
    test_results: List[TestResult]
    runtime_ms: int
    memory_kb: int
    error: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "runner"}


@app.post("/execute", response_model=SubmissionResult)
async def execute_code(request: SubmissionRequest):
    """
    Execute code against test cases in a sandboxed environment.
    """
    if request.language not in handlers:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {request.language}")
    
    if not request.test_cases:
        return SubmissionResult(
            status="error",
            test_results=[],
            runtime_ms=0,
            memory_kb=0,
            error="No test cases available for this problem. Cannot verify correctness."
        )
    
    handler = handlers[request.language]
    
    # 1. Generate the wrapped driver code
    full_code = handler.generate_full_code(request.code, request.test_cases)
    
    # 2. Prepare for Docker execution
    filename = f"main.{handler.get_extension()}"
    files = {filename: full_code}
    command = handler.get_execution_command(filename)
    
    # 3. Run in container
    await acquire_execution_slot()
    try:
        stdout, stderr, exec_time = await run_in_threadpool(
            docker_service.run_code,
            image=os.environ.get("RUNNER_EXECUTOR_IMAGE", "grindup-executor"),
            command=command,
            files=files,
            time_limit_ms=request.time_limit_ms,
            memory_limit_mb=request.memory_limit_kb // 1024
        )
    finally:
        execution_limiter.release()

    # 4. Check for Hard Timeouts (returned differently by docker service)
    if "Time Limit Exceeded" in stderr:
        return SubmissionResult(
            status="tle",
            test_results=[],
            runtime_ms=exec_time,
            memory_kb=0,
            error="Time Limit Exceeded"
        )
    
    # 5. Parse Results
    # Look for content between <<<RESULTS>>> markers
    match = re.search(r"<<<RESULTS>>>\s*(.*?)\s*<<<RESULTS>>>", stdout, re.DOTALL)
    
    if match:
        try:
            results_json = match.group(1)
            raw_results = json.loads(results_json)
            
            # Map raw results to TestResult model
            test_results = []
            all_passed = True
            
            for r in raw_results:
                tr = TestResult(
                    test_case_id=r['test_case_id'],
                    passed=r['passed'],
                    actual_output=r.get('actual_output'),
                    runtime_ms=r.get('runtime_ms', 0),
                    is_hidden=r['is_hidden'],
                    error=r.get('error')
                )
                test_results.append(tr)
                if not tr.passed:
                    all_passed = False
                    
            status = "accepted" if all_passed else "wrong_answer"
            
            # If any test case had an internal error (exception), status is effectively wrong_answer
            # unless we want to flag it as runtime error. 
            # Usually if code errors on a test case, it's a "Runtime Error" for that submission if it crashes.
            # But the driver catches exceptions.
            if any(r.error for r in test_results):
                status = "error" # Or specifically Runtime Error

            return SubmissionResult(
                status=status,
                test_results=test_results,
                runtime_ms=exec_time, # Total execution time
                memory_kb=0, # TODO: Parse from docker stats or time -v
                error=None
            )
            
        except json.JSONDecodeError:
            # Code printed <<<RESULTS>>> but invalid JSON?
            return SubmissionResult(
                status="error",
                test_results=[],
                runtime_ms=exec_time,
                memory_kb=0,
                error=f"Internal Error: Failed to parse execution results.\nStdout: {stdout}"
            )

    # 6. Fallback: If no RESULTS block found, it likely crashed (SyntaxError, etc.)
    # In this case, stderr usually has the traceback.
    error_msg = stderr if stderr else stdout
    
    # If stderr is empty but no results, maybe it didn't print anything or crashed silently
    if not error_msg:
        error_msg = "No output produced. Code may have crashed silently."

    return SubmissionResult(
        status="error",
        test_results=[],
        runtime_ms=exec_time,
        memory_kb=0,
        error=error_msg
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
