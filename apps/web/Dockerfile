# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN sed -i 's|http://deb.debian.org/debian-security|http://security.debian.org/debian-security|g; s|http://deb.debian.org/debian|http://ftp.au.debian.org/debian|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

FROM base AS deps

RUN sed -i 's|http://deb.debian.org/debian-security|http://security.debian.org/debian-security|g; s|http://deb.debian.org/debian|http://ftp.au.debian.org/debian|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    make \
    pkg-config \
    python3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/runner/package.json apps/runner/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ENV DATABASE_URL="postgresql://grindup:grindup_dev_only@localhost:5432/grindup"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="dev-only-change-me"
ENV AUTH_SECRET="dev-only-change-me"

COPY . .

RUN pnpm db:generate
RUN pnpm --filter @grindup/web build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder --chown=node:node /app /app

USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "@grindup/web", "start"]
