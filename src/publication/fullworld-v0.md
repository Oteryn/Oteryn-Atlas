# Full-world Atlas publication v0

Status: **provisional transport contract; serializer/framework choice is not frozen**.

This contract defines the publication emitted by `tools/fullworld-publication/publication.py`.
`Oteryn/Oteryn-Game` remains World/Content authority. The publication is a derived read model and never becomes authority for Game semantics.

## Source boundary

The compiler accepts only the exact verified `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC` hand-off whose SHA-256 is supplied by the caller.
The hand-off must identify `Oteryn/Oteryn-Game` as source authority and must forbid browser/runtime legacy fallback.
Raw OTBM, legacy IR and historical Atlas raster data are not compiler inputs.

The top-level publication records:
- exact hand-off SHA-256;
- fabric root;
- source fingerprint;
- exact Game revision;
- canonical world ID and its explicit state.

`serializerStatus` is `PROVISIONAL_NOT_FROZEN` by design.
## Semantic hierarchy

The semantic publication has three identity levels:

1. `semantic/world.json` — complete-world manifest/root.
2. `semantic/floors/f<floor>.json` — per-floor manifest/root.
3. `semantic/chunks/*.jsonl` — content-addressed semantic shard bytes.

A chunk keeps its logical address (`floor`, `region_x`, `region_y`) separate from its SHA-256 `contentId`.
Logical addresses select data; content IDs prove exact bytes. A verifier must reject duplicate logical addresses, missing content, byte-size mismatch, digest mismatch, root-linkage mismatch or count mismatch.

World and floor roots use domain-separated SHA-256 over canonical JSON manifest cores. Chunk content IDs are SHA-256 of the exact JSONL bytes inherited from the verified fabric.

All tile, primitive and sprite-reference counts must reconcile from chunk bytes through floor manifests to the world manifest.
Unsupported or unresolved upstream semantic records remain explicit; the compiler must not substitute inferred content.

## Pixel publication

Every resolved semantic `sprite_source_id` must have exactly one entry in `pixels/manifest.json`.
The authorized source is the exact asset ZIP covered by repository rights attestation and by the generation hand-off.
Pixel content identity is domain-separated SHA-256 over:

- decoded width;
- decoded height;
- exact RGBA bytes.

Equal pixel identities deduplicate globally across all floors and regions. Sprite source IDs remain source-facing references and are not pixel content identities.

Raw RGBA blobs are stored in deterministic packs capped at 64 MiB. Pack number and byte offset are runtime/transport placement only. Every pack and `runtimePlacement` explicitly set `identityAuthority=false`.

A verifier must independently recompute every blob content ID from pack bytes and independently re-decode every referenced sprite from the authorized asset archive to confirm `sprite_source_id -> contentId` mappings.

## Fail-closed verification

`tools/fullworld-publication/verify_publication.py` rejects at minimum:
- non-canonical or forged manifest roots;
- unsafe relative paths;
- missing/corrupt chunks or packs;
- duplicate logical addresses;
- count/reconciliation divergence;
- pack gaps, overlaps or unindexed bytes;
- forged pixel blob identities;
- missing or forged sprite-to-pixel mappings;
- source-provenance/root linkage divergence;
- any runtime/GPU placement claiming identity authority.

`tools/fullworld-publication/negative_tests.py` exercises the corruption/missing/forgery cases against a real publication without mutating the verified source fabric.
