# Eval Report: VAL-003

## Verdict

Needs user testing

## What changed

The Worker added multipart upload validation to `apps/web/src/app/api/import/route.ts` and `apps/web/src/app/api/homework/submit/route.ts`. Declared multipart bodies over the route cap now return `413` before `request.formData()`, parsed files over 10 MB return `413` before `arrayBuffer()` or extraction, unsupported file types return `400`, and extracted text is capped before AI/database paths.

## Does this fix the root cause?

Yes. `Agents/patches/VAL-003-specialist-eval.md` exists and records `PASS` from Validation and Sanitisation Agent - Input Gatekeeper. The specialist confirmed route-level checks run before extraction helpers, helper-level checks run before `arrayBuffer()`, and extracted content is capped.

## Scope check

Pass. The VAL-003 patch scope is limited to the two upload route files plus review-skill task artifacts. The wider worktree contains many unrelated modified files from other tasks, but VAL-003's patch note and focused diff only require `apps/web/src/app/api/import/route.ts` and `apps/web/src/app/api/homework/submit/route.ts` as app-code changes.

## Backwards compatibility check

Pass with one intentional compatibility tightening. Existing PDF, image, TXT, and MD uploads remain accepted when extension and explicit MIME type agree; `application/octet-stream` remains tolerated for supported extensions. JSON body paths for notes/YouTube import and text homework submission remain unchanged. Binary `doc` and `docx` uploads now fail fast with `400`, which is acceptable because the prior logic only attempted unreliable UTF-8 decoding rather than true document parsing.

## Test check

No automated multipart regression tests were added. Given the existing test gap and lack of route-test harness, manual user testing is still required before approval.

## Commands run

```bash
pnpm --filter @grindup/web exec eslint src/app/api/import/route.ts src/app/api/homework/submit/route.ts
pnpm --filter @grindup/web exec tsc --noEmit --pretty false
python3 -m json.tool Agents/stat.json >/dev/null
```

## Command results

Passed. All three commands exited 0.

## Risks remaining

If `Content-Length` is missing, invalid, or the upload is chunked and there is no upstream request body limit, Next.js can still parse multipart form data before the per-file `File.size` gate is available. This is documented for manual testing and should be handled with deployment/platform request-size limits.

## Eval decision

Mark VAL-003 as `needs_user_test`. Do not mark approved until the user manually tests and says the exact approval phrase.

## Suggested commit message

Reject oversized uploads before buffering
