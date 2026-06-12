# Eval Report: SEC-004

## Verdict

Needs user testing

## What changed

The patch adds creator-or-participant authorization checks before contest and lobby chat reads/writes, and reuses a sender selection that omits `email`.

## Does this fix the root cause?

Yes. The specialist eval passed and confirmed the patch fixes the missing participant authorization and removes sender email fields from both API response surfaces.

## Scope check

Pass. The inspected diff is limited to the two SEC-004 route files and matches the original fix locations.

## Backwards compatibility check

Pass with low residual risk. Contest/lobby creators and participants remain authorized; clients depending on sender `id`, `name`, or `image` remain compatible. Any client still expecting `user.email` must stop relying on that private field.

## Test check

No automated route test was added. Worker and specialist reported targeted lint/typecheck passed; manual API testing is still required because this task depends on real participant and non-participant sessions.

## Commands run

```bash
jq '.tasks[] | select(.id=="SEC-004")' Agents/stat.json
jq '.summary' Agents/stat.json
git diff -- 'apps/web/src/app/api/contests/[contestId]/messages/route.ts' 'apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
git diff --name-only -- 'apps/web/src/app/api/contests/[contestId]/messages/route.ts' 'apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
git diff --check -- 'apps/web/src/app/api/contests/[contestId]/messages/route.ts' 'apps/web/src/app/api/contests/lobbies/[lobbyId]/messages/route.ts'
python3 -m json.tool Agents/stat.json >/dev/null
jq -r '.tasks[].status' Agents/stat.json | sort | uniq -c
```

## Command results

Passed. The path-limited diff contains only the expected route files, `git diff --check` reported no whitespace errors, `Agents/stat.json` is valid JSON, and status counts are 6 queued and 4 needing user test.

## Risks remaining

No automated API regression test covers non-participant denial, participant success, or email redaction.

## Eval decision

Mark SEC-004 as `needs_user_test`.

## Suggested commit message

`Authorize contest chat access`
