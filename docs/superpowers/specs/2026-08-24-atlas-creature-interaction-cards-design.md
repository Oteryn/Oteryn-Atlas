# Atlas Creature Interaction Cards — Design

- Lifecycle authority: `Oteryn/Oteryn-Atlas#113`
- Repository: `Oteryn/Oteryn-Atlas`
- Reviewed planning base: `main@42d268aa98a7d48e8a7a9ed2e95e4a9c14753909`
- Canonical World/Content authority: `Oteryn/Oteryn-Game`
- Verification programme: `Oteryn/Oteryn-Atlas#85`
- Related presentation contract: `#115`, merged planning PR `#116`
- Visual-user acceptance: `#111/#118`

## 1. Purpose

Make every rendered NPC and monster placement on the FullWorld Atlas directly interactive without replacing the bounded Canvas creature renderer, fabricating Game facts, or creating DOM nodes per creature.

The user flow is:

`rendered creature -> hover/tap target -> contextual quick card -> existing inspector/deep link`

The quick card is a map interaction surface, not a bestiary, hunt analyzer, route planner or live spawn tracker.

## 2. Verified starting seam

The current Atlas creature runtime already has stable `record_id`, optional `entity_id`, factual position/floor, NPC roles, spawn-area facts, verified/fallback presentation, `selectedId`, `creature=` URL state and an existing creature inspector. The creature overlay is intentionally `pointer-events:none`; the base map owns drag/wheel/pointer interaction.

The base runtime currently handles no-drag `pointerup` as tile/map selection. Therefore direct creature interaction must explicitly arbitrate that activation or a click can select both a creature and the underlying tile.

The current creature renderer also publishes only a bounded diagnostic anchor sample; that diagnostic sample is not a complete interaction index and must not be promoted into one.

## 3. Authority and identity

Oteryn-Game owns creature/NPC identity, placement, floor, role semantics, appearance/presentation facts and any exported spawn-area facts. Atlas owns derived screen geometry, interaction indexes, transient card state and presentation.

`record_id` identifies the concrete exported placement/spawn record and remains the canonical `creature=` selection/deep-link identity. `entity_id`, when present, identifies the reusable creature/NPC entity. The implementation must never collapse one identity into the other.

A monster placement is not proof that a monster is alive there now. User-facing copy should use `Monster spawn`, `verified placement` or equivalent wording and must not imply live occupancy/capacity.

Atlas must not invent or infer HP, XP, XP/hour, profit/hour, loot, difficulty, attacks, weaknesses, NPC services, travel destinations, quests or live spawn state.

## 4. Architecture decision

Use a hybrid architecture:

- retain Canvas rendering for creatures;
- derive one canonical committed CSS-pixel presentation geometry seam;
- build a bounded screen-space interaction index for only the actually drawn visible creatures;
- arbitrate map click activation through one cancelable map event;
- render exactly one reusable DOM quick card;
- preserve existing durable selection/deep-link semantics.

Do not use DOM-per-creature overlays or an all-Canvas card.

## 5. Canonical creature presentation geometry

Create or reuse one pure presentation-geometry helper. It receives already validated renderer inputs and returns immutable CSS-pixel presentation data.

It must account for:

- factual world anchor and floor;
- committed renderer/view transform;
- map-frame CSS viewport;
- actual rendered creature bitmap width/height when pixel presentation is used;
- Game-owned displacement from the active presentation program;
- deterministic marker fallback bounds;
- viewport clipping;
- CSS-pixel coordinates independent of Canvas backing-store DPR.

Recommended output includes:

- `anchor`;
- `presentationRect`;
- `visibleRect`;
- `presentationKind`;
- `geometryKey`.

The helper must not read DOM, `devicePixelRatio`, network data or Game sources directly.

This seam is shared with #115 labels/badges/diagnostics. If #115 implementation has landed with an equivalent helper, #113 must reuse it rather than create a competing geometry path.

Raw `tileX/tileY` is not the full clickable footprint.

## 6. Interaction target model

Build interaction targets only from the committed actually drawn creature set. Each private target contains only interaction geometry/state, for example:

- `recordId`;
- optional `entityId`;
- kind;
- factual floor/world anchor;
- base and creature render generations;
- draw order;
- `anchorRect` / `presentationRect`;
- bounded `hitRects`;
- optional assist rect for touch;
- geometry key.

A factual record remains sourced from the already validated visible creature records. Presentation rectangles are never persisted as world authority.

Targets for hidden layers, filtered NPCs, wrong floors or undrawn/off-viewport records must not remain clickable.

