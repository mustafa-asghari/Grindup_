## Coverage Evidence

### Areas inspected

- `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth.config.ts`, `apps/web/src/middleware.ts`, `apps/web/src/lib/csrf.ts`, `apps/web/src/lib/logging.ts`
- `apps/web/src/app/api/**/route.ts`, with focus on auth, authorization, sensitive responses, state-changing routes, AI/runner cost surfaces, and ownership boundaries
- `apps/runner/main.py`, `apps/runner/services/docker_service.py`, runner handlers, and `compose.yml`
- `packages/db/prisma/schema.prisma` for user, subject, contest, lobby, alert, and challenge relationships
- Test/config files: root `package.json`, `apps/web/package.json`, `apps/runner/package.json`

### Searches and commands run

```bash
sed -n '1,240p' /Users/mustafaasghari/.codex/skills/review-skill/SKILL.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-skill.md
sed -n '1,240p' /Users/mustafaasghari/code/study/GrindUp/AGENTS.md
sed -n '1,240p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/finding-format.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/01-security-agent.md
pwd
rg --files -g 'AGENTS.md' -g '!node_modules' -g '!vendor'
rg --files -g '!node_modules' -g '!vendor' -g '!dist' -g '!build' -g '!coverage'
git status --short
rg -n "auth\(|getServerSession|requireAuth|getSession|session|NextAuth|authOptions|callbacks|authorized|cookie|cookies|csrf|CORS|Access-Control|redirect|NEXTAUTH|AUTH_SECRET" apps/web/src apps/web/next.config.ts apps/web/package.json .env.example
rg -n "userId|user\.id|session\.user|params\.|searchParams|request\.json|req\.json|NextResponse\.json|prisma\.|where:|include:|select:" apps/web/src/app apps/web/src/lib apps/web/src/components
rg -n "process\.env|apiKey|secret|token|password|hash|Authorization|Bearer|OPENAI|DATABASE_URL|CLICKHOUSE|console\.(log|error|warn)|logger|fs\.|writeFile|readFile|path\.|upload|FormData|File\(" apps/web apps/runner packages .env.example docker compose.yml
rg --files -g '*test*' -g '*spec*' -g '!node_modules' -g '!vendor'
rg --files-without-match "auth\(" apps/web/src/app/api -g 'route.ts'
rg -n "checkCSRF\(|csrf" apps/web/src/app/api apps/web/src/lib apps/web/src/components -g '*.ts' -g '*.tsx'
rg -n "include:\s*\{|select:\s*\{[^\n]*(email|passwordHash|token|secret)|email:\s*true|passwordHash:\s*true|access_token|refresh_token|id_token" apps/web/src/app apps/web/src/lib packages/db/src -g '*.ts' -g '*.tsx'
rg -n "^model Subject|createdBy|owner|userId" packages/db/prisma/schema.prisma
```

### Code paths traced

- Browser/API caller -> `POST /api/execute` -> runner `POST /execute` -> Docker executor container
- Unauthenticated caller -> `POST /api/problems/scrape` -> LeetCode fetch -> OpenAI embeddings -> Postgres/ClickHouse writes
- Authenticated user -> `POST /api/subjects/delete` -> global `Subject` delete -> cascade to topics/exercises/enrollments
- Authenticated non-participant -> contest/lobby message APIs -> message read/write and email-bearing JSON response
- Authenticated user -> `PATCH /api/wellbeing` -> `conceptDriftAlerts.delete({ id })`

### Tests reviewed

- No relevant auth/authorization tests found. `rg --files -g '*test*' -g '*spec*'` only returned component/source filenames such as `test-results.tsx`; `apps/web/package.json` and `apps/runner/package.json` define no test script.

### Domain exclusions

- General validation/sanitisation, database integrity, reliability, performance, and clean-code findings are excluded for their assigned agents unless they create an auth, authorization, secret, sensitive-response, CORS/redirect, file-access, or logging issue.
- Repo root `AGENTS.md` was requested but is absent; `rg --files -g 'AGENTS.md'` found no replacement.

## Finding SEC-001: Runner and execute API allow unauthenticated code execution

**Severity:** High  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** Missing authentication, exposed execution surface, resource abuse

### Files involved

- `apps/web/src/app/api/execute/route.ts`
- `apps/runner/main.py`
- `compose.yml`

### Problem

The web execute route calls `auth()` but never requires a session before forwarding attacker-controlled code, language, test cases, and resource limits to the runner. The runner itself exposes `POST /execute` without any API key and `compose.yml` publishes it on host port `8080`, so an unauthenticated caller can run code containers directly.

### Proof example

```bash
curl -i -X POST http://localhost:8080/execute \
  -H 'Content-Type: application/json' \
  --data '{"code":"def solution(x): return x","language":"python","test_cases":[{"id":"t1","input":"x = 1","expected_output":"1","is_hidden":false}],"time_limit_ms":2000,"memory_limit_kb":256000}'
```

### Current behaviour

No session cookie or service token is required; the runner executes the submitted code and returns execution output/status.

### Expected behaviour

Only the web service should reach the runner, and user-facing execution should require an authenticated, rate-limited user session.

