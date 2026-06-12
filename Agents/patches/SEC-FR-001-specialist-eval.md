# Specialist Eval: SEC-FR-001

## Verdict

PASS. The worker patch fixes the raw internal error disclosure in the outer `POST /api/execute` catch without weakening authentication, runner dispatch, or intentional user-code result behavior.

## Scope Checked

- `AGENTS.md` was not present at the project root; only dependency copies under `node_modules` were found, so this eval continued from `Agents/README.md` and `Agents/stat.json`.
- Read `Agents/stat.json`, `Agents/final-review/01-security.md`, `Agents/patches/SEC-FR-001.md`, and `apps/web/src/app/api/execute/route.ts`.
- Reviewed the current route diff for the execute API.

## Security Assessment

- The auth gate still runs before `req.json()`, so unauthenticated callers continue to receive `401` before body parsing or runner work.
- The outer catch now logs the caught exception server-side and returns only `{ error: 'Internal server error', status: 'error' }` with HTTP 500.
- The response no longer includes `error.message`, `error.stack`, `String(error)`, or a `details` field.
- The inner runner failure path remains the existing generic runner-unavailable response, and normal runner/user-code result bodies continue to flow through the success response path.

## Validation

```bash
rg -n "details:|String\(error\)|error\?\.message|error\?\.stack|Internal server error" apps/web/src/app/api/execute/route.ts
```

Returned only the generic `Internal server error` response line.

```bash
python3 -m json.tool Agents/stat.json >/dev/null
```

Passed.

```bash
pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts
```

Failed on existing unrelated lint issues: `@typescript-eslint/no-explicit-any` at lines 38 and 50, and unused `getXPReward` / `problemId` warnings at line 301.

## Result

Leave `SEC-FR-001` status as `implemented` and proceed to Eval/Supervisor review.
