# Atlas Creature Label and NPC Badge Parallel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one generic, mode-aware creature presentation system for every published Atlas NPC and monster, with canonical CSS-pixel bounds, polished labels, truthful multi-role NPC pixel badges, deterministic collision/layout caching, diagnostics, and exact-head browser verification.

**Architecture:** Four isolated workers build independent pure/test domains in parallel: geometry/layout, NPC badges, creature LOD, and verification contracts. A single integration coordinator reviews those commits and owns all shared FullWorld runtime wiring, diagnostics, final browser tuning, the only implementation PR to `main`, and squash merge.

**Tech Stack:** JavaScript ES modules, `node:test`, HTML Canvas 2D, existing FullWorld renderer/LOD contracts, Playwright pinned Chromium on Molehill, GitHub protected-branch gates.

**Spec:** `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`

## Global Constraints

- Oteryn-Game remains canonical World/Content authority; do not mutate it or invent creature facts.
- Production behavior must be generic for all published NPCs and monsters; named creatures are acceptance fixtures only.
- Preserve canonical role order `bank`, `travel`, `shop`, `quest`, `blessing`, `trainer`.
- Preserve CSS-pixel presentation geometry across DPR 1 and 2; Canvas backing DPR must not be applied twice.
- Do not duplicate canonical AUTO/minimap thresholds from `src/layers/minimap-lod.mjs`.
- If Issue #113 is unmerged, #115 remains presentation-only; if merged, reuse its canonical state/geometry rather than competing with it.
- Production-code tasks obey RED -> GREEN -> REFACTOR; no production implementation before an observed failing test.
- Worker branches do not open PRs to `main`; the coordinator owns one #115 implementation PR.
- No production/live deployment is authorized by this plan.

---

### Task 1: Canonical presentation geometry and layout core

**Files:**
- Create: `src/browser/creature-presentation-layout.mjs`
- Create: `tests/creature-presentation-layout.mjs`

**Interfaces:**
- Consumes: committed screen anchor, zoom, stable bitmap dimensions, Game-owned displacement, fallback marker size, viewport, reserved rectangles, text metrics and layout dependencies.
- Produces: CSS-pixel presentation bounds, clipped rectangles, deterministic ellipsis, ordered label candidates, occupancy result and stable layout key independent of logical animation time.

Target public surface:

```js
export function creaturePresentationBounds(input) {}
export function ellipsizeCreatureLabel(input) {}
export function creatureLabelCandidates(input) {}
export function solveCreaturePresentationLayout(input) {}
export function creaturePresentationLayoutKey(input) {}
```

- [ ] **Step 1: Write failing geometry tests.** Assert the current repo cannot satisfy 32x32, oversized bitmap, displacement, fallback and viewport-clipping cases through the target API.
- [ ] **Step 2: Run RED.** `node --test tests/creature-presentation-layout.mjs`; expected: failures caused by missing exports/behavior, not syntax or fixture errors.
- [ ] **Step 3: Implement bounds only.** Use `left = anchorX - (bitmapWidth - 32 + displacementX) * zoom`, equivalent Y formula, and CSS-pixel width/height; DPR is not accepted by the helper.
- [ ] **Step 4: Add failing ellipsis/collision/cache tests.** Cover injected metrics, candidate order, reserved rectangles, priority suppression and animation-only key invariance.
- [ ] **Step 5: Implement deterministic text/candidate/occupancy/key helpers.** Keep return values immutable according to current repository conventions.
- [ ] **Step 6: Run GREEN.** `node --test tests/creature-presentation-layout.mjs`; expected: zero failures.
- [ ] **Step 7: Commit and push.** Branch `work/115-presentation-geometry-layout`; hand off exact RED/GREEN evidence and final SHA.

### Task 2: Truthful multi-role NPC badges v2

**Files:**
- Modify: `src/browser/npc-markers.mjs`
- Create: `src/browser/npc-badge-primitives.mjs`
- Modify: `tests/npc-markers.mjs`
- Create: `tests/npc-badge-primitives.mjs`

**Interfaces:**
- Consumes: validated canonical factual NPC roles and active `npcRole` filter.
- Produces: bounded immutable badge slots and repository-owned integer-grid primitive commands.

Target public surface:

```js
export function npcBadgeSlots(record, activeFilter = 'all', maxSlots = 3) {}
export function npcBadgePrimitive(role) {}
```

`npcBadgeSlots()` returns role descriptors or one overflow descriptor `{ kind: 'overflow', hiddenCount }`; overflow is never a factual role.

