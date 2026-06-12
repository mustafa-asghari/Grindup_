# Eval Report: REL-001

## Verdict

Needs user testing

## What changed

`DockerService.run_code` now tracks the created container and removes it with `container.remove(force=True)` in the inner `finally`, so cleanup runs after normal completion, timeout returns, and exceptions after container creation. The outer temporary directory cleanup remains unchanged.

## Does this fix the root cause?

Yes. The specialist eval at `Agents/patches/REL-001-specialist-eval.md` passed and confirmed the timeout branch still kills the container and returns the same `("", "Time Limit Exceeded (<limit>ms)", <limit>)` tuple, while the `finally` removes the container before the return completes.

## Scope check

Pass. The app diff for REL-001 is limited to `apps/runner/services/docker_service.py`, at the original fix location. `Agents/stat.json`, `Agents/patches/REL-001.md`, and `Agents/patches/REL-001-specialist-eval.md` are expected workflow artifacts; the broader dirty working tree contains unrelated review-task changes outside this REL-001 decision.

## Backwards compatibility check

Pass. Success, timeout, and error tuple shapes are preserved, including the timeout message text. The new cleanup only removes per-run containers after Docker execution has produced a result.

## Test check

No automated timeout-cleanup test was added, so manual user testing is still required. Static validation passed, and parent-provided runtime validation directly exercised `DockerService.run_code` with an infinite loop and confirmed the executor-derived container count did not increase.

## Commands run

```bash
jq '.summary, (.tasks[] | select(.id == "REL-001"))' Agents/stat.json
jq '[.tasks[].status] | group_by(.) | map({status: .[0], count: length})' Agents/stat.json
git status --short
git diff --stat -- apps/runner/services/docker_service.py Agents/stat.json Agents/patches/REL-001.md Agents/patches/REL-001-specialist-eval.md
git diff -- apps/runner/services/docker_service.py Agents/stat.json Agents/patches/REL-001.md Agents/patches/REL-001-specialist-eval.md
nl -ba apps/runner/services/docker_service.py | sed -n '1,180p'
python3 -m py_compile apps/runner/services/docker_service.py
python3 -m json.tool Agents/stat.json >/dev/null
```

## Command results

Passed. `py_compile` succeeded, `Agents/stat.json` parsed as JSON, and the path-limited app diff contains only the expected container lifecycle cleanup. Parent validation also passed: `docker compose build runner`, `docker compose up -d runner`, and a host-direct 100ms infinite-loop run returned `('', 'Time Limit Exceeded (100ms)', 100)` without increasing the executor-derived container count.

## Risks remaining

There is still no automated regression test for timeout cleanup. A compose-level `/execute` attempt exposed a separate pre-existing Dockerized runner bind-mount limitation; that issue is not part of REL-001 and should not block this cleanup eval.

## Eval decision

Mark REL-001 as `needs_user_test`.

## Suggested commit message

`Fix runner container cleanup on timeout`
