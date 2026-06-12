## Coverage Evidence

### Areas inspected

- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/homework/submit/route.ts`
- `apps/web/src/lib/html-sanitizer.ts`
- `apps/web/src/components/editor/problem-panel.tsx`
- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`
- `apps/web/src/lib/submission-queue.ts`
- `apps/web/Dockerfile`
- `apps/runner/Dockerfile`
- `apps/runner/executor/Dockerfile`
- `compose.yml`
- `.dockerignore`
- Relevant prior artifacts in `Agents/plan/05-performance.md` and `Agents/patches/*.md`

### Searches and commands run

```bash
git status --short
git diff --stat
find Agents -maxdepth 3 -type f | sort
rg -n "sanitize|sanitizeHtml|MAX_|limit|timeout|queue|docker|Docker|build|image|submission|execute|scrape|import" apps packages docker compose.yml .dockerignore turbo.json apps/web/Dockerfile apps/runner/Dockerfile apps/runner/executor/Dockerfile
rg -n "Semaphore|CapacityLimiter|limit_concurrency|--limit-concurrency|UVICORN|workers|THREAD|MAX|RUNNER" apps/runner compose.yml apps/runner/Dockerfile apps/web/src/app/api/execute/route.ts .env.example README.md REVIEWER_RUN_GUIDE.md
rg -n "run_in_threadpool|containers\.run|container\.remove|formData\(|arrayBuffer\(|sanitizeProblemHtml|getNextJob|FOR UPDATE SKIP LOCKED|COPY --from=builder|pnpm --filter @grindup/web build|RUNNER_SHARED_SECRET|RUNNER_EXECUTOR_IMAGE" apps/runner apps/web compose.yml apps/web/Dockerfile apps/runner/Dockerfile apps/runner/executor/Dockerfile .dockerignore
python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py
docker compose config
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
```

### Code paths traced

- Multipart import/homework upload -> `Content-Length` preflight -> `request.formData()` -> file size/type validation -> `arrayBuffer()` -> parser/OCR/OpenAI caps.
- Problem scrape job -> Bearer secret gate -> LeetCode detail loop -> `sanitizeProblemHtml` -> testcase extraction, Postgres write, embedding text, ClickHouse insert.
- Problem render -> `ProblemPanel` -> `useMemo` -> `sanitizeProblemHtml` -> `dangerouslySetInnerHTML`.
- Web execute route -> authenticated `/api/execute` -> runner token header -> runner `/execute` -> `run_in_threadpool` -> Docker SDK container lifecycle -> cleanup `finally`.
- Queue worker claim -> `getNextJob()` -> single raw `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING`.
- Compose/build -> executor image service -> runner image/socket mount -> web image build/start command.

### Tests reviewed

- Existing validation evidence in patch notes for `VAL-001`, `VAL-003`, `DB-003`, `REL-001`, `REL-002`, `SEC-001`, `SEC-002`, and `COMPAT-001`.
- No runner load/concurrency test, upload parser memory test, sanitizer benchmark, queue concurrency integration test, or Docker image size/build-time benchmark found.

### Domain exclusions

- SQL index choice and raw-query correctness are left to Database Agent.
- Authz, XSS policy correctness, MIME validation correctness, and Docker sandbox security are left to Security and Validation/Sanitisation agents.
- Container cleanup correctness and operational failure handling are left to Reliability Agent.

## Performance Risk Assessment

Upload validation now rejects declared oversized multipart bodies before `formData()` and rejects oversized/unsupported files again before `arrayBuffer()`, so the fixes reduce parser/OCR/OpenAI/database work for normal oversized uploads. Known limitation to document: requests without a truthful `Content-Length` still reach the framework multipart parser before `File.size` can be checked; route-level checks remain a backstop before extraction, not a full streaming body limit.

HTML sanitization is memoized in the render path and also applied once per scraped problem before storage/embedding; this adds CPU proportional to problem statement size but did not introduce repeated render work. Queue claiming uses one atomic SQL statement and does not add application-level polling or loops. Docker build changes are directionally positive for executor size (`--no-install-recommends`, fewer packages), while the web runtime image still copies the full built workspace and should be benchmarked separately if image size/startup becomes a release gate.

## Finding PERF-005: Runner offload can fan out unbounded Docker containers

**Severity:** High  
**Confidence:** High  
**Agent:** Performance Agent - Latency Hawk  
**Scope:** Docker runner offloading and execution concurrency

### Files involved

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`
- `compose.yml`

### Problem

The event-loop fix moved synchronous Docker execution into Starlette's threadpool, but the runner has no explicit concurrency cap before `containers.run`. A burst of authenticated `/api/execute` requests can now create many executor containers in parallel, consuming CPU, memory, Docker daemon capacity, and host disk I/O.

### Proof example

Start the compose stack, then send 40 valid `POST /execute` requests with `X-Runner-Token` in parallel and run `docker ps --filter ancestor=grindup-executor:latest`; many executor containers can be active at once instead of a configured small maximum.

### Current behaviour

Each accepted runner request reaches `run_in_threadpool`, and each thread can call `docker_service.run_code` and `self.client.containers.run` without a runner-local semaphore or queue.

### Expected behaviour

The runner should enforce a documented maximum number of concurrent executor containers and reject or queue excess work with predictable latency.

### Evidence

`apps/runner/main.py:123-130` offloads every execution with `run_in_threadpool(...)`. `apps/runner/services/docker_service.py:46-57` starts a Docker container for each call. `compose.yml:75-90` configures the runner service and executor image, but no `RUNNER_MAX_CONCURRENT_EXECUTIONS`, semaphore, worker limit, or compose resource cap is present.

### Fix location

`apps/runner/main.py`, `execute_code`, around lines 95-130; optionally `compose.yml` runner environment around lines 80-84.

### What to change

Add a runner-level concurrency limiter around the `run_in_threadpool` call, backed by an env var such as `RUNNER_MAX_CONCURRENT_EXECUTIONS`; when the limiter is saturated, either wait for a bounded time or return `429`/`503` before creating a Docker container. Document the default limit and tune it below host memory capacity.

### Expected result after fix

Rerunning the parallel proof shows no more than the configured number of `grindup-executor:latest` containers active at a time, and excess requests return a clear backpressure response or wait within the configured bound.

### Test gap

No runner concurrency/load test asserts max active executor containers or backpressure behavior after Docker work was offloaded from the event loop.

### Backwards compatibility risk

Medium, because high parallel execution bursts may receive backpressure instead of all starting immediately; normal single-run editor execution is unaffected.

### Patch priority

High

### Suggested commit message

`Limit concurrent runner Docker executions`

## Readiness Verdict

Not ready from a performance perspective until `PERF-005` is fixed or explicitly accepted as a documented operational limitation with a safe deployment cap. All other requested surfaces were re-audited with no new concrete performance regressions found.
