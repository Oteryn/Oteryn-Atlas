# Atlas E2E anti-loop promotion and Phase E/F audit — 2026-08-30

GitHub live state is the source of truth. This record supports Issue #272 / PR #273 and parent programme #179; it does not close #179.

## Consolidated protected replacement

The target control plane is one protected chain:

`protected-verification-controller.yml` -> `protected-hosted-executor.yml` -> versioned evidence manifests -> exact fan-in -> `atlas-gate`.

`protected-base-advance-dispatcher.yml` actively re-evaluates open `main` PRs after base movement. Authority/environment/product changes invalidate only the evidence nodes that actually depend on them. Candidate-controlled executor promotion is forbidden.

The replacement safety contracts are implemented by:

- `verification-authority.mjs` + `verification-authority-manifest.json`;
- `protected-execution-environment*.mjs/json`;
- `base-advance-compatibility.mjs`;
- `evidence-manifest.mjs` + `evidence-reuse.mjs`;
- `protected-verification-lifecycle.mjs`, `protected-verification-state.mjs`, `protected-verification-workflow.mjs`;
- `protected-hosted-fan-in.mjs` + `protected-hosted-gate.mjs`.

## Promotion/bootstrap inventory
| Workflow | Continuing responsibility | Replacement owner/evidence | Remaining live caller | Safe to delete now? |
| --- | --- | --- | --- | --- |
| `protected-execution-promotion-qualification.yml` | Exact legacy qualification/product/candidate-modification promotions on its allowlisted historical branches | protected environment + product identities + v2 evidence/lifecycle | **#268** still open on `fix/issue-179-qualification-functional-fixture` | **No** |
| `protected-hosted-compose-promotion.yml` | Historical protected hosted trust-bootstrap admission | protected environment qualification + hosted executor sandbox | none; #241/#253 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-hosted-fan-in-promotion.yml` | Historical fan-in contract promotion | versioned EXECUTED/REUSED manifests + protected hosted fan-in/gate | none; #242 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-hosted-readiness-reentry-promotion.yml` | Historical readiness re-entry validation | protected environment/product evidence and fail-closed hosted execution | none; #246 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-hosted-readiness-wiring-promotion.yml` | Historical atomic readiness wiring proof | protected environment/product evidence and hosted publication contracts | none; #245 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-publication-readiness-promotion.yml` | Historical publication-readiness promotion | protected product/environment identity + fan-in evidence | none; #243 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-qualification-product-promotion.yml` | Historical qualification-product builder promotion | immutable product identity + protected hosted product checks | none; #238 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `protected-bounded-real-identity-repin.yml` | Historical bounded-real deterministic repin | canonical Git-byte bounded-real product identity + deterministic product test | none; #240 merged | No while parent legacy lanes remain open; re-audit after protected cutover |
| `legacy-molehill-transition-qualification.yml` | One final old-protection admission requiring exact-head 77-scenario evidence and independent visual review | protected v3 controller/executor after the cutover | #274 during this closeout | **No until #274 is protected and its exact-base fallback is unreachable** |

No workflow above is deleted merely because its historical caller merged. The deletion gate is stricter: the replacement must be protected, live-proven, and must not strand any still-open parent-programme PR. In particular #268 keeps `protected-execution-promotion-qualification.yml` live.


### Exact-base cutover tombstone

PR #274 needs one old-protection compatibility branch in `ci.yml` only while its protected base is exactly `00bc97034618fa0ce264685d1aa342c591a43914`. The branch is bound to that full SHA. After #274 changes `main`, no subsequent main-targeting PR can satisfy that equality without forbidden history rewriting. The fallback is therefore functionally unreachable after the cutover.

#273 deliberately keeps `ci.yml` byte-identical to protected cutover `main` rather than creating a new candidate-controlled authority delta merely to delete unreachable code. This avoids a new micro-bootstrap in direct accordance with the stabilization plan. Physical tombstone deletion is deferred to a future independently protected authority change; it is not a live gating dependency and must never be widened to a branch name, moving SHA or ambient status.

## Phase E semantic-identity adoption

`buildSemanticExperimentIdentity()` binds candidate head, authority, environment, product identities, execution policy, workload, harness and selector identity. It deliberately does **not** bind unrelated protected-base SHA movement.
Deterministic contract `tests/verification/semantic-experiment-identity.test.mjs` proves:

- unrelated `main` SHA movement preserves `experimentDigest` when semantic experiment inputs are unchanged;
- harness, authority, environment, product, execution-policy or workload changes invalidate the identity;
- therefore Phase E repetition validity is semantic rather than monolithic-current-main based.

PR #217 remains a Draft preparation lane and is not silently promoted or merged by #273. Its next authoritative repetitions must rebuild on the final protected anti-loop/Phase-D state and consume this identity model.

## Phase F selector/evidence adoption

Selector identity binds exact planner, catalog and census digests plus required stable IDs, specialist obligations, `forceFull` and `selectorEscape`.

`validateSelectorObligations()` refuses reuse whenever planner/catalog/census identity changes or any stable-ID/specialist obligation is added or removed. `forceFull` and `selectorEscape` cannot yield an empty required test set and remain widening-only.

The same deterministic contract proves a new hosted stable ID or `real_fullworld` specialist obligation invalidates prior Phase F evidence.

PR #219 remains a Draft preparation lane and selective execution remains disabled. #273 supplies the semantic/reuse safety contract; it does not authorize Phase F savings or close #179.

## Verification authority for this audit

The inventory was reconstructed from live GitHub PR state and exact workflow branch predicates on 2026-08-30. Terminal deletion decisions must be re-read after #274 and #273 merge; this record must not be treated as permission to delete a path whose live caller state later changes.
