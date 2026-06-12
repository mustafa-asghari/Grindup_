# REL-002 Specialist Eval - Reliability Agent

## Result

Pass.

## Evaluation

The patch fixes the reliability root cause. `apps/runner/main.py` keeps `execute_code` as an async FastAPI handler, but now awaits `run_in_threadpool` for `docker_service.run_code` at lines 123-130, moving the synchronous Docker SDK calls and `time.sleep` polling off the event loop.

Response shape and existing gates are preserved. FastAPI request validation, runner middleware, unsupported-language handling, empty-test-case handling, timeout mapping, result parsing, and fallback error responses still run in the same order around the Docker call.

The REL-002 change does not add a new startup dependency beyond Starlette, which FastAPI already uses, and it does not introduce new async, cancellation, or error-handling behavior that makes the original path worse. Docker execution exceptions still resolve through the existing `DockerService.run_code` return/error behavior.

Scope is appropriate for this task. The patch does not add a new concurrency policy and does not change Docker bind mounts or the Dockerized filesystem limitation area. The runner token middleware and executor image environment fallback are adjacent existing diff from other task work, not required for REL-002, and they do not invalidate this reliability fix.

## Validation

- `python3 -m py_compile apps/runner/main.py` - passed
- `python3 -m json.tool Agents/stat.json >/dev/null` - passed

The live Docker concurrency proof was not rerun in this specialist eval.
