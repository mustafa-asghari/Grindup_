# User Test Instructions: PERF-005

## What was fixed

The runner now limits how many Docker executor containers can run at once and returns explicit HTTP 429 backpressure when the limit is saturated.

## Where to test

- API endpoint: `POST http://127.0.0.1:8080/execute`
- Health endpoint: `GET http://127.0.0.1:8080/health`
- Docker containers: `docker ps --filter ancestor=grindup-executor:latest`

## Setup needed

```bash
docker compose build runner executor-image
RUNNER_MAX_CONCURRENT_EXECUTIONS=1 RUNNER_EXECUTION_QUEUE_TIMEOUT_MS=0 docker compose up -d --force-recreate runner
curl -sS http://127.0.0.1:8080/health
```

## Test steps

1. Create a slow valid runner request:

   ```bash
   printf '%s' '{"code":"import time\ndef solution(x):\n    time.sleep(5)\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":8000,"memory_limit_kb":256000}' > /tmp/grindup-perf005-payload.json
   ```

2. Start one slow execution in the background:

   ```bash
   curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: dev-only-runner-secret' --data-binary @/tmp/grindup-perf005-payload.json > /tmp/grindup-perf005-first.out &
   ```

3. While the first request is still running, send a second request:

   ```bash
   curl -i -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: dev-only-runner-secret' --data-binary @/tmp/grindup-perf005-payload.json
   ```

4. Check active executor containers during the burst:

   ```bash
   docker ps --filter ancestor=grindup-executor:latest
   curl -sS -i http://127.0.0.1:8080/health
   wait
   cat /tmp/grindup-perf005-first.out
   ```

5. Restore normal compose defaults:

   ```bash
   docker compose up -d --force-recreate runner
   curl -sS http://127.0.0.1:8080/health
   ```

## Expected result

The second request returns HTTP `429` with `Runner is busy; try again shortly`, active executor containers never exceed `1`, `/health` remains HTTP `200`, and the first request finishes with HTTP `200` and `status:"accepted"`.

## Bad result

The fix failed if more than one `grindup-executor:latest` container is active with `RUNNER_MAX_CONCURRENT_EXECUTIONS=1`, the second request starts another executor instead of returning HTTP 429, the first valid request fails, or `/health` becomes unresponsive.

## Regression checks

- A single normal `/execute` request still succeeds.
- Missing or bad `X-Runner-Token` values are still rejected.
- Runner temp files are still cleaned up after execution.
- The runner is healthy again after restoring normal compose defaults.

## What to tell the AI after testing

If the test passed, say:

`I tested task PERF-005 and approve it.`

If the test failed, say:

`Task PERF-005 failed user testing. Here is what happened: <details>.`
