# User Test Instructions: REL-005

## What was fixed

Compose runner execution now stages generated files in a runner/host shared work directory so sibling executor containers can read `/app/main.py`.

## Where to test

- API endpoint: `POST http://127.0.0.1:8080/execute`
- Health endpoint: `GET http://127.0.0.1:8080/health`
- Compose service: `runner`

## Setup needed

Run either:

```bash
docker compose up --build -d runner
```

or the full stack equivalent:

```bash
docker compose up --build -d
```

## Test steps

1. Check runner health:

```bash
curl -sS -i -m 5 http://127.0.0.1:8080/health
```

2. Run the proof request with the expected token:

```bash
curl -sS -i -m 15 -X POST http://127.0.0.1:8080/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: dev-only-runner-secret' \
  --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

3. Verify missing-token rejection:

```bash
curl -sS -i -m 10 -X POST http://127.0.0.1:8080/execute \
  -H 'Content-Type: application/json' \
  --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

4. Verify bad-token rejection:

```bash
curl -sS -i -m 10 -X POST http://127.0.0.1:8080/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: bad-token' \
  --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

5. Check that execution temp directories were removed:

```bash
find /tmp/grindup-runner-work -mindepth 1 -maxdepth 1 -type d -name 'grindup_run_*' -print
```

## Expected result

Health returns HTTP 200 with `{"status":"healthy","service":"runner"}`. The proof request returns HTTP 200 with `status:"accepted"` and visible test `t1` passing.

## Bad result

The fix failed if the proof request returns `python3: can't open file '/app/main.py'`, any non-accepted execution status for the valid request, or leftover `grindup_run_*` directories under `/tmp/grindup-runner-work` after completion.

## Regression checks

- Missing token is rejected with HTTP 401.
- Bad token is rejected with HTTP 403.
- No temp dirs remain under `/tmp/grindup-runner-work` after completion.
- Runner health remains healthy after the proof request.

## What to tell the AI after testing

If the test passed, say:

`I tested task REL-005 and approve it.`

If the test failed, say:

`Task REL-005 failed user testing. Here is what happened: <details>.`
