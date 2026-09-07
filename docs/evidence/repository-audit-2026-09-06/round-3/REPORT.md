# Oteryn Atlas — round 3 repository-audit reconciliation

## 1. Audit status

`INCOMPLETE`.

This round corrects the earlier under-accounting of evidence and persists the resulting reconciliation. It does not claim that the COMPLETE REPOSITORY AUDIT prompt has been fully satisfied. No product/runtime/test/CI/ruleset/deployment changes are part of this round.

## 2. Repository snapshot

- repository: `Oteryn/Oteryn-Atlas`
- audited main: `51623c7dab2346cee39cd51e3caa845bf4b65426`
- audited tree: `8d5b8f1ea3bf636698b8cf7cc81fe434f19f58df`
- lifecycle: Issue #315 remains the verification/maintenance authority
- persistence: PR #342, draft, branch `docs/issue-315-audit-evidence-20260906`

The current audit target remains the above main snapshot; archived experiments on other SHAs are historical evidence only.

## 3. Executive assessment

The repository shows strong intent around provenance, fail-closed data acceptance, revision identity, independent geometry/visual oracles, and separation between Game-owned authority and Atlas-derived products. The largest current engineering risk is not a single catastrophic defect but accumulated verification/governance complexity plus gaps between what validators declare and what they independently recompute.

The active maintenance architecture is intentionally minimal: the protected-base maintenance validator allows only a closed maintenance diff. A green maintenance gate proves that the candidate obeys the freeze; it does not qualify the product.

## 4. Architecture assessment

Observed data path:

`Oteryn-Game / pinned product authority` -> offline generation/publication -> semantic/pixel products and transport indexes -> Nginx/HTTP -> browser loaders/trust roots -> WebGL2/Canvas -> interaction/search/inspector/Farm Explorer.

Observed control path:

`protected GitHub base` -> `tools/maintenance/verify-maintenance-diff.mjs` -> allowed maintenance diff -> normal PR/Merge Queue integration.

The architecture is coherent when each derived product is independently bound to its source identity. The audit found cases where validators compare declared roots without independently reconstructing all producer computations, reducing assurance even when downstream pins still provide another layer of protection.

## 5. Coverage ledger

The local reconciliation ledger contains 234 rows: 151 `DIRECT`, 2 `PARTIAL`, 81 `UNVERIFIED`. Within `Oteryn/Oteryn-Atlas` it records 228 rows: 150 `DIRECT`, 2 `PARTIAL`, 76 `UNVERIFIED`.

This is not the complete tracked-file denominator. Therefore no repository-wide percentage is reported and no `COMPLETE_WITHIN_ACCESSIBLE_SCOPE` claim is made.

All domains A–W were explicitly considered. Materially incomplete domains include full instruction census, complete implementation/build/test closure, current dependency vulnerability data, full Platform mutation lifecycle, current product/browser qualification, deployment state and full tracked-path reconciliation.

## 6. Findings

### F01 — P1 — cross-language canonical JSON disagreement

**FACT:** earlier preserved reproduction and source inspection showed Python/JavaScript canonicalization can disagree for integer-like object keys. **Impact:** producer and consumer may disagree about an otherwise logically equivalent derived value. **Direction:** define one language-neutral canonical form and shared vectors.

### F02 — P1 — destructive output-directory handling

**FACT:** multiple offline builders remove an existing output directory before completing generation, including reviewed FullWorld pixel/overview generation paths. The reviewed functions do not first prove that output is disjoint from input/previous-product roots. **INFERENCE:** a misconfigured output can destroy source or reusable previous-product data. **Direction:** validate resolved path disjointness, build in staging and publish atomically.

### F03 — P1 — maintenance deletion exception is broader than its stated governance purpose

**FACT:** the protected maintenance validator permits deletion of matching `tests/verification/*.test.mjs` paths based on path/operation class. Earlier mutation probes demonstrated that the path class is broader than a semantic obsolete-governance-test classification. **Direction:** when authorized, narrow by explicit inventory or protected semantic contract.

### F04 — P2 — optional persistent-cache failure can affect functional load

**FACT:** reviewed cache/range code paths can propagate environment/cache failures rather than degrading cleanly to verified network retrieval in all cases. **Direction:** keep digest verification mandatory while making optional persistence genuinely optional.

