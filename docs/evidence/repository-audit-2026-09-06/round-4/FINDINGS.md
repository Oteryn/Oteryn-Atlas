# Round 4 findings

Current finding counts: **P0 0 / P1 3 / P2 11 / P3 2**.

Priority is engineering order, not CVSS. `CONFIRMED_CURRENT` means current-source or current live-state evidence supports the finding. `CONFIRMED_BUT_CHANGED` means the inherited issue remains only in a narrowed/current form. Recommendations are not implemented by this audit.

| ID | Priority | Status | Evidence type | Finding | Affected paths/components | Confidence |
|---|---|---|---|---|---|---|
| F01 | P1 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION + EXECUTED_THIS_AUDIT | Python and JavaScript canonical JSON disagree for integer-like object keys. Current JS sorting is followed by `JSON.stringify`, whose integer-index property ordering differs from Python `sort_keys=True`. | `src/browser/loader.mjs`, `tools/fullworld-publication/publication.py`, other canonical serializers | high |
| F02 | P1 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Publication/build paths can remove or populate output roots without first proving resolved disjointness from source/previous-product roots. | `tools/fullworld-publication/publication.py` and reviewed builders | high |
| F03 | P1 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION + HISTORICAL_RECORDED_RESULT | Maintenance admission permits deletion of any matching `tests/verification/*.test.mjs` regular test path; it does not bind deletion to an explicit obsolete-governance inventory. | `tools/maintenance/verify-maintenance-diff.mjs`, `tests/maintenance/maintenance-diff-policy.test.mjs` | high |
| F04 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Optional persistent-cache open/get/put failures can propagate into functional loading instead of always degrading to verified network retrieval. | `src/browser/verified-content-cache.mjs`, `src/browser/fullworld.mjs` | high |
| F05 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Actual response-size bounds are checked after `arrayBuffer()` buffering when no useful trusted `Content-Length` bound prevents the read. | `src/browser/loader.mjs`, `src/browser/fullworld.mjs`, `src/browser/creature-gameplay-profiles.mjs` | high |
| F06 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Coordinate values can pass a pre-round upper bound and then round onto the excluded boundary. | `src/browser/semantic.mjs` | high |
| F07 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Semantic range-cache replacement can over-account bytes and same-key concurrent loads are not fully shared in-flight. | `src/browser/fullworld.mjs` | high |
| F08 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION + EXECUTED_THIS_AUDIT | Textual relative-path validation does not prove resolved URL confinement. Percent-encoded dot segments normalize outside the intended directory, and a scheme-relative interpretation such as `http:...` can change origin after `new URL()`. | `src/browser/fullworld.mjs` and analogous relative-path consumers | high |
| F09 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION + LIVE_SERVICE_READBACK | `e2e/README.md` describes historical required heavy PR qualification and workflow names that do not match the current three-workflow maintenance control plane. | `e2e/README.md` | high |
| F10 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Dependabot currently covers GitHub Actions only while `e2e/package.json` has an npm Playwright dependency. This is update-coverage debt, not evidence of a vulnerability. | `.github/dependabot.yml`, `e2e/package.json` | high |
| F11 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | The semantic benchmark parser uses naive hyphen splitting while compiler filenames encode negative floors such as `f-7-...`, making valid negative-floor output inconsistent with the parser grammar. | `tools/dyn-atlas-semantic/benchmark.py`, `tools/dyn-atlas-semantic/compiler.py` | high |
| F12 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | The FullWorld CDP qualification harness has an outer deadline loop but individual `cdp.send()` promises have no per-RPC timeout/abort, so a silent RPC can outlive the intended deadline. | `tools/fullworld-runtime/qualify_browser.mjs` | high |
| F13 | P2 | CONFIRMED_BUT_CHANGED | STATIC_CODE_INSPECTION | Data-capability routing is substantially corrected. The current inventory classifies all E2E specs, but the two creature-gameplay specs still explicitly require a future split because they mix real-source facts with functional UI/state oracles. | `tools/verification/e2e-data-capability-inventory.json`, `tools/verification/verification-catalog.json` | high |
| F14 | P2 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION + LIVE_SERVICE_READBACK | Active operations/recovery runbooks still name `synology-live-acceptance.yml` and `synology-runner-health.yml` as current workflow authority even though those workflows are presently suspended outside `.github/workflows`. | `docs/operations/ATLAS-LIVE-OPERATIONS.md`, `docs/recovery/ATLAS-LIVE-RECOVERY.md`, `docs/maintenance/suspended-workflows/**` | high |
| F15 | P3 | CONFIRMED_CURRENT | STATIC_CODE_INSPECTION | Root README still describes the initial Semantic Thais Z7 proof rather than the current FullWorld/search/creature/farm scope and maintenance state. | `README.md` | high |
| F16 | P3 | CONFIRMED_CURRENT | LIVE_SERVICE_READBACK + STATIC_CODE_INSPECTION | Issue #315 opening text is historical decision-state prose and can be read as if maintenance were not active; later comments and current `AGENTS.md` establish the completed cutover. | Issue #315, `AGENTS.md`, `docs/maintenance/ATLAS-MAINTENANCE-MODE.md` | high |

## Inherited finding reconciliation

- Cross-language canonicalization: `CONFIRMED_CURRENT` -> F01.
- Publication input/output overlap safety: `CONFIRMED_CURRENT` -> F02.
- Persistent cache failure propagation: `CONFIRMED_CURRENT` -> F04.
- Semantic range cache accounting/in-flight behavior: `CONFIRMED_CURRENT` -> F07.
- Response-size timing: `CONFIRMED_CURRENT` -> F05.
- Coordinate rounding: `CONFIRMED_CURRENT` -> F06.
- Relative-path/resolved-URL confinement: previous concern now directly confirmed -> F08.
- Maintenance verification-test deletion breadth: `CONFIRMED_CURRENT` -> F03.
- Stale check/maintenance terminology: narrowed; root maintenance authority is current, `e2e/README.md` and live-operations runbooks remain stale -> F09/F14.
- Dependency update coverage: `CONFIRMED_CURRENT` -> F10.
- Product qualification gap: current and intentional under maintenance; recorded as a limitation, not a defect count.
- Fixture-routing concern: `CONFIRMED_BUT_CHANGED`; full census now exists, two gameplay specs remain split-required -> F13.
- Negative-floor benchmark parsing: `CONFIRMED_CURRENT` -> F11.
- CDP timeout coverage: `CONFIRMED_CURRENT` -> F12.
- Earlier claim that `tools/fullworld-generation/verify_handoff.py` merely compared a declared shard/fabric root is **retired**: current code verifies shard descriptors/digests and independently reconstructs the canonical descriptor-list root before comparison.

## Remediation order

1. F02/F03/F01: destructive-path safety, maintenance admission precision, canonical identity compatibility.
2. F08/F04/F05/F06/F07: loader/cache/path/coordinate reliability boundaries.
3. F13/F11/F12: verification restoration correctness.
4. F14/F09/F10: operational/docs/dependency governance debt.
5. F15/F16: lower-risk discoverability and historical-language cleanup.
