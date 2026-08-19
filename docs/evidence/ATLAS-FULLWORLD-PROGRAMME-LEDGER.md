# ATLAS-FULLWORLD Programme Ledger

Coordinator: `ATLAS-FULLWORLD-COORDINATOR`

This file is the coordinator-owned factual ledger for the complete-world Atlas programme. Subordinate agents must publish their own evidence in their allocated paths; the coordinator reconciles accepted hand-offs here. Do not replace missing evidence with assumptions.

## Activation snapshot

| Field | Verified value |
| --- | --- |
| Atlas repository | `Oteryn/Oteryn-Atlas` |
| Atlas activation `main` | `610518701ad3709692d55c6dc38a152edd0363f3` |
| Game repository | `Oteryn/Oteryn-Game` |
| Game activation `main` | `63a6cb8cb3e69b7c2f792475f24093e90bd7fd81` |
| DYN-ATLAS-001 merge on Atlas main | `750ecab7b600ea078a832f5f95059f08ce57a06a` |
| Full-world execution suite | `docs/agents/prompts/ATLAS-FULLWORLD-AGENT-SUITE.md` |
| Atlas open PRs at activation | none |
| Atlas governance issue | `#6` open |
| Atlas `main` protection at activation | unprotected according to live repository metadata |

## Authority ledger

### PROVEN

- `Oteryn-Game` is the canonical World/Content authority.
- `Oteryn-Atlas` is a derived semantic projection/read model.
- Browser runtime may not use OTBM, Legacy IR, Canary/Crystal sources or legacy raster Atlas data as fallback authority.
- DYN-ATLAS-001 proved a bounded Thais Z7 WebGL2 architecture/runtime path and was merged; it did not prove complete-world coverage.
- Heavy complete-world generation is assigned to the owner's local workstation, not GitHub-hosted runners.

### DERIVED programme decisions

- Start Phase A with local generation plus semantic authority audit plus CI/preview planning in parallel.
- Start compiler/publication only after a verified census/source hand-off.
- Start full GUI integration only against stable verified full-world publication/layer contracts.
- Use measured worker-count/resource evidence rather than a fixed local concurrency value.

### UNKNOWN until subordinate evidence arrives

- exported floor set and bounds;
- tile/presentation/primitive counts by floor and globally;
- unique appearance/sprite references by floor and globally;
- full-world generated/published byte sizes;
- measured optimal local worker counts and resource peaks;
- final world/per-floor semantic roots;
- final pixel root/pack segmentation/dedupe metrics;
- layer-by-layer authoritative availability and full-world counts;
- real-browser complete-world memory/performance evidence;
- final preview revision/URL and CI run IDs.

### CONFLICT

The archived DYN task still contains a historical statement that its merge remained pending. Live Atlas `main` already contains PR #4 via `750ecab7b600ea078a832f5f95059f08ce57a06a`; current live state supersedes that stale archived wording.

## Gate ledger

| Gate | Owner | State | Evidence required |
| --- | --- | --- | --- |
| G0 preflight | coordinator | PASS | exact live repo heads, authority, open work, path ownership |
| G1 census/benchmark | local generation | PENDING | floor/bounds/count census + representative worker benchmark |
| G2 complete generation | local generation | PENDING | deterministic resumable all-floor shards/manifests/digests |
| G3 publication | compiler/publication | BLOCKED_G2 | world/floor roots, indexes, pixels, reconciliation, negatives |
| G4 semantic layers | semantic layers | AUDIT_STARTABLE | authoritative source/status per layer; implementation evidence for proven layers |
| G5 GUI/runtime | GUI runtime | BLOCKED_G3_G4 | all-floor browser navigation + layers/search/inspector/deeplinks + measured browser evidence |
| G6 CI/preview | CI/closeout | PLANNING_STARTABLE | exact-head CI without hosted heavy generation + independently verified Synology preview |
| G7 final closeout | coordinator | BLOCKED_G1_G6 | integration, issue #6 disposition, final exact-head CI, archive, post-merge main inspection |

## Subordinate hand-off registry

No complete-world subordinate hand-off has been accepted yet.

### Expected: `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`

Must provide at minimum:

- pinned Atlas/Game revisions used;
- workstation census and benchmark table;
- selected worker policy and resource evidence;
- complete exported-floor census;
- shard model and stable shard identifiers;
- per-shard source provenance/digests/status;
- resume/checkpoint proof;
- deterministic verification result;
- exact downstream manifest/path contract.

Status: **NOT RECEIVED**.

### Expected: `ATLAS-FULLWORLD-COMPILER-PUBLICATION`

Must provide at minimum:

- accepted generation hand-off identity;
- world and per-floor manifests/roots;
- semantic chunk/index identities;
- complete authorized pixel publication identities;
- global pixel dedupe/reconciliation metrics;
- corruption/missing/forged negatives;
- deterministic rebuild evidence.

Status: **BLOCKED ON GENERATION HAND-OFF**.

### Expected: `ATLAS-SEMANTIC-LAYERS-AND-INDEXES`

Must first publish an authority matrix for towns/temples, teleports/transitions, houses/doors, AID/UID, waypoints, mechanics/raids/quest areas/POIs, NPCs, monsters/spawns and minimap/overview. Each layer must be `PROVEN`, `BLOCKED`, `UNKNOWN` or `N/A` with exact upstream evidence.

Status: **AUTHORITY AUDIT MAY START**.

### Expected: `ATLAS-FULLWORLD-GUI-RUNTIME`

Must consume only accepted Atlas full-world publication/layer contracts and provide real-browser complete-world qualification across representative floors/regions.

Status: **BLOCKED ON STABLE PUBLICATION/LAYER CONTRACTS**.

### Expected: `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT`

May plan CI and deployment now, but final execution must wait for accepted publication/layer/GUI heads. Hosted CI must not perform the heavy full-world generation.

Status: **PLANNING MAY START; FINAL DELIVERY BLOCKED**.

## Baseline bounded proof — not full-world data

```text
DYN bounded floor = -7
DYN bounded tiles = 24,311
DYN bounded presentation records = 39,282
DYN semantic root = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
DYN pixel root = sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a
DYN sprite refs = 990
DYN unique pixel blobs = 987
15.32.zip SHA-256 = 1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
```

These values are historical bounded proof identities only. The 15.32 authorization is exact-digest scoped and must not be generalized silently.

## Coordinator next action

Merge the coordination bootstrap only after exact-head CI passes. Then Phase A execution order is:

1. `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC` — start full census/benchmark/generation on the owner's workstation;
2. `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` — start authority audit/contracts in parallel;
3. `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT` — start CI/self-hosted/preview planning only;
4. start `ATLAS-FULLWORLD-COMPILER-PUBLICATION` after generation census/source hand-off;
5. start `ATLAS-FULLWORLD-GUI-RUNTIME` against stable publication contracts, with layer integration as factual layer contracts become proven.
