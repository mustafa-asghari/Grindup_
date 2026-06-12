# Final Review: Reliability Agent - Production SRE

## Coverage Evidence

### Areas inspected

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`
- `apps/runner/handlers/python_handler.py`
- `apps/runner/handlers/base_handler.py`
- `apps/runner/Dockerfile`
- `apps/runner/executor/Dockerfile`
- `apps/web/src/app/api/execute/route.ts`
- `compose.yml`
- `docker/compose.yml`
- `Agents/plan/04-reliability.md`
- `Agents/patches/REL-001*.md`
- `Agents/patches/REL-002*.md`
- `Agents/stat.json`

### Searches and commands run

```bash
sed -n '1,220p' /Users/mustafaasghari/.codex/skills/review-skill/SKILL.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-skill.md
sed -n '1,240p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/04-reliability-agent.md
sed -n '1,220p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/finding-format.md
rg --files -g 'AGENTS.md' -g 'Agents/**'
git status --short
sed -n '1,260p' Agents/plan/04-reliability.md
sed -n '1,260p' Agents/stat.json
rg -n 'REL-00[12]|runner|Docker|compose|cleanup|threadpool|to_thread|health|container|timeout' Agents/stat.json Agents/patches/REL-001.md Agents/patches/REL-001-specialist-eval.md Agents/patches/REL-001-eval.md Agents/patches/REL-001-user-test.md Agents/patches/REL-002.md Agents/patches/REL-002-specialist-eval.md Agents/patches/REL-002-eval.md Agents/patches/REL-002-user-test.md Agents/README.md
nl -ba apps/runner/services/docker_service.py | sed -n '1,260p'
nl -ba apps/runner/main.py | sed -n '1,260p'
nl -ba compose.yml | sed -n '1,240p'
nl -ba docker/compose.yml | sed -n '1,240p'
nl -ba apps/runner/Dockerfile | sed -n '1,220p'
nl -ba apps/runner/executor/Dockerfile | sed -n '1,220p'
rg -n 'RUNNER_URL|RUNNER_SHARED_SECRET|runnerResponse|AbortController|fetch\(|x-runner-token|RUNNER_EXECUTOR_IMAGE|tempfile|volumes=|/var/run/docker.sock|grindup-executor|executor-image|run_in_threadpool|to_thread|time\.sleep|container\.remove|container\.kill' apps/runner apps/web/src/app/api/execute compose.yml docker/compose.yml apps/runner/Dockerfile .env.example README.md REVIEWER_RUN_GUIDE.md
nl -ba apps/web/src/app/api/execute/route.ts | sed -n '1,260p'
docker compose config
python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py
python3 -m json.tool Agents/stat.json >/dev/null
docker info --format '{{.ServerVersion}}'
docker compose ps --format json
git diff -- apps/runner/main.py apps/runner/services/docker_service.py compose.yml apps/runner/Dockerfile apps/runner/executor/Dockerfile apps/web/src/app/api/execute/route.ts | sed -n '1,260p'
curl -sS -i -m 15 -X POST http://127.0.0.1:8080/execute -H 'Content-Type: application/json' -H 'X-Runner-Token: dev-only-runner-secret' --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

### Code paths traced

- Web `POST /api/execute` -> `RUNNER_URL` -> runner `POST /execute` -> `run_in_threadpool` -> `DockerService.run_code` -> executor container lifecycle.
- Runner timeout path -> `container.kill()` -> return tuple -> `finally` cleanup with `container.remove(force=True)` -> temp directory cleanup.
- Compose runner startup -> mounted Docker socket -> sibling executor container bind mount from `tempfile.mkdtemp()` path.

### Tests reviewed

- No automated runner cleanup, runner concurrency, or compose execution tests found.
- Runtime smoke check against the current compose runner was performed and failed for compose execution; see REL-005.

### Domain exclusions

- Runner authentication and exposed port hardening are left to Security except where they affect reliability.
- Web request input validation and response data shape are left to Validation and Compatibility unless they create an operational failure.

