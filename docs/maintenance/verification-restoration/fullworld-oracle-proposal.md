# FullWorld oracle and impact-routing evidence

Scope: read-only review of `Oteryn-Atlas` at `f00815858bb5b031c502ad19fb96a05ff66b4d84`. Issue #315 remains `PAUSED_BEFORE_VERIFICATION_RESTORATION`; this is preparatory design only. No FullWorld product, specialist runner, browser qualification, publication, or deployment was executed.

## Decision

Propose one new semantic verification group, **`fullworld.complete-integrity`**, for changes whose correctness claim is about the complete real product. This is an architecture-review candidate, not an accepted model. Keep ordinary algorithm, safety, HTTP, UI, and source-compatibility proofs on deterministic fixtures or the bounded real product. Do not attach `real_fullworld` to the five `tools/fullworld-*` directories as a whole.

The current planner cannot express that policy safely. It unions every matching prefix (`build-verification-plan.mjs:71-104`), so a narrower rule cannot override a directory rule. The current specialist partitioner also considers browser groups only (`protected-semantic-routing.mjs:61-78`), so a non-browser real-product integrity group would be selected in the plan but omitted from specialist placement. Both facts must be corrected before this group can be activated.

## What the real oracle must prove

`fullworld.complete-integrity` has `dataCapability=real_fullworld`, `hosted=false`, `specialistReason=real-fullworld-product`, `resourceClass=artifact-build`, `evidence=machine-summary`, `sequential=true`, and no visual-review claim. It is an artifact/integrity group, not a repackaged full browser suite.

Its exact inputs are an immutable Atlas candidate SHA plus the authorized Game, legacy-importer, map, asset ZIP, catalog, and appearance identities. Its machine evidence must bind those inputs and the candidate code digest, then prove:

1. a clean complete fabric build and independent handoff verification;
2. complete floor/shard/tile/presentation/primitive/byte census reconciliation and every described shard's size/digest/root;
3. publication compilation plus independent semantic/pixel/source-linkage verification, including every referenced sprite and pack;
4. clean complete rebuild equality for every content-derived root (or two independently built trees), rather than the current single-largest-shard determinism sample;
5. complete runtime-index and pixel-bucket derivation, with all source chunks/blobs represented exactly once and all aggregate counts/roots reconciled;
6. complete overview and minimap derivation, with one-to-one floor/logical-address coverage, source-root linkage, aggregate counts, and deterministic output roots;
7. fail-closed evidence for a missing/corrupt descriptor/blob/chunk against the complete product, without weakening roots or using stale output.

The existing source establishes that these are corpus-wide claims: `fabric.py:1099-1269` consumes all authorities, builds all batches/shards and the global census; `verify_handoff.py:35-95` walks every shard and reconciles global totals; `publication.py:95-141` requires the 16-floor/1197-shard handoff and scans every shard/sprite; the downstream builders iterate all publication floors/chunks/blobs. The capability contract explicitly reserves `real_fullworld` for complete publication/census/root linkage, generator/compiler determinism, full-product scale/performance/soak, and overview/minimap consistency (`docs/agents/operations/VERIFICATION_CAPABILITY.md:5-10`).

The group needs a real non-browser specialist obligation in the protected plan, including an executable spec/command identity and evidence digest. Extending the partitioner is mandatory; representing it as an arbitrary Playwright scenario would hide the artifact-build oracle behind a browser stable ID. Real browser release/performance acceptance may depend on this group, but it is a distinct claim and should only be selected when the browser qualifier or release/performance policy changes.

## Exact impact boundary

Every listed product-semantic file should select the existing focused/unit proof, fixture browser coverage where its output is consumed, and `fullworld.complete-integrity`. The real group is additive; its presence does not turn `e2e.full` into a real-data group.

