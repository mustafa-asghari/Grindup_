# Eval Report: DB-003

## Verdict

Needs user testing

## What changed

`apps/web/src/lib/submission-queue.ts` now claims a queued job with one PostgreSQL `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING ...` statement. The patch also tightened local Prisma JSON types in the same file so file-level ESLint passes.

## Does this fix the root cause?

Yes. The specialist eval passed and confirmed the old read-then-update race was replaced by an atomic row-locking claim, so concurrent workers cannot both receive the same queued row.

## Scope check

The DB-003 app-source change is limited to `apps/web/src/lib/submission-queue.ts`, the original fix location. Agent report and status files are expected workflow artifacts; other dirty worktree files belong to separate tasks and were not evaluated as DB-003 scope.

## Backwards compatibility check

The public `getNextJob()` return shape is unchanged: `{ id, userId, problemId, code, language } | null`. The SQL uses existing mapped table and column names, introduces no schema or migration dependency, preserves priority/FIFO ordering, increments `attempts`, sets `started_at`, and uses Prisma tagged raw SQL without interpolated user input.

## Test check

No permanent automated concurrency test was added. This is acceptable for this task because the repository currently lacks a queue concurrency test harness and parent validation included a live Docker PostgreSQL proof of `FOR UPDATE SKIP LOCKED`; user testing should repeat or review that database-level proof before approval.

## Commands run

```bash
git diff -- apps/web/src/lib/submission-queue.ts
jq '.summary, (.tasks[] | select(.id == "DB-003"))' Agents/stat.json
nl -ba apps/web/src/lib/submission-queue.ts | sed -n '1,180p'
nl -ba apps/web/prisma/schema.prisma | sed -n '930,965p'
nl -ba packages/db/prisma/schema.prisma | sed -n '930,965p'
```

Parent validation evidence reviewed:

```bash
pnpm --filter @grindup/web exec eslint src/lib/submission-queue.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
python3 -m json.tool Agents/stat.json >/dev/null
```

Parent live SQL proof reviewed: a locked queued `submission_jobs` row was skipped, the unlocked row was claimed exactly once, a second claim returned zero rows, and final state was `status='processing'`, `attempts=1`, with `started_at IS NOT NULL`.

## Command results

Passed. Supervisor inspection found no DB-003 scope, compatibility, or status-rule blocker.

## Risks remaining

The queue still has no committed automated concurrency regression test. Manual/user validation must confirm the claim behavior against PostgreSQL before approval.

## Eval decision

Mark DB-003 `needs_user_test`.

## Suggested commit message

`Make submission job claims atomic`
