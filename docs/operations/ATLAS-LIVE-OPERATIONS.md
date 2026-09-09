# Atlas Live Operations Runbook

**Artifact class:** `RUNBOOK_OPERATIONAL`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Status:** STEADY-STATE POLICY — NO STANDING DEPLOY AUTHORITY

## Authority boundary

Active selective verification protects merge safety, but a green verification result does not authorize publication or deployment. Live publication/deployment is a separate lifecycle and requires explicit current authority plus an active protected-main implementation for the requested operation.

Use protected `main`, root `AGENTS.md`, current rulesets/workflows, and the exact live-operation task as authority. Historical maintenance/restoration documents and retired workflow names are not executable authority.

## Live-operation invariants

When a live operation is separately authorized:

- deploy only an exact clean revision already merged to protected `main`;
- bind qualification, staged product, cutover, and observed live identity to that exact revision;
- use the repository-approved trusted deployment boundary, never ad-hoc host mutation;
- stage and qualify before replacing the live revision;
- retain the exact prior live revision required for rollback;
- fail closed if runner identity, publication provenance, revision, or health cannot be proven;
- never deploy a task branch, PR merge ref, dirty worktree, remembered SHA, or candidate-only artifact.

Concrete workflow names, runner labels, commands, environments, and approvals must come from the current protected implementation and explicit operation authority, not from this runbook alone.

## Evidence

Record the exact protected-main SHA, approved execution identity/run, final result, live revision/health proof, and rollback evidence when recovery occurs. Do not record secrets.

## Safety

This runbook does not authorize secret changes, ruleset changes, runner reconfiguration, direct Synology/container edits, provenance rewrites, or use of legacy/proprietary inputs as production authority.

Read `docs/agents/operations/LIVE_DEPLOYMENT.md` before any authorized deployment. Recovery policy is defined in `docs/recovery/ATLAS-LIVE-RECOVERY.md`.