## Per-Task Fixed-Status Assessment

- `REL-001` fixed in source. `DockerService.run_code` now tracks `container` and removes it with `container.remove(force=True)` in `finally` after success, timeout, and post-create exceptions; timeout still returns `("", "Time Limit Exceeded (<limit>ms)", <limit>)`.
- `REL-002` fixed in source. `apps/runner/main.py` imports `run_in_threadpool` and awaits `docker_service.run_code` through it, so Docker SDK calls and `time.sleep()` polling no longer run inline on the FastAPI event loop.
- Docker/compose runner behavior is not ready. The current compose runner is healthy, but actual `/execute` fails because executor containers cannot see the temp files created inside the runner container; see REL-005.

## Remaining Reliability Risks

- No regression tests cover timeout cleanup, event-loop responsiveness, or full-stack compose execution.
- `REL-002` intentionally enables concurrent Docker executions through Starlette's threadpool, but there is still no explicit runner-side concurrency cap.
- Existing `REL-003` remains visible in `apps/web/src/app/api/execute/route.ts`: the web route still does not abort hung runner calls with an `AbortController` deadline.

## Finding REL-005: Compose runner launches executor containers without shared execution files

**Severity:** High  
**Confidence:** High  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Docker/compose runner behavior

### Files involved

- `compose.yml`
- `apps/runner/services/docker_service.py`
- `apps/runner/Dockerfile`

### Problem

The compose runner mounts only `/var/run/docker.sock`, then `DockerService.run_code` creates source files in a runner-container temp directory and asks the Docker daemon to bind-mount that path into a sibling executor container. The Docker daemon resolves the bind source outside the runner container, so the executor starts without `main.py` and every compose `/execute` request fails.

### Proof example

```bash
curl -sS -i -m 15 -X POST http://127.0.0.1:8080/execute \
  -H 'Content-Type: application/json' \
  -H 'X-Runner-Token: dev-only-runner-secret' \
  --data '{"code":"def solution(x):\n    return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

Observed response:

```json
{"status":"error","test_results":[],"runtime_ms":596,"memory_kb":0,"error":"python3: can't open file '/app/main.py': [Errno 2] No such file or directory\n"}
```

### Current behaviour

The runner container reports healthy, but real code execution through compose returns an execution error before user code can run.

### Expected behaviour

Compose `/execute` should make the generated source file visible at `/app/main.py` inside the executor container and return normal test results.

### Evidence

`apps/runner/services/docker_service.py:24` creates `temp_dir` with `tempfile.mkdtemp()` inside the runner container, and `apps/runner/services/docker_service.py:49` passes that path as a Docker bind mount. `compose.yml:85-86` mounts only the Docker socket into the runner and does not mount a shared host work directory for executor input files.

### Fix location

`compose.yml`, runner service volumes/environment around lines 80-86, and `apps/runner/services/docker_service.py`, `DockerService.run_code`, around lines 23-50.

### What to change

Use a host-visible execution work directory shared with the runner container, for example mount a host path or named bind directory into the runner at a fixed path and configure `DockerService` to create temp dirs under that path while passing the corresponding host path to the Docker daemon. Alternatively, replace bind mounts with Docker volumes or archive-copy files into the executor container before start.

### Expected result after fix

Rerun the proof curl; the response contains `status:"accepted"` with one passing test result instead of `can't open file '/app/main.py'`.

### Test gap

No compose smoke test calls runner `/execute` and asserts a simple accepted result.

### Backwards compatibility risk

Medium, because the fix changes executor file staging and must preserve host-direct runner execution as well as compose execution.

### Patch priority

High

### Suggested commit message

`Fix compose runner executor file mounts`

## Readiness Verdict

Not ready for production or full-stack Docker validation. `REL-001` and `REL-002` stayed fixed in the application source, but the compose runner path has a high-confidence execution failure that blocks normal code runs, and the runner still lacks automated reliability regression coverage.
