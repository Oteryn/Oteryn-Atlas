# ATLAS-SEMANTIC-LAYERS-AND-INDEXES — authority audit

Status: `AUTHORITY_AUDIT_COMPLETE_IMPLEMENTATION_BLOCKED`

This is the Phase A authority audit required by the full-world agent suite. It does not claim full-world semantic layer implementation.

## Exact audit revisions

- Atlas: `Oteryn/Oteryn-Atlas@e87bdd54207ba9a1e412a24315c28e0507a23e5f`
- Game: `Oteryn/Oteryn-Game@63a6cb8cb3e69b7c2f792475f24093e90bd7fd81`
- Agent prompt blob: `028588791be23d23ed0f647970cfa7345c7c7601`
- Registry canonical SHA-256: `37d78c6b385d7978a772137834b26e078f346d1c74f32e432881fd1d488ec0c4`

## FACT — Game authority inspected

- Export contract: `docs/contracts/OTERYN_GAME_ATLAS_EXPORT_CONTRACT_V1.md`, blob `355874fec7a3ee888fadd7539b12bc2b575b2e56`.
- Coordinate profile: `docs/contracts/OTERYN_WORLD_SPATIAL_COORDINATE_PROFILE_V1.md`, blob `98390ab1785eeccb3675ebbb72861867009be62e`.
- World/content architecture: `docs/architecture/ADR-0005-native-world-format-and-oteryn-studio.md`, blob `ee5ca606505e2384e0bf5a47ad60ce8a5580f8a9`.
- Current executable Atlas producer: `tools/game-atlas-thais-fixture/export.py`, blob `0e36ca9e43d78a919eb673f9dc423ed1c178c727`.
- Current default-deny policy: `tools/game-atlas-thais-fixture/public_policy.py`, blob `07c183e053d76b113178b69fb60523e4b2a30e91`.

The audited producer declares only these capabilities:

- `resolved-appearance-primitives-v0`
- `semantic-tiles-v0`

The public policy is `dyn-atlas-001-static-public-presentation-v0`. It allowlists the bounded static tile/presentation shape only; it does not expose town, teleport, house, waypoint, NPC, monster, spawn, raid, POI or equivalent factual overlay records.

The Game export contract lists several of those families only as candidate semantic capabilities and is explicitly default-deny. Candidate membership is not evidence that the current producer exports or public-classifies a layer.

## FACT — Atlas upstream dependency

At the audited Atlas base there is no `tools/fullworld-generation/**`, `tools/fullworld-publication/**`, `src/publication/**` or other full-world publication hand-off. The coordinator therefore permits this agent to perform the authority audit now but keeps implementation dependent on G3/full-world publication.

The existing `web/proof/**` content remains the bounded DYN-ATLAS-001 proof and cannot be promoted to full-world evidence.

## Layer status

| Layer | Status | Exact blocker |
| --- | --- | --- |
| towns | BLOCKED | Game contract has a candidate family, but current public policy/exporter emits no town capability/records. |
| temples | UNKNOWN | No canonical Game Atlas temple/respawn semantic contract was found; Atlas must not infer temples from labels or map appearance. |
| teleports / transitions | BLOCKED | Candidate family exists, but endpoint/direction/public-field semantics are not emitted by the current exporter. |
| houses | BLOCKED | Candidate family exists, but house identity/geometry is not current public exporter output. |
| house doors | UNKNOWN | House topology exists conceptually, but no Game Atlas contract defines a public house-door relationship. |
| Action IDs | BLOCKED | Legacy numeric identifiers are not canonical public identity unless Game explicitly promotes/classifies them; current exporter does not. |
| Unique IDs | BLOCKED | Same identity/public-classification blocker as Action IDs. |
| waypoints | BLOCKED | Candidate family exists, but current public exporter emits no waypoint records. |
| mechanics | BLOCKED | Contract permits only deliberately public mechanics evidence; current policy defines none. |
| raids / encounters | BLOCKED | Candidate family and world-model concepts exist, but current public exporter emits no encounter geometry/identity records. |
| quest areas | UNKNOWN | World model permits quest-related zones, but no Atlas export contract defines which quest-area facts are public or their record semantics. |
| factual POIs | BLOCKED | Candidate family exists, but current public exporter emits no POI records. |
| NPCs | BLOCKED | Candidate definition/placement/spawn family exists, but current public exporter emits none. |
| monsters / spawns | BLOCKED | Candidate definition/placement/spawn family exists, but current public exporter emits none. |
| minimap / overview | BLOCKED | May only be derived from verified current semantic publication; the full-world publication hand-off does not yet exist. |

Result: **0 PROVEN/ENABLED, 12 BLOCKED, 3 UNKNOWN**. Every layer is explicitly disabled in `layer-authority-registry.json`.

## INFERENCE — safe next implementation boundary

No factual entity index should be implemented against the current Game snapshot because doing so would require a secondary legacy source, guessed field semantics or display/pixel inference. The safe next step is an upstream Game export/public-policy change for the desired factual capabilities, followed by the complete Atlas publication hand-off.

`minimap-overview` is different: it does not require a new entity family if it can be deterministically derived from the verified full-world semantic publication. It remains blocked until that publication exists.

## Required hand-offs before Phase B implementation

1. A separately governed `Oteryn-Game` task must define and emit each factual layer capability that should become public, including stable identity, geometry/position, public fields, certainty state and producer validation.
2. `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC` and `ATLAS-FULLWORLD-COMPILER-PUBLICATION` must deliver verified complete-world manifests/roots and stable publication contracts.
3. This agent must re-audit the exact new Game and Atlas heads before changing any layer from `BLOCKED/UNKNOWN` to `PROVEN`.

## Validation performed

```text
python -m py_compile tools/fullworld-layers/verify_authority_registry.py
PASS

python tools/fullworld-layers/verify_authority_registry.py docs/evidence/fullworld-layers/layer-authority-registry.json
PASS layers=15 proven=0 blocked=12 unknown=3 registry_sha256=37d78c6b385d7978a772137834b26e078f346d1c74f32e432881fd1d488ec0c4

python -m unittest discover -s tests/fullworld-layers -p 'test_*.py' -v
5 tests, PASS
```

Negative tests prove that the registry rejects duplicate layer identities, enabling a blocked layer, a new un-audited Game capability and a premature `PROVEN` claim.

## Scope discipline

This branch intentionally does not modify:

- `Oteryn/Oteryn-Game`;
- coordinator-owned programme ledger/task paths;
- `.github/workflows/**` owned by the CI/closeout agent;
- `src/browser/**` or `web/**` owned by the GUI agent;
- `src/publication/**` or publication tooling owned by the compiler/publication agent.

Phase A authority audit is complete. Full task Definition of Done remains blocked on authoritative Game layer exports and G3 full-world publication.
