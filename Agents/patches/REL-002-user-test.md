# User Test Instructions: REL-002

## What was fixed

Runner Docker execution is offloaded from the FastAPI event loop, so `/health` should remain responsive while `/execute` is running.

## Where to test

- API endpoint: `POST /execute`
- API endpoint: `GET /health`
- File/function: `apps/runner/main.py` `execute_code`

## Setup needed

Run the runner in the same way you normally test execution. If `RUNNER_SHARED_SECRET` is set, include `x-runner-token: <secret>` on the `/execute` request.

## Test steps

1. Start a long-running `/execute` request.
2. While that request is still running, call `GET /health`.
3. Confirm the `/execute` request still eventually returns its normal execution result or timeout result.

## Expected result

`/health` returns immediately with `{"status":"healthy","service":"runner"}` while the long `/execute` request is still active.

## Bad result

The fix failed if `/health` waits for the long `/execute` request to finish before returning.

## Regression checks

- Unsupported languages still return the same 400 response.
- Empty test-case requests still return the existing `No test cases available for this problem` error response.
- Normal execution responses keep the same `status`, `test_results`, `runtime_ms`, `memory_kb`, and `error` shape.

## What to tell the AI after testing

If the test passed, say:

`I tested task REL-002 and approve it.`

If the test failed, say:

`Task REL-002 failed user testing. Here is what happened: <details>.`
