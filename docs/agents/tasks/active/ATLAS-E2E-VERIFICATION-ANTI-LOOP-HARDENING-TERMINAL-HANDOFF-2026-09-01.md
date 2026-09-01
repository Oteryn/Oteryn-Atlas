# ATLAS E2E anti-loop terminal handoff — 2026-09-01

GitHub live state is the only source of truth. This document is a durable checkpoint, not authority over newer GitHub state.

## Lifecycle authority

- Repository: `Oteryn/Oteryn-Atlas`
- Issue: `#272` — Harden E2E verification against closeout and requalification loops
- Parent programme: `#179` — do not reopen or mutate as part of this closeout
- Canonical active task: `docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md`
- Canonical design: `docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md`
- Base-advance handoff design: `docs/superpowers/specs/2026-09-01-atlas-base-advance-executor-handoff-design.md`

## Latest protected state at handoff

- Protected `main`: `1058be9efe9010f864d879ad301d3e3ca0c3c777` (merged PR `#273`)
- Required branch checks: `provenance-gate` + `atlas-gate`, both GitHub Actions app-bound
- No repository rulesets were present in the last live readback; classic branch protection remains the enforcement surface
- The temporary owner-authorized exception used to integrate `#273` has been closed and full protection restored

## What PR #273 proved

PR `#273` was merged at protected `main@1058be9e...`. Its post-merge chain proved that the original controller-to-executor transport defect was fixed:

`Protected Base Advance Dispatcher -> Protected Verification Controller -> protected handoff -> Protected Hosted Verification Executor`

For historical oracle PR `#268`, controller run `33534342318` successfully dispatched an executor and therefore eliminated the earlier defect where bot-dispatched controllers ended without an executor continuation.

## Follow-up PR #282 — newline/EOF defect

Live post-merge execution exposed a separate shell transport defect in the protected executor:

```bash
read -r old_base current_base candidate_head < <(node ...)
```

The Node producer wrote the tuple without a terminating newline. Under `set -e`, Bash `read` returned status `1` on EOF even though values were populated, causing the step to exit before `git fetch` and before lifecycle planning.

PR: `#282` — `fix(verification): terminate base-state tuple before bash EOF`

Current exact head at this checkpoint:

`0ff3e5e522f9c45a75847f9881ddfde92f1222e8`

Scope is exactly two files:

- `.github/workflows/protected-hosted-executor.yml` — one production line adding `\n`
- `tests/verification/protected-base-advance-executor-handoff.test.mjs` — deterministic regression

TDD evidence:

- RED `bb24561bec17345641055fc24a65846e32cf06e2`
- GitHub deterministic run `33535888088`: 649 tests, 648 PASS / 1 FAIL, solely the newline regression
- GREEN `0ff3e5e522f9c45a75847f9881ddfde92f1222e8`
- focused regression suite: 5/5 PASS before push
- exact-head deterministic verification: GREEN
- provenance: GREEN
- CodeQL: GREEN
- deep Codex review on `0ff3e5e...`: completed, no major issues
- no review threads at last read

At the latest checkpoint the exact-head protected executor run `33536464564` had:

- preflight: GREEN
- environment qualification: GREEN
- reuse-evidence: skipped as expected
- hosted shard: still executing real browser work

Do not rerun, no-op commit, mark Ready, or modify the head merely because that hosted shard is still running. Refresh live state once before acting.

## Confirmed supersession/concurrency defect discovered during #282

This is a real live defect and is in-scope for #272; it is not speculative architecture.

Older executor run `33535967047` belonged to the same PR `#282` but stale RED head `bb24561...`. It continued heavy hosted execution after the new head `0ff3e5e...` existed.

The raw GitHub workflow-run payload for executor runs has `pull_requests: []`. Current concurrency is:

```yaml
concurrency:
  group: atlas-protected-hosted-${{ inputs.pr_number || github.event.workflow_run.pull_requests[0].number || github.event.workflow_run.id }}
  cancel-in-progress: true
```

