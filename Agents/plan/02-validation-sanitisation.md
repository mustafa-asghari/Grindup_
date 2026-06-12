## Coverage Evidence

### Areas inspected

- `apps/web/src/app/api/**` JSON and multipart route handlers, including execute, import, homework, topics, subjects, social, contests, reports, scratchpads, notifications, activity, contracts, and tutor routes.
- `apps/web/src/components/**` form and rendering surfaces, including problem display, topic markdown, AI tutor markdown, challenge creation, homework upload, social chat, search, and local-storage hooks.
- `apps/runner/main.py`, `apps/runner/services/docker_service.py`, and runner language handlers.
- `packages/db/prisma/schema.prisma` for sink shape and missing DB-level bounds.
- Repo guidance: `/Users/mustafaasghari/.codex/skills/review-skill/SKILL.md`, `review-skill.md`, `review-agents/finding-format.md`, `review-agents/02-validation-sanitisation-agent.md`. Repo-root `AGENTS.md` was requested but is absent; only dependency copies exist under `node_modules`.

### Searches and commands run

```bash
find .. -name AGENTS.md -print
rg -n "request\.(json|formData|text|arrayBuffer)|new URL\(|searchParams|params\.|NextRequest|POST\(|GET\(" apps/web/src/app apps/web/src/lib apps/web/src/components apps/runner packages
rg -n "dangerouslySetInnerHTML|innerHTML|marked|markdown|rehypeRaw|mermaid|sanitize" apps/web/src apps/runner packages
rg -n "exec\(|spawn\(|subprocess|shell=True|writeFile|readFile|docker|fetch\(|redirect\(|localStorage|sessionStorage" apps/web/src apps/runner packages
rg -n "formData\(|File\)|arrayBuffer\(|Buffer\.from|pdf|mime|file\.size|file\.type" apps/web/src/app/api apps/web/src/components
node --input-type=module - <<'EOF' # sampled installed react-markdown + rehypeRaw rendering of hostile URLs/event handlers
```

### Code paths traced

- LeetCode GraphQL `question.content` -> `prisma.problem.description` / ClickHouse `content` -> problem page query -> `ProblemWorkspace` -> `ProblemPanel` -> `dangerouslySetInnerHTML`.
- Browser `/api/execute` JSON body (`code`, `language`, `test_cases`, `time_limit_ms`, `memory_limit_kb`) -> runner `SubmissionRequest` -> language driver generation/temp file -> Docker `containers.run` command, memory, and timeout.
- Multipart import/homework file -> `request.formData()` -> `File.arrayBuffer()` -> PDF/image/text extraction -> OpenAI/network calls and Prisma storage.
- Social challenge JSON (`type`, `stake`, `targetValue`, `duration`, IDs) -> Prisma `StudyChallenge` and `User.xp` mutations -> accept/evaluate payout paths.
- Topic/imported markdown, AI tutor markdown, Mermaid SVG, direct messages, contest messages, scratchpads, reports, local storage, URL params, env-driven service URLs, and third-party payloads were sampled for rendering, JSON, network, redirect, and DB sinks.

### Tests reviewed

- No relevant automated tests found for hostile HTML, markdown rendering, malformed API bodies, multipart size/type limits, code-runner bounds, or challenge numeric bounds.

### Domain exclusions

- Authentication/authorization ownership, CSRF policy, Docker sandbox escape hardening, database transaction correctness, and performance tuning are left to the security, database, reliability, and performance agents unless the root cause is input validation or output sanitisation.

## Finding VAL-001: Problem descriptions render unsanitized third-party HTML

**Severity:** High  
**Confidence:** High  
**Agent:** Validation and Sanitisation Agent - Input Gatekeeper  
**Scope:** Output rendering sanitisation

### Files involved

- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/web/src/components/editor/problem-workspace.tsx`
- `apps/web/src/components/editor/problem-panel.tsx`

### Problem

LeetCode `question.content` is stored as `Problem.description` without sanitisation, then rendered with `dangerouslySetInnerHTML`. A compromised upstream response or poisoned DB row becomes stored XSS for every user who opens the problem.

### Proof example

In a local dev DB, set one problem description to `<img src=x onerror=alert(document.domain)>`, then open `/problems/<problem-id>`; the payload is inserted directly into the problem pane.

### Current behaviour

Raw HTML from the problem record reaches the browser as executable DOM.

### Expected behaviour

Problem descriptions render only an allowlisted, sanitised subset of HTML, with script/event/unsafe URL payloads removed before display.

### Evidence

`apps/web/src/app/api/problems/scrape/route.ts` stores `q.content` directly in `description` at lines 271-286 and ClickHouse `content` at lines 329-335. `apps/web/src/components/editor/problem-workspace.tsx` passes `problem.description ?? ''` at lines 168-171. `apps/web/src/components/editor/problem-panel.tsx` injects it at line 121.

### Fix location

`apps/web/src/components/editor/problem-panel.tsx`, `ProblemPanel`, line 121; also sanitise ingestion/backfill in `apps/web/src/app/api/problems/scrape/route.ts` around lines 271-286.

### What to change

Add a shared HTML sanitizer with a narrow allowlist for problem statement tags/attributes, sanitize `q.content` before persistence, backfill existing descriptions, and render only the sanitized value. If preserving HTML is not required, replace the raw HTML sink with escaped text/markdown rendering.

### Expected result after fix

Rerunning the proof shows the image tag either removed or rendered without `onerror`; no alert runs when the problem page opens.

### Test gap

No component or ingestion test covers hostile problem HTML such as event attributes, `<script>`, `javascript:` URLs, or SVG/MathML payloads.

### Backwards compatibility risk

Medium, because legitimate problem formatting can change if the allowlist is too strict.

### Patch priority

High

### Suggested commit message

`Fix unsafe problem description HTML rendering`

## Finding VAL-002: Code runner trusts client-controlled limits and test payloads

**Severity:** High  
**Confidence:** High  
**Agent:** Validation and Sanitisation Agent - Input Gatekeeper  
**Scope:** API input validation to command/container sink

### Files involved

- `apps/web/src/app/api/execute/route.ts`
- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`

### Problem

`/api/execute` accepts `test_cases`, `time_limit_ms`, and `memory_limit_kb` from the browser and forwards them to the runner without schema, length, or range validation. Those values control generated driver size and Docker timeout/memory limits.

### Proof example

Send `POST /api/execute` with an existing `problem_id`, `code: "while (true) {}"`, one trivial test case, `time_limit_ms: 600000`, and `memory_limit_kb: 33554432`; the request is forwarded to the runner instead of being rejected as out of range.

### Current behaviour

The web route uses `time_limit_ms || 2000` and `memory_limit_kb || 256000`, and the runner passes derived values into Docker.

### Expected behaviour

The server rejects malformed or oversized runner input and derives test cases and resource limits from trusted problem records or fixed server-side caps.

### Evidence

`apps/web/src/app/api/execute/route.ts` parses raw JSON at lines 63-65 and forwards body values at lines 111-120. `apps/runner/main.py` defines unconstrained integers at lines 40-45 and passes them to Docker at lines 97-103. `apps/runner/services/docker_service.py` uses `memory_limit_mb` and `time_limit_ms` for `mem_limit` and timeout at lines 45-71.

### Fix location

`apps/web/src/app/api/execute/route.ts`, `POST`, around lines 63-120; `apps/runner/main.py`, `SubmissionRequest`, around lines 40-45.

### What to change

Validate the request with a schema: language enum, code max length, test-case count and field length caps, and numeric bounds. Prefer loading canonical test cases and `timeLimitMs`/`memoryLimitKb` from `problem_id` server-side; also enforce Pydantic `Field(ge=..., le=...)` caps in the runner as a second boundary.

### Expected result after fix

The proof request returns `400` with a validation error before any Docker container is started.

### Test gap

No API or runner tests assert rejection for oversized code, excessive test cases, negative/non-finite limits, or limits above policy.

### Backwards compatibility risk

Medium, because existing clients currently send test cases and limits; the frontend may need to send only `code`, `language`, and `problem_id`.

### Patch priority

High

### Suggested commit message

`Validate code runner input limits`

## Finding VAL-003: Multipart uploads are buffered before file limits are enforced

**Severity:** Medium  
**Confidence:** High  
**Agent:** Validation and Sanitisation Agent - Input Gatekeeper  
**Scope:** File upload validation

### Files involved

- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/homework/submit/route.ts`

### Problem

Upload handlers materialize entire files with `File.arrayBuffer()` before applying size/type checks; homework submission has no explicit size limit at all. A large upload can consume server memory/CPU and trigger PDF/image/OCR work before validation rejects it.

### Proof example

Create a large local file with `dd if=/dev/zero of=/tmp/big.bin bs=1m count=200`, then submit it as `file` to `/api/import` or `/api/homework/submit` with an authenticated cookie; the route buffers the file before rejection or extraction failure.

### Current behaviour

Import checks `buffer.byteLength > 10 * 1024 * 1024` only after `await file.arrayBuffer()`, while homework immediately buffers and then branches into PDF/image/text extraction.

### Expected behaviour

Oversized or disallowed files are rejected from `file.size`, filename, and MIME/magic-byte policy before full buffering, extraction, conversion, or OpenAI calls.

### Evidence

`apps/web/src/app/api/import/route.ts` reads multipart files at lines 437-448; `fileToText` buffers at line 326 and checks size at lines 329-332. `apps/web/src/app/api/homework/submit/route.ts` buffers at line 10, then processes images/PDFs at lines 21-119; the route accepts multipart files at lines 209-216.

### Fix location

`apps/web/src/app/api/import/route.ts`, multipart branch around lines 437-448 and `fileToText` around lines 320-332; `apps/web/src/app/api/homework/submit/route.ts`, `POST` around lines 209-216 and `extractTextFromFile` around lines 9-21.

### What to change

Before calling extraction helpers, reject `file.size` above the policy limit and reject unsupported extensions/MIME types. Add the same guard inside each extraction helper, cap extracted text length before AI/database sinks, and configure an upstream request body limit where the deployment platform supports it.

### Expected result after fix

The proof upload returns `413` or `400` immediately and does not call PDF parsing, image conversion, OpenAI, or Prisma storage.

### Test gap

No multipart tests cover oversized files, unsupported MIME/extension combinations, malformed PDFs, or extracted text length limits.

### Backwards compatibility risk

Low, if limits match the documented UI accept list and current intended 10 MB import cap.

### Patch priority

Medium

### Suggested commit message

`Reject oversized uploads before buffering`

## Finding VAL-004: Challenge numeric fields allow negative XP and duration values

**Severity:** High  
**Confidence:** High  
**Agent:** Validation and Sanitisation Agent - Input Gatekeeper  
**Scope:** API body range and enum validation

### Files involved

- `apps/web/src/app/api/social/challenges/route.ts`
- `apps/web/src/app/api/social/challenges/claim/route.ts`
- `apps/web/src/app/api/social/challenges/evaluate/route.ts`
- `packages/db/prisma/schema.prisma`

### Problem

`/api/social/challenges` trusts `stake`, `duration`, `targetValue`, and `type` from JSON without server-side range validation. A negative stake passes the XP balance checks and is used in Prisma `decrement`, which reverses the accounting direction.

### Proof example

Send an authenticated `POST /api/social/challenges` body like `{"targetUserId":"<other-user-id>","type":"study_time","stake":-1000,"targetValue":1,"duration":-1}`; the create path accepts the negative stake instead of returning `400`.

### Current behaviour

Negative `stake` passes `user.xp < stake`, is stored as `xpStake`, and is applied with `xp: { decrement: stake }`; negative `duration` later produces an already-ended challenge.

### Expected behaviour

The API rejects non-enum challenge types and non-integer, negative, zero, non-finite, or out-of-policy numeric values before any DB mutation.

### Evidence

`apps/web/src/app/api/social/challenges/route.ts` parses body fields at line 36, checks XP against raw `stake` at lines 39-41 and 63-66, stores raw values at lines 71-80, decrements raw `stake` at lines 84-87, and uses `challenge.duration` / `challenge.xpStake` again at lines 127-139. Payout paths use `challenge.xpStake` at `claim/route.ts` lines 144-198 and `evaluate/route.ts` lines 115-152. The Prisma model stores plain `Int` fields without check constraints at `packages/db/prisma/schema.prisma` lines 1385-1389.

### Fix location

`apps/web/src/app/api/social/challenges/route.ts`, `POST`, around lines 36-87; add defensive checks in `PATCH` around lines 102-139; optionally add DB check constraints in the migration/schema layer.

### What to change

Validate with a schema: `type` must be one of the `ChallengeType` values, `stake` must be an integer within the UI policy such as 10-1000, `duration` within 1-168 hours, `targetValue` positive and capped per challenge type, and IDs must be valid existing users/problems. Reject same-user challenges and use a transaction after validation.

### Expected result after fix

The proof request returns `400`; no challenge row is created and no user XP changes.

### Test gap

No API tests cover negative stake, zero duration, non-enum type, non-numeric values, excessive target values, or XP balance accounting after rejected inputs.

### Backwards compatibility risk

Low, because the UI already presents positive min/max controls for stake and duration.

### Patch priority

High

### Suggested commit message

`Validate challenge numeric bounds`
