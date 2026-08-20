# ATLAS-FULLWORLD-GUI-RUNTIME — performance and incremental evidence

Status: **implementation qualification PASS on local workstation; exact-head CI remains required before merge.**

## Trusted input

- full-world publication root: `sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f`
- semantic root: `sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9`
- canonical pixel root: `sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad`
- overview root: `sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db`
- Game revision: `f79fd3b5c239fa13810338f1380539c4eac67d7d`
- census: 16 floors / 1,197 shards / 18,997,668 tiles / 24,502,035 resolved primitives / 18,750,839,498 semantic bytes.

## Derived runtime products

- runtime row-group index: `sha256:fa30ae5fc47f0ca8a6d482ed87b5db2cd74f32f7f523df16187ca719b8e04f08`, 44,426 authenticated groups with explicit derived `WorldChunk` records;
- stable pixel-bucket runtime root: `sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116`, 27,302 blobs / 256 buckets / 252,592,128 bytes;
- incremental content graph: `sha256:39f35da5f7be9b3eae108f823bb2fc1ed6d7795691db8ca5c91b42cbaceebc04`, 16 floors / 1,197 chunks / 100,037 cells / 18,997,668 tiles.

All are derived transport/invalidation products and do not claim semantic identity authority.

## Measured incremental reuse

Runtime index clean full-world scan: 125.57 s wall, 31,604 KiB max RSS, swap 0. The final WorldChunk-enriched index was regenerated from an exact trusted previous index in 0.53 s with 51,884 KiB max RSS, swap 0, 1,197/1,197 chunks reused and 0 scanned; the current root is pinned above.

Overview rebuild from the exact trusted G4 output with unchanged semantic chunk identities: 1.02 s, 1,197/1,197 overview chunks reused, 0 scanned, identical overview root; the independent overview verifier passed against the complete source publication.

Stable pixel transport rebuild reused 256/256 buckets and read 0 canonical source packs. The current v2 runtime product also publishes an optional verified `local-max` acceleration bundle over the same bucket bytes.

The full tile/cell/region graph baseline scan took 140.41 s with max RSS 236,200 KiB and swap 0. Source-side discovery of changed OTBM regions is intentionally not claimed; see `src/publication/incremental-content-graph-v0.md`.

## Real Chrome qualification

`qualification-navigation.json`: PASS, floor -7 at 2x, `local-max`, one draw call, 2,107 retained tiles / 3,464 submitted primitives, verified full-pixel bundle; 1,113,374,720 B measured peak browser process-tree RSS, 1,613.6 ms initial load and 1,205.5 ms authenticated scene load in this run.

`qualification-reference.json`: PASS, floor -7 at 2x, `reference`, selective stable buckets and one instanced draw; 842,973,184 B measured peak browser process-tree RSS.

`qualification-overview.json`: PASS, floor -7 at 0.25x, overview-only path, zero base-map draw calls, zero pixel network bytes and 348,442,624 B measured peak browser process-tree RSS.

`qualification-multifloor.json`: PASS in one Chrome session across floors `-7 -> -15 -> -10 -> -3 -> 0`; each detail transition completed with one WebGL draw from verified data. Peak browser process-tree RSS was 1,778,880,512 B.

Real 1920x1080 Chrome screenshots were captured during qualification. Their binary payloads are kept outside the repository tree; exact identities are pinned here:
- `fullworld-detail-1920x1080.png`: 752,704 bytes, SHA-256 `88fbbdca22fd53c6d401be5a9c3471a9731b9062494fd906e59c91627d33c2b2`.
- `fullworld-multifloor-1920x1080.png`: 339,645 bytes, SHA-256 `55ce7b824a1b89e35b23c6b5b999c688ac5b54d88e43143ed4ce18086bd451f6`.
- `fullworld-overview-1920x1080.png`: 128,981 bytes, SHA-256 `ad36c9676e730801f475ebcfce918dc29a562f0cd1e008009b7d629bdbacdec9`.
- `fullworld-reference-1920x1080.png`: 752,778 bytes, SHA-256 `68a7069007736e17f3f19ad76616158703b61753675d2f4c46b7952040f2947b`.

