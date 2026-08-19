# DYN-ATLAS-001 real-source renderer qualification

Classification: **PROOF MEASUREMENT — NOT PRODUCTION SLO**.

## Authority boundary

The browser consumes only the checked-in Atlas semantic publication and the authorized content-addressed pixel publication. It does not parse OTBM, Legacy IR, Canary/Crystal world sources, Tibia asset metadata, or the legacy raster Atlas at runtime.

Exact proof identities:

```text
Game semantic artifact = sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e
Atlas semantic root    = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
Pixel root             = sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a
Pixel pack SHA-256     = 4f0b32786dc7601764c8a2596bc1ab49a24881d9778ecb4f54c894b113d84d62
Pixel pack bytes       = 7,725,056
```

The proof publication lives at `web/proof/semantic/` and `web/proof/pixels/`. Pixel content identity remains separate from Game/appearance/placement identity.
## Renderer candidate

The proof uses a small direct WebGL2 renderer; this does not freeze a permanent frontend framework. Verified source RGBA is uploaded into one proof-local texture cache. Texture placement and batching are transport state only and have `identityAuthority=false`.

The accepted visual origin is implemented directly:

```text
world pixel x = tile.x * 32 - (widthUnits - 32) + displacement.dxUnits
world pixel y = tile.y * 32 - (heightUnits - 32) + displacement.dyUnits
```

At the representative 1920x1080 GUI view the measured runtime state was 30/30 loaded semantic chunks, 593 visible primitives, one draw call, a 2048x1024 texture (8,388,608 bytes), and the 7,725,056-byte verified pixel pack. Timing values from the deterministic virtual-time screenshot harness are not promoted as performance evidence or an SLO.

## Objective browser parity

`tests/browser-proof.html` / `tests/browser-proof.mjs` execute the real browser modules in Chrome WebGL2 and independently compose a CPU reference from the same verified semantic primitives and authorized pixel bytes.
The five qualified viewports cover 32x32, 64x64, 32x64, 64x32, nonzero displacement, stacked presentations, and nonzero pattern/depth data present in the exact fixture. Local Chrome 151.0.7922.140 returned **byte-exact RGB parity for all five cases**: `maxAbs=0`, `meanAbs=0`, and zero differing RGB channels.

The durable machine-readable record is:

- `docs/evidence/DYN-ATLAS-001-browser-gui-qualification.json`

## Real GUI screenshot

The running application was captured in Chrome at an exact 1920x1080 viewport:

```text
path   = docs/evidence/DYN-ATLAS-001-gui-1920x1080.png
sha256 = 19869d8a15c8c4e0a6691bd8b0690e709ff3f9725da0a5aeea73cd6e1cf3ba1b
```

The screenshot shows real Thais Z7 pixels rendered by WebGL2, deterministic X/Y/floor/zoom state, factual selection, a six-record tile inspector, disabled unsupported semantic layers, and measured runtime diagnostics. It is not a precomposed map image and is evidence only for the bounded DYN-ATLAS-001 proof.
