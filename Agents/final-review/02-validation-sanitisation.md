## Coverage Evidence

### Areas inspected

- `Agents/plan/02-validation-sanitisation.md`
- `Agents/stat.json`
- `Agents/patches/VAL-001.md`
- `Agents/patches/VAL-001-specialist-eval.md`
- `Agents/patches/VAL-001-eval.md`
- `Agents/patches/VAL-003.md`
- `Agents/patches/VAL-003-specialist-eval.md`
- `Agents/patches/VAL-003-eval.md`
- `apps/web/src/lib/html-sanitizer.ts`
- `apps/web/src/components/editor/problem-panel.tsx`
- `apps/web/src/app/api/problems/scrape/route.ts`
- `apps/web/src/app/api/import/route.ts`
- `apps/web/src/app/api/homework/submit/route.ts`
- Adjacent render/upload indicators under `apps/web/src/app/api`, `apps/web/src/components`, `packages`, and `apps/runner`.

### Searches and commands run

```bash
find .. -name AGENTS.md -print
find Agents -maxdepth 3 -type f | sort
git status --short
jq '.tasks[] | select(.id=="VAL-001" or .id=="VAL-003")' Agents/stat.json
rg -n "dangerouslySetInnerHTML|sanitizeProblemHtml|sanitizeHtml|innerHTML|rehypeRaw|markdown|marked" apps/web/src packages apps/runner
rg -n "formData\(|arrayBuffer\(|File\)|Buffer\.from|file\.size|file\.type|content-length|MAX_UPLOAD" apps/web/src/app/api apps/web/src/components
rg -n "sanitizeProblemHtml|dangerouslySetInnerHTML|formData\(|arrayBuffer\(|getMultipartBodyValidationError|getUploadValidationError|MAX_UPLOAD_BYTES|MAX_EXTRACTED_TEXT_CHARS|Content-Length|content-length|rehypeRaw|innerHTML" apps/web/src/lib/html-sanitizer.ts apps/web/src/components/editor/problem-panel.tsx apps/web/src/app/api/problems/scrape/route.ts apps/web/src/app/api/import/route.ts apps/web/src/app/api/homework/submit/route.ts apps/web/src/components apps/web/src/app/api
git diff -- apps/web/src/lib/html-sanitizer.ts apps/web/src/components/editor/problem-panel.tsx apps/web/src/app/api/problems/scrape/route.ts apps/web/src/app/api/import/route.ts apps/web/src/app/api/homework/submit/route.ts apps/web/package.json pnpm-lock.yaml
pnpm --filter @grindup/web exec node --input-type=module -e "<sanitize-html hostile payload probe>"
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
pnpm --filter @grindup/web exec eslint src/lib/html-sanitizer.ts src/components/editor/problem-panel.tsx src/app/api/problems/scrape/route.ts src/app/api/import/route.ts src/app/api/homework/submit/route.ts
python3 -m json.tool Agents/stat.json >/dev/null
git diff --check
```

### Code paths traced

- LeetCode `question.content` -> `sanitizeProblemHtml(q.content)` -> Postgres `Problem.description`, ClickHouse `problems_vec.content`, testcase extraction, embedding text -> `ProblemPanel` -> `sanitizeProblemHtml(problem.description)` -> `dangerouslySetInnerHTML`.
- `/api/import` multipart request -> declared body-size gate -> `request.formData()` -> parsed `File.size`/extension/MIME gate -> `fileToText()` helper backstop -> `File.arrayBuffer()` -> PDF/image/text extraction -> extracted-text cap -> OpenAI/Prisma/ClickHouse paths.
- `/api/homework/submit` multipart request -> declared body-size gate -> `request.formData()` -> parsed `File.size`/extension/MIME gate -> `extractTextFromFile()` helper backstop -> `File.arrayBuffer()` -> PDF/image/text extraction -> extracted-text cap -> grading and Prisma storage.

