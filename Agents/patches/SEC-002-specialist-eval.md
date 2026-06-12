# Specialist Eval: SEC-002

**Result:** PASS  
**Agent:** Security Agent - Paranoid Threat Hunter  
**Task:** Public problem scrape route mutates data, spends AI quota, and returns stack traces

## Security Assessment

The patch fixes the root cause. `POST /api/problems/scrape` now checks `Authorization: Bearer <PROBLEM_SCRAPE_SECRET>` before `initClickHouse()`, LeetCode fetches, Prisma writes, ClickHouse inserts, or OpenAI embeddings. Missing, invalid, or unset `PROBLEM_SCRAPE_SECRET` fails closed with `401`.

The secret handling is acceptable for this maintenance endpoint: the configured secret is not returned to clients, unset config logs only the env var name, and same-length values are compared with `timingSafeEqual` after a length check. The HTTP error path no longer returns raw exception messages or stack traces; it logs server-side details and returns only `{"error":"Problem scrape failed"}`.

## Adjacent Path Check

Search found no second `problems/scrape` route or alternate scrape trigger. Adjacent problem routes checked were `apps/web/src/app/api/problems/count/route.ts`, `apps/web/src/app/api/problems/report/route.ts`, and `apps/web/src/app/api/admin/seed-problems/route.ts`; they do not expose the SEC-002 scrape path, LeetCode fetches, ClickHouse inserts, embeddings, or stack-trace response behavior.

## Validation Run

```bash
git diff -- apps/web/src/app/api/problems/scrape/route.ts .env.example Agents/stat.json
rg -n "problems/scrape|PROBLEM_SCRAPE_SECRET|isAuthorizedScrapeRequest|getBearerToken|initClickHouse|getEmbedding|LeetCode|scrape" apps/web/src/app apps/web/src/lib .env.example Agents -g '!node_modules'
rg --files apps/web/src/app/api/problems apps/web/src/app/api | rg 'scrape|problem'
nl -ba apps/web/src/app/api/problems/scrape/route.ts
nl -ba .env.example
nl -ba apps/web/src/lib/clickhouse.ts
nl -ba apps/web/src/app/api/admin/seed-problems/route.ts
nl -ba apps/web/src/app/api/problems/count/route.ts
nl -ba apps/web/src/app/api/problems/report/route.ts
python3 -m json.tool Agents/stat.json
pnpm --filter @grindup/web exec eslint src/app/api/problems/scrape/route.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
```

All validation commands passed. I did not run the original curl proof because no local Next.js server was started for this specialist eval.

## Residual Risk

No route test currently asserts unauthorized scrape requests stop before external or mutating work. That test gap remains, but the static control flow and type/lint checks support passing this specialist eval.
