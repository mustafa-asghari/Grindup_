# User Test Instructions: SEC-003

## What was fixed

The subject delete endpoint no longer deletes shared `Subject` records. It now removes only the authenticated caller's enrollment from `UserSubject`.

## Where to test

- Browser page: `/subjects`
- API endpoint: `POST /api/subjects/delete`
- File/function: `apps/web/src/app/api/subjects/delete/route.ts`

## Setup needed

Run the web app with a local database that has at least two users enrolled in the same subject, or one user enrolled in a subject and another subject where that user is not enrolled.

## Test steps

1. Sign in as user A and enroll user A in a subject that user B is also enrolled in.
2. From user A's session, remove that subject through the subject removal UI or send `POST /api/subjects/delete` with user A's session cookie and that `subjectId`.
3. Confirm the response is successful for user A.
4. Sign in as user B or inspect the database and confirm user B is still enrolled in the same subject.
5. From user A's session, send `POST /api/subjects/delete` for a subject where user A has no enrollment.

## Expected result

Only user A's `UserSubject` enrollment is removed. The shared `Subject` row remains, other users' enrollments remain, and the not-enrolled request returns `404` with `Subject enrollment not found`.

## Bad result

The fix failed if the shared `Subject` row is deleted, if another user's enrollment disappears, if an unenrolled user can delete anything, or if the subject list stops updating after a valid removal.

## Regression checks

- The caller's subject list updates after a valid removal.
- Other subject pages and enrollments remain accessible.
- Revalidating `/subjects` and `/` still produces the expected UI update.

## What to tell the AI after testing

If the test passed, say:

`I tested task SEC-003 and approve it.`

If the test failed, say:

`Task SEC-003 failed user testing. Here is what happened: <details>.`
