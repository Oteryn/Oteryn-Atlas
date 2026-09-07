# Atlas Live Recovery Runbook

**Artifact class:** `RUNBOOK_RECOVERY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Version:** 2  
**Status:** SUSPENDED DURING MAINTENANCE

## Current state

Atlas live deployment and its former automated rollback path are suspended by the temporary maintenance lifecycle tracked in Issue #315. This document preserves the recovery contract for a later restored deployment path; it is not current authority to dispatch a suspended workflow or mutate live infrastructure.

Current authority is protected `main`, root `AGENTS.md`, Issue #315 and the workflow files that actually exist under `.github/workflows/` on protected `main`. Historical `synology-live-acceptance.yml` and `synology-runner-health.yml` definitions are retained under `docs/maintenance/suspended-workflows/` only as suspended implementation evidence.

## Recovery contract after restoration

When live deployment is restored and a real incident occurs, recovery must preserve these invariants:

1. allow the repository-approved deployment/recovery mechanism to finish its owned failure handling before considering any separately authorized intervention;
2. roll back only to the exact previous live revision recorded by the active deployment mechanism, never to a guessed or remembered commit;
3. require restored exact-revision and health proof, not merely a running container;
4. preserve bounded evidence from the failed candidate for diagnosis;
5. deliver any durable fix through a new protected PR and merged `main`, not by patching the live host.

Concrete workflow names, runner labels, commands and rollback mechanics must be taken from the then-current protected-main implementation. Suspended workflow copies are not executable authority.

## Break-glass boundary

If the restored repository-approved recovery mechanism cannot restore and qualify the previous exact live revision, recovery is **BLOCKED** until a separately authorized incident/recovery task exists. Record the failed candidate SHA, execution/run identity, captured prior revision when available and the exact failed assertion.

This runbook never authorizes manual Synology/container mutation, arbitrary revision checkout, task-branch deployment, secret changes, runner reconfiguration, protection/ruleset changes, provenance edits or invented rollback targets.

## Maintenance behavior

While Issue #315 keeps deployment suspended, there is no live-operation action to recover through this runbook. Preserve historical recovery material and use current protected authority to decide when a new live path may be restored.

Normal live-operation guidance is in `docs/operations/ATLAS-LIVE-OPERATIONS.md` and `docs/agents/operations/LIVE_DEPLOYMENT.md`.
