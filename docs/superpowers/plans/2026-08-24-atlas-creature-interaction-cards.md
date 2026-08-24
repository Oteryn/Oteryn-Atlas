# Atlas Creature Interaction Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rendered NPC and monster placements directly clickable/tappable with one truthful contextual card while preserving map interaction, Game authority and existing creature deep-link/inspector semantics.

**Architecture:** Reuse one canonical CSS-pixel creature presentation geometry seam shared with #115, build a bounded committed-render interaction bucket index, arbitrate no-drag map activation with a cancelable event, and render one DOM card whose visibility is separate from durable `creature=` selection. Exact-head Node, geometry, Docker Playwright and visual-user evidence are part of the delivery.

**Tech Stack:** Browser ES modules, Canvas/WebGL FullWorld runtime, DOM/CSS quick card, `node:test`, Playwright Chromium, GitHub protected PR lifecycle.

**Spec:** `docs/superpowers/specs/2026-08-24-atlas-creature-interaction-cards-design.md`

## Global Constraints

- Oteryn-Game is read-only and remains canonical World/Content authority.
- `record_id` is placement/deep-link identity; `entity_id` is reusable entity identity.
- No invented HP/XP/loot/profit/difficulty/services/live-spawn facts.
- No DOM-per-creature, second selection model, alternate Game source or proprietary copied assets.
- Preserve base map drag/wheel/pointer ownership; creature activation must not double-select the underlying tile.
- Geometry and interaction remain in CSS pixels and must link to the same committed render generation.
- Refresh #112/#115/#118 and current `main` before product mutation and before final qualification.
- TDD and permanent regressions are required under `AGENTS.md`/#85.
- Heavy full browser qualification runs only on Molehill-PC through the repository wrapper, workers=1, retries=0.
- Live deployment is not part of ordinary #113 implementation unless explicit deployment authority exists at execution time.

---

## File Structure

Expected implementation surface, to be reconciled against refreshed `main`:

- `src/browser/creature-presentation-geometry.mjs` — pure shared committed presentation geometry, unless an equivalent #115 module already exists.
- `src/browser/creature-interaction.mjs` — pure target normalization, bucket index, hit testing, overlap ordering, card placement/state helpers.
- `web/fullworld-app.mjs` — cancelable no-drag map-activation seam only.
- `web/fullworld-creatures.mjs` — committed interaction target production, durable selection integration, hover/card controller and diagnostics.
- `web/fullworld.html` / `web/fullworld.css` — one quick-card surface and responsive presentation.
- `web/fullworld-mobile.mjs` — internal open-inspector coordination/topmost dismissal only if required.
- `tests/creature-presentation-geometry.mjs` — pure geometry tests.
- `tests/creature-interaction.mjs` — pure interaction/state/index tests.
- existing browser/GUI contract tests — markup/event/compatibility contracts.
- `e2e/tests/creatures-desktop.spec.mjs` and applicable mobile/visual specs — real browser journeys.

Do not refactor unrelated FullWorld architecture.

### Task 1: Refresh lifecycle and dependencies

**Files:** no product mutation.

**Interfaces:** establishes exact base/dependency state used by every later task.

- [ ] **Step 1: Resolve current GitHub authority**

Record exact current `main`, Issue #113, branch protection, current `AGENTS.md`, and open PRs touching creature/map/mobile/visual surfaces.

- [ ] **Step 2: Reconcile #112**

If animation-coverage PR #112 is still open and overlaps creature runtime files, do not begin overlapping product mutation. Wait for/rebase after its merge unless ownership is explicitly transferred. Record the exact resolution.

- [ ] **Step 3: Reconcile #115/#116**

Read the merged #116 contract and current #115 implementation state. If a canonical presentation-geometry helper already exists, record its exact interface and reuse it in Tasks 2/5 instead of creating another helper.

- [ ] **Step 4: Reconcile #111/#118**

Record the current exact-head visual-user acceptance path and whether reviewed screenshot evidence is already required for `atlas-local-e2e`.

- [ ] **Step 5: Create a fresh implementation branch**

Create one branch from refreshed `main`; never implement from the planning/docs branch. Record base SHA in the eventual implementation PR.

### Task 2: Establish shared creature presentation geometry

**Files:**
- Create/reuse: `src/browser/creature-presentation-geometry.mjs`
- Test: `tests/creature-presentation-geometry.mjs`

