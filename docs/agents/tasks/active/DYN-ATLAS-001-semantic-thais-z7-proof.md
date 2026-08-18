# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: implementing
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 0b56d9a95279f1ec02fddd0dfcf8bd6ffd16b539
branch: feat/DYN-ATLAS-001-semantic-thais-z7-proof
pr: pending
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-18T11:25:00+02:00
owned_paths:
  - docs/agents/tasks/active/DYN-ATLAS-001-semantic-thais-z7-proof.md
  - docs/evidence/DYN-ATLAS-001-*.md
  - tools/**
  - src/**
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
  - `docs/architecture/oteryn-dynamic-semantic-atlas.md`
  - `docs/maps/oteryn-dynamic-semantic-atlas-program.md`
  - `docs/maps/oteryn-dynamic-semantic-atlas-execution-prompt.md`
- Game semantic exporter merged on `blakinio/Oteryn-v2` as PR #335 / merge `bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d`.
- Game contracts used by the proof:
  - `oteryn-game-atlas-export-v1`;
  - `oteryn-world-spatial-v1`;
  - `oteryn-crystalserver-legacy-spatial-import-v1`;
  - `oteryn-atlas-15-32-appearance-spatial-v1`.
- Legacy migration/reference code remains pinned to `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce` and is not an Atlas/browser runtime source.

## Canonical bounded Game artifact

Atlas consumes one exact immutable Game-produced semantic artifact:

```text
producer repository = blakinio/Oteryn-v2
producer final head = 8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0
producer merge = bf8a65ca0d6b0fbc1b6c521b16e613824b048f0d
workflow run = 32119580912
workflow job = 95656797494
workflow artifact id = 9318268404
workflow artifact zip sha256 = ec05e39be62d6826d27be19ff9c33c6cba7d1c835f79d02b8ad303b073c1ef40
semantic artifact digest = sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e
physical profile = dyn-atlas-thais-z7-jsonl-v0
```

Stable source projection facts:

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
diagnostics.json bytes = 19
diagnostics.json sha256 = 60326e4e048106d4366a2fd8fe472ccfdf06667fcd0f234977febfeaa38f31b8
```

The Game producer proves byte-identical double builds, exact ordering/bounds, fail-closed corruption handling and a default-deny public field allowlist. Three nested source descendants are intentionally excluded from visible spatial presentation rather than flattened into the stack.

## PROVEN

- Atlas repository/authority boundary is established and browser-runtime OTBM fallback is forbidden.
- Native coordinate/floor/order semantics required by the proof are accepted by Game.
- The current latest asset source is the exact Drive object `15.32.zip`, Drive ID `1Dlo3bS4K1nS3mw4BhPZdlHT7lX5zRAvv`, ZIP SHA-256 `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f`.
- Game-owned 15.32 appearance semantics are accepted: 32 units/tile, south-east visual anchor, west/north visual coverage, explicit displacement, producer-owned frame/phase/pattern/layer/sprite resolution.
- The bounded Game semantic export artifact exists, is digest-pinned and contains zero source pixel payload.
- Exact Game final semantic artifact has been downloaded for consumer development; Atlas need not and must not regenerate it from OTBM.
- There is no overlapping open Atlas DYN-ATLAS implementation PR at this generation start.

## DERIVED

- Atlas may proceed with semantic consumer validation, deterministic derived chunking, content identity, inspector schema, malformed-input tests and browser application scaffolding using only the exact Game artifact.
- Proof-local physical chunk candidates may be compared without promoting any chunk size/encoding to canonical authority.
- The single-floor bounded Game export means floor-switch UI is not an applicable multi-floor acceptance dimension for this exact slice; Atlas must not invent additional floor data.

## UNKNOWN / explicit remaining gates

### 1. Exact 15.32 pixel publication authorization

The existing owner rights attestation in `docs/legal/DYN-ATLAS-001-tibia-asset-rights-attestation.md` is scoped to the **different** supplied 15.25 archive SHA-256 `01c45146e2fcec3f4087844e0cbc1817fb1d60b310a35ac5d88c07aab6f73d1a`.

It does not automatically authorize publication/redistribution of the distinct `15.32.zip` SHA-256:

```text
1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

Semantic work proceeds because the Game artifact contains no pixels. Decoding/committing/publicly publishing 15.32 pixel blobs remains fail-closed until the exact digest is explicitly covered by project authorization.

### 2. Static navigation semantics

The current Game artifact declares `semantic-tiles-v0` and `resolved-appearance-primitives-v0`. It does not declare authoritative walkability/collision/navigation capability.

Atlas must not derive passability from sprite IDs, pixel alpha, presentation order, tile presence or legacy item IDs. DYN-ATLAS deterministic navigation must either consume a later explicit public Game navigation capability or remain blocked/limited to an explicitly authored advisory route fixture whose facts do not claim movement authority and whose acceptance is supported by the programme authority.

## Implementation generation plan

1. Validate the exact Game artifact and copy only its immutable identity/provenance into Atlas evidence.
2. Implement a deterministic bounded semantic chunk compiler/consumer adapter.
3. Compare at least two proof-local chunking/encoding candidates for size/locality without freezing a permanent winner.
4. Prove deterministic rebuild and local-edit invalidation.
5. Implement browser consumer schema/resource validation and malformed/unsupported negative tests.
6. Scaffold the preferred Svelte 5 + TypeScript + PixiJS 8 proof candidate behind replaceable semantic interfaces.
7. Implement semantic tile/stack inspector and stable deep-link/pan/zoom state using Game projection data only.
8. Resolve the exact 15.32 pixel-publication gate before committing/publicly publishing decoded sprite pixels and visual parity evidence.
9. Resolve/clarify the static-navigation capability before claiming deterministic navigation acceptance.
10. Record required measurements and exact-head CI before Ready/merge.

## Stop conditions retained

Stop rather than workaround if:

- exact 15.32 pixel rights remain unresolved at the point pixel publication is required;
- navigation acceptance would require inventing walkability/collision facts not exported by Game;
- any consumer shortcut would reopen OTBM/legacy files as world authority;
- merge/readiness would require bypassing repository review/CI governance.

A semantic/compiler/browser partial generation is useful evidence but is not DYN-ATLAS-001 completion until all applicable canonical acceptance criteria are proven or a named upstream stop condition is recorded.