- [ ] **Step 1: Write failing slot tests.** Cover 0/1/2/3/4/5 roles, active-filter overflow visibility and exact hidden counts.
- [ ] **Step 2: Run RED.** `node --test tests/npc-markers.mjs`; expected: new badge-slot assertions fail for missing behavior.
- [ ] **Step 3: Implement minimal slot selection.** Preserve the record's factual role list and current filter semantics.
- [ ] **Step 4: Write failing primitive tests.** Every bank/travel/shop/quest/blessing/trainer/other primitive must use bounded integer grid rectangles/cells and no external asset.
- [ ] **Step 5: Implement immutable primitives.** No emoji, copied Tibia/CipSoft art, SVG pack or anti-aliased arc dependency.
- [ ] **Step 6: Run GREEN/regressions.** `node --test tests/npc-markers.mjs tests/npc-badge-primitives.mjs`; then run the existing creature-role/index test command discovered from current `package.json`/CI.
- [ ] **Step 7: Commit and push.** Branch `work/115-npc-functional-badges-v2`; hand off exported shapes and final SHA.

### Task 3: Mode/effective-representation creature LOD policy

**Files:**
- Create: `src/browser/creature-presentation-lod.mjs`
- Create: `tests/creature-presentation-lod.mjs`

**Interfaces:**
- Consumes: explicit view mode, canonical effective representation from `lodBlend()`, zoom for within-detail tiering, overview flag, selection, optional canonical hover and creature kind.
- Produces: immutable presentation tier/flags/max-width policy without owning AUTO transition thresholds.

Target public surface:

```js
export function creaturePresentationLod({
  mode,
  effectiveRepresentation,
  zoom,
  overview = false,
  selected = false,
  hovered = false,
  kind,
}) {}
```

- [ ] **Step 1: Write failing mode tests.** Cover minimap/classic sparse, map far/medium/close, AUTO effective minimap/detail/transition, overview and selection/hover promotion.
- [ ] **Step 2: Run RED.** `node --test tests/creature-presentation-lod.mjs`; expected: missing-feature failures.
- [ ] **Step 3: Implement pure policy.** AUTO sparse/detail choice comes from `effectiveRepresentation`; do not copy `LOD_POLICY` AUTO thresholds.
- [ ] **Step 4: Add a source-contract regression.** Assert the new module does not define/import duplicate AUTO transition constants as its own authority.
- [ ] **Step 5: Run GREEN.** `node --test tests/creature-presentation-lod.mjs` plus the existing minimap LOD test command discovered from current CI; expected: zero failures.
- [ ] **Step 6: Commit and push.** Branch `work/115-creature-presentation-lod`; hand off tier semantics, tuneable within-detail constants and final SHA.

### Task 4: Independent verification contracts

**Files:**
- Create: `tests/creature-presentation-contract.mjs`
- Create: `e2e/tests/creature-presentation.spec.mjs`

**Interfaces:**
- Consumes: public runtime diagnostics, existing deep-link/filter/view controls and accepted Game-derived creature publication.
- Produces: independent RED contracts and stable browser evidence scenarios; no product runtime code.

Expected diagnostics under test:

```js
{
  labelStyle: 'creature-labels-v1',
  npcMarkerStyle: 'functional-icons-v2',
  labelsConsidered: Number,
  labelsDrawn: Number,
  labelsSuppressed: Number,
  drawnNpcBadges: Number,
  drawnNpcIcons: Number,
  effectiveRepresentation: String,
  labelLayoutGeneration: Number,
  labelLayoutKey: String,
}
```

- [ ] **Step 1: Revalidate factual fixtures.** Use exact current publication to select a two-role NPC, >3-role NPC, long-name record and dense scene; record IDs/roles/positions in test-only data/comments.
- [ ] **Step 2: Write failing diagnostics tests.** Assert versioned style names, counters, bounded CSS-pixel rects and committed-generation linkage.
- [ ] **Step 3: Run deterministic RED.** `node --test tests/creature-presentation-contract.mjs`; expected: missing #115 diagnostics fail.
- [ ] **Step 4: Write browser RED cases.** Cover modes, overflow/filter visibility, collisions, edge ellipsis, overview, selected reload, animation no-churn, DPR1/2 and HUD non-occlusion in `e2e/tests/creature-presentation.spec.mjs`.
- [ ] **Step 5: Run the focused browser spec using the exact current command from `e2e/README.md`.** Retain expected product RED separately from publication/network failures.
- [ ] **Step 6: Commit and push.** Branch `work/115-creature-presentation-verification`; no runtime edits; hand off RED evidence and required runtime seams.

### Task 5: Integrate worker outputs and wire shared runtime

**Files:**
- Modify: `web/fullworld-creatures.mjs`
- Modify: `web/fullworld-app.mjs`
- Modify: `web/fullworld.css`
- Modify: `src/browser/creature-render-diagnostics.mjs`
- Consume: worker files/tests from Tasks 1-4 after diff review.

