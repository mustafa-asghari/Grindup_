# GrindUp

GrindUp is an AI-native learning platform that combines curriculum generation, source-grounded tutoring, spaced repetition, homework workflows, analytics, and LeetCode-style coding practice in a single product.

The goal is simple: instead of giving learners a generic chatbot, build a system that can ingest real material, turn it into a structured subject, and then drive actual learning loops around it.

## What This Project Demonstrates

- End-to-end full-stack product thinking, not just isolated UI work
- Practical AI integration beyond chat, including content ingestion, retrieval, generation, and personalization
- A split architecture with a Next.js application and a dedicated sandboxed code execution service
- A large relational learning domain modeled in Prisma for progress, review, homework, gamification, and social systems
- Real developer ergonomics with a pnpm monorepo, shared packages, Docker-backed local infrastructure, and separate runtime boundaries

## Core Product Capabilities

### 1. AI-Powered Subject Creation

Users can create a subject from:

- YouTube videos
- PDFs
- Freeform notes
- Manual subject creation

The platform then:

- extracts or OCRs the source material
- generates a structured subject and topic hierarchy
- stores source content for later retrieval
- creates topic lessons and quizzes on demand

### 2. Personalized Learning Setup

Each subject can be configured through a guided setup flow:

- weekly study hours
- target deadline
- diagnostic confidence check across topics
- AI-generated roadmap based on current level

This moves the product from "content browser" to "personalized study system".

### 3. Source-Grounded AI Tutor

The tutor is intentionally retrieval-grounded. Instead of answering from the model's general memory, it pulls from imported subject material and topic content, then teaches from that context.

This is important because it:

- reduces hallucination risk
- keeps explanations aligned with the learner's actual materials
- makes imported documents, lecture notes, and transcripts reusable across the product

### 4. Lesson, Quiz, Homework, and Flashcard Generation

For each topic, the platform can generate:

- lesson content in Markdown
- math-rich content rendered with KaTeX
- concept diagrams using Mermaid
- MCQ quizzes
- flashcards tied into spaced repetition
- homework assignments with due dates and reminders

This gives the product a full active-learning loop instead of passive reading.

### 5. Coding Practice + Execution Engine

For technology subjects and algorithm practice, GrindUp includes:

- a Monaco-based code editor
- LeetCode-style problems
- test-case driven submissions
- runtime and correctness feedback
- scratchpads and reporting flows
- vector search over problem content

Execution is isolated behind a dedicated runner service that currently supports:

- Python
- JavaScript
- Java
- C++

### 6. Retention, Progress, and Motivation Systems

The platform tracks learning with:

- subject and topic progress
- mastery percentages
- review cards and flashcards using SM-2 style scheduling
- XP, levels, streaks, and badge hooks
- homework queues and late-penalty support
- analytics views, heatmaps, and weekly reports

### 7. Competitive and Social Surfaces

The codebase also includes product surface for:

- contest lobbies
- challenge flows
- social features and messaging
- leaderboards

This makes the system broader than a solo study tracker.

## End-to-End User Flow

1. A user signs up with credentials or optional OAuth.
2. They import a PDF, YouTube lecture, or notes.
3. GrindUp generates a subject, curriculum, and topic structure.
4. The user chooses weekly commitment and target timeline.
5. A diagnostic pass helps build a personalized roadmap.
6. The learner studies lesson content, completes quizzes, and submits homework.
7. Flashcards and review cards re-surface material later using spaced repetition.
8. If the subject is coding-related, the learner can solve programming problems in the built-in workspace.
9. Analytics and weekly summaries expose progress, weak areas, and study patterns.

## Architecture

```mermaid
flowchart LR
    U["User Browser"] --> W["Next.js Web App"]
    W --> P["PostgreSQL + Prisma"]
    W --> C["ClickHouse"]
    W --> O["OpenAI APIs"]
    W --> R["Python Runner Service"]
    W --> E["Docker Executor Image"]
    W --> D["Redis"]
    W --> Y["YouTube / Imported Sources"]
    R --> E
```

## Why The Architecture Looks Like This

### Next.js Web App

The web app is the product shell. It handles:

- authentication
- server-rendered pages
- route handlers
- AI orchestration
- progress tracking
- dashboards and client UI

### PostgreSQL + Prisma

Postgres is the source of truth for the learning domain:

- users
- subjects
- topics
- exercises
- attempts
- homework
- review cards
- submissions
- contests
- analytics snapshots

Prisma gives the project a strongly modeled domain with a large schema that reflects the product's complexity.

### ClickHouse

ClickHouse is used for fast analytical and vector-oriented workloads, including:

- semantic problem search
- imported source indexing
- retrieval support for AI workflows

### Python Runner Service

Code execution is intentionally separated from the Next.js app. The runner:

- receives submission payloads
- wraps test harnesses
- executes code inside Docker
- returns pass/fail and runtime information

This keeps untrusted code execution out of the main web process.

### OpenAI Integration

OpenAI is used for:

- curriculum research and subject generation
- lesson generation
- quiz and homework generation
- embeddings for retrieval and semantic search
- tutor responses
- OCR fallbacks for scanned PDFs

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion |
| Auth | NextAuth v5, Prisma adapter, credentials auth, optional GitHub/Google OAuth |
| Database | PostgreSQL, Prisma |
| Search / Retrieval | ClickHouse, OpenAI embeddings |
| AI | OpenAI chat + embeddings |
| Code Editor | Monaco Editor |
| Math / Rich Content | React Markdown, KaTeX, Mermaid |
| Execution | FastAPI, Python, Docker |
| Monorepo Tooling | pnpm workspaces, Turborepo |
| Supporting Infra | Redis, Docker Compose |

