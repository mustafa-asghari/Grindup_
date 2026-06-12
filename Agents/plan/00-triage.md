# Triage Report

## Coverage Evidence

Areas inspected:

- Root workspace files: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`, `.env.example`, `.gitignore`, `.dockerignore`, `README.md`, `REVIEWER_RUN_GUIDE.md`, `compose.yml`, `docker/compose.yml`, `start-dev.sh`.
- Web app: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/lib/**`, `apps/web/prisma/**`, `apps/web/Dockerfile`.
- Runner app: `apps/runner/main.py`, `apps/runner/services/docker_service.py`, `apps/runner/handlers/*.py`, `apps/runner/requirements.txt`, `apps/runner/Dockerfile`, `apps/runner/executor/Dockerfile`.
- Packages: `packages/db/package.json`, `packages/db/src/index.ts`, `packages/db/prisma/schema.prisma`, `packages/shared/package.json`, `packages/shared/src/**`, `packages/shared/eslint.config.mjs`.
- Audit workspace: `Agents/`, `Agents/plan/`, `Agents/patches/`, `Agents/final-review/` already existed before this report was written.

Searches and commands run:

```bash
pwd
ls -la
ls -la Agents
ls -la Agents/plan
git status --short
rg --files -g 'AGENTS.md' -g '!node_modules' -g '!dist' -g '!build'
rg --files -g 'package.json' -g 'pnpm-lock.yaml' -g 'vite.config.*' -g 'next.config.*' -g 'tsconfig*.json' -g '.env*' -g '.github/**' -g 'Dockerfile*' -g 'docker-compose*' -g 'supabase/**' -g 'prisma/**' -g 'migrations/**' -g '!node_modules'
rg --files -g '!node_modules' -g '!dist' -g '!build' -g '!coverage'
rg --files apps/web/src/app/api -g 'route.ts'
rg --files apps/web/src/app -g 'page.tsx' -g 'layout.tsx' -g 'loading.tsx' -g 'error.tsx' -g 'not-found.tsx'
rg --files -g '*test*' -g '*spec*' -g '!node_modules' -g '!pnpm-lock.yaml'
rg --files -g '.github/**' -g '.gitlab-ci.yml' -g 'Jenkinsfile' -g 'circle.yml' -g '.circleci/**' -g 'azure-pipelines.yml' -g 'bitbucket-pipelines.yml' -g '!node_modules'
rg -n "export async function|export const runtime|export const dynamic|NextRequest|NextResponse" apps/web/src/app/api apps/web/src/app/actions apps/web/src/middleware.ts
rg -n "process\\.env|DATABASE_URL|NEXTAUTH|AUTH_|OPENAI|CLICKHOUSE|REDIS|RUNNER_URL|SERPER|YOUTUBE|TURNSTILE|LEETCODE|SCRAPE_LIMIT" apps packages compose.yml docker/compose.yml turbo.json .env.example
rg -n "checkCSRF|checkRateLimit|checkDailyQuota|cleanupRateLimitLogs|resetDailyQuotas|auth\\(\\)" apps/web/src/app/api apps/web/src/app/actions apps/web/src/lib
for f in $(rg --files apps/web/src/app/api -g 'route.ts'); do if ! rg -q "auth\\(" "$f"; then printf '%s\n' "$f"; fi; done
for f in $(rg -l "export async function (POST|PATCH|DELETE|PUT)" apps/web/src/app/api -g 'route.ts'); do if ! rg -q "checkCSRF" "$f"; then printf '%s\n' "$f"; fi; done
rg -n "formData\\(|File|arrayBuffer|pdf|docx|ppt|tesseract|OCR|extract|transcript|youtube|openai\\.files|embeddings|chat\\.completions|clickhouse\\.insert" apps/web/src/app/api/import/route.ts apps/web/src/app/api/homework/submit/route.ts apps/web/src/app/import/page.tsx
rg -n "execute|RUNNER_URL|runnerUrl|timeLimit|memoryLimit|testCases|test_cases|code|language|submission|reviewCards|dailyRunQuota|checkDailyQuota" apps/web/src/app/api/execute/route.ts apps/runner/main.py apps/runner/services/docker_service.py apps/runner/handlers/*.py apps/web/src/components/editor/problem-workspace.tsx
rg -n "model |enum |@@index|@@unique|@unique|@relation|onDelete|Json|Bytes|Decimal" packages/db/prisma/schema.prisma
rg -n "CREATE INDEX|ALTER TABLE|ADD CONSTRAINT|FOREIGN KEY|UNIQUE INDEX|CREATE UNIQUE INDEX" apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql
wc -l packages/db/prisma/schema.prisma apps/runner/main.py apps/runner/services/docker_service.py apps/web/src/lib/auth.ts apps/web/src/lib/db.ts apps/web/src/lib/clickhouse.ts apps/web/src/lib/openai.ts apps/web/src/middleware.ts
wc -l apps/web/src/app/api/import/route.ts apps/web/src/app/api/topics/generate/route.ts apps/web/src/app/api/topics/generate-subtopics/route.ts apps/web/src/app/api/topics/generate-quiz/route.ts apps/web/src/app/api/homework/generate/route.ts apps/web/src/app/api/homework/submit/route.ts apps/web/src/app/api/execute/route.ts apps/web/src/app/api/problems/scrape/route.ts apps/web/src/app/api/tutor/route.ts apps/web/src/app/api/tutor/chat/route.ts apps/web/src/app/api/admin/seed-problems/route.ts apps/web/src/app/api/social/challenges/evaluate/route.ts apps/web/src/app/api/auth/register/route.ts
```

