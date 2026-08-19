# Full-world semantic overview layer v0

Status: **PROVEN Atlas-derived layer; physical profile remains provisional**.

This contract defines the lightweight overview/minimap dataset produced by
`tools/fullworld-layers/build_overview.py` from a verified
`oteryn-atlas-fullworld-publication-v0` publication.

`Oteryn/Oteryn-Game` remains World/Content authority. The overview is an
`Oteryn/Oteryn-Atlas` derived read model and does not introduce, repair or infer
Game semantics.

## Authority boundary

The builder accepts only the verified full-world semantic publication. Before
emitting overview bytes it verifies the publication/semantic roots and every
source semantic chunk's byte count, SHA-256 identity, tile count and resolved
primitive count. Raw OTBM, Legacy IR, Canary/Crystal data, historical Atlas
raster chunks and sprite appearance are not layer inputs.

The source publication identity is pinned into `world.json`:

- Game revision;
- full-world publication root;
- semantic root;
- source fingerprint.

A source identity mismatch must fail closed.
The builder and source-linked verifier additionally require an externally trusted
expected full-world publication root. The browser data API requires callers to
pin both the expected overview `rootContentId` and expected source publication
root; a self-consistent manifest root alone is not an authority proof.

## Semantics

The layer records **semantic tile-presence density only**.

For a configured positive `cellSizeTiles` (current qualified build: `16`), a
published semantic tile at `(x, y, floor)` contributes to the absolute overview
cell `(floor, floor(x / cellSizeTiles), floor(y / cellSizeTiles))`.

Each cell contains only:

- `tiles`: number of source semantic tile records mapped to that cell;
- `resolvedPrimitives`: number of already-published resolved primitive
  references across those records.

These counts must not be interpreted as terrain, walkability or gameplay
semantics. In particular the layer explicitly claims:

- `walkability = NOT_CLAIMED`;
- `collision = NOT_CLAIMED`;
- `terrainClassification = NOT_CLAIMED`.

It also does not claim quest state, access legality, pathfinding, biome,
mechanics, danger, spawn density or live server state. Pixel/sprite appearance
is never used to assign meaning.

## Deterministic hierarchy

The physical v0 profile has three levels:

1. `world.json` — world-level root, source linkage, counts and floor index;
2. `floors/f<floor>.json` — floor root, source floor root/bounds and chunk index;
3. `chunks/*.overview.json` — canonical sparse overview cells for one source
   semantic logical address.

A source semantic logical address (`floor`, `region_x`, `region_y`) remains
separate from overview content identity. Each overview chunk records the exact
source semantic chunk `contentId` that it derives from.

Canonical JSON uses UTF-8, sorted object keys, compact separators and one final
newline. Chunk `contentId` is SHA-256 of exact canonical bytes. World/floor roots
use domain-separated SHA-256 over their canonical manifest cores:

- `OTERYN-ATLAS-OVERVIEW-WORLD-V0\0`;
- `OTERYN-ATLAS-OVERVIEW-FLOOR-V0\0`.

The serializer and cell size are not permanent Game semantics. A successor
profile may change either without changing source authority.

## Spatial/viewport query contract

Overview cells use absolute source coordinates, not chunk-relative coordinates.
`src/layers/overview.mjs` exposes `queryOverviewCells(chunk, tileBounds)`, which
returns cells whose tile-space cell rectangle intersects the requested
half-open tile bounds.

A GUI may load only the floor/chunks needed for its current viewport. The
browser shell remains owned by the full-world GUI runtime agent; this layer
module only exposes the verified data API.

## Fail-closed loader/verifier

`tools/fullworld-layers/verify_overview.py` and `src/layers/overview.mjs` reject
at minimum:

- non-canonical JSON;
- forged world/floor roots or trusted-root mismatches;
- unsafe paths;
- missing/corrupt chunk bytes or content identities;
- duplicate logical addresses;
- duplicate/unsorted cells;
- invalid counts;
- source publication/semantic/floor/chunk linkage mismatch;
- source/overview count reconciliation mismatch;
- any change that claims walkability, collision or terrain classification.

The Python verifier can additionally reconcile the complete overview against the
source full-world publication using `--source-publication`.

## Enabled-layer status

This contract proves only `minimap-overview`. It does not make any other
semantic overlay family available. Towns, temples, transitions, houses,
Action/Unique IDs, waypoints, mechanics, raids, quest areas, POIs, NPCs and
monster/spawn datasets remain governed by the Game-owned default-deny export
policy and stay disabled until explicitly allowlisted and emitted upstream.
