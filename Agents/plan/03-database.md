# Database Agent - Data Integrity Engineer

## Coverage Evidence

### Areas inspected

- `apps/web/prisma/schema.prisma`
- `packages/db/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`
- `apps/web/prisma/seed.ts`
- `apps/web/prisma/seed-subjects.ts`
- `apps/web/src/lib/db.ts`
- `packages/db/src/index.ts`
- `apps/web/src/lib/submission-queue.ts`
- `apps/web/src/lib/clickhouse.ts`
- Database-backed routes under `apps/web/src/app/api/**`, with focus on subjects, imports, exercises, homework, contests, social challenges, notifications, activity, reports, and ClickHouse import/search paths.

### Searches and commands run

```bash
rg -n "prisma\.|\$queryRaw|\$executeRaw|findMany|findFirst|findUnique|createMany|updateMany|deleteMany|\$transaction" apps packages --glob '!**/node_modules/**'
rg -n "\$queryRaw|\$queryRawUnsafe|\$executeRaw|\$executeRawUnsafe|Prisma\.sql" apps packages --glob '!**/node_modules/**'
rg -n "initClickHouse|initImportSourcesTable|clickhouse\.query|clickhouse\.insert|clickhouse\.exec|problems_vec|import_sources" apps/web/src apps/web/prisma packages --glob '!**/node_modules/**'
rg --files -g '*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}' -g '!**/node_modules/**'
comm -23 <(rg -o '@@map\("[^"]+"\)' apps/web/prisma/schema.prisma | sed -E 's/.*@@map\("([^"]+)"\).*/\1/' | sort -u) <(rg -o 'CREATE TABLE "[^"]+"' apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql | sed -E 's/CREATE TABLE "([^"]+)"/\1/' | sort -u)
pnpm --filter @grindup/db exec prisma migrate diff --from-migrations /Users/mustafaasghari/code/study/GrindUp/apps/web/prisma/migrations --to-schema-datamodel /Users/mustafaasghari/code/study/GrindUp/apps/web/prisma/schema.prisma --script
```

### Code paths traced

- `POST /api/subjects/delete` -> `prisma.subject.delete` -> `subjects` foreign-key cascades into topics, enrollments, vectors, and progress.
- `POST /api/import` with `replaceExisting` -> global subject lookup by name -> `prisma.subject.delete` -> recreate global subject and topics.
- `GET/POST /api/contests/[contestId]/messages` and `/api/contests/lobbies/[lobbyId]/messages` -> message query/create by path id only -> no participant relation predicate.
- `getNextJob()` -> queued job `findFirst` -> update by primary key only -> worker receives pre-update job.
- `POST /api/exercises/submit` and `PATCH /api/homework` -> attempt/XP writes -> first-daily `dailySnapshots.findUnique` -> user streak update -> `dailySnapshots.create`.
- Prisma schema maps and ClickHouse init/insert/query paths for `problems_vec` and `import_sources`.

### Tests reviewed

- No relevant `*.test.*` or `*.spec.*` files found outside dependencies.
- No migration drift, tenant separation, queue concurrency, transaction atomicity, pagination, or ClickHouse integration tests found.

### Domain exclusions

- Authentication/session correctness is owned by Security Agent unless the database query itself breaks user separation.
- Input validation details are owned by Validation and Sanitisation Agent.
- Frontend rendering, layout, and client performance are out of scope.
- Runner sandboxing and deployment hardening are out of scope except where they affect persisted database state.

## Finding DB-001: Authenticated subject delete cascades across all users

**Severity:** High  
**Confidence:** High  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Tenant/user separation, destructive writes, referential integrity

### Files involved

- `apps/web/src/app/api/subjects/delete/route.ts`
- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/subjects/create/route.ts`
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`

### Problem

`Subject` rows are global catalog rows with no owner field, but authenticated routes treat them as user-owned objects. `POST /api/subjects/delete` deletes any subject by id, and the schema cascades that delete into `subject_topics`, `user_subjects`, `subject_vectors`, and related progress for every user.

### Proof example

```bash
curl -i -X POST http://localhost:3000/api/subjects/delete \
  -H 'Cookie: <normal-user-session>' \
  -H 'Content-Type: application/json' \
  --data '{"subjectId":"<subject-id-owned-or-used-by-another-user>"}'
psql "$DATABASE_URL" -c "select count(*) from subjects where id='<subject-id>'; select count(*) from user_subjects where subject_id='<subject-id>';"
```

