# Database Agent - Final Review

## Coverage Evidence

### Areas inspected

- `apps/web/src/lib/submission-queue.ts`
- `apps/web/src/lib/db.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/app/api/subjects/delete/route.ts`
- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/contests/[contestId]/messages/route.ts`
- `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`
- `apps/web/src/app/api/homework/submit/route.ts`
- `apps/web/src/app/api/homework/generate/route.ts`
- `apps/web/src/app/api/tutor/route.ts`
- `apps/web/src/app/api/tutor/chat/route.ts`
- `apps/web/src/app/api/topics/generate-subtopics/route.ts`
- `apps/web/prisma/schema.prisma`
- `packages/db/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`
- `Agents/plan/03-database.md`
- `Agents/patches/DB-003.md`
- `Agents/patches/DB-003-specialist-eval.md`
- `Agents/patches/DB-003-eval.md`
- `Agents/stat.json`

### Searches and commands run

```bash
git status --short
git diff --name-only
git diff -- apps/web/src/lib/submission-queue.ts apps/web/src/lib/db.ts apps/web/src/lib/auth.ts apps/web/prisma/schema.prisma packages/shared/src/types.ts packages/shared/src/constants.ts
git diff -- 'apps/web/src/app/api/subjects/delete/route.ts' 'apps/web/src/app/api/import/route.ts' 'apps/web/src/app/api/contests/[contestId]/messages/route.ts' 'apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
git diff -- apps/web/src/app/api/homework/submit/route.ts apps/web/src/app/api/homework/generate/route.ts apps/web/src/app/api/tutor/route.ts apps/web/src/app/api/tutor/chat/route.ts apps/web/src/app/api/topics/generate-subtopics/route.ts
rg -n "submissionJobs|getNextJob|queueSubmission|completeJob|failJob|\$queryRaw|\$executeRaw|transaction|delete\(|deleteMany|updateMany|createMany|findFirst|findMany|upsert" apps/web/src apps/web/prisma packages -g '!**/node_modules/**'
rg -n "subject\.delete|userSubject\.deleteMany|replaceExisting|canAccessContestChat|canAccessLobbyChat|FOR UPDATE SKIP LOCKED|submission_jobs|@@index\(\[status, queuedAt\]\)|@@index\(\[status, priority" apps/web/src apps/web/prisma packages/db/prisma Agents/patches Agents/plan
rg --files apps/web/prisma packages/db/prisma | sort
rg --files -g '*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}' -g '!**/node_modules/**'
pnpm --filter @grindup/web exec eslint src/lib/submission-queue.ts src/app/api/subjects/delete/route.ts 'src/app/api/contests/[contestId]/messages/route.ts' 'src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
comm -23 <(rg -o '@@map\("[^"]+"\)' apps/web/prisma/schema.prisma | sed -E 's/.*@@map\("([^"]+)"\).*/\1/' | sort -u) <(rg -o 'CREATE TABLE "[^"]+"' apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql | sed -E 's/CREATE TABLE "([^"]+)"/\1/' | sort -u) | sed -n '1,80p'
```

### Code paths traced

- `getNextJob()` -> single PostgreSQL `UPDATE submission_jobs ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...`.
- `POST /api/subjects/delete` -> authenticated user -> `userSubject.deleteMany({ userId: session.user.id, subjectId })`.
- `POST /api/import` with `replaceExisting` -> `subject.findUnique({ name })` -> `subject.delete({ id })` -> global subject cascade.
- Contest/lobby chat GET/POST -> participant/creator relation check -> message read/create -> selected sender fields.
- Prisma schema relation and mapping checks for `SubmissionJobs`, `ContestParticipant`, `ContestLobbyParticipant`, `Subject`, and `UserSubject`.

### Tests reviewed

- No relevant committed `*.test.*` or `*.spec.*` files found.
- Reviewed DB-003 patch validation reports; no live PostgreSQL concurrency proof was rerun in this final review.

### Domain exclusions

- Runner auth, API auth messaging, XSS sanitisation, and shared TypeScript contract compatibility are owned by the Security, Validation, Reliability, and Compatibility agents unless the issue is caused by a database query or relation.

## Fixed-Status Assessment

- **DB-003 atomic queue claiming:** fixed for PostgreSQL. `apps/web/src/lib/submission-queue.ts:58-79` now uses one raw tagged Prisma query with `FOR UPDATE SKIP LOCKED`, claims only rows still matching `status = 'queued' AND attempts < max_attempts`, increments `attempts`, sets `started_at`, and returns the claimed row. This removes the original read-then-update race.
- **SEC-003 / DB-001 subject delete route overlap:** fixed for `POST /api/subjects/delete`. The route now deletes only the caller's enrollment at `apps/web/src/app/api/subjects/delete/route.ts:20-25` and no longer deletes the global `Subject`.
- **SEC-004 / DB-002 chat relation scoping overlap:** fixed for the reviewed routes. `canAccessContestChat` and `canAccessLobbyChat` require creator or participant relation before reads/writes, and sender `email` is no longer selected.

## Remaining Database Risks

- `apps/web/src/app/api/import/route.ts:794-798` still contains the original DB-001 import replacement cascade: any authenticated import with `replaceExisting` can delete a global `Subject` found by unique name, which cascades dependent subject data. This is not a new final-review finding because it was already documented in `Agents/plan/03-database.md` as part of DB-001 and was not part of the implemented DB-003 patch.
- DB-004 remains: first daily snapshot/streak writes are still split across non-transactional operations in exercise/homework completion paths.
- DB-005 remains: migration history still does not reproduce the checked-in Prisma schema; the migration drift command still lists many missing mapped tables, including `submission_jobs`, `daily_snapshots`, contest chat tables, and social/analytics tables.
- DB-003 has no committed automated concurrency regression test. Confidence in the fix is high from static inspection of the SQL pattern, but user/manual PostgreSQL validation is still required before approval.

## New Database Findings

No new concrete database/data-integrity findings were found in the final-review scope. The remaining database risks above are pre-existing planned findings or known test/migration gaps, not regressions introduced by the DB-003 queue patch.

## Readiness Verdict

Database final review: **ready for user testing with caveats**. DB-003 is correctly fixed at the data-layer root cause, and the reviewed Prisma/queue/auth relation patches did not introduce a new data-integrity regression. Do not treat the broader database surface as complete until the residual DB-001 import replacement path, DB-004 transaction gap, DB-005 migration drift, and DB-003 concurrency regression test gap are addressed or explicitly accepted.
