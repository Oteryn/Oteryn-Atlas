# Atlas Live Operations Runbook

**Artifact class:** `RUNBOOK_OPERATIONAL`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 1  
**Status:** ACTIVE

## Purpose

Provide one safe operator procedure for the recurring Atlas merged-main live publication and acceptance path. This runbook documents **how to use the existing authority**; it does not duplicate the mutable implementation embedded in GitHub Actions and it does not authorize direct host/container mutation.

## Authority

In descending order for this procedure:

1. protected GitHub `main` and the exact merged commit;
2. root `AGENTS.md` deployment/verification rules;
3. `.github/workflows/synology-live-acceptance.yml` for staging, qualification, cutover and automatic rollback;
4. `.github/workflows/synology-runner-health.yml` for the organization-runner boundary;
5. `docs/recovery/ATLAS-LIVE-RECOVERY.md` for failure/recovery handling.

If this runbook disagrees with a newer protected workflow or `AGENTS.md`, the protected workflow/instruction wins and this runbook must be updated before reuse.

## Preconditions

All of the following are mandatory:

- the candidate revision is already merged to protected `main`;
- the exact target SHA is resolved from GitHub `Oteryn/Oteryn-Atlas` `main`, not from a task branch, local worktree, PR merge ref or remembered value;
- the required pre-merge repository gates for the delivery have completed according to current branch policy;
- live acceptance is executed only by the existing main-only workflow on the trusted `atlas-runners` / `oteryn-atlas` runner boundary;
- no operator has introduced uncommitted host state as deployment authority;
- no raw legacy/proprietary runtime input is substituted for accepted Game/Atlas publication authority.

A task branch or dirty local checkout is never an acceptable live candidate.

## Standard procedure

1. **Resolve exact merged authority.** Record the protected Atlas `main` SHA that must be served.
2. **Observe the merged-main workflow.** Use the `Synology Live Acceptance` run associated with that exact merged-main push. A manual `workflow_dispatch` is acceptable only when it still executes against `refs/heads/main` and the workflow proves `GITHUB_SHA == ATLAS_REV == fetched main`.
3. **Require runner-boundary proof.** The workflow must pass its existing organization-runner identity and least-privilege boundary checks. If runner identity is not proven, stop and classify the operation as failed; do not bypass the check.
4. **Require workflow-owned staging.** The workflow stages the exact merged revision into its run-scoped candidate root. Do not replace this with an ad-hoc copy, local branch export or direct container bind-mount change.
5. **Require candidate qualification before cutover.** All product, semantic, browser and exact-revision checks implemented by the current workflow must pass for the staged candidate before the live container is replaced.
6. **Require exact-revision cutover evidence.** A successful operation must prove the live surface/container identifies the exact merged Atlas revision required by the workflow. A stale revision is failure even when the page is reachable.
7. **Record bounded evidence.** Record the Atlas merged SHA, GitHub Actions run ID/attempt, final workflow result and any exact revision/health evidence emitted by the workflow. Do not copy secrets, runner credentials or mutable local tokens into documentation.
8. **On any failure, use recovery policy.** Do not improvise host repair under this runbook. Follow `docs/recovery/ATLAS-LIVE-RECOVERY.md`; the existing live-acceptance workflow owns its automatic rollback behavior.

## Validation

A live operation is accepted only when:

- the GitHub Actions run is for `Oteryn/Oteryn-Atlas` protected `main`;
- workflow checkout/fetch proofs bind the run to the recorded merged SHA;
- runner-boundary checks pass;
- staged candidate qualification passes before cutover;
- the final live revision equals the recorded merged-main SHA;
- the workflow concludes successfully.

Repository-side deterministic policy is additionally covered by `tests/deployment-policy.mjs` and `tests/synology-live-workflow.mjs`. Those tests validate the workflow contract but do **not** substitute for merged-main live acceptance when runtime behavior is being delivered.

## Safety boundary

This runbook does not authorize:

- deployment of a PR/task-branch SHA;
- direct edits to Synology runner/container state;
- changing branch protection, required checks, secrets or credentials;
- changing migration/extraction provenance;
- inventing a rollback target;
- treating historical FullWorld handoff paths as current operational authority;
- using Oteryn-Game data except through accepted authoritative publication contracts.

If the existing workflow cannot perform the required operation safely, record the failure and open/use a separately authorized incident/task. Do not widen this runbook's authority to make the operation pass.

## Rollback / recovery

The current live-acceptance workflow captures the prior live revision during staging and owns the automatic restoration path on failed acceptance/cutover. Recovery details and the break-glass boundary are in `docs/recovery/ATLAS-LIVE-RECOVERY.md`.

## Supersession

This runbook remains authoritative only while the protected workflow topology described above remains current. A protected workflow change that materially alters merged-main publication, runner identity, cutover or rollback must update this runbook in the same governed delivery or explicitly record why no runbook change is needed.
