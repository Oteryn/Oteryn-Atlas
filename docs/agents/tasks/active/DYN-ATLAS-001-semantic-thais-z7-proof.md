# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: blocked_on_exact_15_32_pixel_authorization
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 0b56d9a95279f1ec02fddd0dfcf8bd6ffd16b539
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: 4
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-18T12:50:00+02:00
owned_paths:
  - docs/agents/tasks/active/DYN-ATLAS-001-semantic-thais-z7-proof.md
  - docs/evidence/DYN-ATLAS-001-*.md
  - tools/**
  - src/**
  - web/**
  - static/**
  - tests/**
  - package.json
  - package-lock.json
  - svelte.config.js
  - vite.config.ts
  - tsconfig.json
  - playwright.config.ts
```

## Goal

Execute the canonical `DYN-ATLAS-001 — Semantic Thais Z7 Proof` as a bounded Atlas consumer proof without turning Atlas into a second World authority and without parsing OTBM/Legacy IR in browser runtime.

## Live authority

- Platform execution authority: `blakinio/Oteryn-Platform@132cc41d5c722911bdb4f3e30c200c5d8b47f1ec`.
- Game semantic exporter merged by PR #335 as `bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d`; terminal Game task closeout is merged as `16afdf31a15bd49d454cdbcdd98fa7ec72213ef9`.
- Game contracts used by the proof:
  - `oteryn-game-atlas-export-v1`;
  - `oteryn-world-spatial-v1`;
  - `oteryn-crystalserver-legacy-spatial-import-v1`;
  - `oteryn-atlas-15-32-appearance-spatial-v1`.
- Legacy/reference code remains pinned to `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce` and is never an Atlas/browser runtime source.

## Canonical bounded Game artifact

Atlas consumes one exact immutable Game-produced semantic artifact:

```text
producer final head = 8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0
producer merge = bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d
workflow run = 32119580912
workflow job = 95656797494
workflow artifact id = 9318268404
workflow artifact zip sha256 = ec05e39be62d6826d27be19ff9c33c6cba7d1c835f79d02b8ad303b073c1ef40
semantic artifact digest = sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e
physical profile = dyn-atlas-thais-z7-jsonl-v0
```

Stable source facts:

```text
legacy selection = X 32280..32440, Y 32155..32305, Z 7
native selection = x [32280,32441), y [32155,32306), floor -7
tiles = 24311
ground items = 24292
top-level visible tile items = 14990
source item tree without ground = 14993
visible presentation records = 39282
resolved primitives = 39282
unique appearance source ids = 862
unique sprite source ids = 990
tiles.jsonl bytes = 28040344
tiles.jsonl sha256 = ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984
diagnostics.json sha256 = 60326e4e048106d4366a2fd8fe472ccfdf06667fcd0f234977febfeaa38f31b8
```

## Completed in Atlas PR #4

- [x] Deterministic source-to-Atlas semantic compiler with logical chunk addresses separated from content IDs.
- [x] Fail-closed compact semantic verifier.
- [x] Same input -> identical chunk/root identities.
- [x] Local semantic edit invalidates exactly one expected chunk plus aggregate/root identity.
- [x] Candidate chunk spans and debug-vs-compact encoding compared without freezing a permanent format.
- [x] Current proof-local 32x32 compact candidate: 30 chunks, root `sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1`.
- [x] Strict browser semantic manifest/chunk/tile/presentation/primitive decoder.
- [x] Browser verifies manifest root identity and exact chunk SHA-256 before semantic use.
- [x] Stable tile/stack inspector preserving source appearance/sprite refs, ordering and provenance.
- [x] Stable x/y/floor/zoom deep-link round trip.
- [x] Pan/zoom wireframe browser shell.
- [x] Deterministic three-stop camera itinerary using only exported static coordinates and explicitly `movementAuthority=false`.
- [x] Malformed bounds/order/identity/primitive/content-identity negative cases fail closed.
- [x] Browser/runtime source scanner rejects legacy world-format references.
- [x] Exact-source semantic chunk/network/locality measurement records.
- [x] Exact 15.32 metadata-only pixel dedupe measurement: 990 referenced source sprite IDs -> 987 unique dimension+RGBA pixel blobs; 3 duplicate groups; no decoded pixels committed/published.

## Navigation requirement interpretation

Platform programme Phase 1 (`DYN-ATLAS-001`) requires a deterministic static navigation fixture. Platform Phase 5 separately owns navigation indexes, floor-transition graphs, local/cross-region route planning and route overlays.

Therefore the bounded Phase-1 proof does **not** need to invent Game movement legality. The current three-stop camera/deep-link itinerary is retained as the deterministic static navigation fixture because it uses only public exported coordinates, is byte/ordering deterministic, and is explicitly advisory with `movementAuthority=false`.

This is a **DERIVED programme interpretation**, not a claim that camera navigation equals future Phase-5 pathfinding. Walkability/collision/path legality remain out of scope and must not be inferred from pixels, sprite IDs, tile presence or presentation order.

## Exact-source measurements

Proof evidence is recorded in:

- `docs/evidence/DYN-ATLAS-001-semantic-browser-generation.md`;
- `docs/evidence/DYN-ATLAS-001-semantic-chunk-measurements.json`;
- `docs/evidence/DYN-ATLAS-001-15-32-pixel-dedupe-metrics.json`.

Selected proof-local 32x32 compact candidate includes 30 logical chunks. Representative exact-source viewport bytes are 250,352 raw / 68,307 deterministic gzip bytes for the measured central viewport; this is baseline evidence, not a production SLO.

Private metadata-only pixel measurement over exact `15.32.zip` proves:

```text
referenced semantic sprite source IDs = 990
sprite sheets touched = 136
unique dimension+RGBA pixel blobs = 987
duplicate pixel groups = 3
raw RGBA before dedupe = 7,741,440 bytes
raw RGBA after dedupe = 7,725,056 bytes
saved = 16,384 bytes (~0.21%)
```

The result proves deduplication identity mechanics but does not itself authorize or publish source pixels.

## PROVEN

- Atlas/browser consumes Game-owned semantic projection semantics and never OTBM/Legacy IR fallback.
- Native x/y/floor/order and 15.32 appearance presentation semantics required by the current semantic proof are accepted by Game.
- Semantic records reconcile: 24,311 tiles and 39,282 visible presentation/resolved primitive records; three nested source descendants remain excluded rather than silently flattened.
- Compiler/chunk identity/locality behavior is deterministic.
- Browser validates root/chunk content identity before semantic use.
- Browser semantic decode, inspector, deep-link state and static camera navigation are exact-head tested.
- No source pixel bytes are present in the current Atlas semantic/browser generation.
- Exact 15.32 sprite subset dedupe metrics are known without public pixel publication.

## DERIVED

- `dyn-atlas-compact-json-v0` span 32 is a replaceable current proof candidate, not permanent serialization/chunk authority.
- The dependency-free Canvas wireframe is an interim semantic consumer/interaction harness while the exact pixel-publication gate remains closed; it is not the final visual renderer decision.
- The single exported floor makes multi-floor switching not applicable to this exact bounded fixture; no additional floor data is invented.
- The deterministic camera/deep-link itinerary satisfies the bounded Phase-1 static navigation fixture without claiming future Phase-5 pathfinding or Game movement legality.

## SINGLE REMAINING HARD GATE — exact 15.32 pixel publication authorization

The existing owner rights attestation is scoped to the different 15.25 archive SHA:

```text
01c45146e2fcec3f4087844e0cbc1817fb1d60b310a35ac5d88c07aab6f73d1a
```

It does **not** automatically cover exact `15.32.zip` SHA:

```text
1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

Until that exact digest is explicitly authorized for bounded public Oteryn Atlas use, the following remain fail-closed:

- publishing decoded 15.32 pixel blobs;
- generating a public visual sprite store from those pixels;
- real-source PixiJS/WebGL2 visual rendering/parity screenshots;
- real-source GPU upload/texture, draw-call/batching and frame-time/FPS measurements.

## Next action after gate closes

1. Record exact-digest owner authorization without broadening it to other asset archives.
2. Generate deterministic content-addressed pixel store for the 990 referenced semantic sprite IDs while preserving 862 semantic appearance identities.
3. Implement the PixiJS 8/WebGL2 visual candidate behind the existing semantic consumer boundary.
4. Capture visual/reference parity, texture-memory/GPU upload, batching/draw-call and frame-time evidence.
5. Full-diff self-review, exact-head CI, Ready, squash merge and archive/closeout.

## Stop condition

PR #4 remains Draft and DYN-ATLAS-001 is stopped **only** on explicit authorization for exact `15.32.zip` digest `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f`. No substitute asset set, inferred rights or legacy fallback is permitted.
