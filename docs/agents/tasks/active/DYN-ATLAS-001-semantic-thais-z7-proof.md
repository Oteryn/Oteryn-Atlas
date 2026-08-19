# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof + target GUI integration
status: validation_pending_exact_head_ci_preview
repository: Oteryn/Oteryn-Atlas
base_branch: main
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: 4
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-19T07:50:00+02:00
owned_paths:
  - .github/workflows/ci.yml
  - .gitignore
  - __dummy__ (removal only)
  - docs/agents/tasks/**
  - docs/evidence/DYN-ATLAS-001-*
  - docs/legal/DYN-ATLAS-001-*
  - tools/**
  - src/**
  - web/**
  - tests/**
```

## Authority and immutable source

Atlas remains a derived semantic projection/read model. Oteryn-Game remains canonical World/Content authority. Browser runtime has no OTBM, Legacy IR, Canary/Crystal world-source or legacy raster fallback.

```text
Game producer final head = 8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0
Game producer merge      = bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d
workflow artifact id     = 9318268404
workflow artifact ZIP    = ec05e39be62d6826d27be19ff9c33c6cba7d1c835f79d02b8ad303b073c1ef40
semantic artifact        = sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e
tiles.jsonl SHA-256      = ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984
```
Exact bounded proof:

```text
x=[32280,32441)
y=[32155,32306)
floor=-7
tiles=24,311
presentation records=39,282
resolved primitives=39,282
appearance source IDs=862
sprite source IDs=990
```

## Exact 15.32 authorization

The former hard gate is closed for this exact archive only:

```text
Drive file ID = 1Dlo3bS4K1nS3mw4BhPZdlHT7lX5zRAvv
15.32.zip SHA-256 = 1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

Authorization is not generalized to another archive or digest. Historical evidence that predates this closure remains historical rather than current task state.

## Current publication identities

```text
semantic root = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
pixel root    = sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a
pixel pack    = 4f0b32786dc7601764c8a2596bc1ab49a24881d9778ecb4f54c894b113d84d62
pack bytes    = 7,725,056
sprite refs   = 990
unique blobs  = 987
```
## Implemented and locally proven

- [x] deterministic semantic compiler/verifier and locality proof;
- [x] browser semantic root/chunk SHA verification and malformed/forged negatives;
- [x] deterministic content-addressed pixel publication for the exact 990 sprite refs;
- [x] pixel root/pack/blob verification plus missing/forged negatives;
- [x] every 39,282 resolved primitive maps to an authorized pixel reference;
- [x] direct WebGL2 renderer using Game-resolved dimensions, order, pattern, phase and displacement;
- [x] no Canvas2D final renderer and no precomposed Thais map image;
- [x] dark map-dominant GUI with X/Y/floor, copy/deep-link, coordinate search and zoom controls;
- [x] drag pan, wheel/button zoom, factual picking and selected-tile highlight;
- [x] factual Tile/Entities and Provenance inspector;
- [x] unsupported NPC/monster/teleport/house/AID/UID/town/mechanics layers disabled as `N/A`;
- [x] only exported floor -7 exposed; minimap remains deferred;
- [x] browser diagnostics use measured runtime state only;
- [x] representative CPU/WebGL parity covers 32x32, 64x64, 32x64, 64x32, displacement, stacking and nonzero pattern/depth;
- [x] all five local Chrome parity cases are byte-exact (`maxAbs=0`, `meanAbs=0`);
- [x] real Chrome GUI smoke reports WebGL2, 30/30 chunks and one draw call;
- [x] real 1920x1080 screenshot captured.

Screenshot evidence:

```text
path   = docs/evidence/DYN-ATLAS-001-gui-1920x1080.png
sha256 = 19869d8a15c8c4e0a6691bd8b0690e709ff3f9725da0a5aeea73cd6e1cf3ba1b
```
## Evidence classification

### PROVEN

The bounded Thais Z7 publication, authorized pixel store, WebGL2 output, GUI interactions and inspector operate on the accepted new-Atlas boundary. Local Chrome 151.0.7922.140 has objectively qualified the renderer. The exact results are in `docs/evidence/DYN-ATLAS-001-browser-gui-qualification.json` and `docs/evidence/DYN-ATLAS-001-real-source-renderer.md`.

### DERIVED / replaceable

`dyn-atlas-compact-json-v0` span 32, the direct WebGL2 implementation and its texture packing are proof-local choices. None becomes permanent serializer, chunk, framework or identity authority.

### UNKNOWN / not claimed

Full-world completion, additional floors, NPC/monster/quest indexes, minimap, collision/walkability, path legality, production performance SLOs and public DNS are not provided by DYN-ATLAS-001.

## Remaining lifecycle gates

1. clean temporary/generated local junk and remove `__dummy__`;
2. run full local checks and exact diff review;
3. integrate any current `main` advance without dropping task changes;
4. push exact implementation head and require exact-head GitHub CI success;
5. deploy and verify the isolated new-Atlas Synology preview;
6. archive this task in the final closeout commit;
7. require exact-head CI again after closeout, mark PR #4 Ready, squash merge with expected head SHA, and verify final `main`.