### F05 — P2 — bounded-body protection occurs after full buffering in reviewed loader path

**FACT:** the reviewed bounded response helper checks actual body length after `arrayBuffer()` materialization. **Impact:** the semantic limit does not itself cap peak buffering. **Direction:** enforce streaming/reader bounds where the payload class can be large.

### F06 — P2 — coordinate bounding/rounding edge inconsistency

**FACT:** earlier review identified a valid pre-round coordinate that can round outside the intended bound and then fail serialization/round-trip. **Direction:** clamp/quantize in a single invariant-preserving order and add permanent regression coverage when fixes are authorized.

### F07 — P2 — cache accounting/in-flight duplication debt

**FACT:** reviewed semantic-range caching code has paths where replacement accounting and concurrent same-key work are not fully deduplicated. **Direction:** make replacement byte accounting exact and share in-flight requests.

### F08 — P2 — documentation drift around required E2E

**FACT:** `e2e/README.md` still describes the historical heavy `atlas-local-e2e`/Molehill 77-scenario path as required PR qualification, while audited main is in maintenance mode with only three active workflows and protected-base diff validation. **Direction:** update documentation after/with the authorized governance cleanup; do not restore old architecture to make docs true.

### F13 — P2 — tests/contracts still reference suspended historical workflow files

**FACT:** reviewed tests read workflow files such as historical deployment/creature-overlay definitions that are not part of the current three-active-workflow maintenance set. **Impact:** stale contract tests can fail for lifecycle reasons rather than current product regressions. **Direction:** classify these as historical-governance tests or migrate them to current authority during test restoration.

### F14 — P1/P2 depending selected group — fixture routing is not solved by rewriting only the start URL

**FACT:** reviewed E2E scenarios include hard-coded real-product expectations for coordinates, entities, trade data, animation census and other published facts. The qualification-navigation adapter can rewrite historical entry coordinates but cannot make every real-data oracle fixture-independent. **Direction:** catalog each test by the minimum actual data product/capability its oracle needs; do not infer `real_fullworld` from test names.

### F15 — P2 — reviewed benchmark filename parser is inconsistent with negative-floor names

**FACT:** the reviewed compiler emits floor filenames containing negative floor notation, while the reviewed benchmark parser uses a naive hyphen split whose expected arity is inconsistent with such stems. **INFERENCE:** the benchmark can fail before measuring valid negative-floor output. **Direction:** parse the documented filename grammar or read logical address metadata instead of string-splitting filenames.

### F16 — P1/P2 — handoff verifier compares declared shard root without independently recomputing it

**FACT:** reviewed producer code computes a shard-root value; the reviewed verifier validates agreement between declarations but does not reconstruct the producer computation from the shard set in that function. **Impact:** a consistently wrong producer+manifest declaration can evade that verifier, although other independently pinned roots may still prevent acceptance later. **Direction:** independently recompute derived roots in the verifier.

### F19 — P2 — CDP harness timeout does not bound every silent RPC wait

**FACT:** reviewed browser/CDP harness timeout checks surround loop progress, while an awaited CDP `send()` lacks its own deadline. **INFERENCE:** a silent RPC can stall before the outer timeout is rechecked. **Direction:** add per-RPC deadline/abort semantics when the harness is restored.

No new verified P0 was established by this round.

## 7. Tests, CI and build assessment

Audited main exposes three active Atlas workflows:

1. `merge-authority-audit.yml` — protected-base maintenance diff validation for PR and merge-group events;
2. `merge-group-gate.yml` — minimal Merge Queue maintenance gate using the same protected validator;
3. `terminal-branch-lifecycle.yml` — branch lifecycle integration via pinned Platform reusable workflows.

The first two are deliberately governance checks, not product tests. The third includes write-capable close/apply paths in the called reusable workflow family; the full mutation implementation and all called Platform scripts were not closed in this audit.

Substantial E2E and unit-test source was directly reviewed, including accessibility, responsive, search, creature interactions/gameplay/presentation, geometry, race/fault injection, render probes, performance, soak, user journeys and visual acceptance. The audit did not execute a valid full exact-head product suite or current full browser qualification for the audited SHA.

