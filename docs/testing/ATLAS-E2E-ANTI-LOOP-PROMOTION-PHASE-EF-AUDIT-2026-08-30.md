# Atlas E2E anti-loop promotion and Phase E/F audit — 2026-08-30

GitHub live state is the source of truth. This record supports Issue #272 / PR #273 and parent programme #179. GitHub shows #179 already closed/completed; this task does not mutate that lifecycle state.

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
| `legacy-molehill-transition-qualification.yml` | Bounded old-protection admission requiring exact-head 77-scenario evidence and independent visual review | protected v3 controller/executor after stabilization | none after #276 merged | **Do not delete from docs-only #273; re-audit on a future protected-authority change** |

No workflow above is deleted merely because its historical caller merged. The deletion gate is stricter: the replacement must be protected, live-proven, and must not strand any still-open parent-programme PR. In particular #268 keeps `protected-execution-promotion-qualification.yml` live.


### Exact-base cutover tombstone

The compatibility branch in `ci.yml` is now bound only to pre-correction protected SHA `b285c4d57d48cbc70bca54619849b7f7cfd423f6`. PR #276 used that exact equality for one consolidated environment/control-plane correction and then advanced protected `main` to `f8de8e42ca57112cf71100aa19322ef22527b168`. No later main-targeting PR can satisfy the equality without forbidden history rewriting.

#273 keeps the now-inert tombstone byte-identical to protected `main` rather than creating a fresh authority delta merely to delete unreachable code. Physical deletion remains a future independently protected authority cleanup, not a live gating dependency.

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

PR #219 remains a Draft preparation lane and selective execution remains disabled. #273 supplies the semantic/reuse safety contract; it does not authorize Phase F savings. GitHub live state shows #179 already closed/completed independently of this docs-only closeout.

## Verification authority for this audit

The inventory was reconstructed from live GitHub PR state and exact workflow branch predicates on 2026-08-30. Terminal deletion decisions must be re-read after #274 and #273 merge; this record must not be treated as permission to delete a path whose live caller state later changes.

## Protected cutover completion

PR #274 was protected and squash-merged normally as `main@b285c4d57d48cbc70bca54619849b7f7cfd423f6`. Final candidate head `4eb9b886b57dbe0e5b1e51014ba12bc1afd83c69` had deterministic 459/459 PASS, provenance PASS, CodeQL PASS, 77/77 zero-retry transition scenarios, 17/17 reviewed canonical frames and final `atlas-gate` PASS. No admin bypass or force-push was used.

The Actions status-publication job validated the exact plan/evidence/review successfully and then hit a Windows workflow-token `gh api --input -` HTTP 400 at the final POST. The unchanged protected repository publisher was run on the repository-approved Molehill runner from the exact clean remote head; it repeated remote-head, merge-base, 77-ID, summary, review and screenshot-digest validation and published `atlas-local-e2e=success`. The existing exact-head CI rerun then consumed that status and produced `Protected Hosted Playwright evidence=SUCCESS` and `atlas-gate=SUCCESS`.

The protected controller was also hardened during final review after CodeQL identified a high-severity privileged candidate checkout pattern: candidate census now materializes inert bytes with `git archive` and executes them only inside the no-network/read-only/cap-dropped sandbox. Final CodeQL for Actions, JavaScript/TypeScript and Python is GREEN.

The post-cutover deletion inventory remains conservative. In particular #268 still owns a live legacy promotion responsibility, so its required protected promotion workflow is retained. Parent programme #179 remains open.
## Protected stabilization correction #276

PR #276 was squash-merged normally as `main@f8de8e42ca57112cf71100aa19322ef22527b168`. Its final candidate head `5cc3c467c07119cad9bd3098b28aba4a312a02d0` passed 468/468 deterministic tests, provenance 144/144, CodeQL for Actions/JavaScript/Python, and a single exact 77-ID retained transition run with workers=1/retries=0. All 17 required canonical frames were opened and review-bound; final CI consumed the exact status and produced `Protected Hosted Playwright evidence=SUCCESS` and `atlas-gate=SUCCESS`.

The environment repair preserves sandbox UID/GID `1000:1000`: only the host artifact bind is temporarily handed to that identity for the one-shot probe, with an EXIT trap restoring runner ownership. The transition planner now carries an explicit `requiredGroupFloor` that is widening-only and is independently checked against a trusted-base lower-bound plan before any heavy execution.

At the final #273 integration audit, #217 and #219 remain Draft/open and #268 remains open. GitHub reports #179 closed/completed at 2026-08-31T05:56:40Z and #272 closed/completed at 2026-08-31T08:35:01Z. These issue states are recorded, not changed, by this audit.
