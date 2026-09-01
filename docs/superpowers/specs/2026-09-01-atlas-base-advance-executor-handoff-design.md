# Atlas Base-Advance Executor Handoff Design

## Context

Issue #272 requires terminal live proof that a protected `main` advance can trigger bounded compatibility evaluation for open same-repository PRs without recreating the serial requalification loop.

PR #277 merged the anti-loop stabilization to protected `main@2d6309a4df1580ce1a23be844b35c6a3b125b131`. Post-merge live evidence proved the protected base-advance dispatcher and current-main controller resolution work, including for PR #268 whose stale `pr.base.sha` snapshot remains older than current protected main. The remaining failure is downstream continuation: dispatcher-created `workflow_dispatch` controller runs complete successfully, but GitHub does not create the executor's `workflow_run` event for those bot-dispatched runs.

This is an `AUTHORITY_FAILURE` in orchestration, not candidate failure and not authority to rerun heavy browser qualification.

## Goals

- Preserve protected `main` as the controller source for base-advance evaluation.
- Preserve exact candidate-head fencing before expensive work and evidence acceptance.
- Continue a successful `base_advance:*` controller into the existing protected hosted executor and fan-in path.
- Preserve semantic evidence reuse and bounded `REUSE`, `PARTIAL_RERUN`, `FULL_RERUN`, or `REINTEGRATE` disposition.
- Preserve per-PR cancellation/concurrency so repeated base advances cannot create parallel heavy work for one PR.
- Preserve `retries=0`, exact stable-ID equality, immutable product identities, data-capability separation, `atlas-gate`, and `provenance-gate`.
- Keep ordinary browser work GitHub-hosted, Molehill specialist-only, and Synology deployment-only.
- Avoid PAT/service-token dependencies, no-op retriggers, new bootstrap PRs, and candidate self-certification.

## Non-goals

- Do not redesign the planner, evidence manifest schema, or compatibility classifier unless a new regression proves that necessary.
- Do not change the heavy browser test set or broaden `real_fullworld` routing.
- Do not make arbitrary `workflow_dispatch` executor runs authoritative.
- Do not accept historical green status without exact protected producer validation.
- Do not require protected `main` to remain globally unchanged between controller completion and executor admission; a newer base advance is handled by the normal per-PR supersession/concurrency path.

## Selected architecture: protected explicit handoff

The protected verification controller remains responsible only for producing the authoritative plan. For `workflow_dispatch` runs whose input `trigger` matches `base_advance:<40-hex-main-sha>`, a second controller job performs an explicit protected handoff after `protected-plan` succeeds.

The handoff job has only the permission needed to dispatch Actions. It does not check out candidate code, does not execute browser work, and does not publish candidate success. Before dispatching it validates:

1. repository is exactly `Oteryn/Oteryn-Atlas`;
2. the completed plan job belongs to the current controller run and attempt;
3. the trigger embeds an exact SHA equal to the controller's resolved protected base SHA;
4. the controller run is on `main` and the protected plan artifact exists exactly once;
5. the target PR is still open, same-repository, main-targeting, and its current head equals the plan candidate head.

After those checks it dispatches the existing protected hosted executor with two inputs:

- `controller_run_id`: authoritative producer locator;
- `pr_number`: untrusted routing/concurrency key only.

The executor gains a narrow `workflow_dispatch` entry point while retaining the existing `workflow_run` entry point. `pr_number` is never accepted as evidence by itself: executor preflight must prove it equals `plan.prNumber` before lifecycle work can continue.

## Executor admission

The executor treats `workflow_dispatch` as authoritative only when all of these are true:

- `controller_run_id` and `pr_number` are positive integers;
- GitHub API resolves that run as `.github/workflows/protected-verification-controller.yml`;
- producer event is `workflow_dispatch`;
- producer status/conclusion are `completed/success`;
- producer run attempt is exactly `1`;
- producer head branch is `main`;
- producer head SHA equals the plan's `controller.sourceSha` and `protectedBaseSha`;
- producer actor and triggering actor are `github-actions[bot]` for the dispatcher path;
- exactly one protected plan artifact exists for that run;
- the plan is schema v3 and passes the existing controller/candidate/base identity checks;
- input `pr_number` equals `plan.prNumber`;
- live PR is still open, same-repository and main-targeting, and its head still equals the plan candidate head before any expensive execution.

