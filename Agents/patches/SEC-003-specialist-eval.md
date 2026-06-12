# Specialist Eval Report: SEC-003

## Specialist

Security Agent - Paranoid Threat Hunter

## Verdict

Pass

## Domain root cause check

The Worker patch fixes the broken authorization boundary. `apps/web/src/app/api/subjects/delete/route.ts` still requires `session.user.id`, but now deletes only `UserSubject` rows where both `userId` and `subjectId` match the current request at lines 20-25. The route no longer calls `prisma.subject.delete`, so an authenticated caller cannot delete the global `Subject` row through `POST /api/subjects/delete`.

The schema confirms this is the correct scope: `Subject` is global and has no owner/admin field, while `UserSubject` is the per-user enrollment table with `@@unique([userId, subjectId])`. Deleting the scoped `UserSubject` row preserves the intended unenrollment behaviour without cascading global topics, exercises, vectors, homework, or other users' enrollments.

## Same-domain side effects checked

Checked the route entry point, session boundary, client-supplied `subjectId` use, Prisma delete target, `Subject` and `UserSubject` relationships, and the subject UI callers that post to `/api/subjects/delete`. The patch does not trust a client-supplied `userId`, does not add an admin bypass, does not return other users' data, and returns `404` when the current user has no matching enrollment.

The separate `DELETE /api/subjects/enroll` endpoint already performs scoped unenrollment through `userSubject` lookup/delete; the patched route now matches that same security model for callers that still use the legacy delete endpoint.

## New same-domain issues

No new auth, authorization, cross-user data deletion, data leakage, session, token, redirect, CORS, or file-access issue was found in the SEC-003 patch surface.

## Evidence reviewed

```bash
sed -n '1,220p' /Users/mustafaasghari/.codex/skills/review-skill/SKILL.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-skill.md
sed -n '1,220p' /Users/mustafaasghari/.codex/skills/review-skill/AGENTS.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/01-security-agent.md
sed -n '1,260p' /Users/mustafaasghari/.codex/skills/review-skill/review-agents/07-eval-supervisor-agent.md
python3 -m json.tool Agents/stat.json | sed -n '1,260p'
sed -n '1,240p' Agents/plan/01-security.md
sed -n '1,220p' Agents/patches/SEC-003.md
git diff -- apps/web/src/app/api/subjects/delete/route.ts
nl -ba apps/web/src/app/api/subjects/delete/route.ts
nl -ba packages/db/prisma/schema.prisma | sed -n '900,950p'
nl -ba packages/db/prisma/schema.prisma | sed -n '1120,1155p'
rg -n "api/subjects/delete|removeSubject|deleteSubject|subjectId" apps/web/src/components/subjects apps/web/src/app/subjects -g '*.ts' -g '*.tsx'
sed -n '1,120p' apps/web/src/app/api/subjects/enroll/route.ts
```

## Decision

Specialist eval passes. Leave SEC-003 status as `implemented` for Eval/Supervisor final review.