**Interfaces:**
- Consumes: `{record, view, viewport, presentation}` where `presentation` contains either bitmap dimensions + Game-owned displacement or deterministic marker bounds.
- Produces: `computeCreaturePresentationGeometry(input)` -> frozen `{anchor, presentationRect, visibleRect, presentationKind, geometryKey}` in CSS pixels, or `null` for wrong-floor/non-presentable input.

- [ ] **Step 1: Write failing geometry tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCreaturePresentationGeometry } from '../src/browser/creature-presentation-geometry.mjs';

test('pixel geometry includes bitmap size and Game displacement in CSS pixels', () => {
  const result = computeCreaturePresentationGeometry({
    record: { position: { x: 101, y: 100, floor: -7 } },
    view: { x: 100, y: 100, floor: -7, zoom: 2 },
    viewport: { width: 400, height: 300 },
    presentation: { kind: 'pixel', bitmapWidth: 32, bitmapHeight: 32, displacement: { x: 4, y: 6 } },
  });
  assert.equal(result.presentationKind, 'pixel');
  assert.deepEqual(result.anchor, { x: 264, y: 150 });
  assert.equal(result.presentationRect.width, 64);
  assert.equal(result.presentationRect.height, 64);
});

test('wrong-floor geometry fails closed', () => {
  assert.equal(computeCreaturePresentationGeometry({
    record: { position: { x: 1, y: 1, floor: -6 } },
    view: { x: 1, y: 1, floor: -7, zoom: 2 },
    viewport: { width: 400, height: 300 },
    presentation: { kind: 'marker', width: 8, height: 8 },
  }), null);
});
```

Add independent cases for marker fallback, clipping and DPR-independence.

- [ ] **Step 2: Run RED**

Run: `node --test tests/creature-presentation-geometry.mjs`

Expected: FAIL because the canonical helper/API is absent or incomplete.

- [ ] **Step 3: Implement the minimal pure helper**

Use the committed renderer's `32 * zoom` world-to-screen convention as factual input semantics, but do not read DOM or `devicePixelRatio` inside the helper. Freeze/copy returned geometry.

- [ ] **Step 4: Run GREEN and commit**

Run: `node --test tests/creature-presentation-geometry.mjs`

Expected: all geometry tests PASS.

Commit only the helper/tests for this task.

### Task 3: Build the pure bounded interaction index and card-state helpers

**Files:**
- Create: `src/browser/creature-interaction.mjs`
- Test: `tests/creature-interaction.mjs`

**Interfaces:**
- `buildCreatureInteractionIndex(targets, {width, height, cellSize, generation})`
- `queryCreatureHits(index, {x, y, pointerType})`
- `placeCreatureCard(anchorRect, cardSize, viewport, reservedRects)`
- pure card-state reducer/helper that keeps durable selected ID separate from `closed|chooser|record|suspended` transient state.

- [ ] **Step 1: Write RED interaction tests**

Cover rectangle edges/misses, direct-before-touch-assist, deterministic draw-order/distance/ID ordering, bucket membership, malformed targets, stale-generation rejection, chooser invalidation and card-state transitions.

Example oracle:

```js
const hits = queryCreatureHits(index, { x: 50, y: 50, pointerType: 'mouse' });
assert.deepEqual(hits.map((hit) => hit.recordId), ['monster:bbbb', 'npc:aaaa']);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/creature-interaction.mjs`

Expected: FAIL because the module/API does not exist.

- [ ] **Step 3: Implement minimal pure logic**

Use a fixed-size CSS-pixel grid. If any direct hits exist, return only direct hits; use touch assist only when direct hits are empty. Sort by draw order desc, distance asc, then stable `recordId` asc.

- [ ] **Step 4: Test card placement/state**

Add independent viewport/reserved-rect tests and verify transient dismissal never removes the separate durable selected ID.

- [ ] **Step 5: Run GREEN and commit**

Run: `node --test tests/creature-interaction.mjs`

Expected: all interaction tests PASS.

### Task 4: Add cancelable map-activation arbitration

**Files:**
- Modify: `web/fullworld-app.mjs`
- Test: `tests/gui-contract.mjs` or focused browser-contract test.

**Interfaces:**
- Produces synchronous cancelable `oteryn-atlas-map-activate` with `{cssX, cssY, worldX, worldY, floor, pointerType, rendererGeneration, view}`.
- Existing tile selection runs only when `dispatchEvent(...)` returns true.

- [ ] **Step 1: Write a failing contract**

Assert the no-drag pointer-up path dispatches the named cancelable event before tile selection and that canceled activation bypasses tile-selection mutation while uncanceled activation preserves existing behavior.

- [ ] **Step 2: Run RED**

Run the focused contract test and confirm the intended failure.

- [ ] **Step 3: Implement the minimal arbitration seam**

Keep pointerdown/move/drag/wheel ownership unchanged. Do not move interaction state into `fullworld-app.mjs`.

- [ ] **Step 4: Run GREEN and commit**

Run focused GUI/browser contracts plus `node --check web/fullworld-app.mjs`.

### Task 5: Produce committed creature interaction targets

**Files:**
- Modify: `web/fullworld-creatures.mjs`
- Modify: current diagnostics helper only if needed for bounded read-only fields.
- Test: `tests/creature-interaction.mjs` and existing creature render/geometry contracts.

**Interfaces:**
- Consumes committed base renderer snapshot and prepared/drawn creature presentations.
- Produces a private same-generation bucket index and a bounded read-only `creature-interaction-v1` diagnostic snapshot.

- [ ] **Step 1: Write RED integration contracts**

Prove only actually drawn current-floor/current-filter targets enter the index; hidden layers and filtered NPCs are absent; target generations match the committed base/creature render; stale geometry is rejected.

- [ ] **Step 2: Integrate canonical presentation geometry**

Derive each target from actual pixel bitmap/displacement or marker fallback presentation. If #115 label/badge geometry exists, include those rectangles only through the shared seam; do not duplicate their calculations.

- [ ] **Step 3: Build/rebuild the private bucket index only on committed geometry changes**

Do not rebuild the whole index on logical animation ticks when geometry is unchanged. If animation geometry keys can vary, update only affected targets when the key changes.

- [ ] **Step 4: Publish bounded read-only diagnostics**

Expose interaction version, target count, generation linkage, hovered/selected ID, card state, selected target rect and bucket count/cell size. Do not expose the full private target set if not needed.

- [ ] **Step 5: Run targeted deterministic checks and commit**

Run geometry/interaction/creature-render tests and `node --check web/fullworld-creatures.mjs`.

### Task 6: Add the contextual quick card and map activation controller

**Files:**
- Modify: `web/fullworld.html`
- Modify: `web/fullworld.css`
- Modify: `web/fullworld-creatures.mjs`
- Test: `tests/gui-contract.mjs`, `tests/creature-interaction.mjs`.

**Interfaces:** one `#creature-quick-card`; actions `Details`, `Copy link`, close; readonly URL fallback + live status.

