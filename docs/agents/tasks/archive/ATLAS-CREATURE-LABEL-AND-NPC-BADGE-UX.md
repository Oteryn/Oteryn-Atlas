# ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX

Issue: #115  
Parent programme: #11  
Verification policy: #85  
Canonical shipped NPC baseline: #64 / merged PR #83  
Related interaction work: #113  
Visual acceptance programme: #111  
Planning base: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`

## Objective

Replace the current raw creature-name presentation with a polished, deterministic, mode-aware label system and upgrade NPC functional markers into a compact multi-role badge system. Preserve Oteryn-Game as the sole authority for creature identity, location and NPC role semantics.

This is an Atlas presentation/runtime change. It must not introduce new Game-owned facts, role inference, combat metadata, loot/profit data, or a second creature authority.

## Verified shipped baseline

The implementation must refresh these facts at execution time, but the planning baseline was verified on Atlas `main@db5de3938ef815fb467dd2ad911a1ed92b13dccf`:

- `web/fullworld-creatures.mjs` draws creature names directly with `fillText(record.name, ...)`.
- NPCs already receive Canvas functional icons through `drawNpcIcon(...)`.
- `src/browser/npc-markers.mjs` exposes the closed Game-owned role vocabulary `bank`, `travel`, `shop`, `quest`, `blessing`, `trainer` plus presentation-only `other` fallback.
- Current NPC role/filter behavior was shipped by Issue #64 / merged PR #83. Issue #61 is historical/overlapping planning context and must not be treated as the canonical shipped baseline.
- `npcRoleGlyph(record, selectedFilter)` intentionally favors the selected factual filter role when applicable; the redesign must preserve that user-visible semantic cue rather than collapsing back to a fixed first role.
- Creature records can carry multiple ordered factual roles.
- Current creature Canvas already uses DPR-aware backing dimensions and scales drawing back into CSS-pixel geometry; the redesign must preserve and verify this contract rather than introduce a second independent DPR transform.
- Current FullWorld view modes include `auto`, `minimap`, `classic`, and `map`; label LOD must account for the effective presentation mode, not zoom alone.
- URL `creature=` selection already exists through `state.selectedId`; selected-label promotion can use this state even if #113 has not merged.
- Existing creature rendering is bounded to visible creature shards; this design keeps that bounded architecture.

Planning evidence from the committed Game-derived creature catalog includes:

- Albinius: `npc:994e4a2decd5f718ccbc37c1d94bbbeb`, factual roles `shop`, `quest`.
- Eremo: `npc:d6f7fbe1e22b73f3b04a708fd0a219a5`, factual roles `travel`, `shop`, `quest`, `blessing`, `trainer`.

These are useful real-data acceptance anchors, but the implementation agent must revalidate them against the refreshed exact-head publication before relying on them.

## Architecture decisions

### 1. One canonical creature presentation geometry seam

Do not anchor labels, badges and future hit testing independently to raw `tileX/tileY`.

Introduce or reuse one pure presentation-geometry helper that returns CSS-pixel bounds for the committed creature presentation. It must account for:

- factual world anchor and committed renderer transform;
- rendered bitmap width/height when pixel presentation is available;
- Game-owned displacement applied by the creature frame program;
- deterministic marker bounds for factual fallback presentation;
- viewport clipping and CSS-pixel coordinates independent of backing-store DPR.

The same geometry seam must be consumable by:

- label placement;
- NPC badge placement;
- renderer diagnostics;
- #113 hit testing/quick-card anchoring when that work is available.

World coordinates and sprite anchors are factual inputs. Label/badge rectangles are presentation outputs and must never be written back as world authority.

### 2. Separate label-layout lifetime from animation-frame lifetime

The creature animation loop must not re-run text measurement and collision solving merely because logical animation time advanced.

Preferred architecture:

- keep the existing creature sprite/marker Canvas for animated/static creature presentation;
- add a separate `pointer-events:none` Canvas above it for labels and NPC badges; or
- if #113 lands first with a canonical composed overlay pipeline, reuse that pipeline instead of creating a competing layer.

Whichever implementation is chosen, label layout must be cached/recomputed only when a layout dependency changes, such as:

- committed camera transform or viewport dimensions;
- visible creature identity set;
- NPC filter/role presentation;
- effective FullWorld presentation mode or LOD;
- selected/hovered state;
- reserved HUD/card rectangles;
- resolved font/text metrics key.

Logical animation time alone must not invalidate label geometry.

### 3. Dedicated creature labels

Replace direct raw `fillText(record.name, ...)` with one shared Canvas label renderer.

Label anatomy:

- compact translucent high-contrast background behind text;
- restrained 1 CSS-pixel border/outline and shadow;
- compact horizontal/vertical padding;
- deterministic placement relative to canonical creature presentation bounds;
- NPC and monster variants share one visual language with subtle type accents;
- no huge opaque panels;
- no DOM node per creature.

NPC treatment:

- neutral dark background;
- white/off-white primary text;
- restrained gold/teal edge or marker accent.

Monster treatment:

- same base visual language;
- subtle burgundy/red danger accent only;
- no fabricated difficulty, HP or threat classification.

### 4. Long-name and viewport policy

Labels must be bounded.

- define named maximum-width constants by LOD/mode rather than unlimited text width;
- truncate visually with deterministic ellipsis when required;
- keep the full factual name in search/inspector and #113 quick card when available;
- keep accepted label rectangles inside the visible map-frame bounds apart from a small documented edge tolerance;
- do not alter the underlying factual name to make presentation fit.

Exact width constants must be tuned from real-browser evidence and then frozen/tested.

### 5. Deterministic font and text metrics

Use one explicit Canvas font contract aligned with the Atlas UI typography rather than an incidental `12px sans-serif` default.

- derive/define the font specification in one place;
- layout and draw must use the same font specification;
- deterministic unit tests must inject/stub a stable text-metrics oracle instead of treating host font rasterization as the only expected-value oracle;
- browser visual acceptance still validates the real pinned Chromium rendering.

### 6. Pixel-grid NPC role badges

Replace the visually heavy `functional-icons-v1` single marker with `functional-icons-v2` compact original Oteryn badges.

Canonical visual meanings remain presentation-only mappings of factual roles:

- `bank` -> coin / stacked-coin primitive;
- `travel` -> compass / directional primitive;
- `shop` -> bag / pouch primitive;
- `quest` -> scroll / exclamation primitive;
- `blessing` -> star / halo primitive;
- `trainer` -> book / training primitive;
- `other` -> neutral NPC primitive only when factual role metadata resolves to no supported role.

Icon rules:

- never use browser emoji;
- never copy Tibia/CipSoft proprietary icon art;
- draw from repository-owned primitives/assets only;
- prefer integer-grid pixel primitives (`fillRect` / small offscreen pixel grid + nearest-neighbor scaling) rather than anti-aliased arcs as the final icon language;
- keep badges visually subordinate to the creature sprite.

### 7. Truthful multi-role presentation

Preserve the canonical role order from `npc-markers.mjs`.

Base rule:

- 0 supported roles -> neutral `other` presentation;
- 1-3 roles -> show all factual roles in canonical order;
- more than 3 roles -> show at most 3 badge slots, normally first 2 factual roles plus `+N` overflow.

Selected-filter visibility rule:

- filtering never rewrites the canonical role list;
- when a factual `npcRole` filter is active and that role belongs to the NPC, the active role must remain explicitly visible among the bounded badge slots;
- if the active role would otherwise be hidden by overflow, deterministically show the first canonical role, the active filtered role, then `+N` for the remaining hidden roles;
- the overflow count must equal the number of factual roles actually hidden from the row.

This preserves the useful semantic behavior of the existing `npcRoleGlyph(record, selectedFilter)` while expanding from one icon to a truthful multi-role row.

### 8. Mode-aware zoom / LOD

Do not use zoom-only presentation rules.

Implement named helpers that classify label/badge presentation from:

- effective FullWorld presentation mode;
- zoom;
- selection/hover promotion state;
- available map space where relevant.

Required intent:

- forced `minimap`: extremely sparse creature annotation; ordinary full labels suppressed;
- forced `classic`: treat as minimap-style sparse annotation because it is a presentation variant of the minimap surface;
- `map`: enable normal far/medium/close label LOD;
- `auto`: follow the product's actual effective minimap/detail decision instead of duplicating a second independent AUTO threshold;
- technical overview must not become a wall of creature labels;
- selected creature may receive a bounded label promotion using existing `creature=` state;
- hovered creature may receive bounded promotion when #113 supplies canonical hover state.

If the runtime does not currently expose the effective AUTO presentation decision, add a truthful read-only presentation signal derived from the existing canonical LOD policy. Do not hard-code a competing AUTO threshold in the creature module.

Exact thresholds/constants must be tuned in real Chromium and then pinned by deterministic tests.

### 9. Collision and reserved rectangles

Introduce one deterministic screen-space occupancy pass for visible labels/badge rows.

Priority order:

1. selected creature;
2. hovered creature;
3. NPC label;
4. monster label;
5. secondary badge information.

Rules:

- creature sprites/world anchors are never moved to solve UI overlap;
- labels choose from a small deterministic list of candidate anchors around canonical presentation bounds;
- lower-priority labels are suppressed if no acceptable anchor exists;
- accepted label/badge rectangles must avoid other accepted higher-priority rectangles;
- the pass must also accept `reservedRects` for visible map HUD/card surfaces such as runtime/detail badges, cursor coordinates and #113 contextual cards when present;
- collision state is rebuilt only when layout dependencies change and is not persisted as authority;
- complexity must remain bounded to the visible creature set, preferably O(n) with spatial buckets or O(n log n), not whole-world work.

### 10. DPR contract

Preserve the existing CSS-pixel geometry model.

- backing Canvas dimensions may scale with DPR;
- layout rectangles, collision, hit-test geometry and diagnostics remain in CSS pixels;
- 1 CSS-pixel lines must remain visually correct after DPR scaling;
- test DPR 1 and DPR 2 explicitly;
- do not apply DPR twice.

### 11. Diagnostics and compatibility

Version the presentation diagnostics rather than silently changing existing meanings.

Add/extend truthful read-only diagnostics for:

- `labelStyle = creature-labels-v1` or equivalent versioned identifier;
- `npcMarkerStyle = functional-icons-v2`;
- labels considered/drawn/suppressed;
- NPC badge rectangles and `drawnNpcBadges`;
- effective label LOD/mode;
- label-layout generation/key;
- committed transform linkage;
- CSS-pixel creature presentation bounds needed for geometry verification.

Preserve the existing `drawnNpcIcons` field during migration with a documented compatibility meaning (for example, NPC records that rendered at least one badge) until all dependent tests/consumers are migrated. Do not silently redefine it as total badge count.

No diagnostic may mutate product state or inject fake authority.

### 12. Interaction compatibility with #113

Issue #113 owns direct click/tap, hit testing, hover and contextual creature cards.

This task must not create a competing interaction model.

- use existing `state.selectedId` / URL `creature=` for selected-label promotion now;
- if #113 lands first, consume its canonical hover/selection state and committed presentation/hit-target structures;
- if #113 is still active but unmerged, keep #115 presentation-only and expose/reuse the common presentation-bounds seam so #113 can integrate cleanly;
- do not add separate label click handlers, a second selected-creature state, or separate deep-link semantics;
- badge icons are not independent interactive facts; textual role information remains available through search/inspector and later the #113 card.

## Proposed code structure

Likely primary changes:

- `web/fullworld-creatures.mjs` — integrate composed creature presentation, versioned diagnostics and mode/selection state;
- `src/browser/npc-markers.mjs` — expose presentation-safe ordered role descriptors/badge selection helpers without changing Game semantics;
- new pure module such as `src/browser/creature-presentation-layout.mjs` — presentation bounds, LOD, text bounds, overflow, candidate anchors, collision and reserved-rect logic;
- optional dedicated Canvas renderer module for label/badge primitives if keeping `fullworld-creatures.mjs` bounded/readable;
- `tests/npc-markers.mjs` — canonical ordering, active-filter visibility, overflow behavior;
- new deterministic layout tests;
- `e2e/tests/creatures-desktop.spec.mjs` plus applicable mobile/visual-user acceptance specs.

Do not add CSS/DOM-per-creature presentation merely to make testing easier.

## Implementation phases

### Phase A — preflight and overlap reconciliation

- refresh Atlas `main` and exact Issue/PR state;
- treat #64 / PR #83 as shipped NPC baseline;
- inspect #113 branch/PR state and adapt to any merged canonical interaction seam;
- inspect #111/#85 current visual/evidence infrastructure;
- revalidate factual acceptance anchors from the exact current Game-derived publication.

### Phase B — TDD presentation model

Add failing deterministic tests first for:

- canonical CSS-pixel creature presentation bounds for pixel and marker fallback;
- LOD classification across `map`, `minimap`, `classic`, and effective `auto` states;
- selected promotion and #113 hover promotion when available;
- canonical role ordering;
- 1/2/3 role rows;
- >3 overflow row;
- active-filter role forced visible under overflow;
- exact hidden-role overflow count;
- unknown/ambiguous role fallback;
- deterministic long-name ellipsis/bounds;
- deterministic alternate anchors;
- collision priority/suppression;
- reserved HUD/card rectangle avoidance;
- DPR 1/2 geometry invariants;
- layout-cache invalidation dependencies;
- animation logical-time changes do not cause label-layout recomputation.

### Phase C — renderer and icon implementation

Implement:

- canonical creature presentation-bounds seam;
- dedicated rounded label primitive;
- explicit font contract;
- NPC/monster accent styles;
- pixel-grid original role badge primitives;
- truthful multi-role row/overflow;
- mode-aware LOD;
- bounded collision/reserved-rect handling;
- label layout cache or dedicated label Canvas;
- versioned read-only diagnostics.

### Phase D — runtime integration

Verify integration with:

- animation on/off;
- pixel sprite vs factual marker fallback;
- NPC category filters and active-filter badge emphasis/visibility;
- map/minimap/classic/auto mode transitions;
- zoom/pan/floor transitions;
- selected `creature=` deep link and reload;
- #113 hover/card/hit-test state if merged;
- mobile drawers/map HUD without occlusion.

### Phase E — visual tuning and acceptance

Use real pinned Chromium against production-derived data. Do not fabricate Game facts.

At minimum review screenshots/probes for:

- Albinius or another revalidated two-role NPC;
- Eremo or another revalidated >3-role NPC to prove overflow;
- active filter where the selected role would otherwise be hidden by overflow;
- mixed NPC + monster scene;
- several nearby NPCs;
- dense monster scene;
- real long creature/NPC name near a viewport edge;
- `map` far/medium/close zoom;
- forced `minimap`;
- forced `classic`;
- `auto` on both sides of its effective presentation transition;
- technical overview behavior;
- selection promotion;
- #113 hover/card coexistence if available;
- animation on/off while label-layout generation remains stable when no layout dependency changes;
- DPR 1 and DPR 2;
- desktop and mobile viewports.

Tune only presentation constants. Never move factual creatures or rewrite roles to improve screenshots.

## Required verification

- targeted `node:test` unit/contract tests pass;
- existing creature/NPC role/index tests pass;
- deterministic presentation geometry/collision/cache tests pass;
- applicable full repository deterministic suite passes;
- full required Docker Playwright Chromium PR gate runs on Molehill-PC with retries disabled under #85 policy;
- visual-user acceptance artifacts under #111/#85 are generated and actually reviewed, not just produced;
- no console/page/runtime errors;
- creature animation remains functional;
- animation playback does not trigger unnecessary label-layout recomputation;
- URL/deep-link/filter behavior remains unchanged except intentional presentation version diagnostics;
- exact-final-head `atlas-gate` and `provenance-gate` pass before merge;
- complete changed-file set and full final diff are reviewed on the exact PR head.

Live deployment is not automatically authorized by this design task. If explicitly authorized under repository policy, deploy only the exact merged `main` revision and perform merged-main live acceptance on Synology.

## Non-goals

- no new NPC role inference or role vocabulary;
- no monster HP/XP/loot/difficulty/profit information;
- no replacement of the creature Canvas architecture with DOM-per-creature markers;
- no duplicate creature selection/deep-link model;
- no redesign of the entire FullWorld UI;
- no copied proprietary artwork;
- no fake runtime creature data created to make screenshots/tests easy;
- no second AUTO/minimap threshold owned by the creature module.

## Definition of Done

The task is complete only when a real user can view NPCs and monsters in dense FullWorld scenes and:

- names remain readable and bounded without dominating the map;
- factual multi-role NPC functions are represented truthfully, including selected-filter visibility and overflow;
- role icons are compact original Oteryn pixel-grid primitives;
- labels remain aligned to the real rendered creature presentation rather than raw tile assumptions;
- map/minimap/classic/auto modes degrade detail intentionally;
- labels avoid each other, viewport edges and reserved map HUD/card regions;
- DPR 1/2 behavior is correct;
- animation does not cause avoidable layout churn;
- existing selection/deep-link/filter/inspector behavior remains intact;
- #113 can reuse the same geometry seam rather than duplicate it;
- deterministic and real-browser tests pass on the exact final head;
- required CI/review is green and the implementation is squash-merged through the protected lifecycle.