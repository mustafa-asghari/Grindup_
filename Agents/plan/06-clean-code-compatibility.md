## Coverage Evidence

### Areas inspected

- Public contracts: `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `apps/web/src/app/api/execute/route.ts`, `apps/runner/main.py`, editor execution call sites.
- Exercise contracts: `packages/db/prisma/schema.prisma`, `apps/web/src/lib/exercise-types.ts`, topic generation, topic rendering, generic exercise runner, and exercise submit route.
- Package/runtime compatibility: root and workspace `package.json` files, `turbo.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, Dockerfiles, compose files, runner requirements.
- Env/config surfaces: `.env.example`, `compose.yml`, `docker/compose.yml`, `apps/web/src/lib/auth*.ts`, `apps/web/src/lib/csrf.ts`, and env reads across `apps/**` and `packages/**`.

### Searches and commands run

```bash
sed -n '1,280p' /Users/mustafaasghari/.codex/skills/review-skill/review-skill.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/AGENTS.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/finding-format.md
sed -n '1,280p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/06-clean-code-compatibility-agent.md
rg --files /Users/mustafaasghari/code/study/GrindUp
rg -n "@grindup/(shared|db)|SUPPORTED_LANGUAGES|SubmissionRequest|SubmissionResult|TestCase|csharp|language" apps packages -g '*.{ts,tsx,py,json}'
rg -n "problem_id|problemId|test_cases|testCases|time_limit_ms|timeLimitMs|memory_limit_kb|memoryLimitKb|test_results|testResults" apps packages -g '*.{ts,tsx,py}'
rg -n "ExerciseContent|ExerciseData|exercise\\.content|mcq|flashcard|fill_blank|true_false|ExerciseType" apps/web/src packages -g '*.{ts,tsx}'
rg -n "process\\.env\\.|NEXTAUTH|AUTH_|NEXT_PUBLIC|RUNNER_URL|CLICKHOUSE|REDIS|OPENAI|SERPER|YOUTUBE|TURNSTILE|LEETCODE|SCRAPE_LIMIT|DATABASE_URL" apps packages .env.example compose.yml docker/compose.yml turbo.json
find /Users/mustafaasghari/code/study/GrindUp -path '*/node_modules' -prune -o -path '*/.git' -prune -o -type f \( -name '*.test.*' -o -name '*.spec.*' -o -name 'vitest.config.*' -o -name 'jest.config.*' -o -name 'playwright.config.*' -o -name 'pytest.ini' -o -name 'conftest.py' \) -print
pnpm --filter @grindup/web exec tsc --noEmit --incremental false --pretty false
pnpm --filter @grindup/shared lint
node -e "require('./packages/shared')"
node - <<'EOF' # TypeScript compiler probe for ExerciseContent accepting invalid content
```

### Code paths traced

- `CodeEditor` language choice -> `ProblemWorkspace.handleRunCode` -> `POST /api/execute` -> FastAPI runner `POST /execute`.
- Shared `SubmissionRequest`/`SubmissionResult` exports -> actual web and runner request/response field names.
- Topic lesson generation -> `POST /api/topics/generate-quiz` -> `Exercise` rows -> topic page filters/runners -> `POST /api/exercises/submit`.
- `@grindup/shared` package metadata -> `src/index.ts` re-exports -> plain Node package load.

### Tests reviewed

- No relevant automated test/spec files or test configs were found outside `node_modules`.
- `pnpm --filter @grindup/web exec tsc --noEmit --incremental false --pretty false` passed.
- `pnpm --filter @grindup/shared lint` passed, but it does not validate runtime package loading or API contract drift.

### Domain exclusions

- Auth/CSRF/authorization, unsafe HTML, upload validation, Docker cleanup, request timeouts, transactions, indexes, and query performance are left to the Security, Validation and Sanitisation, Reliability, Database, and Performance agents unless the root cause is contract compatibility or type-safety maintenance risk.

## Finding COMPAT-001: Shared submission contract does not match the execute APIs

**Severity:** High  
**Confidence:** High  
**Agent:** Clean Code and Compatibility Agent - Minimalist Maintainer  
**Scope:** Public API response shape, exported types, hidden coupling

