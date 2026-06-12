# Eval Report: SEC-001

## Verdict

Needs user testing

## What changed

`/api/execute` now requires `session.user.id` before parsing request JSON or dispatching to the runner. The web service sends `X-Runner-Token` when `RUNNER_SHARED_SECRET` is configured, the FastAPI runner rejects missing or invalid tokens for `POST /execute`, and the full Docker compose stack wires a development placeholder secret into both services while binding runner host access to `127.0.0.1`.

## Does this fix the root cause?

Yes. The Security specialist eval passed in `Agents/patches/SEC-001-specialist-eval.md` and confirmed that anonymous web execution and unsigned direct runner execution are blocked before Docker work.

## Scope check

The patch stayed inside SEC-001 scope: execution API auth, runner token enforcement, compose/env wiring, and documentation for local review. It did not attempt to fix runner input-limit validation, event-loop blocking, container cleanup, or unrelated authorization findings.

## Backwards compatibility check

Authenticated editor execution keeps the existing request and response flow. Direct local `/execute` calls now require `X-Runner-Token` when `RUNNER_SHARED_SECRET` is set; `/health` remains available without a token.

## Validation commands

```bash
python3 -m py_compile apps/runner/main.py
docker compose config
python3 -m json.tool Agents/stat.json
git diff --check
docker compose up --build -d
curl -i -sS -X POST http://localhost:8080/execute -H 'Content-Type: application/json' --data '{"code":"def solution(x): return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
curl -i -sS -X POST http://localhost:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: wrong-token' --data '{"code":"def solution(x): return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
curl -i -sS http://localhost:8080/health
curl -i -sS -X POST http://localhost:3000/api/execute
pnpm --filter @grindup/web lint
```

## Validation results

- `python3 -m py_compile apps/runner/main.py`: pass.
- `docker compose config`: pass; runner is bound to `127.0.0.1:8080` and both `web` and `runner` receive `RUNNER_SHARED_SECRET`.
- `python3 -m json.tool Agents/stat.json`: pass.
- `git diff --check`: pass.
- `docker compose up --build -d`: pass; images rebuilt and stack started.
- Direct runner proof without token: pass, returned `401 {"detail":"Missing runner token"}`.
- Direct runner proof with invalid token: pass, returned `403 {"detail":"Invalid runner token"}`.
- Runner `/health`: pass, returned `200 {"status":"healthy","service":"runner"}`.
- Unauthenticated web `POST /api/execute`: pass, returned `401 {"error":"Unauthorized"}`.
- `pnpm --filter @grindup/web lint`: fail due existing app-wide lint debt, including `no-explicit-any`, React hook purity/effect rules, and unescaped entity errors across unrelated files. The lint failure is not specific to SEC-001.

## Decision

Move `SEC-001` to `needs_user_test`. User approval is still required by the review-skill workflow before this task can be marked `approved`.
