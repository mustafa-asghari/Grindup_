# GrindUp Runner Service

This service handles the execution of user-submitted code in a secure, sandboxed environment using Docker.

## Prerequisites

- Python 3.11+
- Docker installed and running
- Redis (optional, for future caching/queueing)

## Setup

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Build the Executor Image:**
   This image contains the compilers and runtimes for supported languages (Python, Node, Java, C++).
   ```bash
   cd executor
   docker build -t grindup-executor .
   ```

3. **Run the Service:**
   ```bash
   export RUNNER_SHARED_SECRET=dev-only-runner-secret
   python main.py
   ```
   The service will start on `http://0.0.0.0:8080`.
   Use a local-only value for development and keep real secrets out of public docs and committed files.

## Configuration

- `RUNNER_MAX_CONCURRENT_EXECUTIONS` limits active Docker executor containers. Default: `2`.
- `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS` controls how long saturated requests wait for a slot before returning HTTP 429. Default: `0`.

## API

### POST /execute

Executes code and returns test results.

When `RUNNER_SHARED_SECRET` is configured, direct `POST /execute` calls must include an `X-Runner-Token` header with the same value.

```bash
curl -i -X POST http://localhost:8080/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: dev-only-runner-secret' \
  --data '{"language":"python","code":"def solution(x): return x","test_cases":[{"id":"1","input":"x = 1","expected_output":"1"}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

**Request Body:**
```json
{
  "language": "python",
  "code": "def solution(...): ...",
  "test_cases": [
    {
      "id": "1",
      "input": "arg1=val1; arg2=val2",
      "expected_output": "result"
    }
  ],
  "time_limit_ms": 2000,
  "memory_limit_kb": 256000
}
```
