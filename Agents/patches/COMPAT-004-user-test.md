# User Test Instructions: COMPAT-004

## What was fixed

The runner service README now documents the same local runner token contract as the root README and reviewer guide.

## Where to test

- File: `apps/runner/README.md`
- Runner endpoint: `POST http://localhost:8080/execute`
- Compare docs: `README.md` and `REVIEWER_RUN_GUIDE.md`

## Setup needed

Docker must be running, and the executor image must exist.

```bash
docker build -t grindup-executor apps/runner/executor
```

## Test steps

1. Follow `apps/runner/README.md` to install dependencies and start the runner with `RUNNER_SHARED_SECRET=dev-only-runner-secret`.
2. Run the documented `POST /execute` curl example from `apps/runner/README.md`.
3. Compare the runner setup with `README.md` and `REVIEWER_RUN_GUIDE.md`.
4. Optionally send the same request without `X-Runner-Token` to confirm the protected runner rejects it.

## Expected result

The documented curl request succeeds when `X-Runner-Token: dev-only-runner-secret` matches `RUNNER_SHARED_SECRET`, and the docs describe the same token setup across the runner README, root README, and reviewer guide.

## Bad result

The fix failed if the runner README still omits `RUNNER_SHARED_SECRET`, omits `X-Runner-Token`, uses a real secret, or gives a request example that fails when copied against the documented local setup.

## Regression checks

- Direct runner calls without the configured token should still be rejected.
- Root documentation should still use safe placeholder values only.
- Runner `/health` should remain reachable without a token.

## What to tell the AI after testing

If the test passed, say:

`I tested task COMPAT-004 and approve it.`

If the test failed, say:

`Task COMPAT-004 failed user testing. Here is what happened: <details>.`
