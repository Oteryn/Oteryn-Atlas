# Phase F Shadow Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build deterministic, disabled-by-default Phase F tooling that measures selector safety against exact stable-ID truth, records permanent regression cases, enforces widening-only fallback, and supplies negative fan-in/cardinality evidence without changing the protected planner or Phase E execution policy.

**Architecture:** Keep Lane D additive. A pure evaluator classifies exact stable-ID set deltas and matrix cardinality; a separate selector-escape module owns durable fail-safe feedback; an offline runner composes the existing protected `buildVerificationPlan()` interface with a versioned corpus and full-safety census. Production controller/planner/fan-in files remain untouched.

**Tech Stack:** Node.js ESM, `node:test`, repository JSON contracts, existing `tools/verification/build-verification-plan.mjs` and `tools/verification/protected-fan-in-bootstrap.mjs` interfaces.

**Spec:** `docs/agents/prompts/ATLAS-E2E-OPT-LANE-D-PHASE-F-SHADOW-BACKTEST.md` from the #215 handoff, plus `ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`, P0 amendment, data-capability amendment, and Issue #179.

## Global Constraints

- Selective execution stays disabled; this lane must not set `enabled=true` or make savings authoritative.
- Do not edit protected controller/planner/fan-in production files owned by Lane A unless an unavoidable interface defect is proven.
- Do not choose worker/shard thresholds or final execution shape before Phase E evidence exists.
- Compare exact stable IDs; counts are telemetry only.
- Under-selection is a correctness blocker; over-selection is optimization debt.
- Unknown/malformed/governance change evidence must fail closed through the existing planner.
- `force-full` and `SELECTOR_ESCAPE` may only widen: effective fallback is the hosted full-safety stable-ID set union any already-required specialist stable IDs.
- `profile=full` must remain independent from `real_fullworld`.
- Stale/cancelled evidence must be represented by negative fixtures compatible with protected fan-in.

---

### Task 1: Exact shadow/backtest evaluator and cardinality guard

**Files:**
- Create: `tests/verification/shadow-backtest.test.mjs`
- Create: `tools/verification/shadow-backtest.mjs`

**Interfaces:**
- Produces: `evaluateStableIdSelection({ selectedStableTestIds, requiredTruthStableTestIds, fullSafeStableTestIds, allowedAdditionalStableTestIds })`
- Produces: `assertExactFullSafeCoverage({ expectedStableTestIds, observedStableTestIds })`
- Produces: `evaluateMatrixCardinality({ axes, maxCombinations })`

- [x] **Step 1: Write failing tests** proving exact false-negative IDs, exact over-selected IDs, rejection when truth/selection contains IDs outside the full-safe plus explicit-specialist universe, exact full-safe set equality, duplicate rejection, and a parameterized matrix guard that rejects Cartesian expansion above a caller-supplied limit.
- [x] **Step 2: Run RED** with `node --test tests/verification/shadow-backtest.test.mjs`; expected failure is missing `tools/verification/shadow-backtest.mjs`.
- [x] **Step 3: Implement minimal pure evaluator** using sorted unique stable-ID sets. `status` is `BLOCKED_UNDER_SELECTION` when any required-truth ID is missed, otherwise `SAFE`; over-selection is returned as telemetry and never hides an under-selection.
- [x] **Step 4: Run GREEN** with the same test command and `node --check tools/verification/shadow-backtest.mjs`.

### Task 2: Durable widening-only SELECTOR_ESCAPE feedback

**Files:**
- Create: `tests/verification/selector-escape.test.mjs`
- Create: `tools/verification/selector-escape.mjs`
- Create: `tools/verification/selector-escape-state.json`

**Interfaces:**
- Produces: `validateSelectorEscapeState(state)`
- Produces: `recordSelectorMiss({ state, evidence, fullSafeStableTestIds, allowedAdditionalStableTestIds })`
- Produces: `resolveSelectorFallback({ state, forceFull, selectiveStableTestIds, fullSafeStableTestIds, allowedAdditionalStableTestIds })`

