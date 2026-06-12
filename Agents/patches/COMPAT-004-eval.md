# Eval Report: COMPAT-004

## Verdict

Needs user testing.

## What changed

`apps/runner/README.md` now starts the runner with `RUNNER_SHARED_SECRET=dev-only-runner-secret`, documents the `X-Runner-Token` requirement for direct `POST /execute` calls, and includes a compact curl example with the token header.

## Does this fix the root cause?

Yes. The specialist eval passed in `Agents/patches/COMPAT-004-specialist-eval.md`, and the runner README now matches the token contract enforced by `apps/runner/main.py` when `RUNNER_SHARED_SECRET` is configured.

## Scope check

Pass. The implementation is documentation-only and stays inside the stated COMPAT-004 fix location. Project-root `AGENTS.md` is missing, so this supervisor eval continued from `Agents/README.md` and `Agents/stat.json`.

## Backwards compatibility check

Pass. No application behavior, API shape, environment variable name, or runner middleware behavior changed. The documented token value is the existing public-safe development placeholder, not a real secret.

## Test check

No automated tests were required for this documentation-only compatibility fix. The original proof command was rerun and confirms the runner README now includes both `RUNNER_SHARED_SECRET` and `X-Runner-Token` alongside the root docs and runner middleware references.

## Commands run

```bash
rg --files -g 'AGENTS.md' -g '!node_modules'
rg -n "RUNNER_SHARED_SECRET|X-Runner-Token|python main.py|POST /execute" apps/runner/README.md README.md REVIEWER_RUN_GUIDE.md apps/runner/main.py
python3 -m json.tool Agents/stat.json
git status --short apps/runner/README.md Agents/stat.json Agents/patches/COMPAT-004.md Agents/patches/COMPAT-004-specialist-eval.md
```

## Command results

Passed. `AGENTS.md` was not found outside ignored dependencies; the proof command shows the runner README token setup and header; `Agents/stat.json` parses as valid JSON. The inspected task files are untracked workflow changes, so `git diff` has no tracked-file output for them.

## Risks remaining

Manual testing is still required by the workflow. The root README also has a dependency-check block that starts `python main.py` without repeating the token export; this is non-blocking for COMPAT-004 because the actual local run instructions and reviewer guide already document `RUNNER_SHARED_SECRET`, and the selected task's fix location was `apps/runner/README.md`.

## Eval decision

Mark `COMPAT-004` as `needs_user_test`. Do not mark approved until the user explicitly tests and approves it.

## Suggested commit message

Document runner token setup consistently
