# Patch Note: SEC-FR-001

## Worker personality

Security Worker - Paranoid Threat Hunter.

## Issue

`POST /api/execute` exposed raw internal exception details to authenticated callers from the outer catch block.

## Root cause

The catch response returned `error?.message` and `String(error)` in the JSON body instead of keeping those details server-side only.

## Original proof example

`curl -i -X POST http://localhost:3000/api/execute -H 'Cookie: <authenticated-session>' -H 'Content-Type: application/json' --data '{"code":"x","language":"python","problem_id":{"not":"a-string"},"test_cases":[]}'`

## Original fix location

`apps/web/src/app/api/execute/route.ts` outer catch in `POST`, lines 292-297.

## Original what to change

Keep server-side logging, but return a generic body such as `{ error: "Internal server error", status: "error" }` without `error.message`, `error.stack`, or `String(error)`.

## Files changed

- `apps/web/src/app/api/execute/route.ts`
- `Agents/stat.json`
- `Agents/patches/SEC-FR-001.md`

## Fix made

Changed the exact original fix location. The outer catch now logs the caught error server-side with `console.error('Execution error:', error)` and returns only `{ error: 'Internal server error', status: 'error' }` with HTTP 500.

## Why this fix is minimal

The patch only changes the unexpected-error response body in the outer catch. Normal execution behavior and the inner runner-service unavailable response are unchanged.

## Validation attempted

- `pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts` failed on unrelated existing issues: `@typescript-eslint/no-explicit-any` at lines 38 and 50, and unused `getXPReward`/`problemId` warnings at line 301.
- `rg -n "details:|String\(error\)|error\?\.message|error\?\.stack|Internal server error" apps/web/src/app/api/execute/route.ts` returned only the generic `Internal server error` line.
- `jq empty Agents/stat.json` passed.
- Status-count check showed `implemented=1`, `queued=1`, `needs_user_test=13`, matching the summary.
- The original authenticated proof request was not rerun because no authenticated web session was available in this worker run.

## Result

Unexpected outer `POST /api/execute` failures no longer return raw internal messages, stack-derived strings, or `details` fields to clients.

## Compatibility notes

The 500 response still includes the existing top-level `error` and `status` fields. Clients that depended on raw internal `details` from unexpected failures lose that diagnostic-only field by design.

## Specialist eval handoff

Security Agent - Paranoid Threat Hunter must review this patch next.

## Suggested commit message

Sanitize execute API error responses
