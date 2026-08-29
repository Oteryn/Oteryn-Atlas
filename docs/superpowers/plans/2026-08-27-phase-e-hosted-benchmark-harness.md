# Phase E Hosted Benchmark Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare a measurement-only GitHub-hosted whole-DAG Phase E benchmark harness that can be rebased onto final Phase D and collect exact, non-silent benchmark evidence without selecting or changing production worker/shard policy.

**Architecture:** Keep benchmark authority separate from execution policy. A versioned contract declares required identities, metric observations and experiment candidates; a pure Node collector consumes exported GitHub workflow-run/job metadata plus exact Phase-D identity data, classifies canonical DAG phases using a versioned phase map, and emits fail-closed benchmark evidence. Tests prove missing/malformed/zero-like data cannot silently disappear and that all pre-final-Phase-D evidence remains explicitly non-authoritative.

**Tech Stack:** Node.js ESM, built-in `node:test`, JSON contracts, GitHub Actions metadata exported by `gh api`/REST during final Phase E execution.

**Spec:** `docs/agents/prompts/ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS.md` on draft handoff PR #215, jointly constrained by the #179 implementation prompt, P0 amendment, data-capability amendment and `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md`.

## Global Constraints

- Base this preparation lane on protected `main@0afd5183c68b3f388861bb48599b9aa7c6f5a94b`; final Phase E measurements are valid only after final Phase D merges.
- Measurement only: do not mutate `tools/verification/worker-policy*`, authoritative planner/catalog policy, required checks, or selective-execution enablement.
- Retries remain zero.
- Every evidence record binds exact repository/head/base/plan/product/stable-ID/harness/workflow identities.
- `profile=full` does not imply `dataCapability=real_fullworld`.
- GitHub-hosted measurements define ordinary defaults; Molehill data is specialist-only evidence.
- Measure the packed single-job worker ladder `workers=1/2/4/6/8`: the separate candidates are `workers=1`, `workers=2`, `workers=4`, `workers=6`, and `workers=8`. Every tier above 1 is conditional on measured stability and resource headroom. Keep the multi-job candidates isolated from the packed worker axis: `2 shards` and `4 shards` only.
- Missing metrics are not coerced to zero. Optional/non-applicable metrics are explicit observations with status and source.
- All pre-final-Phase-D measurements are labeled `NON_AUTHORITATIVE_PRE_PHASE_D`.

---

### Task 1: Versioned benchmark contract and experiment candidates

**Files:**
- Create: `tools/verification/hosted-benchmark-contract.json`
- Create: `tools/verification/hosted-benchmark-phase-map.json`
- Create: `tools/verification/hosted-benchmark-experiments.json`
- Test: `tests/verification/hosted-benchmark-contract.test.mjs`

**Interfaces:**
- Consumes: no runtime policy; only static Phase E measurement requirements.
- Produces: canonical metric IDs, canonical phase matching rules, allowed authority states, and non-authoritative experiment candidate definitions.

- [ ] **Step 1: Write the failing contract test** proving schema version, complete metric inventory, the exact packed `workers=1/2/4/6/8` ladder, isolated broad/full-only 2/4-shard candidates, zero retries and measurement-only semantics.
- [ ] **Step 2: Run** `node --test tests/verification/hosted-benchmark-contract.test.mjs` and confirm failure because the contract files do not exist.
- [ ] **Step 3: Add the three JSON contracts** with explicit required identities, required metrics and guarded candidate shapes.
- [ ] **Step 4: Re-run** the contract test and require PASS.
- [ ] **Step 5: Commit** `test/feat(verification): define hosted Phase E benchmark contract`.

### Task 2: Fail-closed evidence schema and collector

**Files:**
- Create: `tools/verification/hosted-benchmark-schema.mjs`
- Create: `tools/verification/collect-hosted-benchmark.mjs`
- Test: `tests/verification/hosted-benchmark-schema.test.mjs`
- Test: `tests/verification/hosted-benchmark-collector.test.mjs`

