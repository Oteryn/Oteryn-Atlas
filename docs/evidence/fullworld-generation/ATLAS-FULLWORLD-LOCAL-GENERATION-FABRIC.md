# ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC — G1/G2 hand-off

Status: **PASS — complete local full-world census, benchmark, deterministic generation, independent verification and resume proof.**

## Exact authority and revisions

| Field | Verified value |
| --- | --- |
| Atlas main base | `3ed3650d8933e186f589d7111978b925c4bc0080` |
| Atlas generation revision | `413826095ad4b556976aac7d56584521ac9c2050` |
| Game main base | `9e594ceb292cb2a54bf968fb057501b743443728` |
| Game generation revision | `f79fd3b5c239fa13810338f1380539c4eac67d7d` |
| Legacy importer revision | `e417c5e7c22986bf4acef0495eb47f7b72c97cce` |
| world.otbm SHA-256 | `3bd40d14fefec41f24c4b3ae879e420be1a831ef55b95dcbec721e587a09b034` |
| 15.32.zip SHA-256 | `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f` |
| catalog SHA-256 | `35639e000c4c108665a091cfbdf699d549d995b37670bc08de575ab6cd380d85` |
| appearance SHA-256 | `dc4f4c01e3701c77877c67895168e4399837046122d6d17e3e608a12a2fed075` |
| fabric.py SHA-256 | `3fcddb5d28dc86ccc2528b115a1f9e671fdc94b247e3256064b2bdfd6e86f80a` |
| Game producer.py SHA-256 | `b3fcb59a8a5df3f5e9acb25036086215a60b8d66c8a01985172707559edf1a2f` |

`Oteryn-Game` remains semantic authority. Atlas orchestrates local census, batching, sharding, checkpointing and hashes only; browser/runtime legacy fallback remains forbidden.

## G1 — full-world census and benchmark: PASS

- Floors: **16** (`-15..0`).
- Tiles: **18,997,668**.
- Presentation records: **24,502,036**.
- Resolved primitives: **24,502,035**.
- Unique appearance source IDs: **25,198**.
- Unique sprite source IDs: **27,394**.
- Explicit unresolved presentations: **1**, appearance source ID `2141`; no sprite was substituted.

### Per-floor census

| Floor | Bounds `[x_min,x_max) × [y_min,y_max)` | Tiles | Presentations | Primitives | Appearance IDs | Sprite IDs | Unresolved |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| -15 | `[16735,34138) × [16438,32996)` | 867,030 | 1,111,624 | 1,111,624 | 5,928 | 7,015 | 0 |
| -14 | `[11805,34139) × [11936,33021)` | 1,205,615 | 1,536,722 | 1,536,721 | 7,110 | 8,327 | 1 |
| -13 | `[12135,34138) × [11936,33016)` | 1,134,136 | 1,411,771 | 1,411,771 | 6,708 | 7,914 | 0 |
| -12 | `[10201,34140) × [10145,33020)` | 1,514,397 | 1,837,498 | 1,837,498 | 6,940 | 8,126 | 0 |
| -11 | `[13936,34132) × [14029,33021)` | 1,650,283 | 2,091,082 | 2,091,082 | 8,387 | 9,692 | 0 |
| -10 | `[10273,34123) × [10150,33022)` | 2,068,919 | 2,644,145 | 2,644,145 | 9,966 | 11,496 | 0 |
| -9 | `[10078,34118) × [10022,33023)` | 2,286,726 | 2,961,179 | 2,961,179 | 10,636 | 12,265 | 0 |
| -8 | `[10282,34125) × [10188,33813)` | 2,335,774 | 3,022,362 | 3,022,362 | 10,527 | 12,042 | 0 |
| -7 | `[1006,34021) × [1013,33050)` | 4,535,848 | 5,797,203 | 5,797,203 | 13,189 | 14,647 | 0 |
| -6 | `[1023,33964) × [1032,33001)` | 544,160 | 806,125 | 806,125 | 10,071 | 11,294 | 0 |
| -5 | `[1027,34144) × [1033,32984)` | 355,035 | 530,900 | 530,900 | 8,714 | 9,776 | 0 |
| -4 | `[1340,33964) × [3417,32984)` | 210,291 | 316,147 | 316,147 | 7,043 | 7,908 | 0 |
| -3 | `[1340,33964) × [3418,32984)` | 126,801 | 195,110 | 195,110 | 5,110 | 5,774 | 0 |
| -2 | `[1340,33964) × [3419,32983)` | 84,551 | 129,388 | 129,388 | 3,970 | 4,574 | 0 |
| -1 | `[1341,33964) × [3421,32983)` | 50,053 | 74,309 | 74,309 | 2,697 | 3,131 | 0 |
| 0 | `[1356,33963) × [3298,32948)` | 28,049 | 36,471 | 36,471 | 1,110 | 1,327 | 0 |