| File | Minimum real-product reason | Fast proof that still runs |
|---|---|---|
| `tools/fullworld-generation/fabric.py` | Owns complete source fingerprint, global structural/semantic census, all batches/shards, handoff root, resumability and generation resource evidence. Current determinism proof rebuilds only the largest shard (`fabric.py:1205-1221`), so a fixture cannot support complete generator determinism. | Unit/property tests for canonicalization, partition boundaries, resume invalidation, output isolation, malformed records. |
| `tools/fullworld-generation/verify_handoff.py` | A PASS means every described shard exists and global tiles/bytes/root reconcile (`verify_handoff.py:35-95`). | Synthetic handoffs for path, digest, ordering, duplicate and count failures. |
| `tools/fullworld-publication/publication.py` | Pins the complete census, scans all shards and sprite references, and compiles the full semantic/pixel roots. | Existing canonical-JSON parity, output-swap safety, tiny semantic/pixel fixtures. |
| `tools/fullworld-publication/verify_publication.py` | Defines the independent complete semantic, pixel, asset-authority and source-linkage acceptance claim (`verify_publication.py:129-469`). | Existing hash/path/file/pixel identity unit tests plus bounded malformed products. |
| `tools/fullworld-publication/negative_tests.py` | Its contract is corruption/missing-input rejection against the complete compiled product and authorized source linkage. | Small mutation fixtures should cover each failure branch quickly; complete-product mutation remains the final oracle. |
| `tools/fullworld-runtime/build_runtime_index.py` | Scans every semantic chunk and creates all floor/world groups, visual bounds, counts, roots and incremental reuse identities. | The current one-floor/one-chunk self-test proves grouping, reuse and corruption rejection (`runtime_index_self_test.py:22-121`). |
| `tools/fullworld-runtime/build_pixel_buckets.py` | Walks every pixel pack/blob and publishes complete stable buckets, blob index and local-max bundle. | Synthetic multi-pack/bucket tests for hashing, boundaries, reuse, corruption and output safety. |
| `tools/fullworld-layers/build_overview.py` | Produces cells for every semantic chunk/floor and reconciles all source/product roots and totals. | Existing two-floor fixture proves round trip, no semantic overclaim, reuse, corruption and duplicate-address rejection (`test_overview.py:165-274`). |
| `tools/fullworld-layers/verify_overview.py` | Its complete PASS must compare the entire overview coverage and aggregate counts to the entire publication. | Same deterministic overview fixture and negative variants. |
| `tools/fullworld-minimap/build_minimap.py` | Iterates every published sprite and every floor/chunk, then binds the world product to publication, semantic and pixel roots (`build_minimap.py:67-205`). | Existing single-tile fixture proves PNG determinism and non-claim semantics (`minimap_builder_self_test.py:19-61`); add malformed/missing/digest cases. |

These files do **not** require the complete product merely because of their directories:

| File | Sufficient oracle | Reason |
|---|---|---|
| `tools/fullworld-runtime/cdp-session.mjs` | Deterministic unit | RPC deadlines, pending-request cleanup and close behavior are byte-independent; `tests/fullworld-runtime/cdp-session.test.mjs` already uses a fake WebSocket. |
| `tools/fullworld-runtime/serve_qualified.py` | Deterministic HTTP fixture; optionally one digest-bound bounded real range for compatibility | Path confinement, HEAD/GET/206/416, content length/range and EOF streaming are transport rules (`serve_qualified.py:20-111`). Synthetic files can exercise size and boundary cases. Complete map bytes do not alter the oracle. |
| `tools/fullworld-layers/verify_authority_registry.py` | Deterministic committed JSON | It checks a closed registry schema, repository/SHA/content-ID shapes and `PROVEN/BLOCKED/UNKNOWN` policy; no publication bytes are read. |

`tools/fullworld-runtime/qualify_browser.mjs` is mixed. Its CDP/session/timeouts and LOD/search transitions are fixture-capable, while its declared `G5_REAL_CHROME_FULLWORLD_QUALIFICATION`, complete-product wall/RSS metrics, and release screenshot are real-product acceptance (`qualify_browser.mjs:183-269`). Until generic orchestration is extracted from real-product acceptance, route changes to this file conservatively to both fixture browser proof and the applicable real FullWorld browser-acceptance obligation. Do not make it part of `fullworld.complete-integrity` unless the group explicitly owns browser release/performance acceptance.

No reviewed file has a bounded-real requirement by itself. `bounded_real_world` is appropriate only for a separately stated compatibility assertion, such as one immutable real semantic chunk through the range server. It cannot replace the complete integrity group for a producer/verifier above.

## Manifest design and unknown fallback

Introduce an exact-path rule type (for example `pathExact`) that suppresses broader `pathPrefix` matches for that one path. Preserve current prefix union behavior when no exact rule exists. Then:

* add exact rules for every known file above, selecting either `fullworld.complete-integrity` or the bounded/fixture owner shown in the tables;
* keep each `tools/fullworld-*` directory prefix only as an **unknown-new-file guard** with domain `unknown-complete-product-impact` and group `fullworld.complete-integrity`;
* cover renames by classifying both old and new paths, as the planner already does;
* fail closed to the real group when a changed hunk crosses extracted product/generic module boundaries or an exact rule is absent;
* use the ordinary global fallback (`profile=full`, fixture groups) outside these complete-product namespaces unless another rule establishes material complete-product uncertainty.

