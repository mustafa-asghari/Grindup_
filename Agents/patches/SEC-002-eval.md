# Eval Report: SEC-002

## Verdict

Needs user testing

## What changed

`POST /api/problems/scrape` now requires `Authorization: Bearer <PROBLEM_SCRAPE_SECRET>` before scraper work starts. `.env.example` documents `PROBLEM_SCRAPE_SECRET`, and the route catch block now returns a generic error body instead of raw exception messages or stack traces.

## Does this fix the root cause?

Yes. The specialist eval at `Agents/patches/SEC-002-specialist-eval.md` passed and confirmed the security root cause is fixed: missing, invalid, or unset scrape secrets return `401` before `initClickHouse()`, external fetches, Prisma writes, ClickHouse inserts, or OpenAI embedding calls.

## Scope check

Pass. The SEC-002-relevant change is limited to the scrape route auth/error boundary and `.env.example` secret documentation. The working tree contains unrelated changes from other review tasks, and the scrape route also includes previously evaluated VAL-001 sanitization changes; those are not treated as SEC-002 regressions.

## Backwards compatibility check

Pass with an intentional operational change. Existing successful scrape response shape remains unchanged, but authorized jobs must now configure `PROBLEM_SCRAPE_SECRET` and send it as a Bearer token. Unset secret fails closed, which is correct for this maintenance endpoint.

## Test check

No automated route test was added, so manual user testing is still required. Static validation and type checks passed.

## Commands run

```bash
git status --short
git diff -- apps/web/src/app/api/problems/scrape/route.ts .env.example Agents/stat.json Agents/patches/SEC-002.md Agents/patches/SEC-002-specialist-eval.md
nl -ba apps/web/src/app/api/problems/scrape/route.ts | sed -n '1,150p'
nl -ba apps/web/src/app/api/problems/scrape/route.ts | sed -n '240,455p'
nl -ba .env.example | sed -n '1,90p'
python3 -m json.tool Agents/stat.json >/dev/null
pnpm --filter @grindup/web exec eslint src/app/api/problems/scrape/route.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
```

## Command results

Passed. The route-specific ESLint command and TypeScript check completed with exit code 0. No local Next.js server was started, so the curl proof is deferred to user testing.

## Risks remaining

There is still no automated regression test asserting unauthorized scrape requests stop before side effects. Manual testing must verify unauthorized requests return `401` or `403`, authorized requests pass the auth gate, and error responses do not include stack traces.

## Eval decision

Mark task `needs_user_test`.

## Suggested commit message

Protect problem scraper endpoint