### Worker benchmark

Sample: **24,576 tiles**. Selection rule: smallest stable worker count within 3% of maximum observed tile throughput.

| Workers | Seconds | Tiles/s | CPU-equivalent cores |
| ---: | ---: | ---: | ---: |
| 1 | 0.532 | 46,228.3 | 0.97 |
| 2 | 0.303 | 81,165.9 | 1.90 |
| 4 | 0.186 | 131,835.0 | 3.37 |
| 8 | 0.179 | 137,250.2 | 3.72 |
| 12 | 0.181 | 135,907.6 | 3.69 |
| 14 | 0.189 | 129,871.0 | 3.88 |

**Selected transform workers: 8; finalization workers: 8.**
Pre-heavy sample-scaled canonical JSONL estimate: **19,641,027,706 B**; actual final JSONL: **18,750,839,498 B**.

## G2 — deterministic resumable full-world generation: PASS

- Shards: **1,197** floor×256-region shards.
- Fabric root: `sha256:ef72ccea156283eea1efd103577e2933b15b38d1a67aa05c89594cc3a731ea6f`.
- Source fingerprint: `sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9`.
- Final semantic JSONL bytes: **18,750,839,498**.
- Intermediate spool bytes: **18,978,811,514**.
- Local output directory bytes: **18,752,890,824**.
- Local work/cache directory bytes: **21,612,075,679**.

### Initial generation performance

- `determinism_rebuild_proof`: **1.183 s**
- `semantic_generation_batches`: **232.703 s**
- `shard_finalization`: **47.033 s**
- `structural_census_and_private_cache`: **273.700 s**
- `total`: **558.567 s**
- `worker_benchmark`: **1.571 s**
- External wall clock: **559.45 s**.
- Peak whole process-tree RSS: **11,627,696,128 B** (~10.83 GiB).
- Peak swap used: **0 B**.
- Observed NVMe writes during pass 1: **37,805,907,968 B**.

### Determinism proof

- Result: **PASS**.
- Rebuilt shard: `fm000007_rxp000125_ryp000122`.
- Shard root: `sha256:369857ea9fa70ef83746fab8fe8dd5c7b9d070a8fa833858816534a2235bb888`.
- Tiles SHA-256: `94ca6226833d66d84148d667f5b9e5b7acb6d3df5df02104b78136b414e1874f`.

### Resume proof

- Result: **PASS**; fabric root/source/census/shard-list equality all `true`.
- Generated batches: **0**; reused batches: **49,474**.
- Generated shards: **0**; reused shards: **1,197**.
- Private cache reused: **true**.
- Resume verification elapsed: **154.942 s**.

## Qualification and fail-closed evidence

- Post-repair bounded Thais Z7 byte parity: **PASS**, SHA-256 `ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984` equals the qualified DYN proof.
- Initial full-world attempt failed closed at the only missing appearance (`2141`, tile `33572,32528,legacy z=14`). Full-source audit found exactly one occurrence and no second missing visible appearance ID.
- Game producer preserves that record as `presentation_resolution_state=UNRESOLVED_APPEARANCE`, with zero resolved primitives; it never substitutes or infers another appearance/sprite.
- Independent final handoff verifier hashed all shard JSONL bytes, checked line counts, manifest↔descriptor consistency and recomputed the global fabric root: **PASS**.

## Compiler hand-off

- Canonical local input: `/home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json`
- `handoff.json` SHA-256: `1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659`
- Independent verification: `/home/mole/oteryn-fullworld/output/fullworld-fabric-v2/verification.json` SHA-256 `fa50b20976f4f212006835113ba1cb84ede8c3326e08f502f647bf2db81d097a`
- Output root: `/home/mole/oteryn-fullworld/output/fullworld-fabric-v2`
- Required verifier command:

```bash
python3 tools/fullworld-generation/verify_handoff.py /home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json
```

`ATLAS-FULLWORLD-COMPILER-PUBLICATION` must consume this verified semantic hand-off and its shard manifests only. It must not reopen OTBM, legacy IR or old raster Atlas data to repair the one unresolved presentation.
