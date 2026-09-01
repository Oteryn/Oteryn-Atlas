# ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING-TERMINAL-CLOSEOUT

MODE: autonomous terminal implementation + verification + closeout coordinator.

Repository: `Oteryn/Oteryn-Atlas`
Lifecycle Issue: `#272`
Parent programme: `#179` — do not mutate unless current GitHub authority explicitly requires it.

## ABSOLUTE AUTHORITY RULE

GITHUB LIVE STATE IS THE ONLY SOURCE OF TRUTH.

Before every mutation refresh:

- protected `main` SHA;
- Issue `#272` state/comments;
- PR `#282` state/head/base/checks/reviews/threads;
- branch protection required checks;
- relevant current task/checkpoint documents on protected `main`.

Do not trust SHAs, run IDs or statuses below without live confirmation. They are handoff locators only.

Durable handoff:
`docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING-TERMINAL-HANDOFF-2026-09-01.md`

Canonical task:
`docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md`

Canonical design:
`docs/superpowers/specs/2026-08-30-atlas-e2e-verification-anti-loop-hardening-design.md`

Base-advance handoff design:
`docs/superpowers/specs/2026-09-01-atlas-base-advance-executor-handoff-design.md`

## PRIMARY OBJECTIVE

Finish Issue `#272` completely without recreating the loop it was designed to remove.

Do not stop at audit, diagnosis, partial CI, or a handoff unless a genuine owner-only/external capability boundary remains.

## CURRENT KNOWN STATE — REFRESH FIRST

At handoff:

- protected `main` was `1058be9efe9010f864d879ad301d3e3ca0c3c777`, containing merged #273;
- required checks were `provenance-gate` + `atlas-gate`;
- the owner-authorized temporary exception used for #273 had already been closed and full protection restored;
- #273 had proven dispatcher -> controller -> explicit executor handoff works on protected main;
- PR #282 existed for a one-line newline/EOF executor fix;
- #282 exact head was `0ff3e5e522f9c45a75847f9881ddfde92f1222e8`;
- #282 deterministic CI, provenance and CodeQL were GREEN;
- Codex deep review on that exact head completed with no major issues;
- protected executor run `33536464564` had GREEN preflight + environment qualification and was executing a hosted shard.

Do not poll that run repeatedly. Refresh it once at a decision boundary.

## VERIFIED ROOT CAUSE FIXED BY #282

The protected executor had:

```bash
read -r old_base current_base candidate_head < <(node ...)
```

The Node producer emitted no terminating newline. Bash `read` therefore returned status 1 at EOF under `set -e`, terminating before `git fetch` and lifecycle planning.

#282 fixes only that defect and adds a regression.

RED evidence at handoff:

- head `bb24561bec17345641055fc24a65846e32cf06e2`
- run `33535888088`
- 649 tests: 648 PASS / 1 FAIL
- sole failure: newline/EOF regression

GREEN evidence at handoff:

- head `0ff3e5e522f9c45a75847f9881ddfde92f1222e8`
- focused affected suite 5/5 PASS
- exact-head deterministic verification GREEN
- provenance GREEN
- CodeQL GREEN
- deep review clean

Do not broaden #282 beyond this exact repair.

## SECOND CONFIRMED DEFECT — MUST BE CLOSED BEFORE ISSUE #272

During #282 qualification a stale executor for the same PR and previous head continued heavy work after a newer PR head existed.

Confirmed cause:

```yaml
concurrency:
  group: atlas-protected-hosted-${{ inputs.pr_number || github.event.workflow_run.pull_requests[0].number || github.event.workflow_run.id }}
  cancel-in-progress: true
```

Raw GitHub executor events had `pull_requests: []`, so ordinary `workflow_run` executions fell back to unique `workflow_run.id`. Therefore newer heads of the same PR did not share a concurrency group and could not supersede/cancel stale heavy work.

This is explicitly in scope: canonical base-advance design requires per-PR concurrency/supersession.

Do NOT invent a new scheduler/service/status/lifecycle mechanism.

Expected minimal correction:

- keep `inputs.pr_number` as the authoritative group key for explicit protected `workflow_dispatch`;
- for ordinary protected `workflow_run`, use a stable candidate identity present in the producer event, preferably `github.event.workflow_run.head_branch` if live schema confirms it is the same stable PR branch across head updates;
- retain a fail-closed final fallback only for malformed/unexpected producer events if required;
- add deterministic regression proving two controller workflow-runs for different heads of the same PR resolve to the same concurrency group;
- preserve `cancel-in-progress: true`.

Use TDD: RED regression first, then minimum workflow change, then full applicable exact-head verification.

## REQUIRED EXECUTION ORDER

1. REFRESH #282 and its exact protected cycle once.
2. If #282 exact head changed, discard stale evidence and re-evaluate only the affected checks/review.
3. If #282 exact head is unchanged and all required checks/protected evidence are GREEN:
   - ensure no unresolved threads;
   - mark Ready only when doing so will not unnecessarily duplicate an already-running protected cycle;
   - merge normally with exact expected-head fencing;
   - no bypass and no protection exception.
