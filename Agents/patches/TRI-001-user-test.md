# User Test Instructions: TRI-001

## What was fixed

The review workspace status summary was refreshed so it no longer describes the older final-review state with 10 user-test tasks and 5 queued follow-ups.

## Where to test

- File: `Agents/README.md`
- File: `Agents/stat.json`
- Test command: `python3 -m json.tool Agents/stat.json >/dev/null`

## Setup needed

None.

## Test steps

1. Run `python3 -m json.tool Agents/stat.json >/dev/null`.
2. Open `Agents/README.md` and confirm the workflow stage is `final_review_complete`.
3. Inspect `Agents/stat.json` and confirm `summary.queued` is `0`, `summary.remaining` is `0`, `summary.approved` is `0`, and `TRI-001.status` is `needs_user_test`.
4. Confirm `TRI-001.supervisor_eval_report` is `Agents/patches/TRI-001-eval.md` and `TRI-001.user_test_report` is `Agents/patches/TRI-001-user-test.md`.

## Expected result

`Agents/stat.json` is valid JSON, no tasks are queued or remaining, no tasks are approved, and TRI-001 is waiting for manual user testing rather than marked approved.

## Bad result

The fix failed if `Agents/stat.json` is invalid JSON, TRI-001 is not `needs_user_test`, any task is marked approved without explicit user approval, or the workspace still reports queued/remaining follow-up tasks.

## Regression checks

- Existing task statuses remain `needs_user_test`.
- Existing `approval.approved_by_user` values remain `false`.
- No application/source code changes are required for this metadata-only task.

## What to tell the AI after testing

If the test passed, say:

`I tested task TRI-001 and approve it.`

If the test failed, say:

`Task TRI-001 failed user testing. Here is what happened: <details>.`
