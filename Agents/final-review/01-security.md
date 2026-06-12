## Coverage Evidence

### Areas inspected

- `Agents/stat.json`, `Agents/plan/01-security.md`, and `Agents/patches/SEC-001..SEC-004*.md`
- `apps/web/src/app/api/execute/route.ts`, `apps/runner/main.py`, `compose.yml`, `.env.example`
- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/web/src/app/api/subjects/delete/route.ts`
- `apps/web/src/app/api/contests/[contestId]/messages/route.ts`
- `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`
- Modified security-adjacent routes/config: `apps/web/src/app/api/import/route.ts`, `apps/web/src/app/api/homework/submit/route.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/openai.ts`, `docker/compose.yml`

### Searches and commands run

```bash
find .. -name AGENTS.md -print
find Agents -maxdepth 3 -type f | sort
git status --short
git diff --name-only
jq '.tasks[] | select(.id|test("SEC-00[1-4]"))' Agents/stat.json
sed -n '1,260p' Agents/plan/01-security.md
for f in Agents/patches/SEC-00{1,2,3,4}.md Agents/patches/SEC-00{1,2,3,4}-specialist-eval.md Agents/patches/SEC-00{1,2,3,4}-eval.md Agents/patches/SEC-00{1,2,3,4}-user-test.md; do sed -n '1,180p' "$f"; done
nl -ba apps/web/src/app/api/execute/route.ts | sed -n '1,330p'
nl -ba apps/runner/main.py | sed -n '1,220p'
nl -ba apps/web/src/app/api/problems/scrape/route.ts | sed -n '1,460p'
nl -ba apps/web/src/app/api/subjects/delete/route.ts | sed -n '1,140p'
nl -ba 'apps/web/src/app/api/contests/[contestId]/messages/route.ts' | sed -n '1,220p'
nl -ba 'apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts' | sed -n '1,240p'
rg -n "email:\s*true|passwordHash:\s*true|token:\s*true|secret|Authorization|Bearer|RUNNER_SHARED_SECRET|PROBLEM_SCRAPE_SECRET|process\.env|console\.(log|error|warn)" apps/web/src/app apps/web/src/lib apps/runner docker compose.yml .env.example -g '!node_modules'
rg -n "export async function (GET|POST|PUT|PATCH|DELETE)|auth\(|session\?\.user|session\.user|userId|createdById|participant|deleteMany|delete\(|update\(|create\(|findMany|include:|select:" apps/web/src/app/api -g 'route.ts'
git diff -- apps/web/src/app/api/import/route.ts
git diff -- apps/web/src/app/api/homework/submit/route.ts
git diff -- compose.yml docker/compose.yml .env.example apps/web/src/lib/auth.ts apps/web/src/lib/openai.ts apps/web/src/lib/submission-queue.ts apps/runner/services/docker_service.py
python3 -m py_compile apps/runner/main.py
docker compose config
pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts src/app/api/problems/scrape/route.ts src/app/api/subjects/delete/route.ts 'src/app/api/contests/[contestId]/messages/route.ts' 'src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
rg -n "(sk-[A-Za-z0-9]|ghp_[A-Za-z0-9]|AIza[0-9A-Za-z_-]|xox[baprs]-|-----BEGIN|PRIVATE KEY|password\s*=\s*['\"][^'\"]+|secret\s*=\s*['\"][^'\"]+)" . -g '!node_modules' -g '!Agents' -g '!pnpm-lock.yaml'
```

### Code paths traced

- Anonymous caller -> `POST /api/execute` -> session gate -> runner dispatch blocked before body parsing.
- Web service -> runner `POST /execute` -> `X-Runner-Token` middleware -> Docker execution.
- Caller -> `POST /api/problems/scrape` -> Bearer secret gate -> scrape/embedding/database side effects.
- Authenticated user -> `POST /api/subjects/delete` -> scoped `UserSubject.deleteMany`.
- Authenticated contest/lobby user -> chat GET/POST -> creator/participant guard -> message query/create -> redacted sender select.

### Tests reviewed

- Existing patch eval/user-test reports for SEC-001 through SEC-004.
- `python3 -m py_compile apps/runner/main.py`: passed.
- `docker compose config`: passed; runner publishes only `127.0.0.1:8080`, web and runner share `RUNNER_SHARED_SECRET`.
- Targeted ESLint failed only on `apps/web/src/app/api/execute/route.ts` existing `any`/unused warnings; no security-task route failure in the other four reviewed files.

### Domain exclusions

- Validation, database correctness, reliability, performance, and clean-code issues are excluded unless they create auth, authorization, secret, token, redirect, CORS, file-access, or sensitive-response risk.
- Repo root `AGENTS.md` is absent; only dependency copies under `node_modules` were found.

## Per-task fixed-status assessment

- `SEC-001`: Fixed, pending manual user approval. `/api/execute` now returns `401` without `session.user.id` before `req.json()`, and `apps/runner/main.py` rejects missing/invalid runner tokens before Docker work. Residual operational risk: Compose uses development fallback secrets, so non-local deployments must override `RUNNER_SHARED_SECRET`, `AUTH_SECRET`, and database credentials.
- `SEC-002`: Fixed, pending manual user approval. `POST /api/problems/scrape` fails closed when `PROBLEM_SCRAPE_SECRET` is unset/missing/invalid and no longer returns stack traces in its catch response.
- `SEC-003`: Fixed, pending manual user approval. `POST /api/subjects/delete` deletes only the caller's `UserSubject` enrollment and no longer deletes global `Subject` rows.
- `SEC-004`: Fixed, pending manual user approval. Contest/lobby chat GET/POST now require creator-or-participant access and response sender selection omits `email`.

## Remaining security risks pending manual user testing

- `SEC-001`: Verify direct runner calls without `X-Runner-Token` return `401`, bad tokens return `403`, unauthenticated `/api/execute` returns `401`, and authenticated editor execution still works.
- `SEC-002`: Verify unauthorized scrape calls do not start scraper work; authorized Bearer calls pass the gate; error bodies remain generic.
- `SEC-003`: Verify a two-user subject removal removes only the caller's enrollment and leaves the shared subject plus other users' enrollments intact.
- `SEC-004`: Verify nonparticipants get `403` for contest/lobby chat GET/POST, participants still succeed, and JSON responses contain no sender email.
- Automated route-level auth regression tests are still absent for all four security tasks.

## Finding SEC-FR-001: Execute route returns raw internal errors to authenticated callers

**Severity:** Low  
**Confidence:** High  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Scope:** Sensitive error disclosure in a modified execution route

### Files involved

- `apps/web/src/app/api/execute/route.ts`

### Problem

The outer `catch` in `POST /api/execute` returns `error?.message` and `String(error)` to the client. Authenticated callers can trigger framework, Prisma, JSON, or internal route errors and receive implementation details that should stay server-side.

### Proof example

```bash
curl -i -X POST http://localhost:3000/api/execute \
  -H 'Cookie: <authenticated-session>' \
  -H 'Content-Type: application/json' \
  --data '{"code":"x","language":"python","problem_id":{"not":"a-string"},"test_cases":[]}'