## 7. Screen-space bucket index

Do not linearly scan every visible creature on every pointer move. Build a fixed-size CSS-pixel bucket/grid index after a committed geometry/layout change.

Hover queries are rAF-throttled and examine only the relevant bucket(s). Retain no unbounded history of target snapshots.

Direct hits on real visible geometry always outrank touch-assist/slop hits. Touch assist may be considered only when no direct hit exists.

Overlap ordering is deterministic:

1. topmost committed draw order;
2. pointer-to-anchor/rect distance;
3. stable `recordId` tie-breaker.

If multiple materially overlapping direct hits remain, open a bounded chooser. Never select based on JS object iteration or timing.

## 8. Cancelable map-activation arbitration

Preserve ownership of pointerdown/move/up, drag and wheel in `fullworld-app.mjs`.

Refactor only the no-drag activation branch so the map runtime synchronously dispatches a cancelable `oteryn-atlas-map-activate` event containing at least:

- map-frame CSS `x/y`;
- world `x/y`;
- floor;
- pointer type;
- current committed renderer generation;
- current view snapshot.

Creature interaction calls `preventDefault()` only when the latest same-generation interaction index contains a valid hit. When canceled, underlying tile selection does not run. Without a valid creature hit, existing map/tile click behavior remains unchanged.

Dragging never activates a creature card.

## 9. Durable selection vs transient card state

Keep existing `state.selectedId` / URL `creature=` as durable selection.

Add a separate transient card state machine with explicit states such as:

- `closed`;
- `chooser`;
- `record`;
- `suspended`.

Escape, explicit close or outside activation closes the card without silently clearing durable creature selection or inspector state.

Pan, zoom, resize or renderer replacement may suspend a card until matching fresh geometry for the same selected record returns. Floor/layer/filter invalidation closes it when the record is no longer a valid target.

An overlap chooser is invalidated if its committed interaction generation changes before a choice is made.

## 10. Quick-card UX

Add exactly one reusable DOM element inside the map frame.

Primary card content is concise and factual:

- full factual name;
- `NPC` or `Monster spawn`;
- X/Y/F position;
- resolved NPC role labels when available;
- verified spawn radius when present;
- explicit ambiguity/unresolved warning only when materially relevant.

Keep record ID, semantic digest, authority provenance and detailed presentation state in the existing inspector/details surface rather than cluttering the primary card.

V1 actions are only:

- **Details** — synchronize/focus the existing creature inspector;
- **Copy link** — share the canonical current URL after `creature=` selection is persisted;
- close.

`Center`, routing, all-spawns navigation, bestiary and hunt analytics are explicitly out of V1.

## 11. Copy-link behavior

Clipboard success must be truthful.

After canonical URL state is current, attempt `navigator.clipboard.writeText(location.href)`. If unavailable or rejected, reveal a readonly canonical URL fallback and announce that manual copying is required. Never display false `Copied` success.

The feature guarantees canonical URL + reload/deep-link restoration. It does not introduce a new application-wide `popstate` history router as part of #113.

## 12. Mobile and accessibility

Desktop hover is supplementary only and never mutates durable selection.

Keyboard-only users retain the existing Creature search/inspector path. Do not create thousands of invisible focusable proxies for Canvas creatures.

Touch uses the same no-drag activation arbitration as mouse. The card may use a compact bottom/anchored sheet on mobile, but it must remain below existing drawer z-order and must not make essential zoom/floor/map controls unreachable.

`Details` should coordinate with the existing mobile inspector through a small internal event (for example `oteryn-atlas-open-inspector`) rather than calling private drawer functions directly.

Escape closes only the topmost active surface. If the mobile inspector drawer is open over the card, the first Escape closes the drawer rather than simultaneously dismissing the underlying card.

The quick card requires an accessible name, logical reading/action order, visible focus and explicit close control.

## 13. Reserved rectangles and #115 compatibility

Card placement must avoid visible runtime/detail badges, cursor/status surfaces and essential controls.

If #115 product code has landed, consume its canonical presentation/label/badge geometry and feed the final card rectangle into its `reservedRects`/occupancy seam so labels do not render underneath the card.

If #115 remains unimplemented, expose only the minimal stable geometry seam needed for later reuse. Do not create independent label click handlers or duplicate hover/selection state.

## 14. Animation geometry

Interaction geometry must match visible pixels/marker presentation.