### Evidence

`apps/web/src/app/api/execute/route.ts:60-65` reads the session and body but does not return `401` when `session?.user?.id` is absent. `apps/web/src/app/api/execute/route.ts:110-120` forwards arbitrary code and caller-provided limits to `RUNNER_URL`. `apps/runner/main.py:69-103` executes requests without any auth check. `compose.yml:82-85` publishes `runner` on host port `8080` and mounts the Docker socket into the runner service.

### Fix location

`apps/web/src/app/api/execute/route.ts`, `POST`, around lines 60-65 and 107-120; `apps/runner/main.py`, `execute_code`, around lines 69-103; `compose.yml`, `runner` service, around lines 82-85.

### What to change

Require `session.user.id` before accepting `/api/execute`, enforce the existing per-user quota/rate-limit before runner dispatch, remove the public `8080:8080` host binding or bind it to an internal-only network, and require a shared server-side runner token header from the web app to the runner.

### Expected result after fix

The proof curl to `localhost:8080/execute` without the runner token returns `401/403`, and unauthenticated `POST /api/execute` returns `401` before any Docker container is created.

### Test gap

No API/runner tests assert unauthenticated execution is rejected, runner token checks are enforced, or caller-provided limits are capped.

### Backwards compatibility risk

Medium, because anonymous code execution currently works but is a security liability; authenticated users should keep the same UI flow.

### Patch priority

High

### Suggested commit message

`Fix unauthenticated runner execution`

## Finding SEC-002: Public problem scrape route mutates data, spends AI quota, and returns stack traces

**Severity:** High  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** Missing authentication, sensitive maintenance endpoint, error leakage

### Files involved

- `apps/web/src/app/api/problems/scrape/route.ts`

### Problem

`POST /api/problems/scrape` has no `auth()` or job secret check before initializing ClickHouse, scraping LeetCode, generating OpenAI embeddings, and writing/updating problems and test cases. On failure it returns `e.message` and `e.stack` to the caller.

### Proof example

```bash
curl -i -X POST http://localhost:3000/api/problems/scrape
```

### Current behaviour

An unauthenticated caller can trigger the full scrape/sync job; failures return diagnostic stack data in the HTTP response.

### Expected behaviour

Only an admin or trusted scheduled job can run the scraper, and production responses do not include stack traces.

### Evidence

`apps/web/src/app/api/problems/scrape/route.ts:175-179` enters the job without authentication. `apps/web/src/app/api/problems/scrape/route.ts:192-339` performs external fetches, OpenAI embedding calls, Postgres writes, and ClickHouse inserts. `apps/web/src/app/api/problems/scrape/route.ts:345-351` returns `error` and `stack`.

### Fix location

`apps/web/src/app/api/problems/scrape/route.ts`, `POST`, around lines 175-179 and catch block around lines 345-351.

### What to change

Add an admin/session check or a dedicated cron secret before `initClickHouse()`, reject missing/invalid credentials with `401/403`, rate-limit the job, and return a generic error body while logging stack details server-side only.

### Expected result after fix

The proof curl without admin credentials or the cron secret returns `401/403`, creates no problem records, makes no OpenAI calls, and never includes a stack trace in the response.

### Test gap

No route tests cover unauthenticated scraper access, authorized job execution, rate limiting, or production-safe error bodies.

### Backwards compatibility risk

Low, because this is a maintenance job and should not be publicly callable.

### Patch priority

High

### Suggested commit message

`Protect problem scraper endpoint`

## Finding SEC-003: Any authenticated user can delete global subjects and cascade other users' data

**Severity:** High  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** Broken authorization, cross-user/global data destruction

### Files involved

- `apps/web/src/app/api/subjects/delete/route.ts`
- `packages/db/prisma/schema.prisma`

### Problem

`POST /api/subjects/delete` accepts a client-supplied `subjectId` and deletes the global `Subject` row without verifying ownership or admin rights. The schema models `Subject` as global and links users through `UserSubject`, so this cascades topics, exercises, homework, vectors, and every user's enrollment for that subject.

### Proof example

```bash
curl -i -X POST http://localhost:3000/api/subjects/delete \
  -H 'Cookie: <any authenticated user session>' \
  -H 'Content-Type: application/json' \
  --data '{"subjectId":"<subject id owned/used by another user>"}'
```

### Current behaviour

The route returns success and deletes the global subject if the caller is merely authenticated.

### Expected behaviour

Regular users can only unenroll themselves from subjects; deleting global subjects requires an explicit owner/admin authorization model.

### Evidence

`apps/web/src/app/api/subjects/delete/route.ts:8-14` checks only that a user is authenticated. `apps/web/src/app/api/subjects/delete/route.ts:20-23` calls `prisma.subject.delete({ where: { id: subjectId } })`. `packages/db/prisma/schema.prisma:912-937` has no subject owner field and shows global relations; `packages/db/prisma/schema.prisma:1129-1147` stores per-user enrollment separately in `UserSubject`.

### Fix location

`apps/web/src/app/api/subjects/delete/route.ts`, `POST`, around lines 14-23; optionally `packages/db/prisma/schema.prisma`, `Subject`, around lines 912-937 if personal subject ownership is required.