Recommended restoration architecture remains: verification profile separate from data capability; ordinary functional E2E on the smallest immutable qualification fixture through production loader/runtime seams; bounded real-world data only for source-compatibility or selected canonical bytes; `real_fullworld` only for complete-product properties; specialist Molehill/Synology use only when the oracle genuinely requires it.

## 8. Security, reliability and performance

Verified strengths include protected-base maintenance enforcement, pinned container/action references in reviewed paths, read-only mounts/internal networking in protected executor definitions, digest/root validation and explicit fail-closed states.

Verified/inferred risks include unsafe output path handling, incomplete independent recomputation of some derived products, optional cache failure propagation, incomplete per-operation timeout coverage and stale validation paths. No current authoritative dependency vulnerability scan was completed, so no dependency is labeled vulnerable merely because it is old.

## 9. Instruction debt

Root `AGENTS.md` carries useful authority, maintenance, GitHub-first and verification invariants, but it also contains substantial procedural detail and historical transition material. The audit supports reducing duplicated lifecycle/process prose where the same constraint is mechanically enforced or centrally owned, while preserving Game/Atlas authority, freeze safety, exact-head evidence and impact/data-capability rules.

The complete nested instruction census and all referenced META/Platform authority files were not fully reviewed, so no blanket deletion recommendation is made.

## 10. Documentation

The strongest confirmed documentation drift is historical E2E/qualification wording that no longer matches the active maintenance workflow set. Historical documents and archived audit evidence must remain clearly labeled as evidence rather than current execution authority.

## 11. Governance

At the audited snapshot, PR/Merge Queue integration remains required by repository governance. The maintenance validator executes protected-base code against an inert candidate and allows regular UTF-8 `docs/evidence/**` changes. This round uses that documented maintenance path only; it does not bypass protection or merge the PR.

## 12. Simplification opportunities

Highest-value opportunities after the freeze phase:

- one shared canonical serialization/root reconstruction contract across producer and consumer languages;
- stage-then-publish builders with one shared path-safety guard;
- data-capability routing based on actual oracle dependencies, not test names;
- remove stale workflow/blob-presence contracts from ordinary product tests;
- consolidate duplicate maintenance validation mechanics when governance allows, while preserving PR and MQ checks;
- reduce always-loaded agent prose that duplicates central policies or mechanical enforcement;
- keep one durable source of truth for active verification architecture and mark old reports historical.

## 13. Remediation roadmap

### Immediate

- preserve maintenance freeze and normal PR/MQ path;
- do not treat green maintenance checks as product qualification;
- before running real product builders, prevent input/output/previous path overlap.

### Near-term

- complete instruction/governance closure and exact tracked-file inventory;
- independently recompute derived product roots in validators;
- define shared canonical serialization vectors;
- classify every restored E2E group by actual minimum data capability;
- remove or reclassify tests whose only oracle is a suspended historical workflow/blob.

### Medium-term

- repair cache degradation, streaming bounds, coordinate round-trip and CDP timeout debt;
- restore tests in shadow, prove real PR/MQ canaries, then make only impact-applicable groups blocking;
- update E2E/docs to the actual post-maintenance architecture.

### Optional

- measure and then simplify duplicated harnesses/workflows/agent context where the reduction preserves independent oracles and governance.

## 14. Unverified surfaces

Known remaining gaps include: full tracked-path census; all nested instruction sources; all docs/prompts; remaining `src`, `web`, `tools` and tests not directly reviewed; Platform mutation-reusable closure; full dependency/CVE/licensing state; current browser/UI inspection; full build and exact-head E2E; current deployment/rollback; and a fresh independent reconciliation of every imported round-1/round-2 file against the supplied archives.

## 15. Final reconciliation

- Are all tracked paths accounted for? **No.**
- Are all audit domains accounted for? **Yes as domains, but several remain materially unverified.**
- Are all discovered instruction sources accounted for? **No.**
- Are all discovered active Atlas CI workflows accounted for? **Yes for the three active definitions; not for every called mutation implementation.**
- Are all discovered build/test systems fully accounted for? **No.**
- Are all accessible governance surfaces fully accounted for? **No.**
- Did the cross-check identify unexplored surfaces? **Yes.**
- Is further audit work possible? **Yes.**

Therefore the truthful final status of round 3 is `INCOMPLETE`.
