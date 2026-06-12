## Coverage Evidence

### Areas inspected

- `apps/web/src/app/**` route pages and API routes for user actions, generation flows, problem sync, notifications, execute, homework, topics, social, and import paths.
- `apps/web/src/components/**` client components and hooks for polling, duplicate fetches, route refreshes, expensive render work, and debounce/throttle gaps.
- `apps/runner/main.py`, `apps/runner/services/docker_service.py`, and runner handlers for submission execution latency and blocking work.
- `start-dev.sh`, `package.json`, `apps/web/package.json`, `apps/runner/package.json`, `turbo.json`, and `apps/web/next.config.ts` for startup/build behavior.

### Searches and commands run

```bash
rg --files
rg -n "fetch\(|axios|useEffect\(|setInterval\(|setTimeout\(|router\.refresh|revalidate|cache:|next:|useSWR|react-query|debounce|throttle" apps/web/src apps/runner packages -g '*.{ts,tsx,js,jsx,py}'
rg -n "Promise\.all|await .*find|for .*await|for \(|map\(async|JSON\.stringify|readFileSync|execSync|spawnSync|writeFileSync|fs\." apps/web/src apps/runner packages -g '*.{ts,tsx,js,jsx,py}'
rg --files -g '*test*' -g '*spec*' apps packages
rg -n "problems/count|problems/scrape|SyncProblemsButton|ProblemsListClient|notifications|use-live-stats|study-time-tracker" apps/web/src apps/web -g '*.{test,spec}.{ts,tsx,js,jsx}' -g '*.test.ts' -g '*.spec.ts'
rg -n "generate-quiz|generate content|isGeneratingContent|Generate" apps/web/src/components/subjects/topic-view-client.tsx
```

### Code paths traced

- Browser `/problems` -> `SyncProblemsButton` / `ProblemsListClient` -> `/api/problems/count` and `/api/problems/scrape`.
- Browser subject topic -> `TopicViewClient.handleGenerateContent` and auto activity effect -> `/api/topics/generate-quiz` -> OpenAI chat completion.
- Browser problem runner -> `/api/execute` -> runner `/execute` -> Docker SDK execution loop.
- Build/startup scripts -> `turbo build`, `next build`, `start-dev.sh`, runner startup.

### Tests reviewed

- No relevant test or spec files were present for polling, topic generation, problem sync, runner concurrency, or startup timing.

### Domain exclusions

- Database query shape, N+1 Prisma includes, indexes, migrations, and transaction design are left to Database Agent.
- Security issues in unauthenticated/admin-like routes and CSRF/rate-limit behavior are left to Security and Validation agents.
- Reliability concerns such as data-loss risk from startup scripts are left to Reliability Agent.

## Finding PERF-001: Runner execute endpoint blocks the FastAPI event loop

**Severity:** High  
**Confidence:** High  
**Agent:** Performance Agent - Latency Hawk  
**Scope:** Blocking synchronous work in request hot paths

### Files involved

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`

### Problem

`execute_code` is declared `async`, but it directly calls the synchronous Docker SDK path. `DockerService.run_code` performs blocking container operations and a `time.sleep(0.1)` polling loop, so one long submission can occupy the event loop and delay unrelated runner requests.

### Proof example

Start the runner, post a slow `/execute` request, then immediately run `time curl -s http://localhost:8080/health`; the health request can wait behind the active Docker polling loop instead of returning immediately.

### Current behaviour

Concurrent runner requests share the blocked event loop while `/execute` is waiting on Docker startup, polling, logs, and cleanup.

### Expected behaviour

The runner should continue serving lightweight requests and other accepted concurrent work while a submission executes in Docker.

### Evidence

`apps/runner/main.py:69-103` defines `async def execute_code` and calls `docker_service.run_code(...)` inline. `apps/runner/services/docker_service.py:44-80` uses synchronous Docker SDK calls, `time.sleep`, `container.reload`, and `container.logs`.

