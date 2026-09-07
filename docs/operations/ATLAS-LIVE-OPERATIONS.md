# Atlas Live Operations Runbook

**Artifact class:** `RUNBOOK_OPERATIONAL`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 2  
**Status:** SUSPENDED DURING MAINTENANCE

## Current state

Atlas live publication/deployment is suspended by the temporary maintenance lifecycle tracked in Issue #315. This runbook is retained for recovery of the post-maintenance operating model; it is **not** current authorization to deploy, dispatch a suspended workflow or mutate Synology/container state.

Current authority is protected `main`, root `AGENTS.md`, Issue #315 and the workflows that actually exist under `.github/workflows/` on protected `main`. The former `synology-live-acceptance.yml` and `synology-runner-health.yml` definitions are preserved under `docs/maintenance/suspended-workflows/` and are historical implementation material while suspended.

If any text below conflicts with current protected authority, current protected authority wins.

## Post-maintenance operating contract

When live deployment is explicitly restored and separately authorized, the operating path must preserve these invariants:

- deploy only an exact clean revision already merged to protected `main`;
- bind qualification, cutover and observed live identity to that exact revision;
- use the repository-approved trusted runner/deployment boundary rather than ad-hoc host mutation;
- stage and qualify before replacing the live revision;
- retain a known previous exact live revision for rollback;
- fail closed if runner identity, publication provenance, exact revision or health cannot be proven;
- never use a task branch, PR merge ref, dirty worktree or remembered SHA as deployment authority.

The concrete workflow names, triggers, checks and runner labels must be taken from the restored protected-main implementation at that time, not from this document or a suspended workflow copy.

## Evidence required after restoration

A successful live operation should record, without secrets:

1. the exact protected-main Atlas SHA;
2. the GitHub Actions run ID/attempt or successor repository-approved execution identity;
3. the final execution result;
4. exact live revision/health evidence;
5. rollback evidence when recovery occurred.

## Safety boundary

This runbook never authorizes direct edits to Synology/container state, deployment of a branch SHA, protection/ruleset changes, secret changes, runner reconfiguration, provenance rewrites or substitution of legacy/proprietary inputs for accepted Game/Atlas publication authority.

During maintenance, do not attempt live deployment. After maintenance, use only the then-current protected implementation and `docs/agents/operations/LIVE_DEPLOYMENT.md`.

## Recovery

Failure handling is described in `docs/recovery/ATLAS-LIVE-RECOVERY.md`. That runbook is likewise suspended for live execution until deployment is restored; it remains the design boundary for rollback semantics.
