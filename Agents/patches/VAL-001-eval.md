# Eval Report: VAL-001

## Verdict

Needs user testing

## What changed

The patch adds `sanitizeProblemHtml` in `apps/web/src/lib/html-sanitizer.ts`, uses it before `ProblemPanel` calls `dangerouslySetInnerHTML`, and sanitizes newly scraped LeetCode problem content before Postgres writes, testcase extraction, embedding text, and ClickHouse inserts.

## Does this fix the root cause?

Yes. The specialist eval in `Agents/patches/VAL-001-specialist-eval.md` passed and confirmed the unsafe third-party HTML render sink now receives sanitized HTML.

## Scope check

The application source changes are scoped to the original render sink, scrape ingestion path, and required package dependency. `pnpm-lock.yaml` includes broader pre-existing workspace drift beyond the sanitizer entries; this remains a repo hygiene risk but was already present in the dirty worktree and was not reverted.

## Backwards compatibility check

The sanitizer preserves common problem statement formatting, including paragraphs, headings, code/pre blocks, lists, tables, safe links, HTTPS/HTTP images, and limited MathML. Inline styles, scripts, event handler attributes, unsafe URL schemes, iframes, objects, embeds, SVG, and relative image URLs are removed, which is an intentional security tradeoff.

## Test check

No automated component or API test was added for hostile problem HTML. Manual browser testing is still required because the original proof is a DOM execution check.

## Commands run

```bash
python3 -m json.tool Agents/stat.json >/dev/null
git diff --check
pnpm --filter @grindup/web exec node --input-type=module
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
pnpm --filter @grindup/web build
pnpm --filter @grindup/web lint
```

## Command results

- Passed: `python3 -m json.tool Agents/stat.json >/dev/null`
- Passed: `git diff --check`
- Passed: sanitizer probe removed event handlers, `javascript:` URLs, scripts, and unsafe image URLs while preserving a safe HTTPS image.
- Passed: `pnpm --filter @grindup/web exec tsc --noEmit --pretty false`
- Passed: `pnpm --filter @grindup/web build`
- Failed: `pnpm --filter @grindup/web lint` with existing repo-wide lint debt, 378 problems total: 221 errors and 157 warnings. The failures are primarily existing `no-explicit-any`, React hook purity, unescaped entity, and unused variable issues across many files.

## Risks remaining

Existing stored rows are protected at the render sink, but there is no backfill that rewrites old stored descriptions. Other HTML/markdown rendering surfaces outside the problem description flow were not part of this task. The manual alert proof still needs a browser check.

## Eval decision

Mark `VAL-001` as `needs_user_test`. Do not mark approved until the user explicitly says they tested and approve it.

## Suggested commit message

`Fix unsafe problem description HTML rendering`
