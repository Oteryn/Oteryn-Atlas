# Atlas Comprehensive Verification Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #85 as a blocking, replayable Atlas verification platform that catches renderer/overlay drift and preserves compact failure evidence.

**Architecture:** Extend the existing `node:test` contracts and pinned Docker Playwright harness. Production testability is limited to frozen, serializable snapshots of real committed renderer/overlay state; independent test helpers own expected geometry, seeded actions, artifact validation and budget comparison.

**Tech Stack:** Node.js `node:test`, browser ES modules, WebGL2, Playwright 1.62.0 in digest-pinned Docker, GitHub Actions, Python provenance/self-tests.

**Spec:** `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

## Global Constraints

- Oteryn-Game remains canonical World/Content authority; tests do not invent Game-owned facts.
- Preserve existing frameworks, Playwright retries `0`, fail-closed trust/provenance, and main-only deployment authority.
- Every reproducible defect receives a deterministic regression before its fix is accepted.
- Geometry expected values come from an independent oracle, not the production projection function.
- Diagnostics are copy/frozen read-only evidence only: no setters, fake loaders, injected authority or test-only product behavior.
- Required PR qualification is exact-head; task branches are never live-deployed.

---

### Task 1: Normalize verification evidence and self-test the harness

**Files:**
- Create: `e2e/support/artifacts.mjs`
- Create: `tests/verification/artifacts.test.mjs`
- Modify: `e2e/summary-reporter.mjs`
- Modify: `e2e/playwright.config.mjs`

**Interfaces:** `scenarioEvidence(testInfo, input)` writes bounded JSON attachments; summary scenarios expose category, target/revision, browser/profile, duration, seed, evidence, skip reason and failure details.
- [ ] Write artifact-schema tests for required fields, path bounding and a controlled invalid manifest; run `node --test tests/verification/artifacts.test.mjs` and confirm RED.
- [ ] Implement `artifacts.mjs` and summary metadata; rerun the test GREEN and enumerate Playwright tests in the pinned image.
- [ ] Add reporter tests proving pass/fail/skip classification is machine-readable and skip reasons are explicit.
- [ ] Commit the evidence layer independently.

### Task 2: Add deterministic transform properties

**Files:**
- Create: `src/browser/viewport-transform.mjs`
- Create: `tests/properties/viewport-transform.test.mjs`
- Create: `tests/verification/deterministic-generator.test.mjs`

**Interfaces:** `viewportTransform(view, viewport)` returns frozen camera/viewport/DPR values; `worldTileToScreen(transform, point)` and `screenToWorldTile(transform, point)` are pure. Test-owned deterministic cases print a replay seed.

- [ ] Write round-trip, inverse-pan, inverse-zoom, composition, resize-anchor and floor-isolation properties first; verify missing module/function RED.
- [ ] Implement the smallest pure transform module; rerun all property cases GREEN.
- [ ] Add controlled mutant functions in tests and prove the properties reject translation/scale/sign mutants.
- [ ] Commit the pure transform/property layer.

### Task 3: Expose truthful committed renderer diagnostics

**Files:**
- Modify: `src/browser/fullworld-webgl.mjs`
- Modify: `web/fullworld-app.mjs`
- Create: `tests/verification/renderer-diagnostics.test.mjs`

**Interfaces:** every real render returns monotonic `generation`, frozen `transform`, bounded counts/timings and optional readback probe; `globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__` is a frozen snapshot and `oteryn-atlas-render-committed` carries a copy.
- [ ] Add source/contract tests that demand generation, committed transform, bounded anchors and immutable copies; verify RED before implementation.
- [ ] Add monotonic renderer generation and actual uniform/viewport evidence to `render()`; add explicit bounded framebuffer probe only under capture/synchronous evidence mode.
- [ ] Publish a frozen runtime diagnostic snapshot after the render commit and prove attempted mutation cannot change the next real snapshot.
- [ ] Rerun renderer/unit/browser contract tests and commit.

### Task 4: Reproduce and fix stale NPC/monster overlay commits

**Files:**
- Modify: `web/fullworld-creatures.mjs`
- Create: `e2e/support/diagnostics.mjs`
- Create: `e2e/support/geometry-oracle.mjs`
- Create: `tests/verification/geometry-oracle.test.mjs`
- Create: `e2e/tests/geometry-desktop.spec.mjs`

**Interfaces:** creature diagnostics retain the base render generation/view used by the committed overlay and bounded world/screen anchors; stale async preparations are discarded by an epoch token. The E2E oracle independently projects published world anchors from committed base transform evidence.

- [ ] Add negative oracle self-tests proving a deliberate overlay offset is rejected.
- [ ] Add the real-browser NPC/monster drift regression and run it against current code to capture RED evidence for stale/divergent commits.
- [ ] Add creature render epoch/generation synchronization without changing Game authority or loading semantics; stale async draws must not commit.
- [ ] Rerun the regression GREEN for NPC-only, monster-only and both enabled.
- [ ] Extend the geometry scenario through horizontal, vertical, diagonal and inverse pan; wheel/button zoom; pan+zoom; resize; mode/floor transitions; toggle-around-movement; reload/deep-link.
- [ ] Retain before/after renderer/creature snapshots plus screenshot/trace on failure and commit the regression/fix together.

### Task 5: Add deterministic seeded interaction stress and replay

**Files:**
- Create: `e2e/support/seeded-actions.mjs`
- Create: `tests/verification/seeded-actions.test.mjs`
- Create: `e2e/tests/stress-desktop.spec.mjs`

**Interfaces:** fixed seed + length deterministically yields a bounded legal action log; environment input can replay the same seed/actions; first failing action index and snapshots are attached.
- [ ] Write generator determinism/replay/bounds/controlled-failure tests and verify RED.
- [ ] Implement the generator/replay helper and prove the same seed returns byte-equivalent actions.
- [ ] Run fixed PR smoke seeds across pan, zoom, mode, floor, creature toggles, resize, navigation/reload where legal; assert geometry and boundedness after each committed action.
- [ ] Attach seed, action log and first-failing index; commit.

### Task 6: Deepen fault, render and visual verification

**Files:**
- Modify: `e2e/tests/resilience-desktop.spec.mjs`
- Create: `e2e/tests/render-probes-desktop.spec.mjs`
- Create: `e2e/tests/visual-desktop.spec.mjs`
- Create: `e2e/baselines/metadata.json`
- Create: reviewed Playwright snapshot crop(s) under `e2e/tests/*-snapshots/`

**Interfaces:** network faults are route-scoped and bounded; renderer readback probe detects blank/stale committed frames; visual baselines are pinned to browser container, viewport, DPR, locale/timezone and reviewed source revision.

- [ ] Add delayed/reordered required/optional resource scenarios with rapid pan/zoom/layer movement; assert latest committed generation wins.
- [ ] Add malformed required resource and stale product mismatch cases without global console/network suppression.
- [ ] Add a capture-mode WebGL probe that proves known published detail is non-blank and generation/signature changes after deterministic camera movement; add a controlled blank-probe negative self-test.
- [ ] Add one or more high-signal stable control/marker crops, generate them only in the pinned Playwright container and record baseline metadata.
- [ ] Verify deliberate crop mutation fails before accepting the reviewed baseline; commit.

### Task 7: Add performance, bounded soak and accessibility depth

**Files:**
- Create: `e2e/support/performance.mjs`
- Create: `tests/verification/performance.test.mjs`
- Create: `e2e/tests/performance-desktop.spec.mjs`
- Create: `e2e/tests/geometry-mobile.spec.mjs`
- Modify: existing mobile/audit specs where current shipped behavior has advanced.

**Interfaces:** performance evidence records normalized workload duration, renderer timings, late-frame/scheduler signals, requests, chunks/groups/cache and heap where available; only already accepted product budgets or measured reviewed baselines block.
- [ ] Unit-test budget comparison and monotonic-growth detection with controlled regressions before implementation.
- [ ] Run a repeatable pan/zoom/toggle workload and block on existing max chunk/group/GPU/draw-call budgets; record timing distributions without inventing a wall-clock SLO.
- [ ] Add bounded repeated-cycle soak assertions for retained groups/chunks/cache/heap signals and duplicated overlay state.
- [ ] Cover mobile geometry after portrait/landscape resize and preserve critical accessible names, Escape/focus/drawer/touch interaction.
- [ ] Update stale audit expectations only after proving current capability from runtime/product contracts; commit.

### Task 8: Integrate exact-head CI and scheduled depth

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/docker-e2e.yml`
- Create: `.github/workflows/verification-depth.yml`
- Modify: `e2e/README.md`
- Modify: `docs/testing/ATLAS-VERIFICATION-PLATFORM.md` only for implementation/evidence details that became concrete.

**Interfaces:** `atlas-gate` fans in deterministic repository/unit/harness checks plus exact-head full Playwright qualification on the organization Atlas runner; scheduled depth runs broader fixed seeds/soak without deploying task branches.

- [ ] Add CI contract tests or YAML assertions first and confirm they fail before new jobs are wired.
- [ ] Run all repository `node:test` files, deterministic Python fixture/self-tests and E2E harness self-tests in required CI.
- [ ] Add a non-deploying PR exact-head job on `atlas-runners`/`oteryn-atlas` that overlays checked-out code over the local published product and runs the full Docker Playwright suite with revision qualification.
- [ ] Add scheduled/manual broader seed/soak matrix on the same runner, retaining bounded artifacts.
- [ ] Make `atlas-gate` require the exact-head verification result; preserve `provenance-gate` and main-only live deployment policy.
- [ ] Record mutation-testing disposition: no external mutation dependency unless a bounded trial adds signal beyond controlled transform mutants; document evidence.

### Task 9: Exact-head qualification, review, merge and merged-main acceptance

- [ ] Run every `node:test`, Python provenance/fixture/self-test, syntax/static check and the complete pinned Docker Playwright matrix on the exact final head.
- [ ] Repeat geometry regression and fixed seed census; verify `failure.json`/summary/action artifacts with a controlled negative run.
- [ ] Review `git diff origin/main...HEAD`, forbidden raw formats/secrets, authority boundaries, tolerances, waits, skips, retries and workflow fan-in.
- [ ] Push the branch, wait for exact-head required checks (`atlas-gate`, `provenance-gate`, security/applicable workflows), and resolve failures rather than bypassing them.
- [ ] Squash-merge PR #87 only after all required checks pass; record merged SHA on Issue #85 and close it with command/result/artifact evidence.
- [ ] Allow existing merged-main Synology workflow to deploy/qualify the merged revision; claim live acceptance only when header and container revision equal that exact merged SHA.