4. Read back protected `main` and required checks after #282 merge.
5. Create ONE small follow-up PR for the confirmed executor supersession/concurrency defect.
6. That follow-up must contain only:
   - the stable per-PR concurrency-key correction;
   - its deterministic regression;
   - minimal documentation/evidence update only if repository policy requires it.
7. Require on the follow-up exact final head:
   - deterministic verification GREEN;
   - provenance GREEN;
   - CodeQL/security GREEN;
   - selected protected hosted qualification GREEN;
   - `atlas-gate` GREEN;
   - `provenance-gate` GREEN;
   - no unresolved review threads;
   - one useful deep review for the control-plane change. Do not request repeated deep reviews unless the head changes materially.
8. Merge normally with expected-head fencing and verify protected `main` readback.
9. Run/observe the required terminal live proof for historical oracle PR #268 without mutating its candidate merely because base advanced:
   - protected dispatcher/controller uses then-current main;
   - executor reaches lifecycle decision;
   - result is bounded `REUSE`, `PARTIAL_RERUN`, `FULL_RERUN` or `REINTEGRATE` according to real inputs;
   - fan-in/state publication is exact and trusted;
   - no no-op commit, manual status publication or blind rerun.
10. Run/observe zero-work oracle PR #136:
   - docs-only current diff must be refreshed and confirmed;
   - expected protected plan: `profile=none`;
   - zero executable stable IDs/groups/capabilities;
   - disposition `REUSE`;
   - heavy executions `0`;
   - environment/browser execution skipped;
   - exact fan-in/state still published successfully.
11. Only when both live proofs succeed, update Issue #272 with exact main/head/run IDs and close it as completed.
12. Do NOT change Issue #179.
13. After #272 terminal closeout, return to Atlas provider/Merge Queue rollout #281 only if it is still open, still authorized and not superseded.

## STRICT ANTI-LOOP OPERATING PROTOCOL

You MUST follow this protocol:

- One fresh GitHub snapshot per decision boundary.
- Never repeatedly fetch the same pending workflow without intervening information or a meaningful elapsed interval based on its documented timeout/runtime.
- A pending workflow is not a failure.
- If a run looks stuck, inspect its producer/job/timeout once to distinguish real progress from stall; do not rerun first.
- Never create no-op/retrigger commits.
- Never rerun a deterministic failure until you understand the failure class.
- Never mutate candidate code for an authority/environment/control-plane failure.
- Never create a new micro-bootstrap PR merely because protected main advanced.
- Never weaken `atlas-gate`, `provenance-gate`, retries=0, stable-ID equality, evidence fencing, provenance, protected-source ownership, assertions, timeouts or review requirements to force green.
- Never publish a required status manually unless current canonical repository authority explicitly defines that publisher and all its validation preconditions are met.
- Never add a new governance/proof/review subsystem to solve a local defect.
- Never use local clone/worktree/cache state as authority; GitHub live state wins.
- Never claim DONE from a PR merge alone; execute the live #268 and #136 terminal proofs.

## FAILURE CLASSIFICATION BEFORE ACTION

For every new red result, classify it before mutation:

- `CANDIDATE_FAILURE` — candidate behavior/code is wrong; repair candidate with regression.
- `ENVIRONMENT_FAILURE` — protected environment/product prerequisite is wrong; fix protected environment/control plane, not candidate.
- `AUTHORITY_FAILURE` — trusted controller/executor/fan-in/publisher is wrong; fix existing authority path with TDD.
- `REINTEGRATE` — candidate genuinely cannot integrate with current main; perform normal reconciliation according to repository policy.
- `EXTERNAL_BLOCKER` — unavailable specialist runner/service/permission/owner-only capability; report exact missing capability and stop only if no safe authorized path exists.

Do not invent a sixth category just to keep working.

## TOOL/CAPABILITY DISCIPLINE

Follow Atlas `AGENTS.md`:

- GitHub first for state and lifecycle.
- Prefer GitHub-native operations.
- Remote Desktop/Desktop Commander is exception-only, not a polling or ordinary Git fallback.
- Do not create throwaway state merely to test capabilities.
- If an operation is unavailable, name the exact missing action/permission and inspect safe existing alternatives before calling it a blocker.

## DEFINITION OF DONE

Report COMPLETE only when all are true:

- #282 merged normally and newline/EOF fix is protected on main;
- per-PR executor concurrency/supersession defect fixed with deterministic regression and normally merged;
- protected main still requires `provenance-gate` + `atlas-gate`;
- live historical #268 chain reaches bounded lifecycle + executor + fan-in/state without candidate churn;
- live #136 zero-work chain proves `profile=none`, zero heavy execution and successful fan-in/state;
- Issue #272 closed with exact evidence;
- no no-op/retrigger commit used;
- no stale-green evidence reused;
- no new bootstrap chain created;
- no manual bypass/protection weakening used.

If a genuine external blocker remains, report `BLOCKED` with:

- exact operation;
- exact repo/PR/head/run/job;
- observed error/state;
- failure classification;
- safe alternatives checked;
- smallest owner action required.

Do not return a plan-only response. Continue autonomously to terminal completion or a genuine external blocker.
