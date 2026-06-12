# Eval Report: REL-002

## Verdict

Needs user testing.

## What changed

`apps/runner/main.py` now imports `run_in_threadpool` and awaits `docker_service.run_code(...)` through Starlette's worker thread helper in `execute_code`.

## Does this fix the root cause?

Yes. The specialist eval passed and confirmed the synchronous Docker SDK work plus polling no longer runs inline on the FastAPI event loop.

## Scope check

Pass. The REL-002 change is limited to the original fix location in `execute_code`; adjacent runner token and executor image fallback changes are pre-existing task context and do not invalidate this reliability fix.

## Backwards compatibility check

Pass. The route remains async, keeps the same request validation and `SubmissionResult` response model, and relies on Starlette, which is already provided by FastAPI.

## Test check

No formal runner concurrency test was added. That is acceptable for this workflow pass because the parent validation included a host-level asyncio monkeypatch probe showing `/health` returned immediately while the offloaded `run_code` slept.

## Commands run

```bash
sed -n '1,260p' Agents/patches/REL-002-specialist-eval.md
git diff -- apps/runner/main.py
nl -ba apps/runner/main.py | sed -n '1,180p'
jq '.tasks[] | select(.id=="REL-002")' Agents/stat.json
```

Parent validation already run:

```bash
python3 -m py_compile apps/runner/main.py
python3 -m json.tool Agents/stat.json >/dev/null
```

## Command results

Passed. Specialist eval passed; parent syntax and JSON checks passed; parent host-level asyncio probe confirmed the event loop stayed responsive.

## Risks remaining

There is still no explicit container concurrency limit, so multiple simultaneous `/execute` calls can now run Docker work concurrently. The previous compose-level bind-mount limitation is a separate known limitation and is not part of REL-002.

## Eval decision

Mark task `needs_user_test`.

## Suggested commit message

`Move runner Docker execution off the event loop`