- [ ] **Step 1: Write RED markup/state contracts**

Require exactly one card, hidden default, accessible heading/close/actions, no DOM-per-creature generation and mobile CSS below drawer z-order.

- [ ] **Step 2: Consume `oteryn-atlas-map-activate`**

On a fresh valid hit, prevent the base activation, update durable `selectedId`/`creature=` state, and open either `record` or `chooser` transient state. Without a hit, leave map activation untouched.

- [ ] **Step 3: Implement truthful card content**

Render only full name, NPC/Monster spawn kind, X/Y/F, resolved NPC roles, verified spawn radius and material ambiguity/unresolved notice. Keep technical IDs/digests in the existing inspector.

- [ ] **Step 4: Implement card placement and suspension**

Use `placeCreatureCard()` with fresh target geometry, viewport and reserved rectangles. Pan/zoom/resize/render replacement suspends until matching fresh geometry is available.

- [ ] **Step 5: Implement Copy link truthfully**

After canonical URL selection is persisted, call Clipboard API. On failure/unavailability reveal the readonly URL fallback and announce manual copy; never claim success falsely.

- [ ] **Step 6: Implement dismissal**

Explicit close, outside activation and Escape close transient card state only; preserve durable selection/inspector. Invalidate chooser on generation change.

- [ ] **Step 7: Run GREEN and commit**

Run GUI/interaction tests and syntax checks.

### Task 7: Integrate mobile inspector and #115 reserved geometry

**Files:**
- Modify: `web/fullworld-mobile.mjs`
- Modify: `web/fullworld-creatures.mjs`
- Modify current #115 shared layout module only if it has landed and owns reserved rectangles.
- Test: applicable mobile/browser contracts.

**Interfaces:** `oteryn-atlas-open-inspector` opens the existing drawer through normal mobile state; card publishes only transient `cardRect` presentation geometry.

- [ ] **Step 1: Write RED mobile focus/dismissal tests**

Prove Details opens/focuses the existing inspector, Escape closes only the topmost drawer/card surface, and current drawer focus-return semantics remain intact.

- [ ] **Step 2: Add the internal inspector event**