- [x] **Step 1: Write failing tests** proving default state is inactive and selective execution is explicitly disabled, a proven hosted or specialist miss creates an append-only auditable event and activates escape, active escape and `forceFull=true` widen to hosted full-safe plus any already-required specialist obligations, and malformed/attempted narrowing input fails closed.
- [x] **Step 2: Run RED** with `node --test tests/verification/selector-escape.test.mjs`.
- [x] **Step 3: Implement minimal module** with schema validation and deterministic evidence digest. No reset/deactivation API is provided by Lane D; protected/coordinator cutover owns any future clear operation.
- [x] **Step 4: Run GREEN** and `node --check tools/verification/selector-escape.mjs`.

### Task 3: Versioned historical/live corpus and deterministic runner

**Files:**
- Create: `tools/verification/shadow-backtest-corpus.json`
- Create: `tools/verification/run-shadow-backtest.mjs`
- Create: `tests/verification/shadow-backtest-corpus.test.mjs`
- Create: `tests/verification/protected-fan-in-shadow-fixtures.test.mjs`

**Interfaces:**
- Consumes: current trusted/candidate impact manifest and catalog, `buildVerificationPlan()`, full-safety stable-ID census, Task 1 evaluator.
- Corpus case schema: `{ id, provenance, changedFiles, truth, expectation }` with immutable GitHub provenance where historical.
- Runner output: versioned JSON report containing case ID, plan identity, selected IDs/digest, full-safe IDs/digest, false negatives, over-selection, profile/data capabilities, and verdict.

- [x] **Step 1: Add RED corpus tests** requiring representative governance, unknown-path, rename, multi-domain and historical-regression cases; bind the NPC/monster continuous-pan regression to merged PR #88 / head `03bb3e6cb082dd29dad7261a61e0030e4c846f9d` and its permanent stable ID.
- [x] **Step 2: Add fan-in negative tests** that feed the existing `validateProtectedFanIn()` cancelled, stale-head, duplicate, missing and unexpected stable-ID summaries and require rejection.
- [x] **Step 3: Run RED** for the new corpus/runner tests.
- [x] **Step 4: Implement corpus and runner** without network access at execution time. Historical provenance is data only; the runner evaluates current policy against recorded changed-file evidence and exact truth IDs.
- [ ] **Step 5: Run GREEN** for all Lane D unit/fixture tests, then `node --test tests/verification/*.test.mjs` on the actual branch/CI. Narrow Lane D result is currently `19/19 PASS`; full repository verification remains an exact-head publication gate.

### Task 4: Document handoff and exact rerun boundary

**Files:**
- Create: `docs/testing/ATLAS-E2E-PHASE-F-SHADOW-BACKTEST.md`

**Interfaces:**
- Records admission protected main, Lane D base/head, #200/#195/#213 heads observed at implementation, corpus provenance, commands/results, disabled cutover state, and exact post-Phase-E reruns required.

- [x] **Step 1: Document** that this branch is preparation only and cannot approve #200 or #179 cutover.
- [x] **Step 2: Record** that Phase E final worker/shard policy is still unavailable and therefore matrix guard remains parameterized rather than selecting a threshold.
- [ ] **Step 3: Run** `git diff --check` equivalent through repository diff inspection, targeted Node tests, full `tests/verification/*.test.mjs`, and exact-head CI where available.
- [ ] **Step 4: Open a dedicated draft PR** with base/head/test evidence and the mandatory post-Phase-E rerun list.

## Self-Review

- Spec coverage: historical corpus, exact set classification, permanent regression format, hosted full-safe comparison, specialist-ID preservation, force-full, SELECTOR_ESCAPE, matrix guard, stale/cancelled fan-in negatives and disabled cutover are each assigned above.
- Conflict avoidance: no planned mutation of `build-verification-plan.mjs`, `protected-controller-bootstrap.mjs`, `protected-fan-in-bootstrap.mjs`, workflows, branch protection or Phase E worker policy.
- No execution-shape constants are invented before Phase E.
- The historical regression case uses verified repository PR #88 rather than fabricated history.
