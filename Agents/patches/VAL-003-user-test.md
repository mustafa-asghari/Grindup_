# User Test Instructions: VAL-003

## What was fixed

Multipart upload routes now reject declared oversized multipart bodies before `request.formData()`, reject oversized parsed files before `arrayBuffer()` and parser/OCR/OpenAI work, reject unsupported file types with `400`, and cap extracted text before downstream AI/database use.

## Where to test

- API endpoint: `POST /api/import`
- API endpoint: `POST /api/homework/submit`
- Files: `apps/web/src/app/api/import/route.ts`, `apps/web/src/app/api/homework/submit/route.ts`

## Setup needed

Run the app locally with one of these setups:

```bash
pnpm install
pnpm --filter @grindup/web dev
```

or with Docker if that is your normal local path:

```bash
docker compose up --build
```

Log in through the browser at `http://localhost:3000` and use the browser DevTools Network tab or an exported authenticated session cookie for curl. `/api/homework/submit` also needs a valid `homeworkId` owned by the logged-in user.

Create test files:

```bash
dd if=/dev/zero of=/tmp/big.bin bs=1m count=12
printf 'This is a normal text upload with enough content to pass the minimum length check.\n' > /tmp/normal.txt
printf '# Normal markdown\n\nThis is enough markdown content for upload testing.\n' > /tmp/normal.md
printf 'not supported\n' > /tmp/unsupported.csv
```

Use an existing small PDF from your machine for the PDF regression check, or export a simple one-page PDF before testing.

## Test steps

1. In an authenticated browser session, submit an oversized multipart upload to `/api/import` with `subjectName=VAL003 Test`, `sourceType=file`, and `file=@/tmp/big.bin`. With curl, include your session cookie:

```bash
curl -i -X POST http://localhost:3000/api/import \
  -H 'Cookie: <authenticated-session-cookie>' \
  -F 'subjectName=VAL003 Test' \
  -F 'sourceType=file' \
  -F 'file=@/tmp/big.bin;type=application/octet-stream'
```

2. Submit an oversized multipart upload to `/api/homework/submit` with a valid owned homework id:

```bash
curl -i -X POST http://localhost:3000/api/homework/submit \
  -H 'Cookie: <authenticated-session-cookie>' \
  -F 'homeworkId=<owned-homework-id>' \
  -F 'file=@/tmp/big.bin;type=application/octet-stream'
```

3. Submit an unsupported file to both endpoints, replacing the homework id as needed:

```bash
curl -i -X POST http://localhost:3000/api/import \
  -H 'Cookie: <authenticated-session-cookie>' \
  -F 'subjectName=VAL003 Test' \
  -F 'sourceType=file' \
  -F 'file=@/tmp/unsupported.csv;type=text/csv'

curl -i -X POST http://localhost:3000/api/homework/submit \
  -H 'Cookie: <authenticated-session-cookie>' \
  -F 'homeworkId=<owned-homework-id>' \
  -F 'file=@/tmp/unsupported.csv;type=text/csv'
```

4. Confirm normal TXT and MD uploads still work where the route has valid surrounding data. For import, use `/tmp/normal.txt` or `/tmp/normal.md` with `sourceType=file`. For homework, use a valid owned homework id and upload `/tmp/normal.txt` or `/tmp/normal.md`.

5. Confirm a normal PDF upload still works for import and homework. Use a small real PDF and the same authenticated session. A malformed fake PDF returning `400` is not a failure.

6. Confirm JSON body paths are unchanged. For example, submit a notes import with JSON and a text-only homework submission with JSON:

```bash
curl -i -X POST http://localhost:3000/api/import \
  -H 'Cookie: <authenticated-session-cookie>' \
  -H 'Content-Type: application/json' \
  --data '{"subjectName":"VAL003 Notes","sourceType":"notes","notesText":"This is a normal notes import body with enough content to pass validation and generate a subject."}'

curl -i -X POST http://localhost:3000/api/homework/submit \
  -H 'Cookie: <authenticated-session-cookie>' \
  -H 'Content-Type: application/json' \
  --data '{"homeworkId":"<owned-homework-id>","textContent":"This is a normal text homework submission with enough content for grading."}'
```

7. Optional residual-risk check: repeat an oversized request with a client or proxy configuration that omits `Content-Length` or uses chunked transfer. The app may only reject after multipart parsing; that is a known remaining platform-limit risk, not hidden by this task.

## Expected result

Oversized multipart requests return `413`. Unsupported extensions such as `.csv`, `.doc`, and `.docx` return `400`. Normal PDF, image, TXT, and MD uploads still proceed through the existing route behavior when the user is authenticated and required IDs/fields are valid. JSON body requests continue to behave as before.

## Bad result

The fix failed if an oversized multipart upload reaches parser/OCR/OpenAI/database work, returns success, or returns only after long processing. It also failed if supported PDF/image/TXT/MD uploads are rejected solely because of the new validation, or if JSON import/homework submissions now fail differently than before.

## Regression checks

- `/api/import` still accepts valid file imports for PDF, images, TXT, and MD.
- `/api/homework/submit` still accepts valid file submissions for PDF, images, TXT, and MD.
- `/api/import` notes and YouTube JSON paths still work.
- `/api/homework/submit` JSON text submission still works.
- `doc` and `docx` fail fast with `400` because prior handling only decoded them as unreliable text.
- Missing, invalid, or chunked `Content-Length` remains a residual risk that needs an upstream request-size limit.

## What to tell the AI after testing

If the test passed, say:

`I tested task VAL-003 and approve it.`

If the test failed, say:

`Task VAL-003 failed user testing. Here is what happened: <details>.`
