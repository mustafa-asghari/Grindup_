# Eval Report: COMPAT-001

## Verdict

Needs user testing.

## What changed

`packages/shared/src/types.ts` now exports the live snake_case execution request/result contract and an `ExecutionLanguage` union limited to Python, JavaScript, Java, and C++. `packages/shared/src/constants.ts` removed `csharp` from `SUPPORTED_LANGUAGES`.

## Does this fix the root cause?

Yes. The specialist eval passed and confirmed the shared package now matches the existing `/api/execute` and runner field names while no longer advertising an unsupported language.

## Scope check

The COMPAT-001 code diff is limited to `packages/shared/src/types.ts` and `packages/shared/src/constants.ts`. The execute route was not changed for this task, which is acceptable because it already reads the canonical snake_case payload.

## Backwards compatibility check

Existing UI and API callers that already send snake_case payloads are preserved. Consumers using the old shared camelCase submission fields now get TypeScript errors; that is an intentional compatibility correction for this task.

## Test check

No dedicated contract test was added, so manual API/editor testing is still required. Automated evidence is sufficient for supervisor handoff because the shared package lint, web typecheck, JSON validation, and a TypeScript probe all passed.

## Commands run

```bash
git diff -- packages/shared/src/types.ts packages/shared/src/constants.ts Agents/stat.json Agents/patches/COMPAT-001.md Agents/patches/COMPAT-001-specialist-eval.md
rg -n "csharp|SubmissionRequest|SubmissionResult|SUPPORTED_LANGUAGES|ExecutionLanguage|problemId|testCases|timeLimitMs|memoryLimitKb|testResults|expectedOutput|isHidden|runtimeMs|memoryKb|testCaseId|actualOutput" packages/shared apps/web/src apps/runner -g '*.{ts,tsx,py}'
pnpm --filter @grindup/shared lint
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
python3 -m json.tool Agents/stat.json >/dev/null
node - <<'EOF'
TypeScript compiler probe assigning ExecutionLanguage = 'csharp' and old camelCase SubmissionRequest fields.
EOF
```

## Command results

Passed. The TypeScript probe produced diagnostics `TS2322` and `TS2561`, confirming `csharp` and the old camelCase `SubmissionRequest` shape are rejected. Parent validation also recorded that `eslint src/app/api/execute/route.ts` fails on pre-existing route lint issues, which is not a blocker for this shared-contract task.

## Risks remaining

The editor still keeps its own local language list instead of importing `SUPPORTED_LANGUAGES`; it currently matches the shared and runner languages but remains a future drift point. The runtime curl proof was not rerun in this supervisor pass because the stack and authenticated session were not started.

## Eval decision

Mark `COMPAT-001` as `needs_user_test`.

## Suggested commit message

`Align shared execution contract with runner API`