Code paths traced:

- Browser pages/components -> Next App Router API routes/server actions -> `auth()` -> Prisma/PostgreSQL.
- Import/upload UI -> `apps/web/src/app/api/import/route.ts` -> YouTube/PDF/image extraction -> OpenAI chat/files/embeddings -> Prisma subject/exercise tables -> ClickHouse `import_sources`.
- Coding workspace -> `apps/web/src/app/api/execute/route.ts` -> `RUNNER_URL` FastAPI `/execute` -> language handler wrapper -> Docker executor container.
- Problem scraping -> unauthenticated `apps/web/src/app/api/problems/scrape/route.ts` -> LeetCode GraphQL -> OpenAI embeddings -> Prisma problems/test cases -> ClickHouse `problems_vec`.
- Social/challenge APIs -> Prisma `StudyChallenge`, XP transactions, direct messages, lobby messages.

Tests reviewed:

- No CI workflow files found.
- No real test/spec suite found. `rg --files -g '*test*' -g '*spec*'` only matched app files with "test" in product names such as `test-results.tsx` and `exercises/test/page.tsx`.
- Root has `pnpm test` via Turbo, but inspected workspace package scripts do not define a real `test` script.

Domain exclusions:

- Deep vulnerability validation is for `Security Agent - Paranoid Threat Hunter`.
- Input schema, file parsing, and AI output validation are for `Validation and Sanitisation Agent - Input Gatekeeper`.
- Prisma integrity, migrations, transactions, and ClickHouse consistency are for `Database Agent - Data Integrity Engineer`.
- Runner uptime, Docker/runtime failure modes, and background-job scheduling are for `Reliability Agent - Production SRE`.
- Query cost, OpenAI fan-out, import latency, scraping cost, and dashboard rendering are for `Performance Agent - Latency Hawk`.
- Dependency compatibility, dead code, source layout, and generated-code boundaries are for `Clean Code and Compatibility Agent - Minimalist Maintainer`.

## Project map