### Fix location

`apps/runner/main.py`, `execute_code`, around lines 96-103; `apps/runner/services/docker_service.py`, `run_code`, around lines 44-80.

### What to change

Run `docker_service.run_code` in a worker thread with `starlette.concurrency.run_in_threadpool` or `asyncio.to_thread`, or make the FastAPI route a synchronous `def execute_code` so FastAPI offloads it to its threadpool.

### Expected result after fix

Rerunning the proof shows `/health` returns immediately while the slow `/execute` request is still running.

### Test gap

No runner concurrency test asserts that `/health` or a second request is responsive during an active `/execute`.

### Backwards compatibility risk

Low, because the response contract stays the same and only the execution scheduling changes.

### Patch priority

High

### Suggested commit message

`Fix runner event loop blocking during code execution`

## Finding PERF-002: Manual lesson generation can double-call quiz generation

**Severity:** High  
**Confidence:** High  
**Agent:** Performance Agent - Latency Hawk  
**Scope:** Duplicate API calls and avoidable AI latency

### Files involved

- `apps/web/src/components/subjects/topic-view-client.tsx`
- `apps/web/src/app/api/topics/generate-quiz/route.ts`

### Problem

`handleGenerateContent` updates `currentTopic.content` before it posts `/api/topics/generate-quiz`, while a `useEffect` watches for content with no activities and posts the same endpoint. A single click can therefore launch two expensive quiz-generation requests for the same topic.

### Proof example

Open DevTools Network, navigate to a topic with no exercises, click `Generate Lesson & Activities`, and filter for `generate-quiz`; two `POST /api/topics/generate-quiz` requests can appear from one click.

### Current behaviour

The manual handler posts a forced quiz generation, and the auto-generation effect can race it with another quiz generation for the same topic.

### Expected behaviour

One user action should create one quiz-generation request for the topic.

### Evidence

`apps/web/src/components/subjects/topic-view-client.tsx:395-423` sets generated content and then posts `/api/topics/generate-quiz`. `apps/web/src/components/subjects/topic-view-client.tsx:489-520` automatically posts `/api/topics/generate-quiz` when the current topic has content and no exercises. The API route calls OpenAI chat completion at `apps/web/src/app/api/topics/generate-quiz/route.ts:288-294`.

### Fix location

`apps/web/src/components/subjects/topic-view-client.tsx`, `handleGenerateContent` and `maybeGenerateActivities`, around lines 395-423 and 489-520.

### What to change

Before setting generated content in `handleGenerateContent`, mark the topic as already activity-checked or add an `isGeneratingContent` guard to the auto-generation effect so the effect remains for route-load topics but does not run while manual generation owns quiz creation.

### Expected result after fix

Rerunning the Network check shows exactly one `POST /api/topics/generate-quiz` for one `Generate Lesson & Activities` click.

### Test gap

No component or integration test asserts request counts for manual topic generation.

### Backwards compatibility risk

Low, because the generated lesson and activities are unchanged; only duplicate work is suppressed.

### Patch priority

High

### Suggested commit message

`Prevent duplicate quiz generation during lesson generation`

## Finding PERF-003: Problems page polls count endpoint while idle and duplicates polling during sync

**Severity:** Medium  
**Confidence:** High  
**Agent:** Performance Agent - Latency Hawk  
**Scope:** Repeated network calls and duplicate API calls

### Files involved

- `apps/web/src/app/problems/page.tsx`
- `apps/web/src/components/problems-list-client.tsx`
- `apps/web/src/components/sync-problems-button.tsx`
- `apps/web/src/app/api/problems/count/route.ts`

### Problem

`ProblemsListClient` polls `/api/problems/count` every 10 seconds for every `/problems` visitor even when no sync is running. When sync is running, `SyncProblemsButton` starts its own 10-second count poll and route refresh, duplicating the list component's work.

### Proof example

