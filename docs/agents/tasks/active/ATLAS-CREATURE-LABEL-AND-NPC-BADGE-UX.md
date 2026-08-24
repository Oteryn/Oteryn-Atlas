# ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX

Issue: #115  
Parent programme: #11  
Verification policy: #85  
Related UI work: #61, #113  
Base: `db5de3938ef815fb467dd2ad911a1ed92b13dccf`

## Objective

Replace the current raw creature-name presentation with a polished, deterministic, scale-aware label system and upgrade NPC functional markers into a compact multi-role badge system. Preserve Oteryn-Game as the sole authority for creature identity, location and NPC roles.

## Verified current state

- `web/fullworld-creatures.mjs` renders creature names directly on the canvas with `fillText(record.name, ...)`.
- NPCs already receive a canvas marker through `drawNpcIcon(...)`.
- `src/browser/npc-markers.mjs` exposes authoritative roles: `bank`, `travel`, `shop`, `quest`, `blessing`, `trainer`.
- NPC records may contain multiple roles, but the current presentation path reduces them to one selected glyph.
- Existing creature drawing is canvas-based and bounded to visible creature shards; this design keeps that architecture.

## UX design

### 1. Creature labels

Create one shared canvas label renderer for NPCs and monsters instead of direct raw `fillText` calls.

Label anatomy:
- short high-contrast translucent background behind text;
- 1 px outline/border with a restrained shadow;
- compact horizontal/vertical padding;
- text centered or consistently anchored relative to the creature presentation bounds;
- geometry calculated in CSS pixels and rendered correctly under device pixel ratio scaling;
- no DOM node per creature.

NPC label treatment:
- neutral dark background;
- white/off-white primary text;
- restrained gold/teal accent only as a small edge or marker, not a fully saturated panel.

Monster label treatment:
- same base visual language;
- subtle red/burgundy danger accent, not a large red block;
- no fabricated combat data or difficulty coloring.

### 2. NPC role badges

Replace the visually heavy single marker with compact original Oteryn canvas primitives.

Canonical visual meanings:
- `bank` -> coin / stacked coin primitive;
- `travel` -> compass / directional primitive;
- `shop` -> bag / pouch primitive;
- `quest` -> scroll / exclamation primitive;
- `blessing` -> star / halo primitive;
- `trainer` -> book / crossed-training primitive;
- `other` -> neutral NPC primitive.

Rules:
- never use browser emoji;
- never copy Tibia/CipSoft proprietary icon artwork;
- draw icons from simple canvas primitives or repository-owned SVG/pixel assets;
- preserve canonical role ordering from `npc-markers.mjs`;
- show up to 3 role badges for one NPC;
- if more than 3 roles are present, show the first 2 plus a compact `+N` overflow badge;
- filter selection must not rewrite the NPC's canonical role list.

### 3. Zoom / LOD

Use deterministic presentation levels, implemented as named helpers rather than scattered numeric conditions.

Recommended behavior:
- far zoom: creature sprite/marker only; no name labels; at most one compact NPC role marker;
- medium zoom: NPC names and one role badge may appear; monster names only when sufficient map space exists;
- close zoom: full NPC name plus multi-role badge row; monster name visible;
- selected/hovered creature may temporarily promote one LOD level when #113 interaction state is available, but must remain bounded.

Exact thresholds should be tuned using real-browser evidence rather than guessed from the screenshot alone.

### 4. Collision policy

Introduce a deterministic screen-space occupancy pass for labels and badge rows.

Priority order:
1. selected creature;
2. hovered creature;
3. NPC label;
4. monster label;
5. secondary role badges.

Rules:
- the creature sprite itself is never moved;
- labels may choose from a small deterministic set of anchor positions above/side of the creature;
- if no anchor is available without unacceptable overlap, lower-priority labels are suppressed;
- collision state is rebuilt per committed render frame and is not persisted as authority;
- bounded O(n) or O(n log n) behavior for the visible creature set only.

### 5. Relationship to creature click cards (#113)

This work must not create a competing interaction model.

Integration contract:
- keep rendered creature screen bounds available for #113 hit testing;
- keep label/badge bounds separate from factual creature world coordinates;
- visual hover/selection styling may consume #113 state when present;
- no label click handler or duplicate selection state is introduced here unless #113 has already established the canonical API;
- if #113 lands first, rebase and adapt to its committed render snapshot/hit-target structures instead of duplicating them.

## Proposed code structure

Primary changes:
- `web/fullworld-creatures.mjs` — replace direct name/marker drawing with composed label/badge rendering;
- `src/browser/npc-markers.mjs` — expose presentation-safe ordered role descriptors where useful, without changing authoritative semantics;
- optional new `src/browser/creature-label-layout.mjs` — pure LOD, geometry, collision and overflow helpers;
- `tests/npc-markers.mjs` — multi-role/ordering/overflow behavior;
- new deterministic unit tests for label layout/collision;
- `e2e/**` — real Chromium desktop/mobile visual-user acceptance for dense NPC/monster scenes.

Avoid adding CSS/DOM presentation unless a concrete accessibility need cannot be served through the existing inspector and #113 interaction layer.

## Implementation phases

### Phase A — TDD presentation model

Add pure helpers and failing tests for:
- LOD classification;
- multi-role badge selection;
- overflow badge computation;
- deterministic label bounds;
- collision resolution and priority;
- malformed/unknown presentation input failing closed.

### Phase B — Canvas renderer

Implement:
- shared rounded label primitive;
- NPC/monster accent styles;
- original role badge primitives;
- DPR-safe line widths/text placement;
- deterministic placement around real creature render anchors.

### Phase C — Runtime integration

Integrate with:
- animation on/off;
- pixel sprite vs factual marker fallback;
- NPC category filters;
- zoom/pan/floor transitions;
- existing render diagnostics;
- #113 selection/hover APIs if already merged.

### Phase D — visual tuning and acceptance

Use real Chromium screenshots on representative scenes with:
- at least two nearby NPCs;
- one multi-role NPC;
- mixed NPC + monster view;
- dense creature view;
- desktop and mobile viewport;
- at least three zoom levels.

Tune only presentation constants; do not alter factual placement to make screenshots cleaner.

## Required verification

- targeted `node:test` unit/contract tests pass;
- existing creature/NPC tests pass;
- deterministic geometry/collision tests pass;
- real Chromium Playwright validates label readability, non-overlap policy, LOD transitions and mobile behavior;
- applicable #85 visual-user acceptance artifacts are generated and actually reviewed;
- no console/page/runtime errors;
- creature animation remains functional;
- URL/deep-link/filter behavior remains unchanged;
- exact-head `atlas-gate` and `provenance-gate` pass before merge;
- full final diff is reviewed on the exact PR head.

## Non-goals

- no new NPC role inference;
- no monster HP/XP/loot/difficulty information;
- no replacement of the creature canvas with DOM-per-creature markers;
- no redesign of the whole FullWorld map UI;
- no copied proprietary artwork;
- no fake data created for visual tests.

## Definition of Done

The task is complete only when a real user can view NPCs and monsters in dense FullWorld scenes and the names/role markers remain visually readable, semantically truthful, stable across zoom/pan/floor changes, mobile-safe, covered by deterministic and real-browser tests, and merged through the normal protected PR lifecycle.