Before product mutation, refresh #112 and the current animation-program contract. If all published creature phases are proven geometry-invariant, bind target geometry to that invariant and test it. If phase bitmap/displacement geometry can change, recompute only affected target geometry when its `geometryKey` changes; do not rebuild the whole interaction index on every logical animation tick.

No stale phase rectangle may remain clickable after visible geometry changes.

## 15. Diagnostics

Extend truthful read-only diagnostics only as needed. Recommended fields:

- `interactionVersion: creature-interaction-v1`;
- committed target count;
- base and creature render generations;
- hovered record ID or null;
- selected record ID or null;
- card state;
- selected/card target CSS rect when present;
- bucket count/cell size.

Diagnostics are bounded evidence. They expose no setters, fake records, privileged loaders or alternate transforms.

## 16. Performance constraints

- interaction targets only for the bounded visible drawn set;
- no DOM-per-creature;
- no world-wide scan on pointer movement;
- rebuild/update bucket index only on committed geometry changes;
- rAF-throttled hover;
- bounded target snapshot lifetime;
- immediate invalidation on floor/layer/filter changes;
- preserve existing creature/cache/render bounds.

Dense-scene behavior must be measured in real Chromium.

## 17. Verification design

### Deterministic Node tests

Cover:

- pixel/bitmap/displacement-aware presentation bounds;
- marker fallback bounds;
- CSS-pixel DPR independence;
- viewport clipping/wrong-floor rejection;
- rectangle edge inclusion/miss behavior;
- direct-before-touch-assist priority;
- deterministic overlap ordering;
- bucket membership/query;
- malformed/stale-generation rejection;
- `closed|chooser|record|suspended` transitions;
- chooser invalidation;
- floor/layer/filter target invalidation;
- card viewport clamping/reserved-rect avoidance;
- copy-link fallback state;
- diagnostics compatibility.

Use independent reference calculations for expected geometry where practical.

### Real Chromium acceptance

Desktop and mobile tests must prove:

- direct NPC click;
- direct monster click;
- no simultaneous underlying tile selection;
- hover affordance;
- truthful card fields;
- overlap chooser when a real overlap exists;
- Details -> inspector synchronization;
- Copy link success/fallback;
- Escape/outside dismissal;
- pan/zoom/resize fresh re-anchoring;
- floor/layer/filter invalidation;
- reload/deep-link restoration;
- mobile tap/readability/topmost Escape behavior;
- essential controls remain reachable;
- dense-scene boundedness;
- no runtime/page/console failures.

For overlap E2E, use a real current Game-derived overlapping placement if one exists. If none exists, document that factual absence and rely on deterministic overlap-unit coverage rather than fabricating production data.

### Geometry synchronization

Browser assertions must connect the clicked screen point, interaction target and factual world anchor to the same committed renderer generation and detect stale hitboxes after pan/zoom/resize/floor changes.

### Visual-user acceptance

Use the current #111/#118/#85 contract at final-head time. If merged, generate required exact-revision user-facing evidence and actually review every required screenshot before publishing local E2E success. Do not use screenshot presence alone as proof.

## 18. Lifecycle and sequencing

Planning base records #116 as merged. At implementation time refresh all dependencies.

If #112 remains open and still overlaps creature runtime files, do not implement against stale overlapping code; wait for/rebase after its merge unless ownership is explicitly transferred.

#118 may merge during implementation. Rebase before final qualification and obey the current visual-user acceptance gate.

Implementation must start on a fresh implementation branch from current `main`, not this planning branch.

## 19. Non-goals

- no Game export/schema changes merely to enrich the card;
- no HP/XP/loot/profit/difficulty facts;
- no live spawn state;
- no bestiary;
- no route planner;
- no Hunt Intelligence/Farm Explorer implementation;
- no new application-wide history router;
- no DOM-per-creature;
- no copied proprietary icon/sprite assets;
- no second creature selection/deep-link model.

## 20. Definition of Done

The feature is complete only when every currently rendered NPC/monster placement can be selected from its actual fresh committed screen geometry on desktop and mobile; map click arbitration prevents double tile selection; overlap resolution is deterministic; one concise truthful card is synchronized with existing durable selection/inspector state; stale geometry cannot select a creature; mobile/accessibility behavior is coherent; shared #115 geometry boundaries are respected; and all applicable deterministic, geometry, exact-head Docker Playwright, visual-user, `atlas-gate` and `provenance-gate` requirements pass on the exact final implementation head before squash merge.

Live deployment remains a separate authority boundary: only merged `main` may be deployed, and only when explicit live-deployment authority exists at execution time.