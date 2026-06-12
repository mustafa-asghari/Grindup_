# Patch Note: COMPAT-004

## Worker personality

Compatibility Worker - Minimalist Maintainer.

## Issue

`apps/runner/README.md` did not match the runner token contract documented in the root run docs and enforced by `apps/runner/main.py`.

## Root cause

The runner README still showed `python main.py` without `RUNNER_SHARED_SECRET` and described direct `POST /execute` usage without the `X-Runner-Token` header required when the secret is configured.

## Original proof example

```bash
rg -n "RUNNER_SHARED_SECRET|X-Runner-Token|python main.py|POST /execute" apps/runner/README.md README.md REVIEWER_RUN_GUIDE.md apps/runner/main.py
```

## Original fix location

`apps/runner/README.md` setup and API sections around lines 25-52.

## Original what to change

Add `export RUNNER_SHARED_SECRET=dev-only-runner-secret` before `python main.py`, document the `X-Runner-Token` requirement, and include a compact curl example with the header.

## Files changed

- `apps/runner/README.md`
- `Agents/patches/COMPAT-004.md`
- `Agents/stat.json`

## Fix made

The patch changed the exact original fix location. The runner README now exports `RUNNER_SHARED_SECRET=dev-only-runner-secret` before startup, states that direct `POST /execute` calls require `X-Runner-Token` when the secret is configured, and includes a compact curl example using the header.

## Why this fix is minimal

This is docs-only and updates only the stale runner service instructions; no application/source behavior or public API shape changed.

## Validation attempted

The original proof example was rerun and now shows `RUNNER_SHARED_SECRET` and `X-Runner-Token` entries in `apps/runner/README.md`, alongside the existing root docs and runner middleware references.

## Result

Reviewers following the runner README get the same local token setup and direct `/execute` request contract as the root documentation.

## Compatibility notes

The example token is the public-safe development placeholder `dev-only-runner-secret`; real secrets remain environment-specific and should not be committed.

## Specialist eval handoff

Clean Code and Compatibility Agent - Minimalist Maintainer must review this patch next.

## Suggested commit message

Document runner token setup consistently
