# Eval/Supervisor Report

## Coverage Evidence

### Areas inspected

- `Agents/plan/00-triage.md`
- `Agents/plan/01-security.md`
- `Agents/plan/02-validation-sanitisation.md`
- `Agents/plan/03-database.md`
- `Agents/plan/04-reliability.md`
- `Agents/plan/05-performance.md`
- `Agents/plan/06-clean-code-compatibility.md`
- Selected source files for the top task: `apps/web/src/app/api/execute/route.ts`, `apps/runner/main.py`, `compose.yml`, `.env.example`

### Searches and commands run

```bash
sed -n '1,240p' Agents/plan/01-security.md
sed -n '1,220p' Agents/plan/02-validation-sanitisation.md
sed -n '1,220p' Agents/plan/03-database.md
sed -n '1,220p' Agents/plan/04-reliability.md
sed -n '1,220p' Agents/plan/05-performance.md
sed -n '1,220p' Agents/plan/06-clean-code-compatibility.md
nl -ba apps/web/src/app/api/execute/route.ts | sed -n '1,220p'
nl -ba apps/runner/main.py | sed -n '1,180p'
nl -ba compose.yml | sed -n '60,130p'
```

### Code paths traced

- Unauthenticated caller -> `POST /api/execute` -> web route `auth()` result ignored -> runner `/execute`.
- Unauthenticated caller -> published runner port `8080` -> FastAPI `/execute` -> Docker executor.
- Authenticated user -> subject delete and contest/lobby messages -> database-owned cross-user risks.
- Problem import/scrape content -> problem page HTML rendering.

### Tests reviewed

- Specialist reports found no relevant automated route, runner, authorization, validation, migration, or performance tests outside dependencies.

### Domain exclusions

- This supervisor report does not create new findings. It deduplicates, ranks, and queues findings already produced by specialist reports.

## Accepted Task Queue

1. `SEC-001`: Runner and execute API allow unauthenticated code execution.
2. `VAL-001`: Problem descriptions render unsanitized third-party HTML.
3. `SEC-003`: Any authenticated user can delete global subjects and cascade other users' data.
4. `SEC-004`: Contest and lobby chat APIs allow non-participant read/write and leak emails.
5. `SEC-002`: Public problem scrape route mutates data, spends AI quota, and returns stack traces.
6. `REL-001`: Timed-out runner containers are killed but never removed.
7. `REL-002`: Runner execute handler blocks the event loop during Docker work.
8. `DB-003`: Submission queue claim can hand one job to concurrent workers.
9. `COMPAT-001`: Shared submission contract does not match the execute APIs.
10. `VAL-003`: Multipart uploads are buffered before file limits are enforced.

## Dedupe Decisions

- `SEC-001` owns the exposed execution trust-boundary fix. `VAL-002` remains a later input-boundary hardening task and is not selected now.
- `SEC-003` and `DB-001` describe the same subject deletion bug. The queued task keeps Security ownership because the immediate fix is authorization behavior.
- `SEC-004` and `DB-002` describe the same contest/lobby chat scoping bug. The queued task keeps Security ownership because it includes authorization and email leakage.
- `REL-002` and `PERF-001` describe the same event-loop blocking path. The queued task keeps Reliability ownership because the primary user-visible risk is request starvation and health-check failure.

## Rejected Or Deferred Findings

- `PERF-002`, `PERF-003`, and `PERF-004` are valid but lower impact than direct security and reliability issues.
- `DB-004`, `DB-005`, `COMPAT-002`, `COMPAT-003`, `COMPAT-004`, `SEC-005`, and `VAL-004` are kept as later work but not queued in the initial implementation batch.

## Selected Task

`SEC-001` is selected first because it is high severity, high confidence, externally reachable, and has a contained fix across the web route, runner service, and Docker compose exposure.

## Next Step

Start IMPLEMENTATION MODE for `SEC-001` using Worker Agent, then run Security specialist eval and Eval/Supervisor eval before user testing.
