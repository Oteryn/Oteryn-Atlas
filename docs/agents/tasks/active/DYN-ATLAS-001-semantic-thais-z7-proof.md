# DYN-ATLAS-001 — Semantic Thais Z7 Proof

```yaml
task_id: DYN-ATLAS-001
title: Semantic Thais Z7 Proof
status: blocked
repository: Oteryn/Oteryn-Atlas
base_branch: main
base_sha: 56fe11bc416087ee02aca17e0f463777c07de63e
branch: docs/DYN-ATLAS-001-asset-rights-attestation
owner: ChatGPT autonomous execution
created_at: 2026-08-18T09:24:00+02:00
updated_at: 2026-08-18T09:50:00+02:00
owned_paths:
  - docs/agents/tasks/active/DYN-ATLAS-001-semantic-thais-z7-proof.md
  - docs/legal/DYN-ATLAS-001-tibia-asset-rights-attestation.md
  - src/**
  - static/**
  - tests/**
```

## Goal

Execute the canonical `DYN-ATLAS-001 — Semantic Thais Z7 Proof` as a bounded Atlas consumer proof without turning Atlas into a second World authority and without parsing OTBM/Legacy IR in browser runtime.

## Current authority

- Platform programme/prompt: `blakinio/Oteryn-Platform@c14c790b63401acb84552a4c7e45743e0bc007c5`.
- Game authority after importer closeout: `blakinio/Oteryn-v2@ade3005cdf9ad6daeb87dc20a6546d5c29ee61da`.
- Game contracts: `oteryn-game-atlas-export-v1`, `oteryn-world-spatial-v1`, `oteryn-crystalserver-legacy-spatial-import-v1`.
- Legacy reference: `blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce`.

## PROVEN

- Atlas repository/bootstrap is established; main before this attestation generation is `56fe11bc416087ee02aca17e0f463777c07de63e`.
- Game-owned coordinate/floor/presentation mapping is accepted and merged. Historical Thais `X=32280..32440`, `Y=32155..32305`, legacy `Z=7` maps to native `x=[32280,32441)`, `y=[32155,32306)`, `floor=-7`.
- Canonical legacy world source remains CrystalServer `5e89bf8329ea406cb4ea8f4a18f32954f13e5418`, world SHA-256 `3bd40d14fefec41f24c4b3ae879e420be1a831ef55b95dcbec721e587a09b034`.
- Supplied `otservbr(4).otbm` hash `a80de1dda6a9aca3956a9d5b7fb2e0caebb451570d26853fc21beb40d5f31da2` differs and is not a silent replacement source.
- Supplied `assets(1).zip` hash is `01c45146e2fcec3f4087844e0cbc1817fb1d60b310a35ac5d88c07aab6f73d1a`.
- On 2026-08-18 the project owner explicitly confirmed they have the rights required to use and publish the exact supplied Tibia/CipSoft asset package for public Oteryn Atlas use. The bounded attestation is recorded in `docs/legal/DYN-ATLAS-001-tibia-asset-rights-attestation.md`.

## Evidence classification

### FACT

The owner attestation exists and applies to the exact asset archive digest above.

### LIMITATION

The attestation is user/owner-supplied authorization and is not independently verified third-party copyright evidence. Atlas must not represent it otherwise, and it does not extend to another archive/digest without explicit extension.

### RESULT

For project execution, the prior asset-rights stop condition is closed for this exact digest and bounded Atlas use.

## Remaining blockers

1. **Game-owned appearance spatial profile** for the selected proof asset semantics is still missing. It must define the 32-units-per-tile basis and explicit anchor/footprint/displacement transformation needed by `oteryn-world-spatial-v1`, rather than letting Atlas infer legacy renderer conventions.
2. **Game-owned bounded Thais semantic export artifact/digest** is still missing under `oteryn-game-atlas-export-v1` + `oteryn-world-spatial-v1` + `oteryn-crystalserver-legacy-spatial-import-v1`.

These are Game authority blockers, not Atlas implementation choices.

## Next action

Create a dedicated Game task/branch/PR that freezes the bounded appearance mapping supported by the pinned Otheryn asset decoder/renderer evidence and defines/produces the bounded Thais semantic export fixture identity. After exact-head validation and merge, resume Atlas implementation with immutable semantic chunks, content-addressed pixel deduplication, semantic picking/inspector, deterministic navigation, browser renderer and measurements.

Do not parse OTBM in browser runtime, substitute the mismatched supplied OTBM, or broaden the asset authorization beyond the exact attested archive.
