# Eval Report: SEC-FR-001

## Verdict

Needs user testing. Supervisor eval passes after the specialist PASS.

## What changed

The outer `POST /api/execute` catch in `apps/web/src/app/api/execute/route.ts` now keeps server-side logging and returns only `{ error: 'Internal server error', status: 'error' }` with HTTP 500.

## Does this fix the root cause?

Yes. `Agents/patches/SEC-FR-001-specialist-eval.md` passed and confirmed the response no longer exposes `error.message`, `error.stack`, `String(error)`, or a `details` field.

## Scope check

Pass. The SEC-FR-001 source change is at the identified outer catch response. Earlier execute-route auth and runner changes are separate existing task work and were not changed by this supervisor eval.

## Backwards compatibility check

Pass. The response keeps the existing `error` and `status` fields for unexpected 500s; only raw internal diagnostic details are removed from the client response.

## Test check

No new automated route test was added for this low-risk disclosure fix. Manual authenticated API testing is still required before approval.

## Commands run

```bash
test -f AGENTS.md && sed -n '1,220p' AGENTS.md || printf 'AGENTS.md missing\n'
sed -n '1,220p' Agents/README.md
jq '.summary, (.tasks[] | select(.id=="SEC-FR-001"))' Agents/stat.json
sed -n '1,220p' Agents/final-review/01-security.md
sed -n '1,220p' Agents/patches/SEC-FR-001.md
sed -n '1,220p' Agents/patches/SEC-FR-001-specialist-eval.md
nl -ba apps/web/src/app/api/execute/route.ts | sed -n '260,330p'
rg -n "details:|String\(error\)|error\?\.message|error\?\.stack|Internal server error" apps/web/src/app/api/execute/route.ts
python3 -m json.tool Agents/stat.json >/dev/null
pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts
git diff -- apps/web/src/app/api/execute/route.ts
git status --short -- apps/web/src/app/api/execute/route.ts Agents/stat.json Agents/patches/SEC-FR-001.md Agents/patches/SEC-FR-001-specialist-eval.md Agents/patches/SEC-FR-001-eval.md Agents/patches/SEC-FR-001-user-test.md
```

## Command results

Passed: `AGENTS.md` absence was confirmed and the eval continued from `Agents/README.md` and `Agents/stat.json`; the specialist eval exists and passed; the disclosure search returns only the generic `Internal server error` response line; `Agents/stat.json` is valid JSON.

Failed but non-blocking: `pnpm --filter @grindup/web exec eslint src/app/api/execute/route.ts` still fails on existing unrelated issues at lines 38, 50, and 301 (`no-explicit-any` and unused `getXPReward` / `problemId`).

Not run: the authenticated curl proof was not run because no authenticated browser/session cookie was available in this supervisor context.

## Risks remaining

Manual testing must verify that the malformed authenticated request returns only the generic body, server logs still retain useful diagnostic detail, and normal authenticated code execution still works.

## Eval decision

Pass automated supervisor review and mark `SEC-FR-001` as `needs_user_test`. Do not mark approved.

## Suggested commit message

Sanitize execute API error responses
