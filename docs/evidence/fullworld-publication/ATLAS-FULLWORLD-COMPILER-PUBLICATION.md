# ATLAS-FULLWORLD-COMPILER-PUBLICATION — G3 hand-off

Status: **PASS — complete-world semantic and authorized pixel publication compiled, independently verified, negative-tested and deterministically rebuilt.**

## Exact basis

- Atlas implementation base: `6a1ca4f4d2517bca40e774a7005d6bfefe448e7b`.
- Implementation commit: `5d9e084fb19f6953bdc6e5abe610eafd1ab86151`.
- Source-reconciliation hardening commit: `fe64b0f08211f5aabcef6d38f5866147d8eff319`.
- Source authority: `Oteryn/Oteryn-Game`.
- Game source revision: `f79fd3b5c239fa13810338f1380539c4eac67d7d`.
- Verified generation hand-off SHA-256: `1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659`.
- Fabric root: `sha256:ef72ccea156283eea1efd103577e2933b15b38d1a67aa05c89594cc3a731ea6f`.
- Source fingerprint: `sha256:52613c4b755bee1ca32608b1b860413c3a9184870ca61114fad5a7670e80aee9`.
- Exact authorized asset ZIP SHA-256: `1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f`.

The compiler consumes only the verified fabric hand-off and the exact authorized asset archive. It never reopens OTBM, legacy IR or historical Atlas raster data as fallback authority.

## Complete-world publication

- Floors: **16** (`-15..0`).
- Semantic shards/chunks: **1,197**.
- Tiles: **18,997,668**.
- Resolved primitives: **24,502,035**.
- Unique semantic sprite refs: **27,394**.
- Semantic JSONL bytes: **18,750,839,498**.
Publication identities:

- semantic world root: `sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9`;
- pixel root: `sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad`;
- complete publication root: `sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f`.

Every floor has its own domain-separated root. The exact 16 roots and pack checksums are recorded in `publication-summary.json`.
Logical chunk addresses remain distinct from content IDs.

## Authorized pixel publication

- Sprite refs: **27,394**.
- Unique content-addressed pixel blobs: **27,302**.
- Raw RGBA before global content dedupe: **253,296,640 B**.
- Raw RGBA after dedupe: **252,592,128 B**.
- Dedupe saving: **704,512 B**.
- Deterministic packs: **4**.
- Pixel manifest: **7,416,538 B**.

Pixel identity binds width + height + exact RGBA bytes. Pack placement is transport/runtime state only; every pack and runtime placement records `identityAuthority=false`.
The independent verifier re-decodes the exact authorized asset archive through the existing independent pixel-measure decoder and confirms all **27,394** `sprite_source_id -> pixel contentId` mappings.
It also reconciles every published logical shard address, chunk content ID, byte count, tile count, floor bounds and floor/world count against the exact pinned generation hand-off.

## Performance

Measured second complete rebuild:
- compile: **47.362 s**;
- peak RSS: **456,328 KiB** (~445.6 MiB);
- swap: **0 B**.
Measured full independent verification of the first publication:
- verifier: **52.630 s**;
- peak RSS: **323,236 KiB** (~315.7 MiB);
- swap: **0 B**;
- result: **PASS**.

The first compile was **47.332 s**. The output path is `/home/mole/oteryn-fullworld/output/fullworld-publication-v0`; the local publication directory occupies **19,011,164,550 B** including manifests and hard-linked semantic content.

## Fail-closed negatives

`tools/fullworld-publication/negative_tests.py` ran **9/9 PASS** by proving rejection of:

1. forged top-level publication root;
2. missing semantic chunk;
3. corrupt semantic chunk;
4. forged per-floor manifest root;
5. forged logical shard address even after recomputing floor/world roots;
6. missing pixel pack;
7. corrupt pixel pack;
8. forged pixel blob identity even after recomputing the enclosing pixel manifest root;
9. forged `sprite_source_id -> pixel contentId` mapping against the exact authorized asset archive.

No negative test mutates the verified fabric. Temporary semantic fixtures and pixel-pack symlinks isolate all corruption cases.

## Determinism proof

A second complete build to `/home/mole/oteryn-fullworld/output/fullworld-publication-v0-rebuild` produced the identical semantic, pixel and top-level publication roots.
The rebuild independently passed `verify_publication.py` and `diff -qr --exclude=build-evidence.json` reported **PASS** for byte-for-byte equality of the publication tree.
`build-evidence.json` is deliberately excluded because it contains observed elapsed time and the local output path; neither field participates in any publication root.
## Validation commands

Core local checks:

```text
python3 -m py_compile tools/fullworld-publication/publication.py tools/fullworld-publication/verify_publication.py tools/fullworld-publication/negative_tests.py tests/fullworld-publication/test_publication.py
python3 -m unittest discover -s tests/fullworld-publication -p test_*.py -v
python3 tools/fullworld-publication/verify_publication.py <exact full-world arguments>
python3 tools/fullworld-publication/negative_tests.py <exact full-world arguments>
diff -qr --exclude=build-evidence.json <publication> <rebuild>
git diff --check
```

Results:
- Python compile: **PASS**;
- unit tests: **5/5 PASS**;
- complete publication verifier: **PASS**;
- authorized sprite mapping reconciliation: **27,394/27,394 PASS**;
- negative tests: **9/9 PASS**;
- deterministic rebuild: **PASS**;
- deterministic publication-tree comparison: **PASS**;
- `git diff --check`: **PASS**.

## Downstream hand-off

GUI/layer consumers may use the stable factual v0 publication contract in `src/publication/fullworld-v0.md` and the exact publication roots above without consulting legacy inputs.
The serializer/framework remains explicitly provisional and is not made permanent by this scaling proof.
Final programme merge lifecycle remains owned by `ATLAS-FULLWORLD-COORDINATOR`.

### Exact heavy invocations

```text
python3 tools/fullworld-publication/publication.py --repo-root . --fabric-dir /home/mole/oteryn-fullworld/output/fullworld-fabric-v2 --handoff /home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json --asset-zip /home/mole/oteryn-fullworld/inputs/15.32.zip --output /home/mole/oteryn-fullworld/output/fullworld-publication-v0 --expected-handoff-sha256 1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659
python3 tools/fullworld-publication/verify_publication.py --repo-root . --publication /home/mole/oteryn-fullworld/output/fullworld-publication-v0 --handoff /home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json --asset-zip /home/mole/oteryn-fullworld/inputs/15.32.zip --expected-handoff-sha256 1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659
python3 tools/fullworld-publication/negative_tests.py --repo-root . --publication /home/mole/oteryn-fullworld/output/fullworld-publication-v0 --handoff /home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json --asset-zip /home/mole/oteryn-fullworld/inputs/15.32.zip --expected-handoff-sha256 1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659
python3 tools/fullworld-publication/publication.py --repo-root . --fabric-dir /home/mole/oteryn-fullworld/output/fullworld-fabric-v2 --handoff /home/mole/oteryn-fullworld/output/fullworld-fabric-v2/handoff.json --asset-zip /home/mole/oteryn-fullworld/inputs/15.32.zip --output /home/mole/oteryn-fullworld/output/fullworld-publication-v0-rebuild --expected-handoff-sha256 1d1ab30a59819e41592d701adb188ea619b1122ccf7298255c2afd08d2841659
diff -qr --exclude=build-evidence.json /home/mole/oteryn-fullworld/output/fullworld-publication-v0 /home/mole/oteryn-fullworld/output/fullworld-publication-v0-rebuild
```
