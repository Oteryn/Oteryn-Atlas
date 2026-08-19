# DYN-ATLAS-001 semantic compiler + browser consumer evidence — 2026-08-18

## Status

**PASS for semantic/compiler/browser-consumer generation.** This is not full DYN-ATLAS-001 completion because exact 15.32 source-pixel publication and visual/pixel-dedup parity remain separately gated.

## Exact upstream semantic authority

```text
Game producer repository = blakinio/Oteryn-v2
producer final head = 8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0
producer merge = bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d
workflow run = 32119580912
workflow artifact id = 9318268404
workflow artifact ZIP sha256 = ec05e39be62d6826d27be19ff9c33c6cba7d1c835f79d02b8ad303b073c1ef40
semantic artifact digest = sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e
semantic tiles sha256 = ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984
```

Game task closeout is merged as `blakinio/Oteryn-v2@16afdf31a15bd49d454cdbcdd98fa7ec72213ef9`.

A byte-identical copy of the final semantic-only workflow bundle was uploaded to Google Drive as file ID `1dInqWd6oC5c_2nAFF0RXrJm5Rj0UVV8h`. Its Drive byte size is 1,723,168 bytes. Drive metadata currently reports `shared=false`; this copy is durability evidence, **not** claimed as anonymous browser/CI distribution.

## Atlas exact-source compiler evidence

The exact final Game bundle was independently unpacked and consumed by `tools/dyn-atlas-semantic/compiler.py`. No OTBM/Legacy IR source was opened by the Atlas compiler.

The proof-local candidate matrix over the exact 24,311-tile semantic source produced:

| span | chunks | raw bytes incl. manifest | deterministic gzip bytes incl. manifest | max chunk bytes |
|---:|---:|---:|---:|---:|
| 8 | 399 | 6,112,180 | 1,800,663 | 20,804 |
| 16 | 110 | 5,986,223 | 1,679,335 | 72,688 |
| 24 | 49 | 5,959,678 | 1,645,708 | 155,345 |
| 32 | 30 | 5,951,385 | 1,635,218 | 276,189 |
| 48 | 16 | 5,945,280 | 1,628,476 | 592,808 |
| 64 | 9 | 5,942,225 | 1,626,062 | 1,036,858 |

For the proof-only 32x32 candidate:

```text
chunk count = 30
root content id = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
```

The span is a bounded proof candidate only; these measurements do not freeze permanent Atlas chunk dimensions or serialization.

### Determinism/locality

Using the same exact source twice produces byte-identical chunk maps and manifest identity. A deterministic mutation of one presentation record changes exactly one content-addressed chunk plus aggregate/root identity; unrelated chunk bytes/IDs remain unchanged.

The committed self-test also exercises this locality rule on a bounded synthetic fixture so exact-head CI can validate the algorithm without privileged access to the external Game workflow artifact.

## Browser semantic consumer

Atlas PR #4 implements a dependency-free semantic browser generation before source pixels are authorized:

- strict `dyn-atlas-compact-json-v0` manifest and chunk validation;
- exact Game artifact identity check;
- x/y/floor and legacy-source provenance preservation;
- explicit same-position presentation order;
- explicit unresolved canonical entity identity (never invented from legacy IDs);
- resolved primitive dimensions/pattern/layer/displacement/coverage validation;
- stable tile/stack inspector output with appearance/sprite provenance refs;
- deterministic x/y/floor/zoom deep-link round trip;
- pan/zoom shell;
- deterministic camera itinerary using only exported coordinates.

The itinerary is explicitly `advisoryKind=camera-view` and `movementAuthority=false`; it is not pathfinding and does not claim Game walkability/collision semantics.

The current wireframe shell fails closed when projection bytes are absent; it does not reopen OTBM, Legacy IR, Canary or CrystalServer sources as fallback.

## Exact-head Atlas CI

PR #4 exact head:

```text
461eaaf72128a3690da25ea4f21afe07c4fcbc01
```

Workflow:

```text
CI run 32127818016 (#25) = SUCCESS
```

Applicable jobs pass:

- repository authority / forbidden legacy browser-source checks;
- semantic compiler Python compile + deterministic synthetic/negative tests;
- pinned exact-source identity evidence check;
- browser semantic Node tests;
- static browser entry validation;
- package/project gate (no package selected yet).

A prior browser test head failed because bounds were compared using object serialization/key order. The validator was repaired to structural field comparison and the exact successor head passed. The failed run is retained as evidence of the repaired defect rather than hidden.

## Current evidence classification

The earlier semantic-only heads correctly recorded that no public pixel bytes were present and that exact 15.32 authorization was still unresolved. Those statements are historical evidence for those heads; they are superseded for the current integrated generation by `DYN-ATLAS-001-15-32-rights-gate-closure.md` and the exact-digest attestation.

### PROVEN â€” current integrated generation

- exact Game semantic source identity and counts remain unchanged;
- proof-local semantic root remains `sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1`;
- the exact 15.32 rights gate is closed only for SHA-256 `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f`;
- 990 referenced sprite source IDs map to 987 content-addressed RGBA blobs;
- pixel root is `sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a`;
- pixel pack SHA-256 is `4f0b32786dc7601764c8a2596bc1ab49a24881d9778ecb4f54c894b113d84d62`;
- the browser verifies semantic and pixel identities before use and fails closed;
- the final proof renderer is real WebGL2, not the former Canvas2D wireframe;
- real-browser CPU/WebGL parity is byte-exact for all five qualified cases;
- the integrated dark GUI provides pan, wheel/button zoom, coordinate search, deterministic deep links, selection and factual tile/provenance inspection;
- unsupported semantic layers and additional floors remain disabled rather than fabricated.

### DERIVED / intentionally deferred

- compact JSON span 32 remains a replaceable proof-local candidate, not a permanent serializer/chunk authority;
- the direct WebGL2 implementation is a proof-local renderer choice, not a permanent framework decision;
- movement/path legality remains unavailable because the bounded Game export has no walkability/collision capability;
- full-world indexes, semantic layers and minimap remain later programme work and are not claimed by DYN-ATLAS-001.

Current browser/GUI qualification is recorded in `docs/evidence/DYN-ATLAS-001-browser-gui-qualification.json` and `docs/evidence/DYN-ATLAS-001-real-source-renderer.md`.
