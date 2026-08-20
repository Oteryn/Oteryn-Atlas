# Incremental content graph v0

Status: **derived invalidation/reuse contract; not Game authority**.

The purpose of this graph is to prevent an unrelated small map edit from forcing downstream Atlas products to be rebuilt globally. The canonical full-world publication and its Game provenance remain authoritative; graph identities only describe exact derived bytes and their dependencies.

## Identity hierarchy

Each canonical semantic tile line receives a content identity over its exact bytes. Tile identities are grouped deterministically into overview cells, semantic regions/chunks, floors and a world root. Logical address and content identity remain separate at every level.

The graph records a `dependencyRadius` policy. A producer with radius `0` invalidates only the directly changed tile/cell/region. A future producer that genuinely depends on neighbours must declare a non-zero radius; callers may never widen or shrink dependency reach by guessing semantics.

## Selective invalidation

Two graph snapshots are compared by local content identities. A changed tile marks its dependent cell and region dirty; only affected floor roots and the world root are recomputed. Unchanged sibling regions are reusable byte-for-byte.

Downstream reuse follows the same rule:
- runtime row-group indexes may reuse a trusted previous chunk when the source semantic chunk `contentId` is unchanged;
- overview chunks may reuse a trusted previous derived chunk when its `sourceContentId` is unchanged;
- pixel runtime transport uses stable content-hash buckets so unrelated pixel additions/removals invalidate only affected buckets;
- floor/world manifests are cheap and are always rematerialized with current provenance/root linkage.

Previous derived outputs are eligible only when their exact expected root is supplied and verified. A stale or untrusted cache is never accepted merely because a logical address matches.

## Source-side boundary

The current G1/G2 generation fabric still fingerprints the complete pinned `world.otbm`, so a changed map file invalidates that private source cache. Atlas must not infer changed tiles from pixels or bypass Game/import authority to avoid the scan.

Avoiding a complete original-map scan requires a future **Game-owned authoritative change/region manifest** (or equivalent producer contract) that identifies changed source regions deterministically. Once such a hand-off exists, this graph allows Atlas publication/runtime/overview/pixel derivatives to propagate only those dirty regions.

This limitation is deliberate and fail-closed: downstream Atlas incrementality is implemented without weakening the Game authority boundary.