**Interfaces:**
- Consumes: GitHub run JSON, GitHub jobs JSON, exact identity JSON and the versioned phase map.
- Produces: benchmark evidence JSON with `schemaVersion`, `authority`, `measurementOnly=true`, exact identity, explicit metric observations, source run/job metadata and experiment shape.

- [ ] **Step 1: Write failing schema tests** for missing identity, malformed SHA/digest, retries != 0, missing metric observation, implicit zero/missing metric, and an authoritative claim before final Phase D identity.
- [ ] **Step 2: Run** `node --test tests/verification/hosted-benchmark-schema.test.mjs` and confirm failure.
- [ ] **Step 3: Implement `validateHostedBenchmarkEvidence()`** with strict allowlists and explicit `MEASURED` / `NOT_APPLICABLE` observation states; never default absent metrics to zero.
- [ ] **Step 4: Write failing collector tests** using synthetic GitHub run/jobs fixtures to prove queue/provisioning, whole-run wall-clock, summed job-minutes and named phase timings are derived, while unmatched required phases fail closed.
- [ ] **Step 5: Implement collector CLI/library** with deterministic UTC timestamp parsing, versioned phase-map matching, duplicate phase detection, exact identity passthrough and schema validation before output.
- [ ] **Step 6: Run** both tests and require PASS.
- [ ] **Step 7: Commit** `feat(verification): add hosted whole-DAG benchmark collector`.

### Task 3: Workflow integration contract and operator documentation

**Files:**
- Create: `tests/verification/hosted-benchmark-workflow-contract.test.mjs`
- Create: `docs/testing/ATLAS-PHASE-E-HOSTED-BENCHMARK-HARNESS.md`

**Interfaces:**
- Consumes: final Phase-D hosted workflow only after it is merged to protected main.
- Produces: deterministic instructions for exporting `run.json`/`jobs.json`, exact identity input, repetition labeling, cache/image/artifact/DAG axes and collector invocation without altering production selection.

- [ ] **Step 1: Write the workflow contract test** requiring docs to mark all pre-final-D numbers `NON_AUTHORITATIVE_PRE_PHASE_D`, require >=3 clean repetitions for material candidates, forbid Molehill authority for ordinary defaults, preserve zero retries, and require exact plan/product/stable-ID/head identities.
- [ ] **Step 2: Run** `node --test tests/verification/hosted-benchmark-workflow-contract.test.mjs` and confirm failure because the harness document is absent.
- [ ] **Step 3: Write the harness document** with the packed baseline first, conditional workers 2/4/6/8 as separate single-job experiments, isolated conditional shards 2/4, cold/restored-cache, current/thin-image, per-shard/build-once input, eager/gated DAG experiments, plus decision metrics and explicit non-authority language.
- [ ] **Step 4: Re-run** the workflow contract test and require PASS.
- [ ] **Step 5: Commit** `docs(verification): document hosted Phase E benchmark harness`.

### Task 4: Exact branch verification and handoff

**Files:**
- Modify only if needed after tests: files above.

**Interfaces:**
- Produces: a dedicated Phase-E-prep branch/PR for the coordinator; no merge or final calibration claim.

- [ ] **Step 1: Run targeted tests**: `node --test tests/verification/hosted-benchmark-*.test.mjs`.
- [ ] **Step 2: Run the complete deterministic verification layer invalidated by these verification-tool changes**: `node --test tests/verification/*.test.mjs` in GitHub-hosted CI on the exact branch head.
- [ ] **Step 3: Run `git diff --check`** through CI or exact repository inspection.
- [ ] **Step 4: Review the complete changed-file set and full diff**; confirm no worker policy, planner, required gate or selective enablement mutation.
- [ ] **Step 5: Open a draft PR against `main`** stating base/head SHAs, exact tests/checks, non-authoritative status, dependency on final Phase D and coordinator rebase/rebuild requirement.
- [ ] **Step 6: Do not merge.** Return FACT-only handoff and explicitly state that #179 and Phase E calibration remain incomplete until repeated measurements run on protected final Phase D.