### Current behaviour

The request succeeds for any authenticated user and the subject plus dependent rows disappear for all users.

### Expected behaviour

A user can remove only their own enrollment or delete only a user-owned custom subject; global or other-user subjects are not deleted.

### Evidence

`apps/web/src/app/api/subjects/delete/route.ts:20-23` calls `prisma.subject.delete({ where: { id: subjectId } })` after only checking that a session exists. `apps/web/prisma/schema.prisma:893`, `apps/web/prisma/schema.prisma:907`, and `apps/web/prisma/schema.prisma:1143` define subject-linked cascades; the migration also creates `ON DELETE CASCADE` for subject topics and user subjects at `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql:622-638`. `apps/web/src/app/api/import/route.ts:673-677` has the same global delete path when replacing an existing subject by name, while `apps/web/src/app/api/subjects/create/route.ts:860-899` creates global subjects and then enrolls only the creator.

### Fix location

`apps/web/src/app/api/subjects/delete/route.ts`, `POST`; `apps/web/src/app/api/import/route.ts`, replacement block around lines 673-677; `apps/web/prisma/schema.prisma`, `Subject` ownership model around lines 912-937.

### What to change

Add a user ownership boundary for custom subjects, for example `Subject.createdById`, migrate existing seeded/global subjects to `null`, and require `createdById = session.user.id` before destructive subject deletes. If a user is only leaving a subject, delete `UserSubject` by `{ userId, subjectId }` instead of deleting `Subject`; make import replacement update or delete only the current user's custom subject.

### Expected result after fix

Rerunning the proof request as a normal user against another user's or global subject returns `403` or removes only that user's enrollment, and the `subjects` and other users' `user_subjects` rows remain.

### Test gap

No API or database test covers cross-user subject deletion, import replacement, or cascade preservation for global catalog rows.

### Backwards compatibility risk

Medium, because existing custom subjects need a migration or backfill to distinguish global catalog rows from user-owned rows.

### Patch priority

High

### Suggested commit message

`Fix subject deletion ownership boundary`

## Finding DB-002: Contest and lobby message queries ignore participation

**Severity:** High  
**Confidence:** High  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Tenant/user separation, query scoping

### Files involved

- `apps/web/src/app/api/contests/[contestId]/messages/route.ts`
- `apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`
- `apps/web/prisma/schema.prisma`

### Problem

Contest and lobby message routes select and insert messages by `contestId` or `lobbyId` only, without requiring the current user to be a participant. Any authenticated user who knows an id can read or post messages for that contest/lobby, including private lobby messages.

### Proof example

```bash
curl -i http://localhost:3000/api/contests/lobbies/<private-lobby-id>/messages \
  -H 'Cookie: <authenticated-nonparticipant-session>'
curl -i -X POST http://localhost:3000/api/contests/lobbies/<private-lobby-id>/messages \
  -H 'Cookie: <authenticated-nonparticipant-session>' \
  -H 'Content-Type: application/json' \
  --data '{"message":"not a member"}'
```

### Current behaviour

The GET returns lobby messages and selected user fields, and the POST creates a message linked to the lobby even when the caller is not a lobby participant.

### Expected behaviour

Nonparticipants receive `403` and no message rows are returned or inserted.

### Evidence

`apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts:18-34` uses `where: { lobbyId }`, and lines 57-62 create a message with that `lobbyId`. `apps/web/src/app/api/contests/[contestId]/messages/route.ts:18-34` and lines 57-62 do the same for contests. The schema has participant tables and relations at `apps/web/prisma/schema.prisma:245-255` and `apps/web/prisma/schema.prisma:1381-1401`, but these routes do not use them as query predicates.

### Fix location

`apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts`, both handlers; `apps/web/src/app/api/contests/[contestId]/messages/route.ts`, both handlers.

### What to change

Before reading or creating messages, require a matching `contestLobbyParticipant` or `contestParticipant` row for `{ lobbyId/contestId, userId: session.user.id }`, or put the relation predicate directly into the read query and return `403` when it does not match. Keep the same predicate for writes so nonparticipants cannot insert rows.

### Expected result after fix

Rerunning the proof commands as a nonparticipant returns `403`, and `select count(*) from contest_lobby_messages where lobby_id='<private-lobby-id>' and message='not a member';` stays `0`.

