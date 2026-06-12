# Eval Report: REL-005

## Verdict

Needs user testing

## What changed

`DockerService` now creates execution temp directories under an optional shared runner workdir and passes the matching host-visible path to Docker for executor bind mounts. `compose.yml` configures `/tmp/grindup-runner-work` as both the runner-visible workdir and host-visible bind source.

## Does this fix the root cause?

Yes. The specialist eval in `Agents/patches/REL-005-specialist-eval.md` exists and passed. The proof curl now returns `status:"accepted"` with one passing visible test instead of `python3: can't open file '/app/main.py'`.

## Scope check

Pass. The patch is limited to the REL-005 application/config surface (`apps/runner/services/docker_service.py`, `compose.yml`) plus audit files. The worktree contains unrelated prior audit changes, but they are outside this task's patch scope and were not modified by this supervisor pass.

## Backwards compatibility check

Pass. When `RUNNER_EXECUTION_WORKDIR` and `RUNNER_EXECUTION_HOST_DIR` are unset, `_create_execution_temp_dir()` returns the same temp path for runner writes and Docker bind source, preserving host-direct behavior. Compose mode renders matching `RUNNER_EXECUTION_WORKDIR`, `RUNNER_EXECUTION_HOST_DIR`, and `/tmp/grindup-runner-work:/tmp/grindup-runner-work`. Runner token/auth behavior remains unchanged, REL-001 container/temp cleanup remains in `finally`, and PERF-005 concurrency remains a separate queued task.

## Test check

No automated compose smoke test was added for this task. Required manual validation and live proof checks passed; user testing is still required before approval.

## Commands run

```bash
python3 -m py_compile apps/runner/services/docker_service.py apps/runner/main.py
docker compose config
curl -sS -i -m 15 -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: dev-only-runner-secret' --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
python3 -m json.tool Agents/stat.json >/dev/null
curl -sS -i -m 5 http://127.0.0.1:8080/health
curl -sS -i -m 10 -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
curl -sS -i -m 10 -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: bad-token' --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
find /tmp/grindup-runner-work -mindepth 1 -maxdepth 1 -type d -name 'grindup_run_*' -print 2>/dev/null | sort
```

## Command results

Passed. `py_compile`, `docker compose config`, and `Agents/stat.json` JSON validation exited 0. The proof curl returned HTTP 200 with `status:"accepted"` and test `t1` passing. `/health` returned HTTP 200 healthy. Missing token returned HTTP 401, bad token returned HTTP 403, and no `grindup_run_*` temp directories remained under `/tmp/grindup-runner-work` after completion.

## Risks remaining

No automated regression test covers compose `/execute`. PERF-005 remains queued for runner-side concurrency limits and is not part of this task.

## Eval decision

Mark task `needs_user_test`. Do not mark approved until the user runs the manual test and says `I tested task REL-005 and approve it.`

## Suggested commit message

Fix compose runner executor file mounts