Let `fullworld-mobile.mjs` listen for `oteryn-atlas-open-inspector`; do not call its private drawer functions from the creature module.

- [ ] **Step 3: Reconcile #115**

If #115 product code exists, feed final card rectangle into its `reservedRects` seam and consume its canonical presentation/label/badge rectangles as optional hit geometry. If #115 is still unimplemented, keep the seam minimal and documented.

- [ ] **Step 4: Run GREEN and commit**

Run GUI/mobile contracts and syntax checks.

### Task 8: Add real-browser desktop/mobile acceptance

**Files:**
- Modify: `e2e/tests/creatures-desktop.spec.mjs`
- Create/modify: appropriate mobile creature interaction spec.
- Modify current visual-user scenarios only through the merged current #111/#118 contract.

**Interfaces:** tests use real Game-derived records and independent world-to-screen geometry; no fake runtime authority.

- [ ] **Step 1: Add desktop RED journeys**

Cover direct NPC click, direct monster click, no simultaneous tile selection, hover affordance, truthful card fields, Details, Copy link/fallback, Escape/outside dismissal and reload/deep-link restoration.

- [ ] **Step 2: Add stale-geometry journeys**

From a real record, independently calculate the expected committed CSS anchor from factual position + renderer diagnostics. After pan, zoom, resize, floor and layer/filter changes prove only fresh same-generation geometry can activate.

- [ ] **Step 3: Add mobile journeys**

Use real tap/no-drag activation. Prove readable card, Details drawer opening, topmost Escape behavior and essential controls remain reachable.

- [ ] **Step 4: Handle overlap truthfully**

Revalidate current production-derived creature publication for a real overlapping placement. If found, exercise chooser in Chromium. If absent, record the fact and keep overlap proof in deterministic unit coverage rather than fabricating a record.

- [ ] **Step 5: Run targeted Playwright**

Use the current repository Docker/Playwright wrapper with workers=1, retries=0. Never bypass the Molehill machine-wide lock or substitute Synology.

- [ ] **Step 6: Commit browser coverage**

Commit only after the targeted scenarios pass without hidden retry/tolerance weakening.

### Task 9: Full exact-head qualification and protected closeout

**Files:** no new scope unless verification finds a real regression.

- [ ] **Step 1: Run full deterministic tests**

Use the repository-selected deterministic test command from current `AGENTS.md`/verification docs. At minimum run the complete `tests/**/*.mjs` contract set plus any Python/provenance checks applicable to touched paths.

- [ ] **Step 2: Run focused syntax/contracts**

Run `node --check` for every modified browser module and the focused geometry/interaction/GUI tests. Require exit 0 and zero failures.

- [ ] **Step 3: Run exact-head full Docker Playwright on Molehill-PC**

Use current `e2e/run.ps1` checkout-overlay qualification, workers=1, retries=0, clean exact HEAD. Let the machine-wide lock serialize the run.

- [ ] **Step 4: Perform required visual-user review**

If the #111/#118 mechanism is merged/current, open every required exact-head desktop/mobile evidence frame containing the new card states and create the review manifest only after actual inspection. If current policy requires this evidence, merge remains blocked until it exists.

- [ ] **Step 5: Review final diff and working tree**

Run `git diff --check`, inspect status, changed-file list and full `origin/main...HEAD` diff. Reject unrelated files, fake Game facts, proprietary assets, retry/tolerance weakening, second selection models or stale planning-only mutations.

- [ ] **Step 6: Push exact final head and open/update one implementation PR**

PR body records refreshed base/head SHAs, #112/#115/#118 reconciliation, real factual acceptance records, tests/evidence and remaining truthful limitations.

- [ ] **Step 7: Require exact-head GitHub gates**

Verify `atlas-gate`, `provenance-gate` and every current required CodeQL/creature/browser check on the exact final head. Stale green checks do not count.

- [ ] **Step 8: Squash-merge and clean implementation branch**

Resolve all review threads, squash-merge only after required exact-head checks, close Issue #113 only when Definition of Done is satisfied, and delete the implementation branch when policy permits.

- [ ] **Step 9: Respect post-merge deployment boundary**

Record exact merged `main` SHA. Do not mutate live production unless explicit deployment authority exists at execution time. If authorized, deploy only merged `main` through trusted Synology workflow and run revision-qualified live acceptance.

- [ ] **Step 10: Return evidence-backed closeout**

Report implementation PR, exact merge SHA, files/modules, interaction/geometry versions, real acceptance records, deterministic/Playwright/visual evidence, GitHub gate results, branch cleanup and remaining limitations.