Timing evidence is measurement for this qualification only, not a production FPS/SLO claim.

## Validation

Repository tests cover trusted-root rejection, authenticated range corruption, unsupported Range fallback, deterministic RuntimeState, WorldChunk and World Query boundaries, visible-data-preserving runtime budgets, performance-profile equivalence, frame coalescing, persistent-cache re-hashing, incremental graph invalidation, stable pixel-bucket verification and WebGL2 instancing.

### Rebased local validation

Current `main` integrated before final qualification: `32ad222edfb4cf7d45dc2fad76f4a5de0c8d83b9`.
Validated implementation tree after current-main integration, WorldChunk/World Query completion and cwd-independent harness fix:
- browser semantic tests: **15/15 PASS**;
- pixel-store tests: **6/6 PASS**;
- GUI/full-world runtime tests: **26/26 PASS**;
- full-world publication Python tests: **5/5 PASS**;
- full-world layer Python tests: **15/15 PASS**;
- runtime-index self-test: **PASS**;
- incremental-content-graph self-test: **PASS**;
- changed Python `py_compile`: **PASS**;
- `git diff --check`: **PASS**.

GitHub exact-head CI remains the merge authority after the branch is published.

### Final CodeQL-remediation qualification - 2026-08-20

The final candidate removes qualification-step input from dynamically constructed executable JavaScript. `Runtime.evaluate` now uses a static expression only to acquire `#search-input`; `Runtime.callFunctionOn` executes a static function and receives `step.search` as a CDP value argument. Qualification search values are bounded to 256 characters and reject control characters before submission.

Post-remediation local validation on the final code paths:
- Node browser/pixel/GUI/full-world runtime matrix: **63/63 PASS**;
- full-world publication Python tests: **5/5 PASS**;
- full-world layer Python tests: **15/15 PASS**;
- runtime-index self-test: **PASS**;
- incremental-content-graph self-test: **PASS**;
- extraction-provenance negative tests: **5/5 PASS**;
- extraction-provenance verifier: **PASS**;
- changed Python `py_compile`: **PASS** (8 files);
- forbidden raw legacy tracked-file scan: **PASS**;
- browser legacy-runtime reference scan: **PASS**;
- `git diff --check`: **PASS**.

Post-remediation real Chrome qualification against the verified full-world publication/runtime:
- `local-max` detail, floor `-7`, zoom `2`: **PASS**, 1 draw, 2,531.2283 ms wall, 1,246,318,592 B peak browser process-tree RSS;
- `reference` detail, floor `-7`, zoom `2`: **PASS**, 1 draw, 3,155.5806 ms wall, 1,341,091,840 B peak browser process-tree RSS;
- `reference` overview-only, floor `-7`, zoom `0.25`: **PASS**, 0 base-map draws, 1,231.0718 ms wall, 512,098,304 B peak browser process-tree RSS;
- multifloor `-7 -> -15 -> -10 -> -3 -> 0`: **PASS**, one detail draw at every transition, 4,981.624 ms wall, 1,971,798,016 B peak browser process-tree RSS.

Final qualification screenshot identities (kept outside the repository tree):
- local-max detail: 752,743 bytes, SHA-256 `e40a3e80c858f1b6fe8e8455f33af52ea942aa0ecb1ac2d5b864a1330c5c9482`;
- reference detail: 752,930 bytes, SHA-256 `efb697537b8ffd476750b02338a5da7ce9a2ed41ef73f33bed95574b8115c404`;
- overview-only: 129,020 bytes, SHA-256 `e7a6ead5f1594f94398397e49255e35502192161f5db737b07183ae6cdbbb857`;
- multifloor: 339,667 bytes, SHA-256 `464b3dc1c2f4fab41c97a106e22fe2fb370fe9ef22792d9dbf7f6665a6fe2461`.

These timings are qualification measurements only. They are not production performance SLOs, and unavailable GPU-resident-memory metrics remain unclaimed.
