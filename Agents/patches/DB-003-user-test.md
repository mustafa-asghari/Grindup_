# User Test Instructions: DB-003

## What was fixed

`getNextJob()` now claims a queued submission job atomically with `FOR UPDATE SKIP LOCKED`, preventing two workers from receiving the same queued job.

## Where to test

- File/function: `apps/web/src/lib/submission-queue.ts` `getNextJob`
- Database table: `submission_jobs`
- Test target: Docker PostgreSQL used by the web app

## Setup needed

Start the app database and point `DATABASE_URL` at that PostgreSQL instance. Use a disposable `submission_jobs` row and delete it after the test.

## Test steps

1. Insert one queued `submission_jobs` row with valid `user_id`, `problem_id`, `code`, `language`, `status='queued'`, `attempts=0`, and `max_attempts=3`.
2. In one `psql` session, start a transaction and lock that row with `SELECT id FROM submission_jobs WHERE id='<test-id>' FOR UPDATE;`.
3. In another session, run the claim path, either by calling `getNextJob()` or by running the same `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING` query from the patch.
4. Confirm the claim returns zero rows while the test row is locked.
5. Commit or roll back the first transaction to release the lock.
6. Run the claim path again and confirm it returns exactly the test row once.
7. Run the claim path a second time and confirm it returns zero rows for that same test row.
8. Check the final row, then delete the test row.

## Expected result

The locked row is skipped while locked. After unlock, exactly one claim returns the row, and the final row has `status='processing'`, `attempts=1`, and `started_at IS NOT NULL`.

## Bad result

The fix failed if two claim attempts return the same job id, `attempts` increments more than once for one claim, a locked row blocks instead of being skipped, or the returned job shape differs from `{ id, userId, problemId, code, language }`.

## Regression checks

- A single queued job can still be claimed normally.
- Priority/FIFO ordering still uses `priority ASC, queued_at ASC`.
- `completeJob()`, `failJob()`, and `getJobStatus()` still work with the claimed job.

## What to tell the AI after testing

If the test passed, say:

`I tested task DB-003 and approve it.`

If the test failed, say:

`Task DB-003 failed user testing. Here is what happened: <details>.`
