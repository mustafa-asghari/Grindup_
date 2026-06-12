# Specialist Eval: COMPAT-001

## Result

Pass.

## Compatibility Checks

- `packages/shared/src/types.ts` now models the live execution boundary with snake_case `problem_id`, `test_cases`, `expected_output`, `is_hidden`, `time_limit_ms`, `memory_limit_kb`, `test_results`, `runtime_ms`, `memory_kb`, and `test_case_id` fields.
- `SubmissionResult` includes the route-added `submission_id` and nullable runner `error`/`actual_output` fields, while preserving the runner response fields returned by `apps/runner/main.py`.
- `ExecutionLanguage` and `SUPPORTED_LANGUAGES` no longer advertise `csharp`; the shared list matches the runner handler keys in `apps/runner/main.py` and the editor language list.
- `apps/web/src/app/api/execute/route.ts` still reads and forwards the snake_case request body and returns the runner result with `submission_id`; no route change was needed for this compatibility fix.
- Existing snake_case UI/API behavior is preserved. Previous shared-package consumers using the old camelCase submission fields must update, which is acceptable for this task because the allowed fix was to align shared types to the canonical web contract.

## Drift Review

No missed shared execution constants or exported submission types were found. The editor still has a local language list rather than importing the shared constant, but it currently matches the shared and runner languages, so this is an adjacent drift path rather than a failure of COMPAT-001.

## Validation

- `pnpm --filter @grindup/shared lint` - passed.
- `pnpm --filter @grindup/web exec tsc --noEmit --pretty false` - passed.
- `python3 -m json.tool Agents/stat.json >/dev/null` - passed.

## Verdict

COMPAT-001 passes specialist compatibility evaluation. Leave status as `implemented`.