### Files involved

- `packages/shared/src/types.ts`
- `packages/shared/src/constants.ts`
- `apps/web/src/components/editor/problem-workspace.tsx`
- `apps/web/src/app/api/execute/route.ts`
- `apps/runner/main.py`

### Problem

The shared package exports camelCase `SubmissionRequest`/`SubmissionResult` fields and advertises `csharp`, but the web and runner contracts use snake_case fields and the runner only registers Python, JavaScript, Java, and C++. A caller typed against `@grindup/shared` can compile while sending a request the web route rejects or a language the runner cannot execute.

### Proof example

```bash
curl -i -X POST http://localhost:3000/api/execute \
  -H 'Content-Type: application/json' \
  --data '{"code":"def solution(): return 1","language":"python","problemId":"any","testCases":[],"timeLimitMs":2000,"memoryLimitKb":256000}'
```

### Current behaviour

The route returns `400` with `Missing required fields` because it reads `problem_id` and `test_cases`, not the exported `problemId` and `testCases`; a `csharp` value from `SUPPORTED_LANGUAGES` reaches an unsupported runner language.

### Expected behaviour

The exported shared request/response types should describe the JSON accepted and returned by the public execution boundary, and supported language lists should match the runner handlers and UI.

### Evidence

`packages/shared/src/types.ts:2-23` defines camelCase request/response fields and includes `csharp`; `packages/shared/src/constants.ts:28-34` also includes `csharp`. The UI sends snake_case fields at `apps/web/src/components/editor/problem-workspace.tsx:96-103`, the web route destructures snake_case fields at `apps/web/src/app/api/execute/route.ts:63-120`, and the runner handlers are only `python`, `javascript`, `java`, and `cpp` at `apps/runner/main.py:32-38`.

### Fix location

`packages/shared/src/types.ts`, `SubmissionRequest`, `TestCase`, `SubmissionResult`, and `TestResult`, lines 2-32; `packages/shared/src/constants.ts`, `SUPPORTED_LANGUAGES`, lines 28-34; `apps/web/src/app/api/execute/route.ts`, `POST`, lines 63-123.

### What to change

Create one canonical execution contract at the web boundary: either change the shared types to the existing snake_case JSON and remove `csharp`, or add a compatibility adapter that accepts both camelCase and snake_case while emitting one documented response shape. Keep `csharp` out of exported supported languages until a runner handler, editor default, and test coverage exist.

### Expected result after fix

Rerunning the proof with the canonical shape succeeds or fails for a domain reason such as `Problem not found`, not because the exported type names are rejected; `csharp` is no longer advertised unless it executes successfully.

### Test gap

No contract test posts a `SubmissionRequest`-typed payload to `/api/execute`, asserts the response shape, or checks that shared languages equal runner/editor languages.

### Backwards compatibility risk

Medium, because existing UI callers use snake_case; a safe fix should preserve that shape or accept both shapes during migration.

### Patch priority

High

### Suggested commit message

`Align shared execution contract with runner API`

## Finding COMPAT-002: Generated exercise types exceed runner and grading support

**Severity:** Medium  
**Confidence:** High  
**Agent:** Clean Code and Compatibility Agent - Minimalist Maintainer  
**Scope:** Public contract drift, hidden coupling, user-visible behavior

### Files involved

- `packages/db/prisma/schema.prisma`
- `apps/web/src/app/api/topics/generate-quiz/route.ts`
- `apps/web/src/components/subjects/topic-view-client.tsx`
- `apps/web/src/components/exercise/exercise-runner.tsx`
- `apps/web/src/app/api/exercises/submit/route.ts`

### Problem

The schema and generation route expose `fill_blank` and `true_false` exercises, but the topic UI only renders MCQ and flashcard activities and the generic submit route marks all non-MCQ/non-flashcard types correct for full points. This is hidden coupling between the database enum, generator output, UI filters, and grading logic.

### Proof example

After generating activities for a topic, run:

