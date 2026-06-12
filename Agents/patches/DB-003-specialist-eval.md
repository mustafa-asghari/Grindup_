# DB-003 Specialist Eval

**Status:** Pass  
**Agent:** Database Agent - Data Integrity Engineer  
**Scope:** Database/data-integrity correctness only

## Coverage

- Inspected `apps/web/src/lib/submission-queue.ts`.
- Checked `SubmissionJobs` mappings in `apps/web/prisma/schema.prisma` and `packages/db/prisma/schema.prisma`.
- Reviewed the diff for `apps/web/src/lib/submission-queue.ts` and DB-003 state in `Agents/stat.json`.

## Evaluation

- The claim is now one PostgreSQL `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) ... RETURNING` statement, so concurrent workers cannot both claim the same queued row; overlapping claimers either skip a locked row or see it no longer has `status = 'queued'`.
- Raw table and column names match the mapped Prisma model: `SubmissionJobs` -> `submission_jobs`, `userId` -> `user_id`, `problemId` -> `problem_id`, `maxAttempts` -> `max_attempts`, `queuedAt` -> `queued_at`, and `startedAt` -> `started_at`.
- Priority/FIFO order is preserved with `ORDER BY priority ASC, queued_at ASC`; the claim still increments `attempts`, sets `started_at`, changes status to `processing`, and returns the same public job shape declared by `getNextJob()`.
- The JSON type cleanup preserves `completeJob()` and `getJobStatus()` behavior: stored `result` remains Prisma JSON, and status responses still return the stored result/error fields.
- No raw SQL injection risk was introduced; the Prisma tagged raw query has no interpolated user input.
- No schema or migration changes were introduced, so the patch stays within DB-003 scope.

## Validation

- `pnpm --filter @grindup/web exec eslint src/lib/submission-queue.ts` - passed
- `pnpm --filter @grindup/web exec tsc --noEmit --pretty false` - passed
- `python3 -m json.tool Agents/stat.json >/dev/null` - passed

The live PostgreSQL concurrency proof was not rerun in this eval pass because no database-backed worker runtime was started.
