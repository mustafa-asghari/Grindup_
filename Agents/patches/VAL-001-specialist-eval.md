# Specialist Eval Report: VAL-001

## Specialist

Validation and Sanitisation Agent - Input Gatekeeper

## Verdict

Pass

## Domain root cause check

`ProblemPanel` now memoizes `sanitizeProblemHtml(problem.description)` and sends only `sanitizedDescription` to `dangerouslySetInnerHTML`. The scrape route sanitizes `q.content` once as `sanitizedContent` before new Postgres description writes, testcase extraction, embedding text, and ClickHouse `content` persistence.

## Same-domain side effects checked

Checked the sanitizer allowlist and scheme policy for event handler attributes, script/style bodies, `javascript:`/`data:` URLs, unsafe image URLs, and unsafe `iframe`/`object`/`embed`/`svg` surfaces. The policy preserves common problem statement formatting such as paragraphs, headings, emphasis, code/pre blocks, lists, tables, safe links, HTTP/HTTPS images, and a limited MathML subset.

## New same-domain issues

No new input/render/path/URL/HTML/markdown parsing issue was found in the VAL-001 patch. Existing markdown and Mermaid render surfaces are separate pre-existing paths and were not changed by this task; existing ClickHouse rows are not backfilled, but the problem-page render sink is now sanitized and newly scraped content is sanitized before storage.

## Evidence reviewed

```bash
sed -n '1,260p' Agents/patches/VAL-001.md
git diff -- apps/web/src/app/api/problems/scrape/route.ts apps/web/src/components/editor/problem-panel.tsx apps/web/package.json pnpm-lock.yaml
sed -n '1,260p' apps/web/src/lib/html-sanitizer.ts
nl -ba apps/web/src/components/editor/problem-panel.tsx | sed -n '44,132p'
nl -ba apps/web/src/app/api/problems/scrape/route.ts | sed -n '244,340p'
rg -n "sanitizeProblemHtml|dangerouslySetInnerHTML|description: sanitizedContent|content: sanitizedContent|extractTestCases\(sanitizedContent\)|textToEmbed" apps/web/src/lib/html-sanitizer.ts apps/web/src/components/editor/problem-panel.tsx apps/web/src/app/api/problems/scrape/route.ts
rg -n "problems_vec|Problem\.description|problem\.description|description \?\?|description\}" apps/web/src packages apps/runner
node <<'EOF'
// Probe sanitize-html with the same policy options for event attrs, script/style, javascript/data URLs,
// image URL handling, iframe/object/svg removal, srcset removal, and formatting preservation.
EOF
```

The runtime sanitizer probe removed `onerror`, `onclick`, `javascript:` links, `data:` links/images, `script`, `style`, `svg`, `iframe`, `object`, and `srcset`, while preserving representative paragraph, strong, pre/br, and table formatting.

## Decision

Leave task `implemented` for Eval/Supervisor final review. No Worker follow-up is required for the validation and sanitisation scope.
