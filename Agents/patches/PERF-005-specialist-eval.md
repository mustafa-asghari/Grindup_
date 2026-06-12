# Specialist Eval: PERF-005

## Verdict

Pass.

## Scope

Performance Agent - Latency Hawk reviewed only PERF-005: the runner Docker execution fanout issue. `AGENTS.md` is missing in the repo root, so this eval continued from `Agents/README.md`, `Agents/stat.json`, `Agents/final-review/05-performance.md`, and `Agents/patches/PERF-005.md`.

## Evidence Reviewed

- `apps/runner/main.py`
- `apps/runner/services/docker_service.py`
- `compose.yml`
- `.env.example`
- `apps/runner/README.md`
- `Agents/final-review/05-performance.md`
- `Agents/patches/PERF-005.md`
- `Agents/stat.json`

## Domain Assessment

The patch fixes the traced performance bottleneck. `apps/runner/main.py` now creates a runner-local `asyncio.Semaphore` from `RUNNER_MAX_CONCURRENT_EXECUTIONS`, acquires it immediately before the Docker `run_in_threadpool` boundary, returns HTTP 429 when saturated with zero queue timeout, and releases the slot in `finally`. That caps active executor containers before `docker_service.run_code` can call `containers.run`.

The change does not add a new network waterfall, duplicate work, render-path cost, payload bloat, or scale-sensitive loop. The only intended behavior change is explicit backpressure for bursts above the configured runner capacity.

## Verification

- `python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py`: passed.
- `docker compose config`: passed and includes `RUNNER_MAX_CONCURRENT_EXECUTIONS: "2"` plus `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS: "0"` for the runner service.
- Runtime one-slot proof with `RUNNER_MAX_CONCURRENT_EXECUTIONS=1` and `RUNNER_EXECUTION_QUEUE_TIMEOUT_MS=0`: passed.
  - Active executor containers before request: `0`.
  - Maximum active executor containers during the burst: `1`.
  - Concurrent overflow request: HTTP `429` with `{"detail":"Runner is busy; try again shortly"}`.
  - `/health` during the burst: HTTP `200`.
  - First sleeping execution: HTTP `200`, `status:"accepted"`.
  - Active executor containers after completion: `0`.
  - Runner restored to normal Compose defaults and `/health` returned HTTP `200`.

## Result

PERF-005 passes specialist eval. Leave `status` as `implemented` and set `specialist_eval_report` to `Agents/patches/PERF-005-specialist-eval.md`.
