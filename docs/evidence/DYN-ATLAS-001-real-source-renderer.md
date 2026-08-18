# DYN-ATLAS-001 real-source renderer qualification

Classification: **PROOF MEASUREMENT — NOT PRODUCTION SLO**.

## Boundary

The browser renderer consumes only the checked-in Atlas semantic publication plus the checked-in public pixel store. It does not parse OTBM, Tibia asset metadata, Canary/Crystal data or legacy stack/pattern/animation rules. Game already selected concrete phase, pattern, layer and `spriteSourceId` and exported explicit dimensions, displacement, visual coverage and `PresentationOrderKey`.

Pixel content identity is separate from appearance, placement and Game identity. The canonical pixel manifest/pack contains no GPU coordinates. `static/proof/pixels/cache/` is an explicitly replaceable cache with `identityAuthority=false`; its atlas coordinates are runtime transport state only.

## Renderer candidate

The proof uses a small direct WebGL2 batch renderer rather than freezing Svelte/PixiJS as architecture. This is a proof-local implementation choice, not a production framework decision: all visible primitives use one verified runtime-cache texture and one vertex batch/draw call while retaining the existing semantic decoder/inspector/deep-link boundary. Framework selection remains deferred.

The draw origin is the Game-owned 15.32 profile rule:

```text
screen x = tile x * 32 - (widthUnits - 32) + displacement.dxUnits
screen y = tile y * 32 - (heightUnits - 32) + displacement.dyUnits
```

The semantic decoder independently rejects visual coverage inconsistent with the explicit south-east/bottom-right anchor. Pixel footprint is presentation-only and is never interpreted as collision or walkability.

## Deterministic static evidence

`docs/evidence/DYN-ATLAS-001-public-pixel-renderer-qualification.json` records exact identities, byte sizes and two independent exact-source public pixel builds. The canonical dedupe metrics remain solely in `docs/evidence/DYN-ATLAS-001-15-32-pixel-dedupe-metrics.json`.

`static/proof/parity/references.json` pins five representative reference images generated from the pinned `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce` draw/blend implementation applied offline to the Game-resolved primitives. The set exercises 32x32, 64x64, 64x32 and 32x64 source pixels, nonzero displacement, stacked presentations, nonzero pattern selection and pattern depth. The exact bounded Game fixture contains only `layer_index=0`; no fake additional layer is created.

The legacy renderer is reference evidence only. It is not imported by browser runtime and is not a World authority.

## Runtime evidence

The exact-head GitHub Actions `browser-webgl-proof` job builds a self-contained harness from the exact checked-in bytes, executes the same browser modules in Chrome/Chromium WebGL2, verifies all five reference viewports with numeric pixel-diff metrics, then measures semantic load/decode, runtime-cache PNG decode, texture upload, first meaningful render, visible primitive count, draw calls and representative frame/pan/zoom distributions.

The CI result is uploaded as `dyn-atlas-001-browser-proof-<exact head SHA>`. Runtime values are evidence for that runner only and are not production SLOs.
