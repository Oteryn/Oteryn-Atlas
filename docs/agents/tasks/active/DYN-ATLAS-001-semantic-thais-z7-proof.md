# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: implementing_pixel_gate
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 0b56d9a95279f1ec02fddd0dfcf8bd6ffd16b539
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: 4
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-18T12:32:00+02:00
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

A byte-identical semantic-only durability copy is stored on Google Drive as file ID `1dInqWd6oC5c_2nAFF0RXrJm5Rj0UVV8h`, size `1723168` bytes. Drive metadata reports `shared=false`; it is evidence/storage, not claimed as anonymous CI/browser distribution.

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
- [x] Candidate chunk spans compared without freezing a permanent format.
- [x] Current proof-local 32x32 compact candidate: 30 chunks, root `sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1`.
- [x] Strict browser semantic manifest/chunk/tile/presentation/primitive decoder.
- [x] Stable tile/stack inspector preserving source appearance/sprite refs, ordering and provenance.
- [x] Stable x/y/floor/zoom deep-link round trip.
- [x] Pan/zoom wireframe browser shell.
- [x] Deterministic camera itinerary that is explicitly `movementAuthority=false`.
- [x] Malformed bounds/order/identity/primitive negative cases fail closed.
- [x] Browser/runtime source scanner rejects legacy world-format references.
- [x] Cross-repo GitHub Actions artifact 401 was not bypassed; CI separates immutable exact-source evidence from repository-local exact-head algorithm/consumer tests.

## Current exact-head evidence

Semantic/browser generation evidence is recorded in `docs/evidence/DYN-ATLAS-001-semantic-browser-generation.md`.

Exact Atlas head that first passed the semantic/browser generation:

```text
461eaaf72128a3690da25ea4f21afe07c4fcbc01
CI run 32127818016 (#25) = SUCCESS
```

A predecessor run exposed an order-sensitive object-serialization comparison in the browser validator; the comparison was changed to structural field checks and the successor head passed. The failed run remains visible as repaired evidence.

## Proof-local chunk measurements on exact Game source

| span | chunks | raw bytes incl. manifest | deterministic gzip bytes incl. manifest | max chunk bytes |
|---:|---:|---:|---:|---:|
| 8 | 399 | 6,112,180 | 1,800,663 | 20,804 |
| 16 | 110 | 5,986,223 | 1,679,335 | 72,688 |
| 24 | 49 | 5,959,678 | 1,645,708 | 155,345 |
| 32 | 30 | 5,951,385 | 1,635,218 | 276,189 |
| 48 | 16 | 5,945,280 | 1,628,476 | 592,808 |
| 64 | 9 | 5,942,225 | 1,626,062 | 1,036,858 |

These are proof measurements, not production SLOs or permanent format decisions.

## PROVEN

- Atlas/browser consumes Game-owned semantic projection semantics and never OTBM/Legacy IR fallback.
- Native x/y/floor/order and 15.32 appearance presentation semantics required by the current semantic proof are accepted by Game.
- Semantic records reconcile: 24,311 tiles and 39,282 visible presentation/resolved primitive records; three nested source descendants remain excluded rather than silently flattened.
- Compiler/chunk identity/locality behavior is deterministic.
- Browser semantic decode, inspector, deep-link state and advisory camera navigation are exact-head tested.
- No source pixel bytes are present in the current Atlas semantic/browser generation.

## DERIVED

- `dyn-atlas-compact-json-v0` span 32 is a replaceable current proof candidate, not permanent serialization/chunk authority.
- The dependency-free Canvas wireframe is an interim semantic consumer/interaction harness while the exact pixel-publication gate remains closed; it is not the final visual renderer decision.
- The single exported floor makes multi-floor switching not applicable to this exact bounded fixture; no additional floor data is invented.

## UNKNOWN / remaining hard gates

### 1. Exact 15.32 pixel publication authorization

The existing owner rights attestation is scoped to the different 15.25 archive SHA `01c45146e2fcec3f4087844e0cbc1817fb1d60b310a35ac5d88c07aab6f73d1a`.

It does **not** automatically cover exact `15.32.zip` SHA:

```text
1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

Until that exact digest is explicitly authorized for the bounded public Atlas use, decoded pixel blobs, public sprite publication, pixel-content deduplication, real visual parity evidence and PixiJS/WebGL2 real-sprite measurements remain fail-closed.

### 2. Gameplay/static path navigation semantics

The Game artifact declares `semantic-tiles-v0` and `resolved-appearance-primitives-v0`, not walkability/collision/navigation capability. Atlas does not infer passability from sprite IDs, pixels, tile presence or presentation order.

The implemented deterministic itinerary is camera/view navigation only and cannot be presented as a gameplay movement/path proof. A movement/path acceptance claim requires explicit public Game navigation semantics or a separately accepted interpretation of the canonical requirement.

## Next action

1. Keep PR #4 Draft.
2. Attach an explicit rights attestation to exact 15.32 ZIP SHA `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f` before decoding/publishing its source pixels.
3. After that gate closes, build deterministic pixel content IDs/deduplication and the PixiJS 8/WebGL2 visual candidate over the existing semantic boundary; record visual parity, GPU memory/upload, batching/draw-call/frame measurements.
4. Treat gameplay path navigation as unsupported unless Game exports the needed public semantics.
5. Perform final full-diff review and exact-head CI before Ready/merge.

## Stop conditions retained

Stop rather than workaround if pixel rights remain unresolved when visual publication is required; if movement acceptance would require invented walkability/collision; if any shortcut would reopen legacy world formats as authority; or if readiness would require bypassing CI/review governance.