- Package manager: pnpm workspace, `packageManager: pnpm@8.15.0`, Node engine `>=20`, Turborepo tasks at root.
- Apps: `apps/web` is the Next.js product app; `apps/runner` is a FastAPI code-execution service.
- Packages: `packages/db` exports Prisma client and owns `packages/db/prisma/schema.prisma`; `packages/shared` contains shared TypeScript types/constants.
- Database assets are split: schema is under `packages/db/prisma`, while one migration and seed scripts live under `apps/web/prisma`.
- Docker assets: root `compose.yml` runs full stack; `docker/compose.yml` runs infra only; web, runner, and executor each have Dockerfiles.

## Main technologies

- Next.js 16.1.1, React 19.2.3, TypeScript, Tailwind CSS 4, App Router, server actions.
- NextAuth v5 beta with Prisma adapter, credentials auth, optional GitHub/Google OAuth.
- Prisma 6.19.1, PostgreSQL, ClickHouse client, Redis env/config support.
- OpenAI SDK, YouTube transcript, PDF/OCR/image extraction libraries, Monaco editor, React Markdown, KaTeX, Mermaid.
- FastAPI, Pydantic, Uvicorn, Docker SDK for Python, Docker executor image with Python/Node/Java/C++ runtimes.

## Main scripts

- Root: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm db:generate`, `pnpm db:push`.
- Web: `pnpm --filter @grindup/web dev`, `build`, `start`, `lint`.
- Runner: `pnpm --filter @grindup/runner dev` installs Python requirements and runs `python3 main.py`; `start` runs `python3 main.py`.
- DB package: `pnpm --filter @grindup/db db:generate`, `db:push`, `db:studio`.
- Shared package: `pnpm --filter @grindup/shared lint`.

## How to run

- Local: `cp .env.example .env`, `pnpm install`, `pnpm db:generate`, `pnpm db:push`, `docker compose -f docker/compose.yml up -d`, `docker build -t grindup-executor apps/runner/executor`, run the runner from `apps/runner`, then `pnpm --filter @grindup/web dev`.
- Full Docker: `docker compose up --build`.
- Key URLs: web `http://localhost:3000`, runner `http://localhost:8080/health`, full-stack ClickHouse UI `http://localhost:15521`, infra-only ClickHouse UI `http://localhost:5521`.
- `.env.example` covers `DATABASE_URL`, `REDIS_URL`, ClickHouse credentials, NextAuth/Auth secrets, `RUNNER_URL`, OpenAI/Serper/YouTube keys, Turnstile keys, and optional LeetCode scrape headers.

## How to test

- Intended commands from docs: `pnpm build`, `pnpm lint`, `pnpm test`, runner dependency/start check, `docker compose config`, `docker compose build`.
- Practical current state: no dedicated automated test files or CI workflows were found; expect `pnpm test` to be empty or fail until workspace test scripts are added.
- Runner smoke target: `curl http://localhost:8080/health` after starting `apps/runner/main.py`.

## Important folders

- `apps/web/src/app`: Next.js routes, API route handlers, pages, layout.
- `apps/web/src/components`: product UI, editor, learning, social, dashboard, subjects, contests.
- `apps/web/src/lib`: auth, Prisma client, ClickHouse client, OpenAI client, CSRF, rate limiting, submission queue, logging, gamification.
- `apps/web/prisma`: migration and seed scripts.
- `packages/db/prisma`: Prisma schema source.
- `apps/runner`: FastAPI runner, Docker service, language handlers.
- `apps/runner/executor`: executor Docker image for untrusted code.
- Generated/runtime boundaries: `node_modules`, `.next`, `.turbo`, `dist`, `build`, Docker images/containers, Prisma generated client, runtime ClickHouse tables.

## Likely entry points

