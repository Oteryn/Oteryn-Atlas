# ATLAS-SEMANTIC-LAYERS-AND-INDEXES — G4 hand-off

## Result

`PARTIAL_PROVEN` by authoritative availability:

- `minimap-overview`: `PROVEN / ENABLED`;
- 11 layer families: `BLOCKED` on missing Game public export capabilities;
- 3 layer families: `UNKNOWN` because canonical public semantics are not yet defined.

No blocked/unknown layer is implemented or enabled.

## Exact source

- Atlas base: `5f649bffb5b82d17679e55ca8c40eb0b0dcb30e4`;
- Game source pinned by G3: `f79fd3b5c239fa13810338f1380539c4eac67d7d`;
- full-world publication root:
  `sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f`;
- semantic root:
  `sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9`.

## GUI-consumable contract

- contract: `src/layers/overview-v0.md`;
- browser data API: `src/layers/overview.mjs`;
- world profile: `oteryn-atlas-overview-world-v0`;
- floor profile: `oteryn-atlas-overview-floor-v0`;
- chunk profile: `oteryn-atlas-overview-chunk-v0`;
- qualified cell size: 16 tiles;
- overview root:
  `sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db`.
- required trusted source publication root:
  `sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f`.

`loadOverviewWorld(...)` requires both roots as trusted expectations; the GUI must
not learn either trust anchor from the fetched overview manifest itself.

Full-world reconciliation: 16 floors, 1,197 chunks, 100,037 sparse overview
cells, 18,997,668 semantic tiles and 24,502,035 resolved primitives.

The GUI may use this layer for a truthful overview/minimap and viewport density
index. It must not interpret the layer as walkability, collision, terrain,
quest/mechanics or live-state data.

## Evidence

- `docs/evidence/fullworld-layers/AUTHORITY-AUDIT.md`;
- `docs/evidence/fullworld-layers/layer-authority-registry.json`;
- `docs/evidence/fullworld-layers/overview-summary.json`.

Exact-head repository/CI qualification remains a merge-readiness gate after the
implementation branch is committed and published.
