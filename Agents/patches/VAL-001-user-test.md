# User Test Instructions: VAL-001

## What was fixed

Problem descriptions are sanitized before rendering in the problem panel. Newly scraped problem HTML is also sanitized before being persisted to Postgres and ClickHouse.

## Where to test

- Browser page: `http://localhost:3000/problems/<problem-id>`
- Component sink: `apps/web/src/components/editor/problem-panel.tsx`
- Scrape ingestion route: `POST /api/problems/scrape`

## Setup needed

Start the app locally or with Docker:

```bash
docker compose up -d
```

or:

```bash
pnpm --filter @grindup/web dev
```

Use a local database row for a problem you can safely modify.

## Test steps

1. Set a local problem description to `<img src=x onerror=alert(document.domain)><p onclick="alert(1)">safe text</p><a href="javascript:alert(1)">bad link</a>`.
2. Open the matching problem page at `http://localhost:3000/problems/<problem-id>`.
3. Inspect the rendered description and browser console.
4. Optionally scrape or insert a normal problem statement that includes paragraphs, lists, code/pre blocks, and tables.

## Expected result

No alert appears. The browser console does not show script execution from the description. Unsafe attributes and URLs are removed or inert, while normal problem formatting still renders acceptably.

## Bad result

An alert appears, an event handler remains active, a `javascript:` link remains clickable, or normal problem statement formatting is unusably stripped.

## Regression checks

- Existing problem pages still load.
- Code/pre blocks and examples remain readable.
- Scraped problem content still produces problem rows and test cases when source HTML is otherwise valid.

## What to tell the AI after testing

If the test passed, say:

`I tested task VAL-001 and approve it.`

If the test failed, say:

`Task VAL-001 failed user testing. Here is what happened: <details>.`