**Interfaces:**
- Consumes: pure geometry, badge, LOD APIs and independent RED contracts.
- Produces: separate presentation Canvas/lifetime, canonical geometry usage, bounded label draw, `functional-icons-v2` draw, canonical effective LOD wiring, DOM-derived reserved rectangles and versioned diagnostics.

Integration target:

```js
// fullworld-app publishes the existing view plus read-only effective representation.
{ view, detailReady, detailStreaming, effectiveRepresentation }

// fullworld-creatures keeps sprite animation separate from cached presentation layout.
const layoutKey = creaturePresentationLayoutKey(layoutDependencies);
if (layoutKey !== state.lastPresentationLayoutKey) recomputePresentationLayout();
redrawPresentationCanvasWithoutChangingWorldFacts();
```

- [ ] **Step 1: Refresh `main`, Issue #113 and competing branches.** Create `feat/issue-115-creature-label-badge-ux` from the exact refreshed SHA.
- [ ] **Step 2: Inspect every worker diff and rerun focused tests.** Reject ownership violations or creature-specific production exceptions before integration.
- [ ] **Step 3: Consume reviewed commits in order.** Geometry -> badges -> LOD -> verification; record every worker SHA.
- [ ] **Step 4: Observe shared-runtime RED.** Activate one verification assertion at a time before each runtime change.
- [ ] **Step 5: Add `#creature-presentation-overlay`.** It is `pointer-events:none`, uses CSS dimensions plus DPR-aware backing dimensions, and does not own sprite animation.
- [ ] **Step 6: Replace raw creature-name drawing.** Use the shared explicit Atlas font, bounded ellipsis, label background/accent and geometry/collision result.
- [ ] **Step 7: Draw v2 badges.** Consume factual slots/primitives; preserve exact overflow hidden count and `drawnNpcIcons` compatibility meaning.
- [ ] **Step 8: Publish canonical effective representation.** Derive it from existing `lodBlend()` in `web/fullworld-app.mjs`; preserve `__OTERYN_ATLAS_VIEW__` compatibility.
- [ ] **Step 9: Feed DOM-derived reserved rectangles.** Runtime/detail badges, cursor coordinates and #113 card when present use actual `getBoundingClientRect()` converted to map-frame CSS pixels.
- [ ] **Step 10: Extend diagnostics.** Add versioned style names, counts, effective representation, layout key/generation and bounded presentation/label/badge rectangles linked to committed renderer generation.
- [ ] **Step 11: Run focused GREEN.** Execute all worker deterministic test files and the focused browser spec; logical animation-only frame changes must not increment layout generation.

### Task 6: Exact-head visual verification and protected merge

**Files:**
- No new product files. Change implementation/evidence files only if a fresh failing final-head verification proves a defect, and apply TDD before any fix.

**Interfaces:**
- Consumes: exact final implementation head.
- Produces: reviewed screenshots/artifacts, exact-head local evidence when current policy requires it, green protected gates and one squash-merged #115 PR.

- [ ] **Step 1: Run full deterministic verification.** Use the exact commands currently named by `.github/workflows/ci.yml`; require zero failures.
- [ ] **Step 2: Run pinned Chromium/Molehill exact-head acceptance.** Use the current `e2e/README.md` command, current required worker count and retry policy; retain every failure.
- [ ] **Step 3: Inspect screenshots.** Manually review two-role, >3-role overflow, active-filter overflow, dense collision, long-name edge, map/minimap/classic/auto, overview and mobile DPR2/HUD cases.
- [ ] **Step 4: Publish local exact-head status only after success.** Use current-main `e2e/publish-local-e2e-status.ps1` or its current replacement exactly as documented.
- [ ] **Step 5: Open the single #115 PR to `main`.** Include starting SHA, worker SHAs, revalidated fixtures, changed-file list and verification results.
- [ ] **Step 6: Require protected gates.** `atlas-gate`, `provenance-gate` and every current required check must be green for the exact head.
- [ ] **Step 7: Requalify after any code-changing update.** Never reuse stale local evidence for a new head SHA.
- [ ] **Step 8: Review final diff/threads and squash merge.** Do not bypass branch protection.
- [ ] **Step 9: Verify merged `main` and close #115 only when its Definition of Done is actually satisfied.**

## Parallel launch order

Launch Tasks 1-4 concurrently. Do **not** launch the integration coordinator until all four worker branches have pushed final handoff commits. Then execute Tasks 5-6 through `ATLAS-CREATURE-PRESENTATION-INTEGRATOR`.

## Prompt aliases

- `ATLAS-CREATURE-PRESENTATION-GEOMETRY-LAYOUT`
- `ATLAS-NPC-FUNCTIONAL-BADGES-V2`
- `ATLAS-CREATURE-PRESENTATION-LOD`
- `ATLAS-CREATURE-PRESENTATION-VERIFICATION`
- `ATLAS-CREATURE-PRESENTATION-INTEGRATOR`
