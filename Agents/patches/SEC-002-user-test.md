# User Test Instructions: SEC-002

## What was fixed

`POST /api/problems/scrape` now requires `PROBLEM_SCRAPE_SECRET` via `Authorization: Bearer <secret>` before it starts LeetCode fetches, OpenAI embeddings, Prisma writes, ClickHouse inserts, or other scraper work. Error responses should no longer expose stack traces.

## Where to test

- API endpoint: `POST /api/problems/scrape`
- Route file: `apps/web/src/app/api/problems/scrape/route.ts`
- Environment variable: `PROBLEM_SCRAPE_SECRET`

## Setup needed

Run the web app with a local/test database and set `PROBLEM_SCRAPE_SECRET` to a non-empty test value, for example `local-scrape-secret`. Use a test environment because an authorized request can start the real scrape job and may perform external calls or writes.

## Test steps

1. Start the web app locally.
2. Send an unauthorized request:

```bash
curl -i -X POST http://localhost:3000/api/problems/scrape
```

3. Check the response and server logs.
4. Send an authorized request with the configured secret:

```bash
curl -i -X POST http://localhost:3000/api/problems/scrape \
  -H 'Authorization: Bearer local-scrape-secret'
```

5. If local dependencies are incomplete, inspect the error response from the authorized request.

## Expected result

The unauthorized request returns `401` or `403` and does not start scraper work: there should be no scrape-start log, no LeetCode fetch, no embedding call, and no database or ClickHouse writes. The authorized Bearer request should pass the auth gate and allow the route to proceed, returning either the normal scrape success response or a later generic failure if local scraper dependencies are not configured.

## Bad result

The fix failed if an unauthenticated request starts scraper work, if a correctly configured Bearer token still returns `401` or `403`, or if any error response contains a stack trace, raw exception object, or internal stack frames.

## Regression checks

- Authorized success responses still use the existing `success`, `count`, and `message` shape.
- Unset or empty `PROBLEM_SCRAPE_SECRET` fails closed.
- Error responses contain a generic message such as `Problem scrape failed`, not `stack`.

## What to tell the AI after testing

If the test passed, say:

`I tested task SEC-002 and approve it.`

If the test failed, say:

`Task SEC-002 failed user testing. Here is what happened: <details>.`
