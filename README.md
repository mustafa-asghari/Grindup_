# GrindUp

GrindUp is an AI-powered learning platform that turns source material into structured study plans, lessons, quizzes, flashcards, homework, analytics, and coding practice.

It combines a Next.js product app, Prisma/PostgreSQL, ClickHouse retrieval, Redis support, OpenAI-powered generation, and a FastAPI code runner that executes submissions in Docker.

## What It Does

GrindUp is built around active learning loops:

- import notes, PDFs, YouTube material, or manual subject plans
- generate subject roadmaps, topics, lessons, quizzes, and homework
- tutor from source-grounded context instead of generic chat alone
- schedule flashcards and review cards with spaced repetition
- track learning progress, streaks, weak areas, and study activity
- solve coding problems in a Monaco editor with test-case feedback
- run Python, JavaScript, Java, and C++ submissions through a separate runner service

## Main Features

- AI subject creation and topic roadmap generation
- source-grounded tutor chat and lesson generation
- quiz, homework, flashcard, and review workflows
- learning analytics, weekly reports, streaks, XP, and mastery tracking
- coding practice workspace with scratchpads and test results
- semantic problem/source retrieval with ClickHouse and OpenAI embeddings
- credentials auth plus optional GitHub/Google OAuth
- FastAPI runner service with Docker-based code execution
- local infrastructure through Docker Compose

## Tech Stack

| Area | Technology |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Auth | NextAuth v5, Prisma adapter, credentials auth, optional GitHub/Google OAuth |
| Database | PostgreSQL, Prisma |
| Retrieval / analytics | ClickHouse |
| Cache / queue support | Redis |
| AI | OpenAI chat and embeddings |
| Editor / content | Monaco Editor, React Markdown, KaTeX, Mermaid |
| Runner | FastAPI, Python, Docker SDK |
| Code execution | Docker executor image for Python, JavaScript, Java, and C++ |
| Tooling | pnpm workspaces, Turborepo, ESLint |

## Architecture

```mermaid
flowchart LR
    User["Learner / User"] --> Web["Next.js Web App"]

    Web --> Auth["NextAuth / Auth Layer"]
    Web --> API["Next.js API Routes"]
    Web --> DB["PostgreSQL + Prisma"]
    Web --> AI["OpenAI API"]
    Web --> CH["ClickHouse Retrieval / Analytics"]
    Web --> Redis["Redis Cache / Queue Support"]
    Web --> Runner["FastAPI Runner Service"]

    Runner --> Executor["Docker Code Executor"]
    Executor --> Results["Test Results / Runtime Feedback"]

    DB --> Progress["Progress, Subjects, Quizzes, Homework"]
    CH --> Search["Semantic Search / Source Retrieval"]
    AI --> Tutor["Grounded Tutor, Lessons, Quizzes"]
```

## Repo Structure

```text
GrindUp/
├── apps/
│   ├── web/                    # Next.js app, UI, API routes, auth, AI workflows
│   └── runner/                 # FastAPI code runner service
│       └── executor/           # Docker image used for sandboxed code execution
├── packages/
│   ├── db/                     # Prisma schema and shared Prisma client exports
│   └── shared/                 # Shared types and constants
├── docker/
│   └── compose.yml             # Infra-only compose stack
├── compose.yml                 # Full local review stack
├── REVIEWER_RUN_GUIDE.md       # Short runbook for technical reviewers
├── .env.example                # Safe local environment template
├── pnpm-workspace.yaml
├── turbo.json
└── start-dev.sh
```

## Environment Variables

Copy `.env.example` to `.env` before running locally:

```bash
cp .env.example .env
```

Required for local core app:

| Variable | Purpose | Safe local example |
| --- | --- | --- |
| `DATABASE_URL` | Prisma/PostgreSQL connection | `postgresql://grindup:grindup_dev_only@localhost:5432/grindup` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `CLICKHOUSE_URL` | ClickHouse HTTP endpoint | `http://localhost:8123` |
| `CLICKHOUSE_USER` | ClickHouse user | `grindup` |
| `CLICKHOUSE_PASSWORD` | ClickHouse local password | `grindup_dev_only` |
| `CLICKHOUSE_DB` | ClickHouse database | `grindup` |
| `NEXTAUTH_URL` | Auth callback base URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Local auth signing secret | `dev-only-change-me` |
| `RUNNER_URL` | FastAPI runner URL | `http://localhost:8080` |
| `RUNNER_SHARED_SECRET` | Shared web-to-runner execution token | `dev-only-runner-secret` |

Optional features:

