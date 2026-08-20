# Full-world browser runtime v0

Status: **provisional derived runtime contract; semantic authority is unchanged**.

`Oteryn/Oteryn-Game` remains World/Content authority. The browser consumes only verified Atlas publication products. Runtime indexes, pixel buckets, GPU placement, caches, LOD choices and performance profiles are transport/presentation aids with `identityAuthority=false` and never replace canonical semantic or pixel identities.

## Loading and LOD

The browser loads the verified world/floor manifests first, then selects authenticated semantic row groups from viewport bounds plus bounded prefetch. Requests outside the current refresh epoch are cancelled. Large semantic chunks require HTTP byte-range support; the runtime fails closed rather than downloading an unbounded fallback.

At zoom below the qualified detail threshold the base detail stream is paused and the verified `minimap-overview` dataset is used as the world-scale LOD. Detail mode keeps only the selected floor/viewport working set in memory.

## Performance profiles

`reference` is the deterministic qualification/parity profile. `local-max` changes only resource budgets and transport strategy: larger semantic cache/prefetch, higher bounded request concurrency and the verified full-pixel acceleration bundle. `auto` selects between them from browser-exposed capabilities; no CPU/GPU model is hard-coded.

Interactive rendering is dirty-frame driven through `requestAnimationFrame`. WebGL2 uses one static quad plus ordered per-instance data and `drawArraysInstanced`. Camera movement changes uniforms rather than rebuilding per-vertex geometry. `preserveDrawingBuffer` and synchronous `gl.finish()` are opt-in evidence/capture behavior only.

## Pixel transport

The canonical G3 pixel publication remains authoritative. `tools/fullworld-runtime/build_pixel_buckets.py` derives 256 stable content-hash buckets from the verified pixel blobs. A blob maps to a bucket by content identity, so unrelated new/removed blobs do not repack every later bucket. The optional `local-max` bundle concatenates the same verified buckets for fewer browser/GPU upload operations.

The browser independently validates the bucket manifest root, source publication/pixel roots, bucket byte counts/digests and acceleration-bundle digest. GPU texture-array placement is runtime-only.

## Cache and telemetry

Authenticated semantic ranges and pixel transports can use persistent content-addressed browser cache. Cached bytes are re-hashed before reuse. Runtime evidence records profile/capabilities, CPU frame time, GPU time when the extension returns a valid result, draw calls, retained/submitted primitives, instance-buffer bytes, semantic cache hits/misses, authenticated/network bytes, resident pixel bytes and upload time. Missing metrics remain `null`; no FPS/SLO is inferred.

## Current limitations

- semantic JSON decoding is still on the main JS thread; Web Workers remain a measured follow-up, not an assumed win;
- the current renderer reserves texture-array capacity for the complete verified pixel universe; selective bucket transport reduces network/upload work but not the reserved texture address space;
- GPU timer queries may be unavailable or unresolved in a captured frame and then remain `null`;
- animation remains independently BLOCKED until authoritative phase/timing data exists;
- named factual layers remain BLOCKED/UNKNOWN exactly as recorded by the G4 authority registry.

Qualification evidence is recorded under `docs/evidence/fullworld-gui/`.

## RuntimeState and World Query boundary

`RuntimeState` is deterministic presentation/navigation state only. The URL round-trip includes floor, camera position, zoom, enabled factual layers, selected tile, search query, animation mode and debug flags. Component state never becomes Game/Atlas world authority.

`src/browser/world-query.mjs` is the browser consumer boundary for region, entity, object, layer and provenance queries. Today, region/provenance queries resolve verified runtime products; entity/object queries fail closed as `BLOCKED` until authoritative indexes are published. Consumers should use this boundary instead of treating generated files as authority.

Each runtime shard exposes a non-authoritative `WorldChunk` descriptor with `chunk_id`, floor, bounds, semantic/pixel roots, dependencies, content hash and estimated memory cost. The descriptor is validated against the authenticated shard and floor/world roots before use. Chunk invalidation is hash/dependency based; a local upstream change must not require a full-world reload when authoritative changed-region identities are available.

## Resource budgets and degradation

Profiles define bounded loaded-chunk/group counts, semantic-cache bytes, GPU texture allocation and a one-draw-call target for base-map submission. The selector always retains every authenticated group intersecting the visible viewport; only prefetch is trimmed to satisfy budgets. If the visible factual set itself exceeds a profile budget the runtime fails closed rather than silently hiding data.

GPU memory is reported only when the platform exposes a trustworthy metric. WebGL2 allocation bytes are tracked separately from actual resident GPU memory, which remains `N/A` when unavailable. Real-browser evidence also records initial load, scene/chunk latency, visible/retained chunks, cache hit ratio, process-tree RSS from the external harness, JS heap, draw calls and animation ON/OFF delta when animation is actually available.