```bash
curl -i -X POST http://localhost:3000/api/exercises/submit \
  -H 'Cookie: <authenticated session>' \
  -H 'Content-Type: application/json' \
  --data '{"exerciseId":"<fill_blank-or-true_false-exercise-id>","response":{"anything":"wrong"},"timeSpentSecs":1,"hintsUsed":0}'
```

### Current behaviour

`fill_blank` and `true_false` rows can be created, are not surfaced by the topic tab filters, and are treated as correct with `score = exercise.points` if submitted through the generic endpoint.

### Expected behaviour

Every exercise type that can be generated or advertised should have a renderer and grading path, or it should be rejected/hidden at generation and submit boundaries until support exists.

### Evidence

`packages/db/prisma/schema.prisma:1290-1301` defines ten `ExerciseType` enum values. `apps/web/src/app/api/topics/generate-quiz/route.ts:245-251` asks the model for MCQ, flashcard, fill-blank, and true/false items, then creates `fill_blank` at lines 348-364 and `true_false` at lines 366-380. `apps/web/src/components/subjects/topic-view-client.tsx:554-579` filters only MCQ and flashcard content for the topic tabs, `apps/web/src/components/exercise/exercise-runner.tsx:14-56` only implements MCQ, flashcard, and coding fallback, and `apps/web/src/app/api/exercises/submit/route.ts:35-62` awards full points in the default branch for unsupported types.

### Fix location

`apps/web/src/app/api/topics/generate-quiz/route.ts`, activity creation around lines 306-380; `apps/web/src/app/api/exercises/submit/route.ts`, grading switch around lines 35-62; `apps/web/src/components/exercise/exercise-runner.tsx`, type dispatch around lines 14-56.

### What to change

Either narrow generation to implemented types only, or add first-class runners and grading for `fill_blank` and `true_false`. Replace the default full-credit branch with an explicit unsupported-type error and make the dispatch exhaustive so new enum values fail typecheck until UI and grading support are added.

### Expected result after fix

Rerunning the proof returns `400 Unsupported exercise type` until a real grader exists, or grades the submitted answer with the new type-specific logic; generated topic activities no longer include invisible or auto-passing exercise types.

### Test gap

No test asserts generated exercise types are all renderable and gradable, and no submit-route test covers unsupported `ExerciseType` values.

### Backwards compatibility risk

Medium, because existing databases may contain `fill_blank` or `true_false` rows; a safe fix needs a migration/backfill or read-only fallback for existing data.

### Patch priority

High

### Suggested commit message

`Make exercise type support explicit`

## Finding COMPAT-003: ExerciseContent collapses to any and hides content-shape breakage

**Severity:** Medium  
**Confidence:** High  
**Agent:** Clean Code and Compatibility Agent - Minimalist Maintainer  
**Scope:** Type-safety maintenance blocker

### Files involved

- `apps/web/src/lib/exercise-types.ts`
- `apps/web/src/components/exercise/types/mcq-runner.tsx`
- `apps/web/src/components/exercise/types/flashcard-runner.tsx`
- `apps/web/src/app/api/exercises/submit/route.ts`

### Problem

`ExerciseContent = McqContent | FlashcardContent | any` reduces the exported content contract to `any`, so invalid exercise content compiles and downstream components recover type safety with casts. This makes future exercise changes risky because TypeScript cannot catch shape drift between generators, Prisma JSON, runners, and graders.

### Proof example

```bash
node - <<'EOF'
const ts = require('typescript');
const path = require('path');
const repo = process.cwd();
const fileName = path.join(repo, '__compat_probe__.ts');
const source = "import type { ExerciseContent } from './apps/web/src/lib/exercise-types';\nconst invalid: ExerciseContent = 42;\n";
const options = { strict: true, noEmit: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2020, skipLibCheck: true };
const host = ts.createCompilerHost(options);
const original = host.getSourceFile.bind(host);
host.getSourceFile = (name, lv, onError, fresh) => path.resolve(name) === fileName ? ts.createSourceFile(name, source, lv, true) : original(name, lv, onError, fresh);
host.fileExists = (name) => path.resolve(name) === fileName || ts.sys.fileExists(name);
host.readFile = (name) => path.resolve(name) === fileName ? source : ts.sys.readFile(name);
const program = ts.createProgram([fileName], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.file && path.resolve(d.file.fileName) === fileName);
console.log(diagnostics.length === 0 ? 'accepted invalid ExerciseContent' : 'rejected invalid ExerciseContent');
EOF
```