| Variable | Enables |
| --- | --- |
| `OPENAI_API_KEY` | AI tutor, lessons, quizzes, embeddings, import generation |
| `SERPER_API_KEY` | Optional web research during topic generation |
| `YOUTUBE_API_KEY` | YouTube metadata fallback during imports |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Optional anti-bot protection |
| `LEETCODE_CSRF_TOKEN`, `LEETCODE_COOKIE` | Optional local LeetCode scrape headers |
| `SCRAPE_LIMIT` | Maximum LeetCode problems to request during local scrape |

Do not commit real `.env` files or production credentials.

## Run Locally Without Docker

Prerequisites:

- Node.js 20+
- pnpm 8+
- Python 3.11+
- Docker Desktop, required for the runner executor image
- PostgreSQL, Redis, and ClickHouse running locally or through the infra compose stack

Install dependencies and prepare the database:

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
```

Start local infrastructure if you do not already have PostgreSQL, Redis, and ClickHouse:

```bash
docker compose -f docker/compose.yml up -d
```

Build the executor image used by the runner:

```bash
docker build -t grindup-executor apps/runner/executor
```

Start the runner:

```bash
cd apps/runner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export RUNNER_SHARED_SECRET=dev-only-runner-secret
python main.py
```

Start the web app from the repo root:

```bash
pnpm --filter @grindup/web dev
```

Expected local URLs:

- Web app: `http://localhost:3000`
- Runner health: `http://localhost:8080/health`
- ClickHouse UI: `http://localhost:5521`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- ClickHouse HTTP: `http://localhost:8123`

## Run With Docker

Infra-only stack:

```bash
docker compose -f docker/compose.yml up -d
```

Executor image only:

```bash
docker build -t grindup-executor apps/runner/executor
```

Full local review stack from the repo root:

```bash
docker compose up --build
```

The full-stack compose file publishes the web app on `3000`, binds runner health/direct checks to `127.0.0.1:8080`, and publishes ClickHouse UI on `15521`. PostgreSQL, Redis, and ClickHouse are available inside the Compose network and are not bound to host database/cache ports, which avoids conflicts with local services. Runner `/execute` requests require `RUNNER_SHARED_SECRET`; the web service sends it automatically when configured.

The infra-only compose file defaults to the standard local ports shown above. If you need different host ports for that workflow, set `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, `CLICKHOUSE_HTTP_HOST_PORT`, `CLICKHOUSE_NATIVE_HOST_PORT`, or `CLICKHOUSE_UI_HOST_PORT` before running Compose.

The full stack builds:

- `grindup-web:local`
- `grindup-runner:local`
- `grindup-executor:latest`
- PostgreSQL, Redis, ClickHouse, and ClickHouse UI

The `executor-image` compose service is a build helper. It exits successfully after the executor image exists; the runner then launches short-lived executor containers through the mounted Docker socket.

Stop Docker services:

```bash
docker compose down
docker compose -f docker/compose.yml down
```

## Testing And Linting

```bash
pnpm install
pnpm db:generate
pnpm build
pnpm lint
pnpm test
```

Runner dependency check:

```bash
cd apps/runner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

Docker validation:

```bash
docker compose -f docker/compose.yml config
docker compose -f docker/compose.yml build
docker compose config
docker compose build
```

## Known Limitations

- AI generation, tutoring, embeddings, OCR fallbacks, and some import workflows require real API keys.
- The runner is intended for local development and portfolio review. It uses Docker isolation, disables container networking for executed code, and runs executor containers as a non-root user, but it is not a complete production-grade sandbox.
- Full Docker mode mounts `/var/run/docker.sock` into the runner so it can start executor containers. Treat that as a local development convenience, not a hardened deployment pattern.
- The full Docker web service runs `prisma db push` on startup for reviewer convenience. Production deployments should use a controlled migration process.
- Full Docker does not publish PostgreSQL, Redis, or ClickHouse database/cache ports to the host. Use the infra-only compose file when you want host access to those services.
- File upload storage, background jobs, observability, and deployment infrastructure are intentionally minimal in this repo.
- Optional LeetCode scraping can be rate-limited or require local headers. No browser cookies or private scrape headers are committed.

## Security / Public-Safe Note

This repo is prepared to be shared publicly:

- generated folders such as `node_modules`, `.next`, build outputs, coverage, caches, virtual environments, and Python bytecode are ignored
- `.env.example` contains only fake local placeholders
- real `.env` files are ignored and should not be committed
- committed scrape cookies and CSRF values have been removed
- Docker local credentials are development placeholders only
