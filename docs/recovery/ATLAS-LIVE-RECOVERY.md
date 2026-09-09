# Atlas Live Recovery Runbook

**Artifact class:** `RUNBOOK_RECOVERY`  
**Owner:** `Oteryn/Oteryn-Atlas`  
**Status:** STEADY-STATE POLICY — INCIDENT AUTHORITY REQUIRED

## Recovery boundary

Verification and Merge Queue authority do not grant live recovery authority. Recovery applies only to a separately authorized live lifecycle with an active protected-main deployment/recovery mechanism.

Use protected `main`, current live-operation authority, and the exact recorded deployment state. Historical maintenance/restoration material and retired workflows are not recovery mechanisms.

## Recovery contract

For an authorized incident:

1. let the repository-approved deployment/recovery mechanism finish its owned failure handling before considering separate intervention;
2. roll back only to the exact previous live revision recorded by that mechanism, never to a guessed or remembered commit;
3. require restored exact-revision and health proof, not merely a running process or container;
4. preserve bounded evidence from the failed candidate for diagnosis;
5. deliver every durable fix through a new protected PR and merged `main`, not by patching the live host;
6. keep publication/deployment evidence distinct from verification evidence.

Concrete runner labels, commands, environments, rollback mechanics, and approvals must be taken from the current protected implementation and incident authority.

## Break-glass boundary

If the approved recovery mechanism cannot restore and qualify the recorded previous revision, recovery is `BLOCKED` until separate incident/break-glass authority exists. Record the failed revision, execution identity, prior revision when known, and the exact failed assertion.

This runbook never authorizes arbitrary revision checkout, manual Synology/container mutation, task-branch deployment, secret or ruleset changes, runner reconfiguration, provenance edits, or invented rollback targets.

Normal live-operation policy is in `docs/operations/ATLAS-LIVE-OPERATIONS.md` and `docs/agents/operations/LIVE_DEPLOYMENT.md`.