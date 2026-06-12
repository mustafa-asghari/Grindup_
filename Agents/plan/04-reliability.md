# Reliability Agent - Production SRE

## Coverage Evidence

### Areas inspected

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`
- `apps/runner/handlers/*.py`
- `apps/web/src/app/api/execute/route.ts`
- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/homework/*/route.ts`
- `apps/web/src/app/api/topics/generate*.ts`
- `apps/web/src/app/api/tutor*.ts`
- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/web/src/lib/openai.ts`
- `apps/web/src/lib/clickhouse.ts`
- `apps/web/src/lib/submission-queue.ts`
- `apps/web/src/hooks/*`
- `packages/db/prisma/schema.prisma`
- `compose.yml`, `.env.example`, `apps/web/Dockerfile`, `apps/runner/Dockerfile`

### Searches and commands run

```bash
rg --files -g 'SKILL.md' -g 'review-skill.md' -g 'AGENTS.md' -g 'finding-format.md' -g '04-reliability-agent.md' -g 'package.json'
find /Users/mustafaasghari/.codex/skills/review-skill -maxdepth 3 -type f | sort
rg -n 'process\.env|setInterval|setTimeout|fetch\(|Promise\.|catch\s*\(|try\s*\{|AbortController|timeout|async |await ' apps packages package.json pnpm-workspace.yaml turbo.json compose.yml docker/compose.yml start-dev.sh .env.example
rg -n 'AbortController|AbortSignal|signal:|timeout|runnerResponse|RUNNER_URL|fetch\(' apps/web/src/app/api/execute/route.ts apps/web/src/app/api apps/web/src/lib apps/runner
rg -n 'container\.|run_code\(|time\.sleep|async def execute_code|container\.remove|container\.kill|finally' apps/runner/main.py apps/runner/services/docker_service.py
find . -path './node_modules' -prune -o -path './.git' -prune -o -type f \( -name '*.test.*' -o -name '*.spec.*' -o -name 'pytest.ini' -o -name 'conftest.py' -o -name 'vitest.config.*' -o -name 'jest.config.*' -o -name 'playwright.config.*' \) -print | sort
```

### Code paths traced

- Browser editor -> `POST /api/execute` -> `RUNNER_URL /execute` -> FastAPI `execute_code` -> Docker SDK container lifecycle.
- Runner timeout path -> `container.kill()` -> early return -> temp directory cleanup.
- Import PDF fallback -> OpenAI file upload -> OpenAI chat extraction -> file deletion.
- Submission queue worker path -> `getNextJob()` transaction -> `submissionJobs` state transition.
- Client polling/timer hooks -> interval/listener setup -> cleanup callbacks.

### Tests reviewed

- No relevant test files or test configs found outside `node_modules`.

### Domain exclusions

- Auth, authorization, CSRF, input validation, and SQL/data-model correctness are left to the Security, Validation and Sanitisation, and Database agents unless they directly create a production failure path.

## Finding REL-001: Timed-out runner containers are killed but never removed

**Severity:** High  
**Confidence:** High  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Runner cleanup/resource leaks

### Files involved

- `apps/runner/services/docker_service.py`

### Problem

`DockerService.run_code` returns immediately after `container.kill()` on timeout, so the later `container.remove()` call is skipped. Every TLE leaves a killed container behind until an external Docker cleanup removes it.

### Proof example

Run the runner, submit an infinite loop with `time_limit_ms: 100`, then run `docker ps -a --filter ancestor=grindup-executor --filter status=exited`; the timed-out execution remains as an exited container.

### Current behaviour

Timed-out submissions return `Time Limit Exceeded`, but stopped containers accumulate on the host.

### Expected behaviour

Every execution container is removed whether the run succeeds, fails, or times out.

### Evidence

`apps/runner/services/docker_service.py`, `run_code`, lines 68-82: timeout kills and returns at lines 69-71 before the success-path `container.remove()` at line 82.

### Fix location

`apps/runner/services/docker_service.py`, `DockerService.run_code`, around lines 44-84.

### What to change

