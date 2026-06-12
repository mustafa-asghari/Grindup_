# User Test Instructions: SEC-001

## Where to test

- Web app: `http://localhost:3000`
- Runner health/direct checks: `http://localhost:8080`

## Setup

```bash
docker compose up --build -d
```

## Test steps

1. Confirm the stack is healthy:

```bash
docker compose ps
curl -i http://localhost:8080/health
```

Expected: runner is healthy and `/health` returns `200`.

2. Confirm direct runner execution is blocked without the shared token:

```bash
curl -i -X POST http://localhost:8080/execute \
  -H 'Content-Type: application/json' \
  --data '{"code":"def solution(x): return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

Expected: `401 Unauthorized` with `{"detail":"Missing runner token"}`.

3. Confirm direct runner execution is blocked with a bad token:

```bash
curl -i -X POST http://localhost:8080/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: wrong-token' \
  --data '{"code":"def solution(x): return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

Expected: `403 Forbidden` with `{"detail":"Invalid runner token"}`.

4. Confirm anonymous web execution is blocked:

```bash
curl -i -X POST http://localhost:3000/api/execute
```

Expected: `401 Unauthorized` with `{"error":"Unauthorized"}`.

5. Log in through the web app and run a coding problem from the editor.

Expected: the authenticated editor flow still submits through the web service and receives runner feedback.

## Regression checks

- No submission row should be created for unauthenticated `/api/execute`.
- Runner `/health` should stay public for Compose health checks.
- Direct local `/execute` calls require `X-Runner-Token` when `RUNNER_SHARED_SECRET` is set.

## Approval

After manual testing, say: `I tested task SEC-001 and approve it.`