### Tests reviewed

- No automated hostile-HTML component/API test was added for VAL-001.
- No automated multipart oversize/type regression test was added for VAL-003.
- Targeted TypeScript passed.
- Targeted ESLint passed with one warning: existing unused `motion` import in `apps/web/src/components/editor/problem-panel.tsx`.
- Sanitizer probe passed: stripped event attributes, `javascript:` links, scripts, SVG, and non-HTTP image sources while preserving a safe HTTPS image.

### Domain exclusions

- Auth/session policy, LeetCode scrape authorization, Docker runner hardening, database transaction integrity, and general performance are left to the relevant specialist agents unless the root cause is validation or output sanitisation.
- Pre-existing raw markdown/Mermaid render surfaces using `rehypeRaw` or SVG injection were re-identified but were not introduced by VAL-001 or VAL-003.

## Per-Task Fixed-Status Assessment

### VAL-001: Problem descriptions render unsanitized third-party HTML

**Code status:** Fixed for the audited sink. `ProblemPanel` sanitizes `problem.description` before the only problem-description `dangerouslySetInnerHTML` sink, and the scrape route sanitizes new LeetCode content before Postgres/ClickHouse persistence and downstream testcase/embedding use.

**Evidence:** `apps/web/src/lib/html-sanitizer.ts` defines a narrow allowlist and rejects unsafe schemes/non-HTTP image sources; `apps/web/src/components/editor/problem-panel.tsx:50-52` memoizes sanitized HTML and `:126` renders that value; `apps/web/src/app/api/problems/scrape/route.ts:332`, `:358`, `:368`, `:390`, `:409`, and `:417` use `sanitizedContent`.

**Remaining manual test:** Insert `<img src=x onerror=alert(document.domain)>` or an equivalent hostile description in a local problem row and open `/problems/<problem-id>`; expected result is no alert and acceptable normal statement formatting.

### VAL-003: Multipart uploads are buffered before file limits are enforced

**Code status:** Fixed within route-level code for declared oversized multipart requests and parsed files. Both target routes check declared `Content-Length` before `request.formData()`, check `File.size`, extension, and MIME before extraction helpers, re-check in helpers before `arrayBuffer()`, and cap extracted text before downstream AI/database sinks.

**Evidence:** `apps/web/src/app/api/import/route.ts:90-102`, `:550-568`, and `:442-443`; `apps/web/src/app/api/homework/submit/route.ts:66-78`, `:295-309`, and `:107-108`. Text caps are enforced by `capExtractedText` in import (`100000`) and homework (`50000`).

**Remaining manual test:** With an authenticated local app session, upload a >10 MB file to `/api/import` and `/api/homework/submit`; expected result is `413` before extraction/OCR/OpenAI/Prisma work. Also upload a normal allowed PDF/image/TXT/MD and a MIME/extension mismatch; expected results are success for the valid file and `400` for the mismatch.

## Remaining Validation Risks

- Manual browser and authenticated upload tests are still pending; `Agents/stat.json` correctly leaves both VAL-001 and VAL-003 at `needs_user_test` with `approved_by_user: false`.
- VAL-003 still depends on an upstream/platform request body limit for missing, invalid, or chunked multipart uploads where `Content-Length` is unavailable; the app can only inspect parsed `File.size` after `request.formData()` in that case.
- Existing database rows are not backfilled, but VAL-001 protects old rows at the render sink. A backfill would reduce stored-data hygiene risk, not the current browser execution risk.
- Separate pre-existing raw markdown/Mermaid rendering paths remain outside these two tasks and should be tracked separately if not already covered by another validation/security item.

## New Validation Findings

No new concrete validation/sanitisation finding was found in the VAL-001 or VAL-003 modified areas during final review.

## Readiness Verdict

Validation final review passes for code readiness. VAL-001 and VAL-003 should remain unapproved until the listed manual user tests are completed and the user explicitly approves them.
