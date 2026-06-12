# User Test Instructions: REL-001

## What was fixed

Timed-out runner execution containers are now removed after the timeout branch kills them, instead of accumulating as stopped Docker containers.

## Where to test

- File/function: `apps/runner/services/docker_service.py` `DockerService.run_code`
- Runtime path: host-direct `DockerService().run_code(...)` timeout execution
- Optional API path: runner `POST /execute`, after the separate Dockerized bind-mount limitation is resolved

## Setup needed

Docker must be running and `grindup-executor:latest` must exist locally. If testing through compose, rebuild and start the runner first with `docker compose build runner` and `docker compose up -d runner`; if the compose `/execute` path hits the known bind-mount limitation, use the host-direct test below for REL-001.

## Test steps

1. Record the current executor-derived container count:

```bash
docker ps -a --filter ancestor=grindup-executor:latest --format '{{.ID}} {{.Image}} {{.Status}} {{.Names}}'
```

2. From the repo root, run a host-direct timeout:

```bash
python3 - <<'PY'
from apps.runner.services.docker_service import DockerService

result = DockerService().run_code(
    image="grindup-executor:latest",
    command=["python3", "main.py"],
    files={"main.py": "while True:\n    pass\n"},
    time_limit_ms=100,
    memory_limit_mb=256,
)
print(result)
PY
```

3. List executor-derived containers again:

```bash
docker ps -a --filter ancestor=grindup-executor:latest --format '{{.ID}} {{.Image}} {{.Status}} {{.Names}}'
```

4. Optionally run one normal short execution and one wrong-answer/error execution to confirm result tuples still return normally and containers are still removed.

## Expected result

The timeout run returns `('', 'Time Limit Exceeded (100ms)', 100)` or the same tuple shape with equivalent quoting. The executor-derived container list does not gain a new stopped execution container after the timeout.

## Bad result

The fix failed if the timeout leaves a new stopped execution container, if the timeout no longer returns the expected TLE tuple, or if normal executions leave stopped per-run containers behind.

## Regression checks

- Normal accepted executions still return stdout, stderr, and execution time.
- Runtime error or wrong-answer style executions still return the same tuple shape as before.
- The compose-level bind-mount limitation, if encountered, is tracked separately and should not be counted as a REL-001 cleanup failure.

## What to tell the AI after testing

If the test passed, say:

`I tested task REL-001 and approve it.`

If the test failed, say:

`Task REL-001 failed user testing. Here is what happened: <details>.`
