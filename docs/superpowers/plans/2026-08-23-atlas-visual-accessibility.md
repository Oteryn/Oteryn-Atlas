# Atlas Visual Accessibility Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the `ATLAS-VERIFY-VISUAL-A11Y` child track for Issue #94 with high-signal visual regression, playback pixel-isolation evidence, and deep keyboard/touch/focus accessibility checks.

**Architecture:** Extend the existing Playwright verification platform instead of creating a parallel harness. Visual baselines are limited to Atlas-owned UI chrome; dynamic world/playback verification uses runtime screenshots and an independently bounded animation-overlay mask rather than committing Game-derived raster baselines. Product edits are allowed only behind deterministic RED regressions and remain minimal.

**Tech Stack:** Node.js `node:test`, Playwright 1.62.0, pinned Chromium container, existing Atlas checkout-overlay Docker runner, browser Canvas APIs.

**Spec:** `docs/agents/prompts/ATLAS-VERIFICATION-VISUAL-ACCESSIBILITY.md`

## Global Constraints

- Lifecycle authority is `Oteryn/Oteryn-Atlas#94`, parent `#85`.
- Exact starting `main` SHA is `69dee2a867b5b335b148164fc0ea1b47de816423`.
- Browser image is `mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07`.
- Playwright retries remain `0`; no arbitrary sleeps, broad pixel tolerances, or auto-accepted baselines.
- Visual regression complements geometry/framebuffer oracles; it does not replace them.
- Do not commit Game/world/sprite raster baselines whose publication rights are not separately established.
- Playback ON may alter only verified animated presentation regions; static world pixels outside those regions must remain identical.
- Accessibility automation proves tested behaviors only and must not be described as formal WCAG conformance.
- Every reproducible defect follows RED -> minimal fix -> GREEN -> full applicable exact-head verification.

---

### Task 1: Verification scenario classification

**Files:**
- Modify: `tests/verification/summary-reporter.test.mjs`
- Modify: `e2e/summary-reporter.mjs`

**Interfaces:**
- Consumes: `classifyScenario(file, annotations)`.
- Produces: automatic `accessibility` category for `accessibility-*.spec.mjs` while preserving explicit annotation precedence.

- [ ] **Step 1: Write the failing classifier assertion** for `accessibility-mobile.spec.mjs` and `accessibility-desktop.spec.mjs`.
- [ ] **Step 2: Run** `node --test tests/verification/summary-reporter.test.mjs` **and verify RED** because those files currently classify as `e2e`.
- [ ] **Step 3: Add the minimal filename classifier** immediately beside the existing visual/performance classifiers.
- [ ] **Step 4: Re-run the reporter test and verify GREEN.**
- [ ] **Step 5: Commit** the classifier change with its test.

### Task 2: Permanent stale-floor visual regression

**Files:**
- Create: `e2e/tests/visual-desktop.spec.mjs`
- Modify only after RED: `web/fullworld-creatures.mjs`

**Interfaces:**
- Consumes: the real `#creature-overlay`, `oteryn-atlas-view`, floor controls and published creature layer.
- Produces: a deterministic assertion that a floor transition cannot synchronously paint prepared records from the previous floor.

- [ ] **Step 1: Add an init-script draw probe** that counts `drawImage`/marker painting on `#creature-overlay` during the same turn as a floor-changing `oteryn-atlas-view` event.
- [ ] **Step 2: Load a published creature location on floor `-7`, activate the probe, change floor, and assert zero stale immediate paints before the asynchronous new-floor refresh.**
- [ ] **Step 3: Run only this test on exact checkout-overlay and verify RED on starting main.**
- [ ] **Step 4: Add the minimal guard** `record.position.floor !== view.floor` inside `paintPrepared(...)` before drawing any prepared item.
- [ ] **Step 5: Re-run the test and existing creature/geometry tests and verify GREEN.**
- [ ] **Step 6: Commit** the regression and minimal runtime fix.

### Task 3: Mobile keyboard/focus/hidden-state accessibility

**Files:**
- Create: `e2e/tests/accessibility-mobile.spec.mjs`
- Modify only after RED: `web/fullworld-mobile.mjs`

**Interfaces:**
- Consumes: `#mobile-controls-toggle`, `#mobile-inspector-toggle`, drawer panels, close controls, `Escape`, Playwright touch support.
- Produces: truthful hidden/inert state, focus entry, Escape close + focus restoration, and reachable touch controls at portrait and supported landscape widths.

- [ ] **Step 1: Write RED assertions** that closed mobile drawers are not keyboard-reachable, opening moves focus into the selected drawer, and `Escape` closes it and restores focus to the opener.
- [ ] **Step 2: Add touch assertions** using `locator.tap()` for critical mobile controls and prove the page has no horizontal overflow at 390x844 and 844x390.
- [ ] **Step 3: Run the accessibility mobile spec and capture the exact RED failures.**
- [ ] **Step 4: Minimally synchronize mobile drawer semantics** with the CSS responsive boundary: set/remove `inert` and `aria-hidden`, focus the drawer close control on open, and restore the opener on close. Use the same 980px breakpoint as the CSS mobile layout.
- [ ] **Step 5: Re-run mobile accessibility plus existing responsive/mobile specs and verify GREEN.**
- [ ] **Step 6: Commit** mobile accessibility regression coverage and product fix.