Open `/problems` with DevTools Network and wait 30 seconds without clicking sync; `GET /api/problems/count` repeats. Click `Sync LeetCode`; the same count endpoint is requested by both page components on the 10-second cadence.

### Current behaviour

The page keeps background count traffic alive indefinitely and doubles that traffic during sync.

### Expected behaviour

The count endpoint should be quiet when no sync is active, and there should be one shared poll source while sync is active.

### Evidence

`apps/web/src/app/problems/page.tsx:90-97` mounts both `SyncProblemsButton` and `ProblemsListClient`. `apps/web/src/components/problems-list-client.tsx:24-47` always creates the interval and does not use its `isSyncing` prop. `apps/web/src/components/sync-problems-button.tsx:16-37` creates a second interval while syncing.

### Fix location

`apps/web/src/components/problems-list-client.tsx`, polling effect around lines 24-47; `apps/web/src/components/sync-problems-button.tsx`, sync interval around lines 16-37; `apps/web/src/app/problems/page.tsx`, component composition around lines 90-97.

### What to change

Move sync state into a small client wrapper or shared hook, pass it to the list, and guard the list polling with `if (!isSyncing) return`; alternatively remove list polling and let the sync button own the single progress poll and refresh.

### Expected result after fix

Rerunning the Network check shows no `/api/problems/count` polling at idle and one request per interval while sync is active.

### Test gap

No UI test covers idle `/problems` network silence or one-poller behavior during sync.

### Backwards compatibility risk

Low, because the list still refreshes during active sync and the idle UI does not depend on continuous count polling.

### Patch priority

Medium

### Suggested commit message

`Stop idle and duplicate problem count polling`

## Finding PERF-004: LeetCode sync serializes external detail and embedding calls

**Severity:** Medium  
**Confidence:** High  
**Agent:** Performance Agent - Latency Hawk  
**Scope:** Avoidable external network waterfall in a job-like route

### Files involved

- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/web/src/lib/openai.ts`

### Problem

The problem sync route fetches all slugs, then processes every slug in a single serial loop: LeetCode detail fetch, local processing, embedding request, and vector insert all complete before the next slug starts. With the default `SCRAPE_LIMIT` of `10000`, total wall time scales with the sum of thousands of external round trips.

### Proof example

Run `SCRAPE_LIMIT=5 time curl -s -X POST http://localhost:3000/api/problems/scrape`; the request time grows roughly linearly with each additional slug because the next detail and embedding calls do not start until the previous slug finishes.

### Current behaviour

Sync latency is bounded by a serialized LeetCode/OpenAI waterfall and is likely to hit long request times for full imports.

### Expected behaviour

The route should process external detail and embedding work in bounded batches so latency scales by batch count instead of every individual external round trip.

### Evidence

`apps/web/src/app/api/problems/scrape/route.ts:180-208` loads up to `SCRAPE_LIMIT || 10000` slugs. `apps/web/src/app/api/problems/scrape/route.ts:213-342` awaits each slug's detail fetch and embedding work inside one `for...of` loop. `apps/web/src/lib/openai.ts:21-27` exposes only one-text embedding calls.

### Fix location

`apps/web/src/app/api/problems/scrape/route.ts`, slug processing loop around lines 208-342; `apps/web/src/lib/openai.ts`, embedding helper around lines 21-27.

### What to change

Fetch LeetCode details with bounded concurrency, then batch or bounded-concurrently request embeddings; keep local writes ordered or throttled as needed, but remove the external network waterfall.

### Expected result after fix

Rerunning the timing proof with the same `SCRAPE_LIMIT` shows wall time closer to the slowest batch rather than the sum of every detail and embedding request.

### Test gap

No integration test or timing check covers `SCRAPE_LIMIT` sync duration or verifies that detail/embedding calls are batched.

### Backwards compatibility risk

Medium, because bounded concurrency must respect external rate limits and preserve existing import semantics.

### Patch priority

Medium

### Suggested commit message

`Batch external work in LeetCode problem sync`
