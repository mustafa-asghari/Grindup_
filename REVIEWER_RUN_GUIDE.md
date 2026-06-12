# Reviewer Run Guide

## Quick Overview

GrindUp is an AI learning platform with a Next.js web app, Prisma/PostgreSQL, ClickHouse retrieval, Redis support, OpenAI integration, and a FastAPI runner for coding practice.

The fastest review path is Docker if you want the whole stack, or local Node/Python if you want to inspect and debug each service separately.

## Fastest Full-Stack Run

From the repo root:

```bash
cp .env.example .env
docker compose up --build
```

Then open:

- Web app: `http://localhost:3000`
- Runner health: `http://localhost:8080/health`
- ClickHouse UI: `http://localhost:15521`

Expected result:

- PostgreSQL, Redis, and ClickHouse start
- the executor image is built as `grindup-executor:latest`
- the runner starts on `127.0.0.1:8080`
- the web app pushes the Prisma schema to local Postgres and starts on port `3000`

The `executor-image` compose service may show as exited after a successful build. That is expected; it exists so the runner can launch executor containers later.

## Local Run Commands

Install dependencies and prepare the database:

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
```

Start infrastructure:

```bash
docker compose -f docker/compose.yml up -d
```

Build the code executor image:

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

## Docker Run Commands

Infra only:

```bash
docker compose -f docker/compose.yml up -d
```

Executor image only:

```bash
docker build -t grindup-executor apps/runner/executor
```

Full stack:

```bash
docker compose up --build
```

Stop services:

```bash
docker compose down
docker compose -f docker/compose.yml down
```

## Important URLs

| Service | URL |
| --- | --- |
| Web app | `http://localhost:3000` |
| Runner health | `http://127.0.0.1:8080/health` |
| Full-stack ClickHouse UI | `http://localhost:15521` |
| Infra-only ClickHouse UI | `http://localhost:5521` |
| Infra-only PostgreSQL | `localhost:5432` |
| Infra-only Redis | `localhost:6379` |
| Infra-only ClickHouse HTTP | `http://localhost:8123` |

## Optional Features Requiring API Keys

- `OPENAI_API_KEY`: tutor responses, lesson generation, quiz/homework generation, embeddings, and import workflows
- `SERPER_API_KEY`: optional web research during topic generation
- `YOUTUBE_API_KEY`: YouTube metadata fallback
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET`: optional anti-bot protection
- `LEETCODE_CSRF_TOKEN` / `LEETCODE_COOKIE`: optional local problem scraping headers
- `RUNNER_SHARED_SECRET`: shared web-to-runner token required by runner `/execute` when configured

Without API keys, the core app, auth, database-backed screens, and runner infrastructure can still be reviewed, but AI-powered generation features will be limited.

## Known Limitations

- The runner is suitable for local review, not hardened production sandboxing.
- Full Docker mode mounts the host Docker socket into the runner so it can launch executor containers.
- The full Docker web service runs `prisma db push` during startup for convenience.
- Full Docker does not publish PostgreSQL, Redis, or ClickHouse database/cache ports to the host. Use the infra-only compose file when you want host access to those services.
- Background jobs, production object storage, and production deployment manifests are intentionally minimal.
- Optional scrape/import flows can depend on third-party rate limits or local credentials.

## Troubleshooting

If `pnpm db:push` cannot connect, start the infra stack first:

```bash
docker compose -f docker/compose.yml up -d
```

If infra-only Docker reports that a port is already allocated, set a host-port override and rerun the command. Example:

```bash
POSTGRES_HOST_PORT=15432 docker compose -f docker/compose.yml up -d
```

If code execution fails, confirm Docker Desktop is running and the executor image exists:

```bash
docker images | grep grindup-executor
docker build -t grindup-executor apps/runner/executor
```

If the runner fails in Docker, check Docker socket access:

```bash
docker compose logs runner
```

If the web app cannot reach the runner in Docker, confirm the full stack is using:

```env
RUNNER_URL=http://runner:8080
RUNNER_SHARED_SECRET=dev-only-runner-secret
```