Track `container` outside the inner `try` and move removal into a `finally` that calls `container.remove(force=True)` after kill/error/success; keep `shutil.rmtree(temp_dir)` in the outer `finally`.

### Expected result after fix

Rerun the timeout proof; `docker ps -a --filter ancestor=grindup-executor --filter status=exited` does not show a new leftover container from the timed-out request.

### Test gap

No runner test covers timeout cleanup or asserts `remove(force=True)` is called after `container.kill()`.

### Backwards compatibility risk

Low, because the change only cleans up per-request containers after the result is already known.

### Patch priority

High

### Suggested commit message

`Fix runner container cleanup on timeout`

## Finding REL-002: Runner execute handler blocks the event loop during Docker work

**Severity:** High  
**Confidence:** High  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Async request paths

### Files involved

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`

### Problem

FastAPI declares `execute_code` as `async`, but it calls synchronous Docker SDK operations and `time.sleep()` inline. While a submission is running, the event loop is blocked, delaying `/health` and other requests on that worker.

### Proof example

Start one long-running `POST /execute` request with code that loops until the time limit, then immediately run `time curl -s http://localhost:8080/health`; the health request waits behind the blocking Docker loop instead of returning immediately.

### Current behaviour

One slow or stuck execution can make unrelated runner requests appear unavailable until the blocking path exits.

### Expected behaviour

Docker execution runs off the event loop, so health checks and concurrent requests remain responsive.

### Evidence

`apps/runner/main.py`, `execute_code`, lines 69-103 calls `docker_service.run_code` directly. `apps/runner/services/docker_service.py`, `run_code`, lines 68-75 polls the container with `time.sleep(step)` and Docker SDK reload calls.

### Fix location

`apps/runner/main.py`, `execute_code`, around lines 96-103, and optionally `apps/runner/services/docker_service.py` if concurrency limits are added.

### What to change

Run `docker_service.run_code` in a worker thread via `starlette.concurrency.run_in_threadpool` or `asyncio.to_thread`, and add an explicit per-run concurrency guard if the host must cap simultaneous containers.

### Expected result after fix

Rerun the proof; `/health` responds quickly while the long `/execute` request is still running.

### Test gap

No async/concurrency test asserts that `/health` remains responsive during an active execution.

### Backwards compatibility risk

Medium, because concurrent execution changes runner scheduling and should be paired with a container concurrency limit.

### Patch priority

High

### Suggested commit message

`Move runner Docker execution off the event loop`

## Finding REL-003: Web execute route has no runner timeout or response status handling

**Severity:** Medium  
**Confidence:** High  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Cross-service request failure handling

### Files involved

- `apps/web/src/app/api/execute/route.ts`

### Problem

`POST /api/execute` waits on `fetch(`${runnerUrl}/execute`)` without an abort deadline and parses JSON without checking `runnerResponse.ok`. A hung runner pins the API request, and non-2xx runner responses can be treated as normal result payloads.

### Proof example

Run `RUNNER_URL=http://10.255.255.1:8080 pnpm --filter @grindup/web dev`, submit code from the editor, and watch `POST /api/execute` remain pending until the platform/network timeout instead of failing on an app-controlled deadline.

### Current behaviour

The request can hang for an unbounded period from the application's perspective, and runner HTTP errors are not converted into a clear failed execution response.

### Expected behaviour

The route aborts runner calls after a configured deadline and returns a non-2xx error response when the runner is unavailable or returns a non-2xx status.

### Evidence

`apps/web/src/app/api/execute/route.ts`, `POST`, lines 110-123: `fetch` has no `signal`, timeout, or `runnerResponse.ok` check before `runnerResponse.json()`.

### Fix location

`apps/web/src/app/api/execute/route.ts`, runner call in `POST`, around lines 110-124.

### What to change

Create an `AbortController` with a deadline slightly above `time_limit_ms`, pass `signal` to `fetch`, clear the timer in `finally`, check `runnerResponse.ok`, and return a 502/504 style JSON response while marking any created submission as `error`.

### Expected result after fix

Rerun the proof with an unreachable `RUNNER_URL`; `POST /api/execute` fails quickly with the configured timeout response and the submission is marked `error`.

