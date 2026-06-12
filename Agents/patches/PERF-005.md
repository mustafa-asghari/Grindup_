# Patch Note: PERF-005

## Worker personality

Performance Worker - Latency Hawk

## Issue

Runner `/execute` offloads Docker work to Starlette's threadpool without a runner-local concurrency cap.

## Root cause

Every accepted execution request could enter `run_in_threadpool(docker_service.run_code, ...)` and reach Docker container creation independently, allowing bursts to start too many executor containers.

## Original proof example

Start the compose stack, send 40 valid `POST /execute` requests with `X-Runner-Token` in parallel, then run `docker ps --filter ancestor=grindup-executor:latest`; many executor containers can be active at once.

## Original fix location

`apps/runner/main.py` `execute_code` around lines 95-130; optionally `compose.yml` runner environment around lines 80-84.

## Original what to change

Add a runner-level concurrency limiter around the `run_in_threadpool` call, backed by an env var such as `RUNNER_MAX_CONCURRENT_EXECUTIONS`; return 429/503 or wait within a bounded timeout when saturated.

## Files changed

- `apps/runner/main.py`
- `compose.yml`
- `.env.example`
- `apps/runner/README.md`
- `Agents/stat.json`
- `Agents/patches/PERF-005.md`

## Fix made

Added a module-level `asyncio.Semaphore` initialized from `RUNNER_MAX_CONCURRENT_EXECUTIONS`, with invalid or negative values falling back to a safe default of `2` and a minimum effective limit of `1`. Added `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS`, defaulting to `0`, and return HTTP 429 with `Runner is busy; try again shortly` before the Docker threadpool call when no slot is available within the configured wait.

The patch changed the exact original fix location in `apps/runner/main.py` and updated the runner environment in `compose.yml`.

## Why this fix is minimal

The change wraps only the existing Docker offload boundary, so normal request validation, code generation, Docker execution, REL-005 file staging, and REL-001 cleanup behavior stay in the existing service path.

## Validation attempted

- `python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py`: passed.
- `docker compose config`: passed and showed `RUNNER_MAX_CONCURRENT_EXECUTIONS: "2"` plus `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS: "0"` for runner.
- `docker compose build runner`: passed.
- `docker compose up -d runner`: passed.
- Single proof curl to `/execute` with a valid token returned HTTP 200 and `status:"accepted"`.
- First backpressure attempt used incorrectly escaped code newlines, so both requests returned fast Python syntax errors and did not prove saturation.
- After tightening max-concurrency env parsing, `python3 -m py_compile`, `docker compose config`, `docker compose build runner`, `docker compose up -d runner`, the single proof curl, and the one-slot backpressure proof were rerun.
- Final corrected backpressure proof with `RUNNER_MAX_CONCURRENT_EXECUTIONS=1` and `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS=0` returned one active executor container, a concurrent second request returned HTTP 429 with the busy message, and the first request completed HTTP 200 `status:"accepted"`.
- `/health` returned HTTP 200 during the final burst in about 21 ms.
- Runner was recreated again with the normal Compose defaults after the final one-slot proof.

## Result

Executor containers are capped by the configured runner-local limit, and overflow receives explicit HTTP 429 backpressure before a Docker container is created.

## Compatibility notes

Single execution behavior and response shape are preserved. High parallel bursts may now receive HTTP 429 when the runner is saturated, which is the intended explicit backpressure behavior.

## Specialist eval handoff

Performance Agent - Latency Hawk must review this patch next.

## Suggested commit message

Limit concurrent runner Docker executions