### What to change

Replace this route's regular-user behavior with unenrollment through `userSubject.delete` scoped by `{ userId: session.user.id, subjectId }`, or add a `createdById`/admin role model and require it before deleting `Subject`.

### Expected result after fix

The proof request for another user's/global subject returns `403` or only removes the caller's `UserSubject`; other users' topics, exercises, homework, and enrollments remain intact.

### Test gap

No multi-user authorization test covers subject deletion, unenrollment, or cascade protection.

### Backwards compatibility risk

Medium, because current UI flows may call this for removal; changing it to scoped unenrollment preserves user intent while avoiding global deletion.

### Patch priority

High

### Suggested commit message

`Prevent unauthorized subject deletion`

## Finding SEC-004: Contest and lobby chat APIs allow non-participant read/write and leak emails

**Severity:** High  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** Broken authorization, sensitive API response

### Files involved

- `apps/web/src/app/api/contests/[contestId]/messages/route.ts`
- `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`
- `packages/db/prisma/schema.prisma`

### Problem

The contest and lobby message routes require login but do not verify that the caller is a contest/lobby participant before reading or posting messages. Both routes include `user.email` in message responses, exposing participant emails to any authenticated user who knows or guesses an ID.

### Proof example

```bash
curl -i http://localhost:3000/api/contests/<contestId>/messages \
  -H 'Cookie: <authenticated non-participant session>'
curl -i -X POST http://localhost:3000/api/contests/lobbies/<lobbyId>/messages \
  -H 'Cookie: <authenticated non-participant session>' \
  -H 'Content-Type: application/json' \
  --data '{"message":"unauthorized hello"}'
```

### Current behaviour

The GET routes return chat history with sender email fields, and the POST routes create messages as the non-participant.

### Expected behaviour

Only participants or hosts can read/write contest/lobby chat, and chat JSON should expose public profile fields only.

### Evidence

`apps/web/src/app/api/contests/[contestId]/messages/route.ts:11-36` checks login then queries messages by `contestId` only and selects `email: true`; lines 44-75 create a message without participant verification and again select `email: true`. `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts:11-36` and `44-75` repeat the same pattern for lobbies. `packages/db/prisma/schema.prisma:185-194` and `245-255` define participant tables that can be used for the missing authorization checks.

### Fix location

`apps/web/src/app/api/contests/[contestId]/messages/route.ts`, `GET` and `POST`, around lines 16-36 and 49-75; `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`, `GET` and `POST`, around lines 16-36 and 49-75.

### What to change

Before querying or creating messages, require `ContestParticipant`/`Contest.createdById` membership for contests and `ContestLobbyParticipant`/`ContestLobby.createdById` membership for lobbies; remove `email: true` from returned user selections.

### Expected result after fix

The proof requests by a non-participant return `403`, and authorized message responses include `id`, `name`, and `image` but not email addresses.

### Test gap

No API tests cover non-participant chat access, private lobby message access, unauthorized posting, or email redaction in chat responses.

### Backwards compatibility risk

Low, because legitimate participants keep access and the UI should not need email fields for chat rendering.

### Patch priority

High

### Suggested commit message

`Authorize contest chat access`

## Finding SEC-005: Wellbeing alert dismissal deletes by global alert ID without owner scope

**Severity:** Medium  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** IDOR, broken object-level authorization

### Files involved

- `apps/web/src/app/api/wellbeing/route.ts`

### Problem

`PATCH /api/wellbeing` authenticates the caller but deletes `conceptDriftAlerts` by `id` alone. Any authenticated user who obtains another alert ID can dismiss that user's wellbeing/concept-drift alert.

### Proof example

```bash
curl -i -X PATCH http://localhost:3000/api/wellbeing \
  -H 'Cookie: <attacker authenticated session>' \
  -H 'Content-Type: application/json' \
  --data '{"alertId":"<victim concept_drift_alerts.id>"}'
```

### Current behaviour

The victim alert is deleted because the query does not include `userId: session.user.id`.

### Expected behaviour

Users can dismiss only their own alerts.

### Evidence

`apps/web/src/app/api/wellbeing/route.ts:167-174` authenticates and reads `alertId`, but `apps/web/src/app/api/wellbeing/route.ts:180-182` calls `prisma.conceptDriftAlerts.delete({ where: { id: alertId } })` without owner scope. The same route's GET and POST paths correctly filter by `userId` at lines 15-18, 59-61, and 79-83.

### Fix location

`apps/web/src/app/api/wellbeing/route.ts`, `PATCH`, around lines 180-182.

### What to change

Use `deleteMany({ where: { id: alertId, userId: session.user.id } })` or first fetch by both `id` and `userId`; return `404/403` when no owned alert is found.

### Expected result after fix

The proof request with a victim alert ID returns `404/403`, and the victim still sees the alert from `GET /api/wellbeing`.

### Test gap

No authorization test covers dismissing another user's wellbeing alert.

### Backwards compatibility risk

Low, because same-user alert dismissal still works.

### Patch priority

Medium

### Suggested commit message

`Scope wellbeing alert dismissal to owner`
