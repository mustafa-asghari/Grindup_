# User Test Instructions: COMPAT-001

## What was fixed

The shared execution contract now uses the same snake_case request and response fields as `/api/execute` and the runner. `csharp` is no longer listed as a supported execution language until runner support exists.

## Where to test

- Type contract: `packages/shared/src/types.ts`
- API endpoint: `POST /api/execute`
- Browser flow: problem editor code execution

## Setup needed

Install dependencies and start the app stack if testing runtime execution. Because the execute route now requires authentication from a separate security fix, use a logged-in browser session or an authenticated API request for `/api/execute`.

## Test steps

1. Run `pnpm --filter @grindup/shared lint`.
2. Run `pnpm --filter @grindup/web exec tsc --noEmit --pretty false`.
3. Confirm TypeScript rejects `ExecutionLanguage = 'csharp'`.
4. Confirm TypeScript rejects the old camelCase `SubmissionRequest` fields: `problemId`, `testCases`, `timeLimitMs`, and `memoryLimitKb`.
5. From a logged-in problem editor, run code in Python, JavaScript, Java, or C++.
6. If testing the API directly, send a snake_case payload with `problem_id`, `test_cases`, `time_limit_ms`, and `memory_limit_kb`.

## Expected result

The type checks pass for the repo, old shared-contract payloads fail at compile time, and snake_case execution requests are handled by the API without a `Missing required fields` response.

## Bad result

The fix failed if `csharp` still compiles as an `ExecutionLanguage`, the old camelCase `SubmissionRequest` still compiles, or a valid authenticated snake_case request returns `Missing required fields`.

## Regression checks

- Existing problem editor execution still sends snake_case payloads.
- The editor language picker still offers Python, JavaScript, Java, and C++.
- Runner unsupported-language behavior is unchanged for values outside the supported list.

## What to tell the AI after testing

If the test passed, say:

`I tested task COMPAT-001 and approve it.`

If the test failed, say:

`Task COMPAT-001 failed user testing. Here is what happened: <details>.`