This makes the conservative case explicit without claiming that `cdp-session.mjs`, the local range server, or the authority-registry checker needs ~19 GB of bytes. The protected and candidate manifests must still be unioned so a candidate cannot downgrade the protected exact rule.

The current `deterministic.core` catalog entry names only `tests/verification/*.test.mjs` (`verification-catalog.json:4-10`); it does not own the actual `tests/fullworld-*` unit suites. Add a separately executable hosted group such as `unit.fullworld-tools` (or expand execution ownership with explicit commands) before relying on “deterministic.core” as proof of these tools. Python and Node commands must be first-class plan obligations, not inert strings that the hosted browser runner ignores.

## Issue #376 minimal routing

The functional gameplay E2E is already fixture-owned by `e2e.creatures`, and the isolated Game-fact test is already `bounded_real_world` in `integration.source-contract` (`verification-catalog.json:20-32,84-93`). The missing pieces are exact impact ownership:

```json
{
  "pathExact": "src/browser/creature-gameplay-profiles.mjs",
  "domains": ["creatures", "source-contract"],
  "minimumProfile": "targeted",
  "requiredGroups": ["deterministic.core", "e2e.creatures", "integration.source-contract", "visual.creatures"]
}
```

```json
{
  "pathExact": "e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs",
  "domains": ["creatures", "source-contract", "test-contract"],
  "minimumProfile": "targeted",
  "requiredGroups": ["deterministic.core", "e2e.creatures", "integration.source-contract"]
}
```

Expected plans for either isolated path: `requiresRealFullWorld=false`; data capabilities exactly `bounded_real_world` and `qualification_fixture`; functional owner `e2e.creatures`; source owner `integration.source-contract`; no `e2e.full`, `fullworld.animation-census`, or `fullworld.complete-integrity`. Preserve `visual.creatures` for the runtime module because gameplay validation changes can alter user-visible creature detail; editing the source-contract test itself does not create a visual obligation.

The existing regression contract already demands both missing explicit rules and the runtime plan's two capabilities (`tests/verification/qualification-gameplay-contract.test.mjs:67-100`). Add the same isolated-plan assertions for the source-contract spec and explicit absence of FullWorld groups. With the current prefix-only union, merely adding the two existing-schema entries is insufficient: the spec still matches generic `e2e/` and acquires profile/full-suite ownership. The exact-path override is therefore part of the minimal correctness fix, unless the generic `e2e/` catchall is replaced by an exhaustive specific inventory with an equivalent unknown fallback.

## Explicit unresolved oracles

The following remain **BLOCKED/UNKNOWN**, rather than implicitly satisfied by the proposal:

* no executable `fullworld.complete-integrity` oracle, exact input-identity manifest, or candidate-bound evidence schema exists;
* no controller currently places a selected non-browser real-FullWorld group on the specialist runner;
* no current complete-product proof rebuilds the whole fabric twice; the checked-in fabric samples one largest shard for determinism;
* no current focused catalog group executes the Python/Node `tests/fullworld-*` commands as declared plan obligations;
* whether complete artifact generation can run safely and repeatably on the approved specialist capacity, within measured disk/time limits, has not been demonstrated;
* `build_minimap.py` consumes publication/pixel/semantic JSON and pack offsets directly without the independent root/digest validation visible in the overview/publication verifiers; the complete-integrity runner must not treat the builder's output root as an independent source-integrity oracle;
* the product-independent and release/full-product responsibilities inside `qualify_browser.mjs` are not separated, so its narrowest durable route is unresolved;
* the planner has no exact-path override or equivalent closed ownership model, so the proposed FullWorld boundaries and #376 no-escalation result are not implementable by JSON edits alone;
* exact reviewed full-product census values and expected output roots for the future candidate/input tuple are unavailable in this review. They must be generated and independently bound under separate authority, never copied from stale evidence.

## Activation gate

This design must remain inert while #315 is paused. Before any future shadow activation, require: schema/planner/merge tests for exact override and protected/candidate union; specialist placement tests for non-browser `real_fullworld`; executable unit-group ownership; exact product identity/evidence schema; then the separately authorized shadow/canary sequence. No stale product or existing animation census evidence can satisfy `fullworld.complete-integrity`.
