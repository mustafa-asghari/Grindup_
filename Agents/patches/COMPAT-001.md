# Patch Note: COMPAT-001

## Worker personality

Compatibility Worker - Minimalist Maintainer

## Issue

Shared execution request and response types did not match the live `/api/execute` and runner JSON contracts, and shared supported languages advertised `csharp`.

## Root cause

The shared package used camelCase submission fields while the web route, editor, and runner use snake_case fields. The shared language union and `SUPPORTED_LANGUAGES` also included `csharp`, but the runner only registers Python, JavaScript, Java, and C++ handlers.

## Original proof example

```bash
curl -i -X POST http://localhost:3000/api/execute -H 'Content-Type: application/json' --data '{"code":"def solution(): return 1","language":"python","problemId":"any","testCases":[],"timeLimitMs":2000,"memoryLimitKb":256000}'
```

## Original fix location

`packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, and `apps/web/src/app/api/execute/route.ts`.

## Original what to change

Align shared types with canonical web API shape or accept both shapes through a compatibility adapter and remove `csharp` until supported.

## Files changed

- `packages/shared/src/types.ts`
- `packages/shared/src/constants.ts`
- `Agents/stat.json`
- `Agents/patches/COMPAT-001.md`

## Fix made

The patch changed the exact shared package fix locations. `SubmissionRequest`, `TestCase`, `SubmissionResult`, and `TestResult` now use the existing snake_case execution contract, optional request limits match the route defaults, response fields include `submission_id` and nullable runner error/output fields, and `csharp` was removed from the execution language union and `SUPPORTED_LANGUAGES`.

No `apps/web/src/app/api/execute/route.ts` adapter was added because the shared contract now matches the existing snake_case API, preserving current UI/API callers without changing execution logic.

## Why this fix is minimal

The patch only updates exported shared contracts and the language list. It does not change the execute route, runner behavior, editor payloads, submission persistence, or response processing.

## Validation attempted

- `pnpm --filter @grindup/shared lint` - passed.
- `pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts` - failed on existing route lint findings: three `@typescript-eslint/no-explicit-any` errors at lines 38, 50, and 292, plus unused `getXPReward` warnings at line 302.
- `pnpm --filter @grindup/web exec tsc --noEmit --pretty false` - passed.

The original proof curl was not rerun because this Worker pass did not start the authenticated web/database/runtime stack, and that camelCase payload is no longer the shared `SubmissionRequest` shape after the fix.

## Result

Callers typed against `@grindup/shared` now build the same snake_case payload the live web route accepts and consume the same snake_case response the runner returns through the web route. `csharp` is no longer advertised by shared execution constants until runner support exists.

## Compatibility notes

Existing snake_case UI and API callers are preserved. Consumers using the previous shared camelCase submission fields will get TypeScript errors and need to send the live snake_case contract.

## Specialist eval handoff

Clean Code and Compatibility Agent - Minimalist Maintainer must review this patch next and write `Agents/patches/COMPAT-001-specialist-eval.md`.

## Suggested commit message

`Align shared execution contract with runner API`