### Test gap

No route or repository test verifies that contest/lobby message reads and writes are scoped to participants.

### Backwards compatibility risk

Low, because legitimate participants keep the same data path.

### Patch priority

High

### Suggested commit message

`Scope contest messages to participants`

## Finding DB-003: Submission queue claim can hand one job to multiple workers

**Severity:** High  
**Confidence:** High  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Transaction atomicity, race conditions

### Files involved

- `apps/web/src/lib/submission-queue.ts`
- `apps/web/prisma/schema.prisma`

### Problem

`getNextJob()` reads the next queued job and then updates it by primary key only. Under PostgreSQL's default read-committed isolation, two workers can both read the same queued row before either commit, then both update and return that same job.

### Proof example

```ts
const id = await queueSubmission({ userId, problemId, code: "print(1)", language: "python" });
const [a, b] = await Promise.all([getNextJob(), getNextJob()]);
console.log(a?.id, b?.id, await prisma.submissionJobs.findUnique({ where: { id } }));
```

### Current behaviour

Both workers can receive the same job id, and the row's `attempts` can be incremented twice for one queued submission.

### Expected behaviour

Exactly one worker claims the job; concurrent workers either receive different jobs or `null`.

### Evidence

`apps/web/src/lib/submission-queue.ts:50-74` performs `findFirst({ where: { status: 'queued' } })` and then `update({ where: { id: nextJob.id } })`; the update does not re-check `status: 'queued'` or lock with `FOR UPDATE SKIP LOCKED`. The `SubmissionJobs` model at `apps/web/prisma/schema.prisma:940-958` has queue indexes but no claim token or uniqueness guard that prevents duplicate claims.

### Fix location

`apps/web/src/lib/submission-queue.ts`, `getNextJob`, lines 50-74.

### What to change

Make the claim a single atomic database operation, preferably a raw SQL `UPDATE submission_jobs SET status='processing', started_at=now(), attempts=attempts+1 WHERE id = (SELECT id FROM submission_jobs WHERE status='queued' AND attempts < max_attempts ORDER BY priority ASC, queued_at ASC FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...`, or use an `updateMany` claim predicate plus retry loop that updates only rows still in `queued`. Add an index covering `(status, priority, queued_at)`.

### Expected result after fix

Rerunning the proof snippet prints one job id and one `undefined`/different id; the claimed job's `attempts` increments once.

### Test gap

No concurrency test covers two workers calling `getNextJob()` at the same time.

### Backwards compatibility risk

Low, because the queue API shape can stay the same while the claim query changes.

### Patch priority

High

### Suggested commit message

`Make submission job claims atomic`

## Finding DB-004: First daily snapshot writes are non-atomic

**Severity:** Medium  
**Confidence:** High  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Transactions, uniqueness constraints, data consistency

### Files involved

- `apps/web/src/app/api/exercises/submit/route.ts`
- `apps/web/src/app/api/homework/route.ts`
- `apps/web/prisma/schema.prisma`

### Problem

The first-activity-of-day path checks for a `daily_snapshots` row, updates `users.current_streak`, and then creates the unique snapshot in separate statements after already saving attempts and awarding XP. Concurrent first daily submissions can both see no snapshot; one later hits the unique constraint while previous attempt/XP/streak writes remain committed.

### Proof example

```bash
seq 1 2 | xargs -P2 -I{} curl -s -o /tmp/submit-{} -w "%{http_code}\n" \
  -X POST http://localhost:3000/api/exercises/submit \
  -H 'Cookie: <same-user-session>' \
  -H 'Content-Type: application/json' \
  --data '{"exerciseId":"<flashcard-or-mcq-id>","response":{"selectedIndices":[0]},"timeSpentSecs":1,"hintsUsed":0}'
psql "$DATABASE_URL" -c "select current_streak from users where id='<user-id>'; select count(*) from daily_snapshots where user_id='<user-id>' and date=current_date;"
```

### Current behaviour

One request can return `500` with a Prisma unique violation after it has already inserted an attempt and adjusted XP/streak, and the user's streak can be incremented twice when yesterday's snapshot exists.

### Expected behaviour

Both requests either commit a consistent aggregate state or one cleanly no-ops the first-daily side effect without leaving partial attempt/XP/streak state.

### Evidence

