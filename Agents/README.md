# Audit Workspace README

## Current workflow stage

`final_review_complete`; 14 tasks are `needs_user_test` pending manual user approval, and no tasks are approved. The metadata follow-up `TRI-001` is implemented by this worker patch, leaving no queued or remaining tasks.

## Skill being used

Use `review-skill.md`.

## Repo summary

GrindUp is a Next.js, FastAPI, Prisma/PostgreSQL, ClickHouse, Redis, OpenAI, and Docker runner learning platform. The audit found the highest-risk surface in the code execution path and several authorization, rendering, data-integrity, reliability, and compatibility issues.

## Plan files

- `Agents/plan/00-triage.md`
- `Agents/plan/01-security.md`
- `Agents/plan/02-validation-sanitisation.md`
- `Agents/plan/03-database.md`
- `Agents/plan/04-reliability.md`
- `Agents/plan/05-performance.md`
- `Agents/plan/06-clean-code-compatibility.md`
- `Agents/plan/07-eval-supervisor.md`

## Stat file

Task state is stored in `Agents/stat.json`.

## How to continue in a new chat

1. Read `review-skill.md`.
2. Read `AGENTS.md`.
3. Read `Agents/README.md`.
4. Read `Agents/stat.json`.
5. Read the source report for the selected task.
6. Use IMPLEMENTATION MODE with only:
   - Worker Agent
   - The selected task's original specialist agent
   - Eval/Supervisor Agent
7. Worker patches only one selected task.
8. The original specialist checks the patch for domain correctness.
9. Eval/Supervisor checks process, scope, compatibility, and test readiness.
10. Eval/Supervisor writes user test instructions.
11. User tests manually.
12. User approves or rejects.
13. Eval/Supervisor updates `Agents/stat.json`.
14. User commits manually.

## Implementation rules

Implementation uses Worker Agent, the selected task's original specialist agent, and Eval/Supervisor Agent only.

Worker patches exactly one selected task and preserves `owner_agent_name`.

The original specialist named in `owner_agent_name` must write `Agents/patches/<task-id>-specialist-eval.md`.

Eval/Supervisor cannot pass the task or write user-test instructions until specialist eval passes.

User-test instructions should reuse the original proof example when it is safe and relevant, then state the expected fixed result.

## User approval rules

A task is not approved just because automated tests pass.

A task is approved only when the user explicitly says they tested it and approve it.

## Commit rules

Agents must never commit.

The human user commits manually.

## Final review rules

After selected tasks are complete, run FINAL REVIEW MODE.