The executor does **not** require the repository's current `main` head to still equal the producer's protected base. Doing so would turn a subsequent unrelated main advance into a stale-base rejection and recreate the loop #272 is designed to eliminate. Instead, a newer base advance is handled by the dispatcher/controller lifecycle and the executor's per-PR `cancel-in-progress` concurrency.

A manually invoked executor that cannot prove the protected producer chain fails closed before environment qualification, evidence reuse, browser execution, or fan-in.

## Concurrency and supersession

For normal `workflow_run`, executor concurrency keeps using the PR association from the event when present. For protected `workflow_dispatch` handoff, workflow-level concurrency uses the supplied `pr_number` routing key so a newer executor for the same PR cancels older in-progress work.

Because the routing key is available before jobs start, it may be used only for concurrency selection. Every job that relies on PR identity must use the validated `plan.prNumber` after preflight. A mismatch between input and plan fails closed.

## Trust boundary

The controller does not grant trust to candidate bytes. The executor continues to check out protected control from `plan.controller.sourceSha`, not the candidate. Candidate census remains inert/read-only and ordinary browser execution remains protected GitHub-hosted.

The new handoff changes transport only. It does not weaken the producer oracle: the plan artifact, exact protected base, exact candidate head, authority/environment digests, product identities, stable IDs, execution policy, and lifecycle classifier remain authoritative.

## Lifecycle and anti-loop behavior

The executor must restore prior exact-candidate lifecycle state before deciding base compatibility. For a semantically compatible base advance it can return `REUSE` or `PARTIAL_RERUN`; full heavy work is performed only if the existing classifier returns `FULL_RERUN`. `REINTEGRATE` and `BLOCKED` remain fail-closed and do not execute browser work.

The transport repair itself must not trigger Molehill or FullWorld qualification. The post-merge terminal proof is successful only when the automatic chain demonstrates a bounded disposition and reaches executor/fan-in without a no-op commit or manual retrigger.

## Files expected to change

- `.github/workflows/protected-verification-controller.yml` — add the protected base-advance handoff job.
- `.github/workflows/protected-hosted-executor.yml` — add narrow `workflow_dispatch` inputs, preserve per-PR concurrency, and share protected producer resolution.
- `tools/verification/protected-verification-state.mjs` — admit the new executor producer event only where the protected dispatch chain is validated, if required by current state validation.
- `tools/verification/protected-hosted-gate.mjs` — admit the new executor event only where the protected producer chain is validated, if required by current gate validation.
- `tests/verification/protected-verification-lifecycle-workflow-contract.test.mjs` and/or `tests/verification/protected-hosted-workflow-contract.test.mjs` — regression for controller handoff, per-PR concurrency, and fail-closed dispatch admission.
- `tests/verification/protected-hosted-gate.test.mjs` and state tests — exact producer-event negative and positive cases as needed.

No unrelated runtime or product files are in scope.

## Required TDD proofs

1. RED: a successful bot-dispatched `base_advance:*` controller currently has no authoritative executor continuation.
2. GREEN: controller contains an exact protected handoff to the executor using the current controller run ID and PR routing key.
3. Negative: arbitrary/manual executor dispatch without a successful protected controller run is rejected.
4. Negative: stale/failed/attempt>1/wrong-workflow/wrong-repository/wrong-producer-branch producer is rejected.
5. Negative: input `pr_number` differing from the protected plan is rejected.
6. Negative: current PR head differing from the plan candidate head is rejected before expensive work.
7. Positive: ordinary `workflow_run` controller execution remains accepted unchanged.
8. Positive: a later unrelated `main` advance does not invalidate an already admitted semantic plan solely because global main moved; per-PR concurrency/supersession handles the newer lifecycle.
9. Positive: `workflow_dispatch` base-advance execution reaches the existing lifecycle classifier and can produce bounded reuse/partial/full/reintegrate behavior without changing candidate identity.
10. Full deterministic verification contracts remain green.

## Terminal live proof

After the implementation PR is protected and merged, a real protected-main push must automatically produce:

`Protected Base Advance Dispatcher` → `Protected Verification Controller (workflow_dispatch)` → protected handoff → `Protected Hosted Verification Executor` → lifecycle disposition → reuse/required hosted execution → fan-in/state publication.

For the historical stale-base oracle PR #268, the controller must resolve the then-current protected `main`, not its stale `pr.base.sha` snapshot. The chain must not create a new candidate commit or require Molehill unless the protected plan independently requires a specialist capability.

Issue #272 can close only after this live chain is verified from GitHub state and no new closeout/requalification loop is introduced.