For ordinary `workflow_run`, the missing PR array makes the expression fall back to unique `workflow_run.id`, so successive heads of the same PR do not share a concurrency group and stale heavy execution is not cancelled.

This violates the canonical base-advance handoff design, which explicitly requires per-PR concurrency/supersession to prevent a new requalification loop.

Minimal verified direction:

- preserve `inputs.pr_number` for explicit `workflow_dispatch`
- for `workflow_run`, use a stable candidate identity already present in the event, e.g. the controller's stable candidate branch (`github.event.workflow_run.head_branch`) rather than unique run ID
- retain a fail-closed final fallback only if required for malformed/unexpected producer events
- add a regression that proves two workflow-run executions for different heads of the same PR map to the same concurrency key
- do not invent a new scheduler, service, status, bootstrap mechanism or lifecycle state machine

Do not push this fix until the existing #282 cycle has reached a terminal state and #282 has been integrated normally; avoid creating another overlapping protected executor head.

## Required terminal sequence

1. Refresh live `main`, Issue `#272`, PR `#282`, exact head, checks, reviews and protection.
2. If `#282@0ff3e5e...` remains the head and all required checks are GREEN, mark Ready only after its existing protected execution has completed; do not create an extra controller cycle prematurely.
3. Merge `#282` normally with exact expected-head fencing. No bypass and no temporary protection exception.
4. Verify protected `main` contains the newline fix and branch protection still requires `provenance-gate` + `atlas-gate`.
5. Implement the confirmed per-PR concurrency/supersession correction as one small TDD follow-up PR on current protected `main`.
6. Require deterministic regression, exact-head CI, provenance, CodeQL, protected hosted qualification where selected, and one useful deep review for that control-plane follow-up. No repeated reviews without a material head change.
7. Merge the concurrency fix normally and verify protected-main readback.
8. Execute the terminal live proof required by the canonical task without candidate churn:
   - historical oracle `#268`: protected chain reaches bounded lifecycle disposition and executor/fan-in on the then-current protected base; do not mutate its candidate head solely because `main` advanced
   - zero-work oracle `#136`: controller/executor must produce `profile=none`, zero executable IDs/capabilities, `REUSE`, heavy executions `0`, skip environment/browser work, and still publish exact fan-in/state
9. Only after both proofs succeed, update/close Issue `#272` with exact run IDs, SHAs and conclusions.
10. Then return to the separate Atlas solo-maintainer/Merge Queue provider rollout (`#281`) if it is still live and still authorized. Do not conflate that rollout with Issue `#272`.

## Anti-loop operating rules

- One fresh snapshot per decision boundary; never poll the same pending run repeatedly without new information.
- A pending workflow is not a defect. Inspect its producer/job only when needed to distinguish normal progress from a real stall.
- No no-op/retrigger commits.
- No blind reruns after deterministic failure.
- No new bootstrap PR merely because protected authority advanced.
- No candidate mutation for an `AUTHORITY_FAILURE` or environment/control-plane defect.
- Do not weaken assertions, retries, status requirements, evidence fencing, stable-ID equality, provenance or protected-source ownership to make a gate pass.
- Do not add new governance/proof/review machinery unless current canonical authority explicitly requires it.
- Do not rely on SHA values in this handoff without live refresh.
- If a new failure appears, classify it first: `CANDIDATE_FAILURE`, `ENVIRONMENT_FAILURE`, `AUTHORITY_FAILURE`, `REINTEGRATE`, or genuine external capability boundary. Then perform the minimum allowed action.

## Definition of DONE for this handoff

Do not report COMPLETE until:

- #282 is normally merged and protected-main readback proves the newline fix is active;
- the per-PR executor concurrency/supersession defect is fixed with regression and normally merged;
- live #268 base-advance proof reaches protected executor/fan-in with bounded disposition and no candidate churn;
- live #136 zero-work proof shows `profile=none`, zero heavy executions and successful fan-in/state publication;
- Issue #272 is closed with exact evidence;
- `atlas-gate` and `provenance-gate` remain intact;
- no no-op/retrigger commit, stale-green reuse, ad-hoc status publication or new bootstrap chain was used.