### Current behaviour

The probe prints `accepted invalid ExerciseContent`, and production code casts `exercise.content` to `McqContent` or `FlashcardContent` before reading required fields.

### Expected behaviour

Invalid content such as a number or a missing `correctAnswers` array should fail at compile time where content is typed, and untrusted Prisma JSON should be narrowed once at the boundary.

### Evidence

`apps/web/src/lib/exercise-types.ts:3-22` defines the content types and the `| any` union. `apps/web/src/components/exercise/types/mcq-runner.tsx:13-18`, `apps/web/src/components/exercise/types/flashcard-runner.tsx:13-16`, and `apps/web/src/app/api/exercises/submit/route.ts:36-39` cast JSON content instead of receiving a narrowed discriminated type.

### Fix location

`apps/web/src/lib/exercise-types.ts`, `ExerciseContent` and `ExerciseData`, lines 3-26; runner/submit call sites that currently cast content.

### What to change

Replace `| any` with a discriminated union keyed by `ExerciseData.type`, add explicit content types for supported exercise types, and introduce a small parser/narrowing helper for Prisma JSON before it reaches runners or grading logic.

### Expected result after fix

Rerunning the proof reports `rejected invalid ExerciseContent`, and components can access content fields without unchecked casts.

### Test gap

No type-level test or route/component test locks exercise content shapes for MCQ, flashcard, or future exercise types.

### Backwards compatibility risk

Low, because the runtime JSON shape can stay the same; the main change is compile-time narrowing plus boundary validation.

### Patch priority

Medium

### Suggested commit message

`Restore typed exercise content contracts`

## Finding COMPAT-004: Shared package entrypoint is not loadable through its declared main

**Severity:** Low  
**Confidence:** High  
**Agent:** Clean Code and Compatibility Agent - Minimalist Maintainer  
**Scope:** Package exports and runtime compatibility

### Files involved

- `packages/shared/package.json`
- `packages/shared/src/index.ts`

### Problem

`@grindup/shared` declares `main` and `types` as raw TypeScript source, but the source entrypoint re-exports extensionless relative modules and the package has no build output or `exports` map. Plain Node consumers cannot load the package entrypoint, which makes shared contracts fragile outside a bundler that understands TypeScript source and extensionless resolution.

### Proof example

```bash
node -e "require('./packages/shared')"
```

### Current behaviour

The command fails with `ERR_MODULE_NOT_FOUND` for `packages/shared/src/types` imported from `packages/shared/src/index.ts`.

### Expected behaviour

The package entrypoint should load consistently through the declared package metadata, or the package should be clearly marked as type-only with no runtime `main`.

### Evidence

`packages/shared/package.json:5-6` points both `main` and `types` to `./src/index.ts`. `packages/shared/src/index.ts:2-3` re-exports `./types` and `./constants` without emitted `.js` files or an `exports` map.

### Fix location

`packages/shared/package.json`, package entry metadata around lines 5-8; `packages/shared/src/index.ts`, re-export declarations around lines 2-3.

### What to change

Add a build step that emits `dist/index.js` and `dist/index.d.ts`, set `main`/`types`/`exports` to `dist`, and add `build` to the Turbo graph; if the package is type-only, remove the runtime `main` contract and document type-only imports.

### Expected result after fix

Rerunning the proof from the repo root loads the package or fails only because a deliberate type-only import was used incorrectly; workspace consumers no longer depend on bundler-specific TypeScript source loading.

### Test gap

No package smoke test imports `@grindup/shared` through its package entrypoint, and the current shared lint does not exercise runtime resolution.

### Backwards compatibility risk

Low, because the package is private and currently unused by app code; consumers may need import paths updated if they relied on source files directly.

### Patch priority

Medium

### Suggested commit message

`Fix shared package entrypoint`