### Task 4: Desktop accessible-name and truthful-state depth

**Files:**
- Create: `e2e/tests/accessibility-desktop.spec.mjs`
- Modify product HTML/JS only if a deterministic RED identifies a defect.

**Interfaces:**
- Consumes: shipped desktop controls and qualification state.
- Produces: accessible-name, disabled-state, keyboard activation, and focus reachability assertions for core desktop controls.

- [ ] **Step 1: Assert accessible names** for zoom, floor, semantic search, animation, view mode group, map canvas, and inspector.
- [ ] **Step 2: Assert truthful disabled state** for unavailable Area/Subarea controls and conditional animation capability.
- [ ] **Step 3: Activate zoom and view-mode controls with keyboard input** and assert URL/runtime state changes rather than DOM-only clicks.
- [ ] **Step 4: Run the desktop accessibility spec; if any defect is RED, apply only the smallest source fix and preserve the failing assertion.**
- [ ] **Step 5: Re-run desktop accessibility and existing audit/state specs to GREEN.**
- [ ] **Step 6: Commit** the desktop accessibility coverage.

### Task 5: Stable Atlas-owned UI visual baselines

**Files:**
- Modify: `e2e/playwright.config.mjs`
- Create: `e2e/baselines/provenance.json`
- Extend: `e2e/tests/visual-desktop.spec.mjs`
- Create: `e2e/tests/visual-mobile.spec.mjs`
- Create through explicit reviewed baseline generation: `e2e/baselines/desktop-chromium/**`, `e2e/baselines/mobile-chromium/**`

**Interfaces:**
- Consumes: Playwright `toHaveScreenshot` and fixed project viewport/DPR/locale/timezone.
- Produces: expected/actual/diff on failure for narrowly cropped Atlas-owned UI chrome only.

- [ ] **Step 1: Configure `snapshotPathTemplate`** so reviewed images live under `e2e/baselines/<project>/...`.
- [ ] **Step 2: Add narrow screenshots** for desktop zoom/topbar controls and mobile topbar/drawer chrome; exclude the map/world raster from committed baselines.
- [ ] **Step 3: Record provenance** including container digest, Playwright version, viewport, DPR, locale, timezone, exact intentional baseline revision, and the UI-only rights boundary.
- [ ] **Step 4: Generate baselines once with explicit Playwright snapshot update, inspect the exact changed files, then run twice without update.**
- [ ] **Step 5: Require both ordinary reruns to be GREEN with no baseline mutation.**
- [ ] **Step 6: Commit** visual specs, provenance and reviewed UI-only baselines.

### Task 6: Playback/static-world pixel-isolation oracle

**Files:**
- Extend: `e2e/tests/visual-desktop.spec.mjs`
- Optional support if needed: `e2e/support/visual-oracle.mjs`

**Interfaces:**
- Consumes: locator screenshots, `#animation-overlay` Canvas2D alpha pixels, animation toggle, deterministic camera state.
- Produces: bounded evidence that playback changes at least one verified animated pixel while changing zero pixels outside the union of actual animation-overlay regions, and that disabling playback restores the deterministic static reference rendering.

- [ ] **Step 1: Select a deterministic published viewport with visible verified animated world presentations and prove the overlay emits non-zero alpha pixels.**
- [ ] **Step 2: Capture static screenshot, enable playback, sample a bounded union of animation-overlay alpha masks across deterministic observed frames, and capture playback screenshot.**
- [ ] **Step 3: Decode both screenshots in-browser and compare exact RGBA pixels; fail if any changed pixel is outside the allowed overlay mask, and fail if no allowed pixel changes.**
- [ ] **Step 4: Disable playback and require the settled static screenshot to return pixel-identically to the original static screenshot.**
- [ ] **Step 5: On failure attach bounded before/after/diff/mask PNG evidence plus counts; do not create a committed world raster baseline.**
- [ ] **Step 6: Run the playback visual oracle repeatedly to prove stable signal and commit it.**

### Task 7: Exact-head qualification and delivery

**Files:**
- No new product scope; update Issue/PR evidence only.

**Interfaces:**
- Consumes: all commits from Tasks 1-6.
- Produces: exact-head verified PR linked to #85 and #94.

- [ ] **Step 1: Run all applicable Node verification tests and `git diff --check`.**
- [ ] **Step 2: Run targeted visual/accessibility specs at least twice without retries or baseline updates.**
- [ ] **Step 3: Run the complete Playwright desktop+mobile checkout-overlay suite on the exact branch head.**
- [ ] **Step 4: Review `git diff origin/main...HEAD`, changed-file scope, artifact census and baseline provenance.**
- [ ] **Step 5: Push the branch and create one PR referencing `#85` and closing `#94`; record exact base/head SHA and local qualification evidence.**
- [ ] **Step 6: Require exact-head CI including stable `atlas-gate`; squash-merge only when required checks/reviews are green.**
- [ ] **Step 7: Verify merged `main`, close #94 if GitHub did not auto-close it, leave #85 open, and delete the completed task branch where policy permits.**