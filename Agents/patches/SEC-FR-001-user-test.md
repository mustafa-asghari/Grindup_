# User Test Instructions: SEC-FR-001

## What was fixed

Unexpected internal failures in `POST /api/execute` should no longer return raw exception messages, stack-derived strings, or `details` fields to API clients.

## Where to test

- API endpoint: `POST /api/execute`
- File/function: `apps/web/src/app/api/execute/route.ts`, outer `POST` catch
- Web app: `http://localhost:3000`

## Setup needed

Start the web app and sign in locally so you have an authenticated session cookie. Start the runner too if you want to run the normal-execution regression check.

## Test steps

1. Send this malformed request with a valid authenticated session cookie:

   ```bash
   curl -i -X POST http://localhost:3000/api/execute \
     -H 'Cookie: <authenticated-session-cookie>' \
     -H 'Content-Type: application/json' \
     --data '{"code":"x","language":"python","problem_id":{"not":"a-string"},"test_cases":[]}'
   ```

2. Inspect the response body.
3. Run a normal authenticated code execution from the editor/API.
4. Optionally check the server terminal logs for the internal exception details.

## Expected result

The malformed request returns HTTP 500 with only a generic body like `{ "error": "Internal server error", "status": "error" }`. Normal authenticated execution still returns the expected execution result shape.

## Bad result

The fix failed if the response body includes a raw exception message, stack trace, `details`, `String(error)`, Prisma/framework internals, or if normal authenticated execution breaks.

## Regression checks

- Unauthenticated `/api/execute` requests still return `401`.
- Runner unavailable responses still return the existing generic runner-service error.
- Intentional user-code execution results remain visible where the runner is expected to return them.
- Server logs still include enough detail to debug unexpected execute-route failures.

## What to tell the AI after testing

If the test passed, say:

`I tested task SEC-FR-001 and approve it.`

If the test failed, say:

`Task SEC-FR-001 failed user testing. Here is what happened: <details>.`