### Test gap

No route test mocks a hung runner, a non-JSON runner response, or a non-2xx runner response.

### Backwards compatibility risk

Low, because successful runner responses keep the same response shape.

### Patch priority

Medium

### Suggested commit message

`Add timeout and status handling to execute runner calls`

## Finding REL-004: Queue job claim can hand the same job to concurrent workers

**Severity:** Medium  
**Confidence:** Medium  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Async job paths

### Files involved

- `apps/web/src/lib/submission-queue.ts`
- `packages/db/prisma/schema.prisma`

### Problem

`getNextJob` selects the next queued row and then updates it by `id` only. Two workers can select the same queued job before either commits; the second update still succeeds after the first commit because it does not require `status: queued`.

### Proof example

Seed one `submission_jobs` row with `status='queued'`, then run `await Promise.all([getNextJob(), getNextJob()])` from two worker contexts; both calls can return the same job id under concurrent execution.

### Current behaviour

Concurrent workers can duplicate process the same submission and increment attempts twice.

### Expected behaviour

Only one worker can claim a queued job; the losing worker receives `null` or claims a different queued job.

### Evidence

`apps/web/src/lib/submission-queue.ts`, `getNextJob`, lines 50-75 performs `findFirst` then `update({ where: { id: nextJob.id } })`. `packages/db/prisma/schema.prisma`, `SubmissionJobs`, lines 940-958 has indexes but no claim token or atomic state transition constraint.

### Fix location

`apps/web/src/lib/submission-queue.ts`, `getNextJob`, around lines 49-75.

### What to change

Use an atomic claim such as `UPDATE ... WHERE id = $id AND status = 'queued' RETURNING *`, or a Postgres `FOR UPDATE SKIP LOCKED` transaction; if the guarded update affects zero rows, retry or return `null`.

### Expected result after fix

Rerun the concurrent proof; only one call returns the seeded job id.

### Test gap

No job queue concurrency test exercises two simultaneous workers claiming the same queued row.

### Backwards compatibility risk

Medium, because worker scheduling semantics change under contention, but single-worker behavior is unchanged.

### Patch priority

Medium

### Suggested commit message

`Make submission job claims atomic`

## Finding REL-005: OpenAI uploaded PDFs are not deleted if extraction fails after upload

**Severity:** Medium  
**Confidence:** High  
**Agent:** Reliability Agent - Production SRE  
**Scope:** Cleanup/resource leaks

### Files involved

- `apps/web/src/app/api/import/route.ts`

### Problem

The PDF import fallback uploads a file to OpenAI and deletes it only after `openai.chat.completions.create` succeeds. If the chat extraction call throws after upload, the catch logs the error and skips deletion.

### Proof example

Mock `openai.files.create` to return `{ id: 'file_test' }`, mock `openai.chat.completions.create` to throw, call `extractPdfText`, and assert `openai.files.delete('file_test')` was not called.

### Current behaviour

Uploaded files can remain in the OpenAI account after transient extraction failures.

### Expected behaviour

Uploaded files are deleted in a cleanup path regardless of extraction success or failure.

### Evidence

`apps/web/src/app/api/import/route.ts`, `extractPdfText`, lines 255-264 uploads the file and starts chat extraction; deletion occurs only on the success path at lines 299-304, while the catch at lines 313-315 has no cleanup.

### Fix location

`apps/web/src/app/api/import/route.ts`, `extractPdfText`, OpenAI File Upload API fallback around lines 249-315.

### What to change

Declare `let uploadedFileId: string | undefined` before the try, assign it immediately after upload, and delete it in a `finally` block when set; keep deletion errors logged without masking the original extraction failure.

### Expected result after fix

Rerun the mocked proof; `openai.files.delete('file_test')` is called even when chat extraction throws.

### Test gap

No import cleanup test covers OpenAI upload success followed by extraction failure.

### Backwards compatibility risk

Low, because the user-visible import behavior stays the same while leaked remote files are cleaned up.

### Patch priority

Medium

### Suggested commit message

`Clean up OpenAI PDF uploads on extraction failure`
