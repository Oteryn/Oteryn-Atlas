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

- runtime row-group index: `sha256:98fa66118d49e3d440d8b14643d020542fadeff522ada69d6fb342d1f82547ed`, 44,426 authenticated groups;
- stable pixel-bucket runtime root: `sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116`, 27,302 blobs / 256 buckets / 252,592,128 bytes;
- incremental content graph: `sha256:39f35da5f7be9b3eae108f823bb2fc1ed6d7795691db8ca5c91b42cbaceebc04`, 16 floors / 1,197 chunks / 100,037 cells / 18,997,668 tiles.

All are derived transport/invalidation products and do not claim semantic identity authority.

## Measured incremental reuse

Runtime index clean full-world scan: 125.57 s wall, 31,604 KiB max RSS, swap 0. Rebuild from an exact trusted previous index with unchanged semantic chunks: 0.38 s, 1,197/1,197 chunks reused, 0 scanned, identical runtime root.

Overview rebuild from the exact trusted G4 output with unchanged semantic chunk identities: 1.02 s, 1,197/1,197 overview chunks reused, 0 scanned, identical overview root; the independent overview verifier passed against the complete source publication.

Stable pixel transport rebuild reused 256/256 buckets and read 0 canonical source packs. The current v2 runtime product also publishes an optional verified `local-max` acceleration bundle over the same bucket bytes.

The full tile/cell/region graph baseline scan took 140.41 s with max RSS 236,200 KiB and swap 0. Source-side discovery of changed OTBM regions is intentionally not claimed; see `src/publication/incremental-content-graph-v0.md`.

## Real Chrome qualification

`qualification-navigation.json`: PASS, floor -7 at 2x, `local-max`, one draw call, 2,107 retained tiles / 3,464 submitted primitives, verified full-pixel bundle, measured CPU WebGL render time recorded in the JSON.

`qualification-reference.json`: PASS, floor -7 at 2x, `reference`, selective stable buckets and one instanced draw.

`qualification-overview.json`: PASS, floor -7 at 0.25x, overview-only path, zero base-map draw calls and zero pixel network bytes.

`qualification-multifloor.json`: PASS in one Chrome session across floors `-7 -> -15 -> -10 -> -3 -> 0`; each detail transition completed with a WebGL draw from verified data.

Real 1920x1080 Chrome screenshots were captured during qualification. Their binary payloads are kept outside the repository tree; exact identities are pinned here:
- `fullworld-detail-1920x1080.png`: 751,392 bytes, SHA-256 `c78ca7ef7c0a0d5d1478629bcf157299b49473c749858f9e8be1cc388e1cf997`.
- `fullworld-multifloor-1920x1080.png`: 338,967 bytes, SHA-256 `19d292268a272850133b2dd6dbca610fcccf06762748570fc9f1a64c91c4d602`.
- `fullworld-overview-1920x1080.png`: 127,649 bytes, SHA-256 `7d9b1ed145bcd7d124eda1cb69afa2af3c3066f6a93bfbc9cd4c2ce75bc12cc3`.
- `fullworld-reference-1920x1080.png`: 751,335 bytes, SHA-256 `c19b4728d4b1ad90f4faf8323eece6646dca74677dfb0c725b7e42545e0df74a`.

Timing evidence is measurement for this qualification only, not a production FPS/SLO claim.

## Validation

Repository tests cover trusted-root rejection, authenticated range corruption, unsupported Range fallback, performance-profile equivalence, frame coalescing, persistent-cache re-hashing, incremental graph invalidation, stable pixel-bucket verification and WebGL2 instancing.

### Rebased local validation

Base: `172916e5cdd25580e857eb01c74b77a92954c1d7`.
Validated implementation tree after rebase and cwd-independent harness fix:
- browser semantic tests: **15/15 PASS**;
- pixel-store tests: **6/6 PASS**;
- GUI/full-world runtime tests: **23/23 PASS**;
- full-world publication Python tests: **5/5 PASS**;
- full-world layer Python tests: **15/15 PASS**;
- runtime-index self-test: **PASS**;
- incremental-content-graph self-test: **PASS**;
- changed Python `py_compile`: **PASS**;
- `git diff --check`: **PASS**.

GitHub exact-head CI remains the merge authority after the branch is published.
