# Eval Report: SEC-003

## Verdict

Needs user testing

## What changed

`POST /api/subjects/delete` now removes only the current user's `UserSubject` enrollment for the submitted `subjectId`. It no longer deletes the shared `Subject` row, and it returns `404` when the caller has no matching enrollment.

## Does this fix the root cause?

Yes. The specialist eval in `Agents/patches/SEC-003-specialist-eval.md` passed and confirmed the global `prisma.subject.delete` call was removed from the route. The replacement `prisma.userSubject.deleteMany` is scoped by both `session.user.id` and `subjectId`, which prevents a regular authenticated user from deleting global subject data or another user's enrollment through this endpoint.

## Scope check

Pass. The application-source diff is limited to `apps/web/src/app/api/subjects/delete/route.ts`, which is the original fix location for SEC-003. The change does not introduce an admin/ownership model or alter unrelated subject routes.

## Backwards compatibility check

Pass with one intentional behavior change. Successful callers still receive `{ "success": true }` and the same paths are revalidated. Callers that previously depended on this endpoint deleting global subjects now receive scoped unenrollment behavior, which is the intended security fix.

## Test check

No automated multi-user authorization test exists for this route. Manual user testing is still required with two users or seeded enrollments to prove only the caller's enrollment is removed.

## Commands run

```bash
python3 -m json.tool Agents/stat.json >/dev/null
git diff --check -- apps/web/src/app/api/subjects/delete/route.ts Agents/stat.json Agents/patches/SEC-003.md Agents/patches/SEC-003-specialist-eval.md
pnpm --filter @grindup/web exec eslint src/app/api/subjects/delete/route.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
nl -ba apps/web/src/app/api/subjects/delete/route.ts | sed -n '1,120p'
```

## Command results

Passed. JSON validation, diff whitespace checks, targeted ESLint, and TypeScript completed successfully. Full web lint was not rerun for this eval because the repo has known pre-existing lint debt outside SEC-003.

## Risks remaining

The route still accepts a client-supplied `subjectId`, so the protection depends on the scoped `userId + subjectId` delete predicate. That is acceptable for this fix, but should be covered by a future route test.

## Eval decision

Mark SEC-003 as `needs_user_test`. Do not mark it approved until the user manually verifies the subject removal flow and explicitly approves the task.

## Suggested commit message

Prevent unauthorized subject deletion
