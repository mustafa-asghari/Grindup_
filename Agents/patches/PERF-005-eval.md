# Eval Report: PERF-005

## Verdict

Needs user testing.

## What changed

`apps/runner/main.py` now gates Docker execution behind a runner-local `asyncio.Semaphore` configured by `RUNNER_MAX_CONCURRENT_EXECUTIONS`, with `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS` controlling bounded wait behavior. `compose.yml`, `.env.example`, and `apps/runner/README.md` document/configure the new runner limit.

## Does this fix the root cause?

Yes. The specialist eval passed in `Agents/patches/PERF-005-specialist-eval.md`, and the runtime proof showed executor containers capped before `docker_service.run_code` can create additional Docker containers.

## Scope check

Pass. The PERF-005 work is scoped to the runner Docker execution boundary and the configuration/docs needed to operate it. The broader worktree contains earlier review-skill changes, but this supervisor pass reviewed only the PERF-005 patch surface and did not evaluate unrelated tasks.

## Backwards compatibility check

Pass with intended behavior change. A single runner execution still returns HTTP 200 with normal results; bursts above the configured capacity now receive HTTP 429 instead of starting unbounded executor containers.

## Test check

Pass for workflow readiness. No automated Docker concurrency regression test was added, so manual user testing is still required; supervisor reran static checks and a one-slot runtime proof.

## Commands run

```bash
python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py
docker compose config
RUNNER_MAX_CONCURRENT_EXECUTIONS=1 RUNNER_EXECUTION_QUEUE_TIMEOUT_MS=0 docker compose up -d --force-recreate runner
curl -sS http://127.0.0.1:8080/health
# Sent two concurrent authenticated POST /execute requests with sleeping Python code.
docker ps --filter ancestor=grindup-executor:latest
docker compose up -d --force-recreate runner
```

## Command results

Passed.

- Python compile passed.
- Compose config passed.
- Runtime proof passed: initial active executor containers `0`, max active executor containers `1`, overflow request HTTP `429`, health during burst HTTP `200`, first execution HTTP `200`, final active executor containers `0`, runner restored healthy with HTTP `200`.
- During restore one transient health curl saw an empty reply while the container was restarting; the final restored health check was HTTP `200`.

## Risks remaining

The concurrency cap is process-local. If the runner is later deployed with multiple Python worker processes or multiple runner replicas, the effective total cap is per process/replica unless an external queue or distributed limiter is added.

## Eval decision

Mark task `needs_user_test`. Do not mark approved until the user explicitly tests and approves PERF-005.

## Suggested commit message

Limit concurrent runner Docker executions