## Repo Structure

```text
GrindUp/
├── apps/
│   ├── runner/        # FastAPI service for sandboxed code execution
│   └── web/           # Next.js product UI and API routes
├── packages/
│   ├── db/            # Shared Prisma schema and database package
│   └── shared/        # Shared types and constants
├── docker/
│   └── compose.yml    # Local Postgres / Redis / ClickHouse stack
├── start-dev.sh       # Local helper script for booting runner + web
├── turbo.json         # Turborepo pipeline config
└── pnpm-workspace.yaml
```

## Notable Engineering Decisions

### Grounded AI Instead of Generic AI

The strongest product decision in this codebase is that imported materials are not just stored, they become the foundation for:

- tutor retrieval
- lesson generation
- quiz generation
- homework generation

That gives the app a coherent learning loop and makes the AI behavior materially better than a plain chat wrapper.

### Separate Runner for Untrusted Code

Executing user code in the same process as the web app would be the wrong boundary. The separate runner service is a cleaner design for:

- isolation
- future scaling
- language-specific execution logic
- container-based sandboxing

### Domain Model Over Toy Schema

This is not a thin CRUD app. The Prisma schema models:

- onboarding
- subject enrollment
- topic mastery
- review scheduling
- homework reminders
- late penalties
- submissions
- contests
- leaderboards
- social features

That modeling work is a major part of the project value.

### Learning Science Built Into The Product

The system is not just about generating content. It tries to support retention using:

- review cards
- flashcards
- spaced repetition
- mastery updates
- streaks and rewards
- analytics feedback loops

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Python 3.11+
- Docker Desktop

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create your environment file

```bash
cp .env.example .env
```

If you use the included Docker Compose stack, keep these local defaults:

```env
DATABASE_URL="postgresql://grindup:grindup_secure_2024@localhost:5432/grindup"
CLICKHOUSE_URL="http://localhost:8123"
CLICKHOUSE_USER="grindup"
CLICKHOUSE_PASSWORD="grindup_secure_2024"
CLICKHOUSE_DB="grindup"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
OPENAI_API_KEY=""
RUNNER_URL="http://localhost:8080"
```

Optional providers and services:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SERPER_API_KEY`
- `YOUTUBE_API_KEY`
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET`

### 3. Start local infrastructure

```bash
docker compose -f docker/compose.yml up -d
```

This brings up:

- PostgreSQL
- Redis
- ClickHouse
- ClickHouse UI

### 4. Build the execution image

```bash
docker build -t grindup-executor apps/runner/executor
```

### 5. Push the Prisma schema

```bash
pnpm db:generate
pnpm db:push
```

### 6. Start the runner service

```bash
cd apps/runner
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The runner starts on `http://localhost:8080`.

### 7. Start the web app

Open another terminal:

```bash
pnpm --filter @grindup/web dev
```

The app starts on `http://localhost:3000`.

### Optional: one-command local boot

There is also a helper script:

```bash
./start-dev.sh
```

This is useful for local development, especially on macOS, because it:

- kills existing ports
- starts the Python runner
- runs Prisma generate / push
- starts the Next.js app

## Key Product Surfaces

### Subject Learning

- subject library and enrollment
- generated topic trees
- topic detail pages with lessons and exercises
- subject dashboard with progress context

### Coding Practice

- problem list
- semantic search
- submission flow
- scratchpad support
- review cards for accepted solutions

### Active Recall

- flashcard study
- daily review queue
- SM-2 scheduling logic

### Study Operations

- homework generation
- homework submission and AI feedback
- weekly reports
- analytics heatmaps and radar charts

### Social / Competitive

- contests
- contest lobbies
- messaging and challenge surfaces

## Selected Implementation Details

### Import Pipeline

The import flow is one of the most interesting parts of the project:

- YouTube imports attempt transcript retrieval first, then fall back to metadata
- PDF imports attempt text extraction first, then OCR and file-assisted AI fallback
- imported content is stored for downstream lesson and tutor use
- ClickHouse tables support source tracking and vector-oriented retrieval

### Lesson Rendering

Generated learning content supports:

- Markdown
- KaTeX-rendered mathematics
- Mermaid diagrams

That makes the system suitable for both coding and math-heavy subjects.

### Review Scheduling

Flashcard review uses an SM-2 style scheduling algorithm, which gives the product a retention mechanism rather than a simple "completed / not completed" state.

### Semantic Search

The coding side uses embeddings plus ClickHouse to retrieve semantically relevant problems, which is a meaningful step beyond basic keyword search.

## If I Were Taking This To Production Next

The next improvements I would prioritize are:

1. background job infrastructure for long-running AI generation and imports
2. automated integration tests around import, generation, and execution flows
3. tighter sandboxing, quotas, and execution observability for the runner
4. object storage for uploads and generated artifacts
5. stronger evaluation and guardrails for AI-generated curriculum quality
6. websocket or event-stream support for real-time contests and progress updates

## Why This Project Matters

Most AI learning products stop at "ask a chatbot a question". GrindUp goes further and treats learning as a system:

- ingest source material
- structure it into curriculum
- personalize the plan
- create practice loops
- reinforce memory
- track progress
- support coding execution when needed

That combination of product thinking, AI integration, and full-stack implementation is what makes this project worth showing in a job context.
