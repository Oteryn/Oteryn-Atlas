# ATLAS-SEMANTIC-LAYERS-AND-INDEXES — G4 authority re-audit

Status: `G4_PARTIAL_PROVEN`

This re-audit continues the merged Phase A audit after G3 full-world publication
became available. It preserves the Game default-deny authority boundary and
promotes only the one layer that can now be derived without inventing new Game
facts: `minimap-overview`.

## Exact revisions and upstream hand-off

- Atlas implementation base: `Oteryn/Oteryn-Atlas@5f649bffb5b82d17679e55ca8c40eb0b0dcb30e4`.
- Agent suite blob at that base: `4872889f5eacdb56727d0624bfd230f2c3194ea8`.
- G3 publication contract blob: `c1a35e71197fc2fa60aee821fba248a9c945c0cf`.
- G3 publication evidence blob: `766f1fb77dec48dff34889bce4fa091411ffd65c`.
- Pinned Game source revision carried by G3: `f79fd3b5c239fa13810338f1380539c4eac67d7d`.
- Game `main` revalidated during this continuation: `c3dc8da61a0419706dd94002677fe1896b3b2144`.
- Full-world Game producer blob at both the pinned source and current Game main:
  `3e5cd427c5d51f3095d87847bedb495b918f9fc1`.

Verified G3 identities:

- publication root: `sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f`;
- semantic root: `sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9`;
- source fingerprint: `sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9`;
- floors: `16`;
- semantic shards: `1,197`;
- tiles: `18,997,668`;
- resolved primitives: `24,502,035`.

## FACT — current Game capability boundary

The qualified full-world Game adapter broadens spatial selection only. Its
semantic capability set remains:

- `resolved-appearance-primitives-v0`;
- `semantic-tiles-v0`.

It explicitly does not add or infer towns, NPCs, spawns, raids, quests or other
factual overlays. The Game export contract remains default-deny: candidate
record families do not become public merely because the canonical source may
contain related data.

Therefore G3 removes the publication blocker but does **not** remove the
Game-authority blocker for entity/overlay families.

## Layer classification after G3

| Layer | Status | Exact disposition |
| --- | --- | --- |
| towns | BLOCKED | Game still emits no public town capability/records. |
| temples | UNKNOWN | No canonical public Atlas temple/respawn semantic contract. |
| teleports / transitions | BLOCKED | No public endpoint/direction capability/records. |
| houses | BLOCKED | No public house identity/geometry capability/records. |
| house doors | UNKNOWN | No canonical public house-door relationship contract. |
| Action IDs | BLOCKED | Legacy numeric identifiers remain non-canonical/public unless Game explicitly promotes them. |
| Unique IDs | BLOCKED | Same stable-identity/public-classification blocker as Action IDs. |
| waypoints | BLOCKED | No public waypoint capability/records. |
| mechanics | BLOCKED | No deliberately public mechanics capability/records. |
| raids / encounters | BLOCKED | No public encounter identity/geometry capability/records. |
| quest areas | UNKNOWN | Public quest-area semantics and safe fields remain undefined. |
| factual POIs | BLOCKED | No public POI capability/records. |
| NPCs | BLOCKED | No public NPC definition/placement/spawn capability/records. |
| monsters / spawns | BLOCKED | No public monster definition/placement/spawn capability/records. |
| minimap / overview | **PROVEN / ENABLED** | Safely derived from verified G3 semantic tile presence only; no sprite/pixel or gameplay inference. |

Result: **1 PROVEN/ENABLED, 11 BLOCKED, 3 UNKNOWN**.

## PROVEN — full-world overview/index publication

Contract: `src/layers/overview-v0.md`.

Implementation:

- `tools/fullworld-layers/build_overview.py`;
- `tools/fullworld-layers/verify_overview.py`;
- `src/layers/overview.mjs`.

The overview is a sparse absolute-coordinate 16x16-tile density index. It
records only the count of already-published semantic tile records and resolved
primitive references. It explicitly does not claim walkability, collision,
terrain classification, quest state, mechanics, path legality or live state.

Full-world build on `Molehill-PC` from the exact G3 publication:

```text
PASS root=sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db
floors=16
chunks=1197
cells=100037
tiles=18997668
primitives=24502035
```

- canonical `world.json` SHA-256:
  `6206eb5702e14d893c4303b592d0ff197a362934d8cbad6623db9927f368846e`;
- exact output bytes: `7,695,652` across `1,214` files;
- build with `12` workers: `5.37 s` wall clock, parent max RSS `27,984 KiB`,
  swap `0`; parent RSS does not aggregate child-process RSS;
- source-linked full verifier: `0.22 s`, max RSS `23,168 KiB`, swap `0`;
- deterministic rebuild produced the same root and byte-identical tree.

During the build every one of the 1,197 source semantic chunks was rechecked for
byte size, SHA-256 content identity, tile count and resolved primitive count
before its overview data was accepted.

The builder and source-linked verifier additionally require the separately trusted
G3 publication root. The JS world loader requires both the trusted overview root
and trusted source-publication root; recomputing a root from an untrusted manifest
is not treated as sufficient authority.

Machine-readable evidence: `docs/evidence/fullworld-layers/overview-summary.json`.

## Verification

```text
python tools/fullworld-layers/verify_authority_registry.py \
  docs/evidence/fullworld-layers/layer-authority-registry.json
PASS layers=15 proven=1 blocked=11 unknown=3

python -m unittest discover -s tests/fullworld-layers -p 'test_*.py' -v
13/13 PASS

Windows Node v24.18.0:
node tests/fullworld-layers/overview-browser.test.mjs
4/4 PASS

full-world source-linked verifier:
PASS root=sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db
floors=16 chunks=1197 cells=100037 tiles=18997668 primitives=24502035

deterministic rebuild tree compare:
PASS
```

Negative coverage includes corrupt source chunks, corrupt derived chunks,
duplicate logical addresses, forged G3 registry roots, unauthorized capability
changes, attempted enablement of blocked layers and attempted promotion of any
non-overview layer.

## Remaining authoritative blockers

`minimap-overview` is complete at the Agent 3 data-contract/index boundary.
The other 14 intended families cannot truthfully be implemented from current
Game exports. They require separately governed Game export/public-policy
capabilities with stable identity, public-safe fields, geometry/position
semantics and deterministic producer output.

This agent does not repair those blockers through OTBM, legacy Atlas files,
Canary/Crystal data, pixel/sprite inference or browser heuristics.

## Scope discipline / hand-off

Only coordinator-assigned Agent 3 paths are changed:

- `tools/fullworld-layers/**`;
- `docs/evidence/fullworld-layers/**`;
- `src/layers/**`;
- `tests/fullworld-layers/**`.

No Game, GUI/browser-shell, publication/compiler, coordinator-ledger or CI
workflow path is modified. The GUI agent may consume `src/layers/overview.mjs`
and the `overview-v0` publication; all other layer toggles must remain disabled
until their registry status is upgraded from authoritative upstream evidence.
