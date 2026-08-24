# ATLAS-CREATURE-INTERACTION-CARDS

ALIAS:
`ATLAS-CREATURE-INTERACTION-CARDS`

MODE:
Autonomous implementation + verification + integration + protected merge + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement Issue #113 completely: direct click/tap interaction for every rendered NPC and monster placement in FullWorld Atlas, one truthful contextual quick card, shared committed presentation geometry, deterministic overlap handling, exact-head verification and protected merge.

## Repositories

Primary implementation repository:
`https://github.com/Oteryn/Oteryn-Atlas`

Canonical Game/World/Content authority, READ-ONLY for this task:
`https://github.com/Oteryn/Oteryn-Game`

Do not modify Oteryn-Game.

## Mandatory source documents

Before changing product code read the current-main versions of:

1. `AGENTS.md` and every nearer applicable instruction file;
2. Issue `Oteryn/Oteryn-Atlas#113`;
3. `docs/superpowers/specs/2026-08-24-atlas-creature-interaction-cards-design.md`;
4. `docs/superpowers/plans/2026-08-24-atlas-creature-interaction-cards.md`;
5. `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md` from merged #116;
6. `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
7. current creature runtime, map pointer runtime, mobile drawer runtime and applicable tests.

Use the implementation plan task-by-task. If Superpowers is available, prefer `superpowers:subagent-driven-development`; otherwise use `superpowers:executing-plans`. TDD is mandatory for implementation logic and every defect discovered.

Design-time SHAs are historical evidence only. Refresh GitHub before mutation and before final qualification.

## Mandatory GitHub-first preflight

1. Resolve exact current Atlas `main` SHA, branch protection and required checks from GitHub.
2. Confirm this design, plan and prompt have already landed on `main`. Never implement ordinary product changes on the planning/docs branch.
3. Refresh Issue #113 and every open PR touching `web/fullworld-creatures.mjs`, creature rendering, animation, labels/badges, visual acceptance, mobile drawers or map pointer handling.
4. Treat Issue #64 / merged PR #83 as the shipped NPC role/icon/filter baseline. Issue #61 is historical context only.
5. Refresh #108/#112. If animation-coverage work is still unmerged and overlaps the same runtime files, do not create competing stale mutations; wait for/rebase after its merge unless ownership is explicitly transferred.
6. Refresh #115. Merged PR #116 defines the shared presentation-bounds contract. If canonical product geometry/layout code has since landed, reuse it rather than create a second seam.
7. Refresh #111/#118/#85. Use the strongest current exact-head visual-user/browser qualification path.
8. Refresh #114/#117 only to preserve compatibility with shared `record_id`/`entity_id` and geometry seams; do not implement those product scopes.
9. Create one fresh implementation branch from refreshed `main` and one implementation PR for #113.
10. Record exact starting base SHA and dependency reconciliation in the PR.

## Hard authority boundary

Oteryn-Game owns factual creature/NPC identity, placement, floor, role semantics, appearance/presentation and exported spawn-area facts.

Atlas owns derived CSS-pixel presentation geometry, interaction indexes, transient card state and UI.

`record_id` is the concrete placement/spawn record and remains the canonical `creature=` selection/deep-link identity. `entity_id`, when present, is the reusable creature/NPC entity identity. Never collapse one into the other.

A placement is not proof of live occupancy. Use wording such as `Monster spawn` / `verified placement`; never imply the monster is currently alive there.

Never invent or infer HP, XP, XP/hour, profit/hour, loot, difficulty, attacks, weaknesses, NPC services, travel destinations, quests or live spawn state.

Never add a second Game source, browser OTBM/Lua/XML parsing, sprite/image recognition, copied proprietary assets, DOM-per-creature rendering, or a second selected-creature/deep-link model.

## Required implementation

### A. Canonical shared creature presentation geometry

Create or reuse one pure CSS-pixel geometry helper for the actually rendered creature presentation.

It must account for:
- factual world anchor/floor;
- committed renderer/view transform;
- map-frame CSS viewport;
- actual bitmap width/height for pixel presentation;
- Game-owned displacement;
- deterministic marker fallback bounds;
- viewport clipping;
- CSS-pixel coordinates independent of backing-store DPR.

Recommended pure result:
`{ anchor, presentationRect, visibleRect, presentationKind, geometryKey }`.

The helper must not read DOM, `devicePixelRatio`, network or Game sources itself. It consumes validated inputs.

#113 hit testing/card anchoring and #115 labels/badges/diagnostics must converge on this seam. If #115 already provides an equivalent canonical helper, adapt to it.

Do not treat raw `tileX/tileY` as the full clickable footprint.

### B. Bounded committed interaction index

Build targets only for actually drawn visible creatures after a committed creature/base render.

Each private target includes stable record ID, optional entity ID, kind, factual floor/world anchor, base/creature render generations, draw order, canonical presentation/anchor rectangle, bounded hit rectangles and geometry key.

Build a fixed-size CSS-pixel bucket/grid index only when committed geometry changes. No whole-visible-set scan on every pointermove; hover must be rAF-throttled and bucket-local.

Direct visible geometry hits always outrank touch-assist/slop. Touch assist is considered only when there is no direct hit.

Deterministic overlap ordering:
1. topmost committed draw order;
2. pointer distance;
3. stable `record_id` tie-breaker.

If multiple materially overlapping direct hits remain, show a bounded chooser tied to the current committed interaction generation.

### C. Cancelable map activation arbitration

Preserve pointerdown/move/drag/wheel ownership in `web/fullworld-app.mjs`.

Refactor only the no-drag activation branch to synchronously dispatch a cancelable `oteryn-atlas-map-activate` event containing map-frame CSS x/y, world x/y, floor, pointer type, renderer generation and current view.

Creature interaction may `preventDefault()` only when the latest same-generation index has a valid creature hit. If prevented, underlying tile selection does not run. If there is no valid creature hit, existing map/tile click behavior remains unchanged.

Dragging never opens a creature card.

### D. Durable selection vs transient card state

Keep existing `state.selectedId` and URL `creature=` as durable selection.

Add separate transient card states such as:
- `closed`;
- `chooser`;
- `record`;
- `suspended`.

Escape/explicit close/outside activation closes transient card state without silently clearing durable creature selection or inspector state.

Pan/zoom/resize/render replacement may suspend the card until matching fresh geometry returns. Floor/layer/filter invalidation closes it when the record is no longer a valid target.

Invalidate chooser state whenever its committed interaction generation changes before a choice.

### E. One truthful contextual quick card

Add exactly one reusable DOM card in the map frame. No DOM-per-creature.

Primary card content:
- full factual name;
- `NPC` or `Monster spawn`;
- X/Y/F;
- resolved NPC roles when available;
- verified spawn radius when present;
- material ambiguity/unresolved warning when needed.

Keep record IDs, semantic digests, authority provenance and detailed presentation state in the existing inspector/details surface.

V1 actions are only:
- **Details** — synchronize/focus existing inspector;
- **Copy link** — canonical current URL after `creature=` state is persisted;
- close.

Do NOT add Center, routing, all-spawns navigation, bestiary, Farm Explorer or Hunt Intelligence UI in #113.

### F. Copy link must be truthful

Attempt Clipboard API only after canonical URL state is current.

On unavailable/rejected clipboard access, reveal a readonly canonical URL fallback and announce manual copy. Never show false success.

Guarantee canonical URL and reload/deep-link restoration. Do not build a new application-wide `popstate` history router in #113.

### G. Mobile/accessibility

Desktop hover is supplementary and never mutates durable selection.

Keyboard-only users keep existing Creature search/inspector access; do not fabricate thousands of focusable creature proxies.

Touch uses the same no-drag activation path. Mobile card may become a compact bottom/anchored sheet, but stays below existing drawer z-order and does not block essential zoom/floor/map controls.

Coordinate Details with the current mobile inspector through a small internal event such as `oteryn-atlas-open-inspector`; do not call private drawer functions from the creature module.

Escape closes only the topmost surface. If inspector drawer is open over the card, first Escape closes the drawer, not both surfaces.

Card must have accessible name, logical order, visible focus and explicit close.

### H. #115 reserved rectangles

Card placement avoids visible runtime/detail badges, cursor/status surfaces and essential controls.

If #115 product layout has landed, consume canonical presentation/label/badge geometry and feed final card rectangle into its `reservedRects`/occupancy seam. Do not create duplicate label click or hover/selection systems.

### I. Animation geometry

Refresh current #112 animation contract before implementation.

If all creature animation phases are proven geometry-invariant, bind target geometry to that invariant and test it. If phase bitmap/displacement geometry can change, update only affected target geometry when `geometryKey` changes; do not rebuild the whole index on every logical animation frame.

No stale phase rectangle may remain clickable after visible geometry changes.

### J. Diagnostics

Expose only bounded truthful read-only interaction diagnostics, for example:
- `interactionVersion: creature-interaction-v1`;
- target count;
- base/creature generations;
- hovered/selected ID;
- card state;
- selected/card target rect;
- bucket count/cell size.

No setters, fake records, alternate loaders or mutation hooks.

## Required TDD / deterministic coverage

Write RED tests before logic implementation for:
- pixel/bitmap/displacement presentation bounds;
- marker fallback;
- clipping/wrong-floor fail-closed behavior;
- CSS-pixel DPR invariance;
- rect edge/miss behavior;
- direct-before-touch-assist priority;
- deterministic overlap order;
- bucket membership/query;
- malformed/stale target rejection;
- card state transitions;
- chooser invalidation;
- floor/layer/filter invalidation;
- card viewport/reserved-rect placement;
- copy-link fallback state;
- diagnostics compatibility;
- map activation canceled vs uncanceled behavior.

Expected geometry must use an independent reference oracle where practical.

## Required real-browser acceptance

Use real Game-derived records, never fake production authority.

Desktop/mobile Chromium must prove:
- direct NPC click;
- direct monster click;
- no simultaneous tile selection;
- hover affordance;
- truthful card fields;
- overlap chooser if a real overlap exists;
- Details -> inspector;
- Copy link/fallback;
- Escape/outside dismissal;
- pan/zoom/resize re-anchoring;
- floor/layer/filter invalidation;
- reload/deep-link restoration;
- mobile tap/readability/topmost Escape;
- essential controls remain reachable;
- dense-scene boundedness;
- no page/console/runtime errors.

Browser geometry assertions must link clicked screen point, interaction target and factual world anchor to the same committed renderer generation and detect stale hitboxes after camera/floor changes.

If no real overlapping production-derived placement exists at execution time, record that factual absence and rely on deterministic overlap-unit proof rather than fabricating E2E data.

## Exact-head qualification

Before merge:

1. run full applicable deterministic suite;
2. run syntax/focused geometry/interaction/GUI tests;
3. run the complete required Docker Playwright checkout-overlay gate on Molehill-PC, workers=1, retries=0, through the current repository wrapper/machine-wide lock;
4. if #111/#118 visual-user acceptance is current/merged, generate exact-revision evidence and actually open/review every required desktop/mobile screenshot before approval/status publication;
5. run `git diff --check`, inspect entire changed-file set and complete final diff;
6. push exact final head and update one implementation PR;
7. require exact-head `atlas-gate`, `provenance-gate` and every current required CodeQL/creature/browser check;
8. resolve all review threads;
9. squash-merge only when all exact-head evidence is green;
10. close Issue #113 only when its Definition of Done is satisfied; delete completed implementation branch when policy permits.

Never merge based on stale earlier-head checks. Never weaken retries, tolerances, allowlists, timeouts or provenance/security gates to obtain green status.

## Live deployment boundary

Ordinary #113 implementation does NOT authorize live/production mutation.

After merge, record the exact merged `main` SHA. Only if explicit live-deployment authority exists at execution time may you deploy, and then only the exact merged `main` through the trusted Synology main-only workflow with revision-qualified desktop/mobile live acceptance.

## Final report

Return a compact evidence-backed closeout containing:
- implementation PR number;
- exact base/head/merge SHAs;
- delivered files/modules and interaction/geometry version identities;
- real factual acceptance record IDs used;
- deterministic test results;
- exact-head Docker Playwright result;
- visual-user review evidence if required;
- `atlas-gate` / `provenance-gate` / security status;
- Issue #113 state;
- branch cleanup state;
- exact remaining truthful limitations.

No invented success claims. If an external dependency remains unresolved, record the exact blocker and leave only the affected claim incomplete.