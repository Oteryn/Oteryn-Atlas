# Atlas v3.10 Documentation/Agent IA Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminally resolve the Atlas-owned v3.10 Documentation/Agent IA gaps without changing Atlas runtime, generated products, migration/extraction provenance facts, runner state, deployment state, or protected GitHub policy.

**Architecture:** Preserve the existing Atlas documentation topology and add only evidence-backed durable artifacts. Use one adjacent machine-readable IA registry plus a deterministic standard-library validator for prompt/task lifecycle and gap dispositions. Add operational/recovery runbooks only because merged-main Synology publication and recovery are recurring procedures already implemented by existing workflows.

**Tech Stack:** Markdown, JSON, Python standard library/unittest, existing GitHub Actions gates unchanged.

**Spec:** `Oteryn/Oteryn@3f154b32ab1dc9fd3437fb4976691b16f50e2e5d:docs/agents/prompts/OTERYN-V310-ATLAS-DOC-IA-CLOSEOUT.md`; lifecycle Issue `Oteryn/Oteryn-Atlas#137`.

## Global Constraints

- Writable repository: `Oteryn/Oteryn-Atlas` only.
- Audit start head: `b8235bd4f46947aa54dfc2f19c96d3bc21e64283`.
- Refreshed implementation base: `7130bea8e95016aa821eefd51b3dba9c18be09c7`.
- Oteryn-Game remains canonical World/Content authority; no Game facts may be invented.
- Do not change product/runtime/generated data, extraction/migration facts, runner/Synology state, publication/deployment state, branch protection/rulesets, secrets, or dependency versions.
- Use exactly one terminal disposition per target gap: `KEEP_EXISTING`, `CREATE_CANONICAL_ARTIFACT`, `NOT_NEEDED`, or `BLOCKED`.
- Do not create empty taxonomy for symmetry.
- GitHub Issues own mutable lifecycle state; Markdown task packets are caches only.
- Existing required checks remain `atlas-gate` and `provenance-gate` and must not be weakened or renamed.
- Runtime/browser behavior is unchanged by this closeout.

## Verified execution adjustment

An earlier test-first experiment attempted to wire the future IA validator into `.github/workflows/ci.yml`. Exact-head CI run `32754885744` proved that `tools/governance/verify_extraction_provenance.py` pins the CI workflow blob to `913cedcae9423e9487fb2849fe4644e31ed82a55`; any CI edit fails provenance before the IA subcheck can run. Updating `docs/migration/legacy-atlas-extraction-provenance.json` is outside this task's authority. Therefore this plan keeps `.github/workflows/ci.yml` byte-identical, records the condition as `OUT_OF_SCOPE_FINDING`, and validates the new IA contract directly during closeout. This preserves the existing stable required gates instead of bypassing them.

---

### Task 1: Lock exact current-head IA inventory and lifecycle decisions

**Files:**
- Create: `docs/agents/DOCUMENTATION_AGENT_IA.json`
- Create: `docs/agents/DOCUMENTATION_AGENT_IA.md`
- Test: `tools/governance/test_documentation_ia.py`

**Interfaces:**
- Consumes: refreshed GitHub tree, prompt/task trees, live Issue states, `AGENTS.md`, `CODEOWNERS`, `BRANCH_LIFECYCLE_*`, `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`, and FullWorld handoff evidence.
- Produces: registry schema `1`, exact audited head/tree identities, one target disposition per gap, canonical artifact map, prompt registry, task registry, recommendation decisions, and handover classification.

- [ ] **Step 1: Commit failing registry/validator contract tests before production artifacts.**
- [ ] **Step 2: Confirm RED is structurally guaranteed because registry/validator paths are absent at this point.**
- [ ] **Step 3: Create the minimal adjacent registry and readable policy.**
- [ ] **Step 4: Require all fourteen current prompts and all three current active task packets to be represented exactly once.**

### Task 2: Create only recurring operational and recovery runbooks

**Files:**
- Create: `docs/operations/ATLAS-LIVE-OPERATIONS.md`
- Create: `docs/recovery/ATLAS-LIVE-RECOVERY.md`

**Interfaces:**
- Consumes: `AGENTS.md`, `.github/workflows/synology-live-acceptance.yml`, `.github/workflows/synology-runner-health.yml`, and deterministic deployment-policy tests.
- Produces: one operational and one recovery procedure that point to existing workflow authority rather than duplicating mutable host commands.

- [ ] **Step 1: Add runbook existence/disposition expectations to registry tests.**
- [ ] **Step 2: Create operational runbook with exact merged-main preconditions, verification, evidence capture and recovery link.**
- [ ] **Step 3: Create recovery runbook that permits only workflow-owned restoration of the previously captured exact merged-main revision; arbitrary/manual revision selection remains forbidden.**

### Task 3: Implement deterministic Documentation/Agent IA validation

**Files:**
- Create: `tools/governance/validate_documentation_ia.py`
- Modify: `tools/governance/test_documentation_ia.py`

**Interfaces:**
- Consumes: registry plus tracked repository paths.
- Produces: exit `0` plus bounded PASS summary, or fail-closed diagnostics for prompt/task registration drift, invalid dispositions, missing canonical artifacts, incorrect prompt blob identity, missing authorities, or malformed historical-handover classification.

- [ ] **Step 1: Cover duplicate/missing prompt, duplicate/missing task, invalid disposition, missing canonical artifact, invalid class/status and prompt blob drift.**
- [ ] **Step 2: Implement validator using Python standard library only.**
- [ ] **Step 3: Run `python tools/governance/test_documentation_ia.py`.**
- [ ] **Step 4: Run `python tools/governance/validate_documentation_ia.py`.**
- [ ] **Step 5: Run `python -m py_compile tools/governance/validate_documentation_ia.py tools/governance/test_documentation_ia.py`.**
- [ ] **Step 6: Keep `.github/workflows/ci.yml` unchanged because exact provenance evidence proves CI wiring is outside this bounded closeout unless migration provenance is separately authorized.**

### Task 4: Exact-final-head qualification and protected merge

**Files:**
- Review: exact PR diff only.

**Interfaces:**
- Consumes: final PR head, current protected `main`, live Issue/review state and required check results.
- Produces: squash merge, branch cleanup, closed #137, and exact merged-main evidence.

- [ ] **Step 1: Refresh current `main`; if it advanced materially, update the inventory and reconcile only new Documentation/Agent IA material without taking parallel ownership.**
- [ ] **Step 2: Verify exact diff has no runtime/generated/provenance/deployment-state mutation and `.github/workflows/ci.yml` is unchanged.**
- [ ] **Step 3: Run deterministic IA tests/validator/syntax checks on exact candidate.**
- [ ] **Step 4: Satisfy unchanged exact-head `atlas-gate` and `provenance-gate`, including the repository's existing `atlas-local-e2e` prerequisite if still applicable; do not weaken it.**
- [ ] **Step 5: Inspect reviews and unresolved threads; resolve only in-scope findings.**
- [ ] **Step 6: Squash merge through protected lifecycle, delete the task branch where policy permits, verify merged `main`, then close Issue #137.**
