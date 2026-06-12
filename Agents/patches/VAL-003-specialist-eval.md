# Specialist Eval Report: VAL-003

## Specialist

Validation and Sanitisation Agent - Input Gatekeeper

## Verdict

PASS

## Domain root cause check

The upload root cause is fixed within the implemented route code. Both multipart routes check declared multipart `Content-Length` before `request.formData()`, so oversized declared multipart bodies over the route body cap return `413` before the multipart parser buffers form data.

Both routes validate `File.size`, filename extension, and MIME/extension consistency before extraction helpers run. The extraction helpers also re-run the same validation before `file.arrayBuffer()`, which gives a backstop if a future caller bypasses the route-level check.

Unsupported extensions or MIME/extension mismatches return `400`; files over 10 MB return `413`. Extracted import text is capped at 100,000 characters before AI, topic generation, embeddings, ClickHouse, or Prisma paths; homework extracted/submitted content is capped at 50,000 characters before grading and storage paths.

Residual limitation: if `Content-Length` is absent, invalid, or the upload is chunked and no upstream request body limit exists, `request.formData()` can still parse the multipart body before the per-file `File.size` gate is available. That limitation was explicitly scoped as a platform/upstream body-limit concern in the original finding guidance and does not fail this task because the implemented code now rejects declared oversized multipart requests before `formData()` and rejects parsed oversized files before `arrayBuffer()` or downstream work.

## Same-domain side effects checked

- `apps/web/src/app/api/import/route.ts`: confirmed `getMultipartBodyValidationError()` runs before `request.formData()`; `getUploadValidationError()` runs before `fileToText()`; `fileToText()` validates before `file.arrayBuffer()`; unsupported files return `400`; oversized files return `413`; PDF magic-byte failure returns no extracted text before parser/OCR work; text/image/PDF extraction results are capped before AI/database/storage paths.
- `apps/web/src/app/api/homework/submit/route.ts`: confirmed `getMultipartBodyValidationError()` runs before `request.formData()`; `getUploadValidationError()` runs before `extractTextFromFile()`; `extractTextFromFile()` validates before `file.arrayBuffer()`; unsupported files return `400`; oversized files return `413`; extracted content is capped before grading and Prisma writes.
- Checked the changed upload paths for newly introduced same-domain validation gaps around extension allowlists, MIME handling, file-size checks, extracted-text limits, and error statuses.

## New same-domain issues

None found in these upload paths.

## Evidence reviewed

- `Agents/stat.json`
- `Agents/plan/02-validation-sanitisation.md`
- `Agents/patches/VAL-003.md`
- Current git diff for `apps/web/src/app/api/import/route.ts`
- Current git diff for `apps/web/src/app/api/homework/submit/route.ts`
- Source inspection of relevant validation, extraction, OCR/OpenAI, and Prisma paths in both route files.

Validation commands:

```bash
pnpm --filter @grindup/web exec eslint src/app/api/import/route.ts src/app/api/homework/submit/route.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
python3 -m json.tool Agents/stat.json >/dev/null
```

All three commands passed.

## Decision

Specialist eval passes. Leave VAL-003 status as `implemented` and set `specialist_eval_report` to `Agents/patches/VAL-003-specialist-eval.md`.