```

### Current behaviour

The route can return a `500` body containing the raw exception message and duplicated details from `String(error)`.

### Expected behaviour

Authenticated callers receive a generic execution error response while full exception details are logged only on the server.

### Evidence

`apps/web/src/app/api/execute/route.ts:292-297` logs the exception and returns `{ error: error?.message || 'Internal server error', status: 'error', details: String(error) }`.

### Fix location

`apps/web/src/app/api/execute/route.ts`, outer `catch` in `POST`, lines 292-297.

### What to change

Keep the server-side logging, but return a generic body such as `{ error: 'Internal server error', status: 'error' }`; avoid sending `error.message`, `error.stack`, or `String(error)` to the client.

### Expected result after fix

Rerun the proof request; the response still returns `500`, but contains only the generic error and no Prisma/framework/internal details.

### Test gap

No execute-route test asserts that internal exceptions are sanitized before reaching API clients.

### Backwards compatibility risk

Low, because clients should not depend on raw internal error strings.

### Patch priority

Medium

### Suggested commit message

`Sanitize execute API error responses`

## Readiness verdict

Security final review is conditionally ready for user testing of `SEC-001` through `SEC-004`: the original fixed issues stayed fixed and I did not find a new auth/access-control/secret-exposure regression introduced by those patches. Do not mark the four tasks approved until the manual tests above pass. Address `SEC-FR-001` before production hardening, and ensure all development fallback secrets in Compose are overridden outside local review environments.