- Web UI: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, and page routes under `apps/web/src/app/**/page.tsx`.
- API: 45 `apps/web/src/app/api/**/route.ts` files; notable groups are auth, import, tutor, topics, homework, exercises, execute, problems, social, contests, subjects, notifications, wellbeing.
- Auth: `apps/web/src/app/api/auth/[...nextauth]/route.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth.config.ts`.
- Middleware: `apps/web/src/middleware.ts` currently has an empty matcher and only returns `NextResponse.next()`.
- Server actions: `apps/web/src/app/actions/contest.ts`, `exercise.ts`, `settings.ts`.
- Runner: `apps/runner/main.py` with `GET /health` and `POST /execute`.
- Database: `packages/db/prisma/schema.prisma`, `apps/web/prisma/migrations/20260115040836_add_multi_subject_models/migration.sql`.

## Data flow guess

- Authenticated learner traffic mostly flows through server-rendered pages and API routes that call `auth()` and Prisma.
- Imported notes/PDFs/images/YouTube content flows through extraction and OpenAI generation, then persists structured subjects, topics, exercises, homework, embeddings, and source metadata.
- Coding submissions flow from the browser editor to Next API, then to the runner, then to a short-lived Docker executor container; accepted results update submissions, XP, review cards, and challenge state.
- Problem scraping pulls LeetCode data, embeds descriptions, writes Postgres problems/test cases, and inserts ClickHouse vectors.
- Background-style routes exist as HTTP endpoints for cleanup/evaluation but no scheduler/cron config was found.

## High-risk areas for specialist agents

- `Security Agent - Paranoid Threat Hunter`: API auth/CSRF and exposed state-changing routes. Search evidence found unauthenticated API routes at `apps/web/src/app/api/problems/scrape/route.ts`, `apps/web/src/app/api/social/challenges/evaluate/route.ts`, `apps/web/src/app/api/auth/register/route.ts`, `apps/web/src/app/api/problems/count/route.ts`, plus NextAuth handler; many POST/PATCH/DELETE routes do not call `checkCSRF`. Include `apps/web/src/lib/auth.ts`, `apps/web/src/lib/csrf.ts`, `apps/web/src/middleware.ts`, and `apps/web/src/app/api/admin/seed-problems/route.ts`.
- `Security Agent - Paranoid Threat Hunter` and `Reliability Agent - Production SRE`: untrusted code execution path. Inspect `apps/web/src/app/api/execute/route.ts`, `apps/runner/main.py`, `apps/runner/services/docker_service.py`, `apps/runner/handlers/*.py`, `apps/runner/executor/Dockerfile`, and root `compose.yml` because the runner accepts user code, mounts temp files, starts Docker containers, and full Docker mounts `/var/run/docker.sock`.
- `Validation and Sanitisation Agent - Input Gatekeeper`, `Database Agent - Data Integrity Engineer`, and `Performance Agent - Latency Hawk`: import/generation/data persistence pipeline. Inspect `apps/web/src/app/api/import/route.ts` (1119 lines), `apps/web/src/app/api/homework/submit/route.ts`, `apps/web/src/app/api/topics/generate*.ts`, `apps/web/src/app/api/subjects/create/route.ts`, `packages/db/prisma/schema.prisma`, `apps/web/prisma/migrations/**`, and `apps/web/src/lib/clickhouse.ts` for untrusted files/text, AI JSON, embeddings, schema/migration consistency, and long-running fan-out.

## Commands to run first

```bash
pnpm install
pnpm db:generate
pnpm --filter @grindup/web lint
pnpm --filter @grindup/shared lint
pnpm --filter @grindup/web build
python3 -m py_compile apps/runner/main.py apps/runner/services/docker_service.py apps/runner/handlers/*.py
docker compose -f docker/compose.yml config
docker compose config
```

Run `pnpm db:push`, import/scrape endpoints, and full `docker compose up --build` only against disposable local data because they can mutate the database and ClickHouse.

## Notes

- `AGENTS.md` was requested but is absent in the target repo (`rg --files -g 'AGENTS.md'` returned no files).
- The worktree already had many modified/untracked files before this report; triage did not edit application source, config, or docs.
- `.env` exists in the repo root but was not opened; `.env.example` was used for environment mapping.
- No CI config was found.
