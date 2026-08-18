# DYN-ATLAS-001 — target GUI and runtime contract

Status: OWNER-ACCEPTED TARGET DIRECTION for the new `Oteryn/Oteryn-Atlas`.

This document records the agreed presentation/runtime direction for the **new semantic Atlas**. It MUST NOT be implemented by reviving the legacy heavy raster/full-map viewer from `blakinio/Otheryn`. The old project is reference evidence only.

## Product shape

The end-user experience is a dark, map-dominant desktop/web application with the real semantic map rendered in the central WebGL viewport. The target visual composition is:

- top application bar: `OTERYN ATLAS`, current X/Y/floor controls, copy/deep-link, global search;
- left panel: collapsible semantic layer controls and floor/render controls;
- center: dominant interactive WebGL map with pan, zoom, selection, measurement/waypoint affordances and current-coordinate cursor feedback;
- right panel: contextual Tile/Entity inspector with tabs for factual properties and provenance;
- optional bottom diagnostics panel for developer/runtime evidence;
- compact minimap/navigation overview when a real semantic source for it exists.

The interface should feel like a modern professional world-atlas/debugger rather than an engineering wireframe. The map remains the primary surface; panels must not overwhelm it.

## Data/runtime architecture

The target path remains:

```text
Oteryn-Game canonical World/Content authority
  -> immutable semantic export
  -> Atlas semantic chunks / indexes
  -> content-addressed deduplicated pixel store
  -> WebGL2 browser renderer
  -> semantic overlays / search / inspector
```

Browser runtime MUST NOT parse OTBM, Legacy IR, Canary/Crystal world sources, Tibia asset metadata or old atlas rasters as fallback authority.

For the bounded DYN-ATLAS-001 proof the exact Game source remains:

- semantic artifact: `sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e`;
- `tiles.jsonl`: `ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984`;
- native bounds: `x=[32280,32441)`, `y=[32155,32306)`, `floor=-7`;
- 24,311 tiles / 39,282 presentation records / 39,282 resolved primitives;
- 990 semantic sprite source IDs, 987 unique dimension+RGBA pixel blobs.

The exact 15.32 rights gate is closed only for the recorded exact digest. Do not generalize authorization to another archive.

## GUI behavior

### Map

- Real map pixels are composed by the new Atlas renderer from Game-resolved primitives plus the authorized Atlas pixel publication.
- Pan and wheel/button zoom are smooth and preserve deterministic URL state.
- Clicking the map selects the factual semantic tile/entity under the pointer; no fake hit targets.
- Current X/Y/floor are always visible and copyable.
- Single-floor DYN-ATLAS-001 must not invent additional floors. The final product may expose the floor selector only when exported floor data exists.

### Semantic layers

The long-term GUI reserves semantic layers such as NPCs, monsters, teleports, houses/doors, AID/UID, towns/temples, waypoints, mechanics, quest/raid/POI categories and later programme-approved datasets.

However a control MUST be enabled only when a real Atlas/Game semantic dataset exists. Missing categories must be disabled or explicitly `UNKNOWN`/`NOT AVAILABLE IN THIS PROOF`; they must never be populated from name heuristics, pixels or legacy runtime fallbacks.

Layer data is separate from base-map pixels. Toggling a layer must not rebuild map imagery.

### Search

The final GUI should support coordinate search and factual semantic indexes. DYN-ATLAS-001 does not authorize inventing full-world NPC/monster/quest search if those indexes do not yet exist in the new Atlas architecture.

### Inspector

The right-side inspector has two conceptual levels:

1. product-facing factual information when present in semantic indexes;
2. developer/provenance view showing position, stack/order, appearance source ID, sprite source IDs, Game artifact/source profiles and content identities.

Unknown fields remain unknown. Never infer walkability, collision, quest state, boss status, names or mechanics from sprite appearance.

### Diagnostics

Diagnostics may show only measured values: renderer/backend, loaded chunks, visible primitives, draw calls, texture/pixel-store size, cache counts and measured frame timings when actually collected.

Do not display invented FPS, cache hit rate, memory usage or performance claims merely to match a mockup.

## Visual reference interpretation

The owner-approved concept shown in the conversation is a **visual/interaction target**, not a factual screenshot of completed functionality. Preserve its strong ideas:

- dark professional shell;
- left semantic-layer rail;
- large central map;
- top coordinates/search/navigation;
- right tile inspector/provenance;
- bottom diagnostics;
- high information density without obscuring the map.

Do not copy fake values from the concept image. The working application must derive every displayed factual value from real runtime state.

## Acceptance for the first integrated GUI proof

A correct first integrated proof must:

1. use only the new `Oteryn/Oteryn-Atlas` runtime boundary;
2. load the exact semantic Thais Z7 publication and authorized pixel store;
3. render real source pixels through WebGL2 (or an explicitly accepted equivalent GPU path), not a precomposed Thais screenshot;
4. retain pan, zoom, deterministic deep-link state and tile/stack inspector;
5. present the agreed dark map-dominant GUI shell;
6. show only supported controls as active;
7. fail closed if semantic/pixel identities do not verify;
8. contain no browser OTBM/Legacy IR fallback;
9. capture a real 1920x1080 screenshot from the running application as evidence;
10. clearly label the bounded Thais Z7 nature of DYN-ATLAS-001 rather than implying full-world completion.

## Synology/preview execution context

For authorized preview/deployment work, the Remote Desktop Commander user identity is `chagpt` and has access to Synology. Always revalidate the live session/device/runtime before mutation. Do not trust historic PIDs, stale containers, old hashes or old mounted paths. Do not expose or copy secrets into repository evidence.

A Synology preview is a delivery convenience only. It does not change Game/Atlas authority boundaries and it is not acceptance evidence by itself.