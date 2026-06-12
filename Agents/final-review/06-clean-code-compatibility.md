## Coverage Evidence

### Areas inspected

- COMPAT-001 patch: `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `packages/shared/package.json`, `packages/shared/src/index.ts`.
- Execution contract callers: `apps/web/src/app/api/execute/route.ts`, `apps/web/src/components/editor/problem-workspace.tsx`, `apps/web/src/components/editor/code-editor.tsx`, `apps/runner/main.py`.
- Docker and public-readiness cleanup: `.env.example`, `.gitignore`, `.dockerignore`, `README.md`, `REVIEWER_RUN_GUIDE.md`, `compose.yml`, `docker/compose.yml`, `apps/web/Dockerfile`, `apps/runner/Dockerfile`, `apps/runner/README.md`, `apps/runner/executor/Dockerfile`.
- Worktree hygiene: untracked files, ignored local artifacts, generated folders, and secret-like strings outside `Agents/`.

### Searches and commands run

```bash
git status --short
git diff --stat
git diff -- packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/package.json apps/web/package.json turbo.json pnpm-lock.yaml
git diff -- README.md REVIEWER_RUN_GUIDE.md .env.example .gitignore .dockerignore compose.yml docker/compose.yml apps/web/Dockerfile apps/runner/Dockerfile apps/runner/README.md apps/runner/executor/Dockerfile
rg -n "SUPPORTED_LANGUAGES|ExecutionLanguage|SubmissionRequest|SubmissionResult|problemId|testCases|timeLimitMs|memoryLimitKb|testResults|expectedOutput|isHidden|runtimeMs|memoryKb|testCaseId|actualOutput|csharp" packages/shared apps/web/src apps/runner -g '*.{ts,tsx,py}'
rg -n --hidden --glob '!node_modules/**' --glob '!**/node_modules/**' --glob '!.git/**' --glob '!Agents/**' "(sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY|leetcode_session|LEETCODE_SESSION|csrftoken=|session=|password\s*[:=]\s*['\"][^'\"]{8,}|secret\s*[:=]\s*['\"][^'\"]{8,}|token\s*[:=]\s*['\"][^'\"]{8,})" .
find . -path './.git' -prune -o -path './node_modules' -prune -o -path './*/node_modules' -prune -o -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' -o -name '*.sqlite' -o -name '*.db' -o -name '*.tsbuildinfo' -o -name '.DS_Store' -o -name '*.pyc' -o -name '*.log' \) -print
find . -path './.git' -prune -o -path './node_modules' -prune -o -path './*/node_modules' -prune -o -path './Agents' -prune -o -type d \( -name '.next' -o -name 'dist' -o -name 'build' -o -name 'coverage' -o -name '__pycache__' -o -name '.pytest_cache' -o -name '.turbo' -o -name 'venv' -o -name '.venv' \) -print
git ls-files --others --exclude-standard
git check-ignore -v .env .next apps/web/.next node_modules apps/runner/venv apps/runner/__pycache__ foo.log tmp/test.tmp
pnpm --filter @grindup/shared lint
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
docker compose -f docker/compose.yml config
docker compose config
node -e "require('./packages/shared'); console.log('shared require ok')"
```

### Code paths traced

- `@grindup/shared` exported `SubmissionRequest` / `SubmissionResult` / `SUPPORTED_LANGUAGES` -> editor payload construction -> `POST /api/execute` -> runner `/execute`.
- Root local-run docs -> `RUNNER_SHARED_SECRET` setup -> runner middleware token gate -> runner README direct API documentation.
- Public docs/env cleanup -> `.env.example` placeholders -> compose defaults -> `.gitignore` / `.dockerignore` handling of local artifacts.

### Tests reviewed

- `pnpm --filter @grindup/shared lint` passed.
- `pnpm --filter @grindup/web exec tsc --noEmit --pretty false` passed.
- `docker compose -f docker/compose.yml config` and `docker compose config` passed.
- `node -e "require('./packages/shared')"` failed because the private shared package points `main` at TypeScript source with extensionless re-exports; this appears pre-existing package-runtime incompatibility, not introduced by COMPAT-001.
- No dedicated execution-contract or Docker smoke tests were found.

### Domain exclusions

- Auth, unsafe HTML, authorization, queue concurrency, database indexes, runner sandbox strength, and API validation depth remain owned by the Security, Validation, Reliability, Database, and Performance agents unless the issue is contract or public-readiness compatibility.

## Fixed-Status Assessment

- COMPAT-001 is fixed for the intended shared contract: `SubmissionRequest`, `TestCase`, `SubmissionResult`, and `TestResult` now use the live snake_case execution JSON shape; `ExecutionLanguage` and `SUPPORTED_LANGUAGES` no longer advertise `csharp`.
- Existing web/editor execution callers remain compatible because they already send snake_case fields. The editor still duplicates its language list locally, but it currently matches shared constants and runner handlers.
- Shared package lint and web typecheck pass. The remaining `require('./packages/shared')` failure is a package runtime/export risk that was already visible before this final pass and is not caused by the COMPAT-001 fix.
- Docker and README cleanup are mostly public-safe: real-looking local passwords were replaced with development placeholders, scrape cookies/CSRF values are not committed, `.env` is ignored, and compose files validate.
- Worktree hygiene is acceptable for generated/local files: `.env`, `.next`, `.turbo`, `*.tsbuildinfo`, logs, and Python bytecode exist locally but are ignored. Untracked review files under `Agents/` are expected for this workflow; untracked public files such as Dockerfiles, compose, `.dockerignore`, reviewer guide, runner README, sanitizer, seed script, and shared ESLint config should be intentionally staged or removed by the human before publishing.

## Finding COMPAT-004: Runner README is stale after runner token cleanup

**Severity:** Medium  
**Confidence:** High  
**Agent:** Clean Code and Compatibility Agent - Minimalist Maintainer  
**Scope:** Public documentation compatibility, reviewer run contract, public-readiness

### Files involved

- `apps/runner/README.md`
- `apps/runner/main.py`
- `README.md`
- `REVIEWER_RUN_GUIDE.md`

### Problem

The new root docs correctly tell reviewers to run the runner with `RUNNER_SHARED_SECRET`, and `apps/runner/main.py` enforces `X-Runner-Token` when that env var is set, but `apps/runner/README.md` still documents `python main.py` without the secret and shows a bare `/execute` request body with no token header. Following the service README either starts the runner without the intended token gate or produces direct API requests that fail once the root guide's secret is configured.

### Proof example

```bash
rg -n "RUNNER_SHARED_SECRET|X-Runner-Token|python main.py|POST /execute" apps/runner/README.md README.md REVIEWER_RUN_GUIDE.md apps/runner/main.py
```

### Current behaviour

`apps/runner/README.md:25-29` starts the service without `RUNNER_SHARED_SECRET`, while `apps/runner/main.py:46-61` only protects `/execute` when that variable is present. If a reviewer follows the root docs and sets the secret, the API example in `apps/runner/README.md:37-52` is incomplete because it omits the required `X-Runner-Token` header.

### Expected behaviour

All public run docs should describe the same runner contract: set `RUNNER_SHARED_SECRET` for local runner startup and include `X-Runner-Token: <secret>` in direct `/execute` examples.

### Evidence

Root docs set the secret at `README.md:160-166` and `REVIEWER_RUN_GUIDE.md:56-64`, and `README.md:204` states runner `/execute` requests require it. The runner service README does not mention the env var or token header.

### Fix location

`apps/runner/README.md`, setup and API sections around lines 25-52.

### What to change

Add `export RUNNER_SHARED_SECRET=dev-only-runner-secret` before `python main.py`, document that direct `/execute` requests require `X-Runner-Token` when the secret is configured, and include a compact `curl` example with that header.

### Expected result after fix

Rerunning the proof shows `RUNNER_SHARED_SECRET` and `X-Runner-Token` in the runner README, and reviewers following any public doc start and call the runner with the same contract.

### Test gap

No documentation smoke check or runner auth integration test asserts that the public runbook and runner middleware stay aligned.

### Backwards compatibility risk

Low for code, medium for reviewer/public readiness because the docs can lead to an unprotected local runner or failed direct execution checks.

### Patch priority

Medium

### Suggested commit message

`Document runner token setup consistently`

## Remaining Compatibility / Public-Readiness Risks

- `packages/shared/package.json` still points `main` and `types` at TypeScript source; direct Node `require('./packages/shared')` fails with `ERR_MODULE_NOT_FOUND` on the extensionless `src/index.ts` re-exports. Because this package is private and workspace TypeScript consumers typecheck, this is not a blocker for the current fixes, but it should be addressed before treating `@grindup/shared` as a runtime package.
- `turbo.json` now tracks many env vars for cache invalidation but omits `RUNNER_SHARED_SECRET` and `PROBLEM_SCRAPE_SECRET`; this is low-risk for current builds because those secrets are runtime-only, but it is a future cache/config drift point.
- No generated/local files appear ready to be committed accidentally based on ignore checks, but there are several untracked intended source/docs files that need human staging review before publication.

## Readiness Verdict

Not fully ready for final public/reviewer handoff until COMPAT-004 is fixed or accepted. The application compatibility fixes reviewed here are otherwise coherent: COMPAT-001 remains fixed, Docker compose configs validate, typecheck/lint pass for the inspected surfaces, and no obvious public secrets or tracked generated artifacts were found.
