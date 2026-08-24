# Atlas Live Recovery Runbook

**Artifact class:** `RUNBOOK_RECOVERY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 1  
**Status:** ACTIVE

## Purpose

Define the safe recovery boundary when merged-main Atlas live acceptance or cutover fails. The existing `Synology Live Acceptance` workflow owns normal automatic rollback. This document prevents recovery from turning into an ad-hoc task-branch deployment or an invented revision change.

## Authority

1. protected `Oteryn/Oteryn-Atlas` merged `main` history;
2. root `AGENTS.md`;
3. `.github/workflows/synology-live-acceptance.yml` automatic rollback/candidate lifecycle;
4. `.github/workflows/synology-runner-health.yml` runner identity boundary;
5. `docs/operations/ATLAS-LIVE-OPERATIONS.md` for normal operation.

The protected workflow is implementation authority for the rollback mechanics. This runbook deliberately does not duplicate host/container commands that can drift.

## Recovery triggers

Use this runbook when any of the following occurs during a merged-main live operation:

- staged candidate qualification fails;
- cutover occurs but exact-revision/health acceptance fails;
- the workflow reports rollback/recovery failure;
- the observed live revision does not match the exact merged-main candidate expected by the run;
- the trusted runner boundary cannot be proven.

## Preconditions

Before taking recovery action, record without modifying live state:

- failing Atlas merged-main candidate SHA;
- GitHub Actions run ID and attempt;
- workflow stage/failure point;
- previous exact live revision captured by the workflow, when available;
- available bounded failure artifacts/logs that do not expose secrets.

Never select a rollback SHA from memory, a task branch, a PR head or a dirty worktree.

## Standard recovery

1. **Allow workflow-owned failure handling to finish.** Do not race the live-acceptance workflow with manual host changes. The workflow stages candidates separately and captures the prior live revision for rollback.
2. **Use only the workflow-captured previous revision.** If rollback is required, the valid recovery target is the previous exact live revision that the workflow observed before cutover. Do not substitute an arbitrary older commit.
3. **Require restored-revision qualification.** Recovery is not complete merely because a container starts. The restored live surface must identify the exact previous revision and satisfy the current workflow's rollback/health assertions.
4. **Preserve the failed candidate evidence.** Keep the GitHub run/artifacts needed for diagnosis subject to existing retention. Do not rewrite migration/provenance facts or historical evidence to make the failed attempt look successful.
5. **Return to normal operations only after proof.** Once the prior exact revision is restored and qualified, subsequent fixes must travel through a new protected PR/main delivery and the standard `docs/operations/ATLAS-LIVE-OPERATIONS.md` path.

## Break-glass boundary

If the existing workflow cannot restore/qualify the previously captured exact live revision, recovery under this runbook is **BLOCKED**. Record the failing run, candidate SHA, captured prior revision if known and exact failed assertion, then use a separately authorized incident/recovery task.

This runbook does not authorize manual Synology/container mutation, arbitrary revision checkout, secret changes, runner reconfiguration, branch-protection changes, migration/provenance edits or direct deployment from a task branch. Lack of a working automated restore path is a blocker, not permission to broaden authority silently.

## Validation

Recovery is accepted only when all applicable statements are proven:

- the restored revision is the exact previous merged-main revision captured by the workflow;
- the trusted Atlas runner boundary is valid;
- workflow rollback/health assertions pass;
- the live revision identity equals the restored revision;
- no task branch or dirty worktree became deployment authority;
- recovery did not alter Game authority, generated-data truth, migration/extraction provenance, branch protection, secrets or dependency policy.

Repository contract tests such as `tests/deployment-policy.mjs` verify that failed live acceptance restores the previous exact revision and does not assume old product absence. They are policy evidence; actual merged-main recovery still requires the live workflow's evidence when a real incident occurs.

## Roll-forward

After successful restoration, repair the defect in a new/appropriate GitHub Issue and protected PR. Re-run exact-head required checks, merge to protected `main`, then use the normal merged-main live operation. Never patch the live host as the durable fix.

## Supersession

A protected change to live-acceptance rollback/candidate topology must update this runbook or explicitly prove the recovery contract remains unchanged. When this runbook is superseded, retain Git history as provenance; do not preserve two simultaneously active recovery authorities.