`apps/web/src/app/api/exercises/submit/route.ts:65-77` creates the attempt, lines 203-221 update XP and create an XP transaction, and lines 228-271 do `dailySnapshots.findUnique`, `user.update`, and `dailySnapshots.create/update` outside a transaction. `apps/web/src/app/api/homework/route.ts:215-294` repeats the same split update/create pattern for homework completion. The schema enforces only `@@unique([userId, date])` on `DailySnapshots` at `apps/web/prisma/schema.prisma:271-284`.

### Fix location

`apps/web/src/app/api/exercises/submit/route.ts`, daily snapshot block around lines 224-271; `apps/web/src/app/api/homework/route.ts`, completion block around lines 215-294.

### What to change

Wrap the attempt/progress/XP/snapshot changes in one `$transaction`. Use `dailySnapshots.upsert` for per-day counters, and update `users.currentStreak` only when the transaction actually creates the first snapshot for that user/date, or use the unique constraint as a guarded create and handle duplicate-create as "snapshot already exists" before any irreversible side effects.

### Expected result after fix

Rerunning the parallel proof returns successful responses or one controlled no-op; `daily_snapshots` has one row for the day, XP totals match accepted attempts, and `current_streak` increments at most once.

### Test gap

No test covers concurrent first daily exercise or homework completion against the `daily_snapshots_user_id_date` uniqueness constraint.

### Backwards compatibility risk

Medium, because progress, XP, and streak side effects need to move into a shared transaction boundary.

### Patch priority

Medium

### Suggested commit message

`Make daily snapshot updates atomic`

## Finding DB-005: Migration history does not reproduce the checked-in Prisma schema

**Severity:** Medium  
**Confidence:** High  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Prisma schema/migrations, deployment reproducibility

### Files involved

- `apps/web/prisma/schema.prisma`
- `packages/db/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`
- `packages/db/package.json`
- `compose.yml`
- `start-dev.sh`

### Problem

The checked-in Prisma schema contains many mapped tables that are absent from the only migration file. Local startup hides this with `prisma db push`, but any migration-based database build will miss tables used by the app.

### Proof example

```bash
comm -23 <(rg -o '@@map\("[^"]+"\)' apps/web/prisma/schema.prisma | sed -E 's/.*@@map\("([^"]+)"\).*/\1/' | sort -u) \
  <(rg -o 'CREATE TABLE "[^"]+"' apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql | sed -E 's/CREATE TABLE "([^"]+)"/\1/' | sort -u)
```

### Current behaviour

The command lists 47 schema tables missing from the migration, including `contest_lobbies`, `contest_messages`, `daily_snapshots`, `friendships`, `rate_limit_logs`, `study_challenges`, `submission_jobs`, `subject_vectors`, and `user_activities`.

### Expected behaviour

Applying migrations to an empty database creates every table and constraint required by the current Prisma client.

### Evidence

`apps/web/prisma/schema.prisma:169`, `apps/web/prisma/schema.prisma:242`, `apps/web/prisma/schema.prisma:284`, `apps/web/prisma/schema.prisma:958`, `apps/web/prisma/schema.prisma:1102`, `apps/web/prisma/schema.prisma:1363`, and `apps/web/prisma/schema.prisma:1401` map active models to tables that have no matching `CREATE TABLE` in `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`. `packages/db/package.json:8-9`, `compose.yml:115`, and `start-dev.sh:70-72` rely on `prisma generate`/`db push` rather than a complete migration history.

### Fix location

`apps/web/prisma/migrations/`, create a new migration or re-baseline migration set from the current `apps/web/prisma/schema.prisma`; `packages/db/package.json` and startup scripts, align schema-management commands with migration deployment.

### What to change

Generate and commit Prisma migration SQL for the current schema, including missing tables, indexes, foreign keys, enums, and cascades. Add a CI or reviewer command that runs `prisma migrate diff` with a shadow database to fail when migrations drift from `schema.prisma`; reserve `db push --accept-data-loss` for disposable local databases only.

### Expected result after fix

Rerunning the proof command prints no missing tables, and `prisma migrate deploy` on an empty database creates the tables used by the current app.

### Test gap

No migration drift check or empty-database migration smoke test exists.

### Backwards compatibility risk

Medium, because existing local databases created with `db push` may need baselining before migration deployment.

### Patch priority

Medium

### Suggested commit message

`Add migrations for current Prisma schema`
