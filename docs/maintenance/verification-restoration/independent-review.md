# Correction review scope — PR #391 directive

The previous implementation verdict below is historical and does not qualify the
corrected candidate. Sol High design reviews approved the changed-leaf trust split
and removal of unconsumed R4 transport. A separate Sol High reviewer must review the
exact final #390 head; its verdict is recorded on that PR and in the programme
closeout, before regenerating or requesting admission of #389.

Current evidence and limits: [correction ledger](correction-ledger.md) and
[execution readiness](execution-readiness.md). No protected admission, R4, browser
acceptance or FullWorld qualification follows from local tests.

---

## Continuation review — 2026-09-08

Independent Sol High reviewed implementation commit `34c26d0660d552ce6b9d12b11937e105f3949d94`, tree `e33fba0b4023e354d1b7e4237c9e75d04bc2f881`.

**PASS for local R1–R3 correctness; BLOCKED for R4 readiness.** The reviewer independently ran all 1047 verification tests, with zero failures, skips or todos. Lead combined verification/maintenance qualification passed 1076/1076. The reviewed census is 46 groups, 36 browser specs, 203 deterministic entries, 30 review frames, 11 bound complete-product sources and 12 planned complete-product commands.

The review checked routing false negatives, conservative unknown-path blocking, execution ownership, additive visual evidence, source identity, protected producer and review authentication, candidate/base identity, PR/MQ semantics and canonical metadata projections. Findings about incomplete browser case identity and missing verifier source binding were fixed and re-reviewed before this verdict.

No active product caller, shadow run, product canary, FullWorld or Molehill execution was qualified. Real-FullWorld authentication deliberately rejects incomplete claims. Local artifact receipts do not satisfy protected execution, two-build, source provenance, overview, corruption or independent-review authentication requirements. Protected admission also remains blocked by the current immutable maintenance allowlist. This is not programme completion or authorization to activate R4.

The record below is historical evidence for the earlier preparation slice; its old counts and unresolved findings are not the current implementation status. See [execution-readiness.md](execution-readiness.md) for the continuation.

---

# Independent adversarial review — verification restoration preparation

Reviewed baseline: `main@f00815858bb5b031c502ad19fb96a05ff66b4d84`
Reviewed local candidate: `77036a2b4073e9001bfdf068f5e267af05a5f9d0`
Scope: bounded maintenance admissibility, preparatory architecture, and truthfulness of completion claims. This is not activation, a product canary, programme acceptance, or deployment approval.

## Disposition

- **Current authorized maintenance slice: PASS.** I found no P0 or candidate-blocking P1 defect. The exact candidate is a clean descendant of the stated baseline and changes only ten inert files under `docs/maintenance/verification-restoration/` plus deletion of the two exact protected-obsolete contracts. It changes no planner, routing, catalog, workflow, runtime, or product code.
- **Proposed final verification architecture: CHANGES_REQUIRED / BLOCKED.** The current executable system still has the P1 gaps below. The candidate now records the necessary design constraints accurately, but documentation does not implement or qualify them.
- **Issue #315 state: remains `PAUSED_BEFORE_VERIFICATION_RESTORATION`.** Nothing in this review authorizes shadow execution, canaries, blocking promotion, publication, or deployment.

## Findings

### P0 — none

No evidence of an authority bypass, candidate-code execution by the maintenance gate, workflow mutation, unprotected test deletion, false production claim, or secret/data-boundary violation was found in the reviewed slice.

### P1-1 — Deterministic execution ownership and changed-test closure remain absent

`contract-ownership.json` identifies 53 entrypoints without direct catalog ownership and 42 without effective direct-or-transitive catalog coverage. The apparent count of 190 entrypoints with one *proposed* family is inventory bookkeeping, not executable ownership: the four proposed families are not active catalog groups. More decisively, `tools/verification/run-protected-admission.mjs:152-173` still derives deterministic files from absent `.github/workflows/ci.yml` and invokes one Node command, while the baseline contains separate Python tests and Node tests outside `tests/verification/*.test.mjs`.

The candidate states this limit at `README.md:49-53,85-97`, `contract-ownership.json` (`commandEvidence`, `ownership`, and `constraints`), and `definition-of-done.md:12-13`. Before restoration, every deterministic entrypoint must have an exact executable owner and command/runtime, changed tests must execute themselves or a proven owner, import aggregators must not duplicate leaf execution, and browser-only harnesses must not be counted as Node tests. Missing ownership must block rather than inherit a label such as `deterministic.core`.

### P1-2 — Selective routing cannot yet preserve all obligations or fail closed on unknowns

The current planner unions all matching prefixes (`build-verification-plan.mjs:71-104`) and falls back to `deterministic.core` plus fixture `e2e.full` for unknown paths (`build-verification-plan.mjs:13,83-96`). That fallback cannot prove an unresolved specialist, native-GPU, artifact-build, security, publication, or non-browser oracle. A broad profile is not a substitute for a required capability.

The reviewed proposal now correctly rejects two unsafe alternatives at `fullworld-oracle-proposal.md:58-69`: an exact-path rule may suppress only a named default/unknown catchall, never other overlapping semantic rules; protected and candidate classifications must be computed independently and unioned; and every unknown path must produce an explicit unresolved-ownership/oracle block unless a protected proof really covers it. This is a sound design constraint, but the schema and planner do not implement it. Rename source and destination, changed test ownership, capability floors, evidence/review floors, dependencies, and cross-domain escalation all still need table-driven negative tests before selective activation.

For #376 specifically, adding exact gameplay/source-contract entries can repair the current bounded-source false negative. It cannot by itself remove the generic `e2e/` broad-suite match. The proposal now preserves `e2e.common-smoke` for the runtime module and treats removal of broad over-execution as a separate, reviewed catchall migration (`fullworld-oracle-proposal.md:73-97`). #376 therefore remains correctly open and BLOCKED.

### P1-3 — Selected non-browser groups can disappear before execution

`protected-semantic-routing.mjs:61-78` partitions only catalog groups with `capabilities.browser=true`. A selected non-browser hosted or specialist group is omitted rather than assigned an executor. This directly affects the proposed real-product artifact oracle: `fullworld.complete-integrity` is intentionally non-browser, so current routing cannot execute it even if the planner selects it.

The final architecture must conserve every selected group exactly once into a deterministic, hosted, or specialist execution obligation, with review added independently; unsupported, missing, skipped, or duplicate partitions must fail. The candidate records this requirement at `fullworld-oracle-proposal.md:9,27,62-71,99-115`, but no executable group, command identity, specialist placement, or evidence validator exists yet.

### P1-4 — One routine FullWorld aggregate would rebuild unrelated product stages

The corpus-wide oracle itself is justified: source inspection confirms that `fabric.py:1099-1269` builds the complete fabric and currently repeats only the largest shard for determinism (`fabric.py:1205-1221`); `verify_handoff.py:35-95` verifies every described shard and global totals; and `publication.py:95-141` pins and scans the complete 16-floor/1197-shard handoff. Real complete-product proof cannot be replaced by a tiny fixture.

However, one routine group containing clean fabric generation, publication, runtime index, pixel buckets, overview, minimap, and corruption proof would cause a change to a downstream verifier or builder to rebuild unrelated upstream stages. The reviewed proposal now limits the aggregate to broad qualification and requires generator, publication, runtime-index, pixel, overview, and minimap stages to be split by producer/consumer dependencies before routine use (`fullworld-oracle-proposal.md:29-44`). Mixed files remain temporarily conservative; generic code must be extracted to independently owned modules before optimized routing, without a diff-hunk semantic classifier. Until those groups, dependencies, exact immutable inputs, output-root expectations, complete determinism proof, and resource bounds exist, FullWorld architecture remains BLOCKED.

### P1-5 — Visual review coverage is incomplete and currently coupled too broadly

Independent source/ledger comparison found 36 Playwright specs and nine specs with 30 explicit full-frame capture scenarios. The protected capture contract contains only 17 frames across seven of those specs; the 13 creature-presentation frames across desktop and mobile are absent. Catalog group `visual.creatures` owns only `visual-desktop` and `visual-mobile`, while `e2e.full` labels overlapping specs as machine-summary with `visualReview=false`. Conversely, once current routing sees any selected visual group, `protected-semantic-routing.mjs:107-114` adds the entire protected frame contract, which can over-select unrelated captures.

The future model must bind visual obligation to exact stable scenario/frame IDs independently of machine execution groups, include all applicable captured scenarios, require exact candidate/test/digest evidence and an actual independent reviewer, and fail when a required capture is missing or disabled. Machine execution of an overlapping spec must not discharge review. The candidate accurately marks this BLOCKED at `README.md:79-84`, `browser-ownership.json` (`catalog_findings`), and `definition-of-done.md:21`.

### P2-1 — Exact GitHub admission remains an integration gate for the final published head

I ran the protected-base validator locally against the clean reviewed candidate for modeled `pull_request_target/synchronize` and `merge_group/checks_requested` identities; both returned `PASS`, `mode=maintenance-only`, with the same twelve changed paths. This proves local admissibility under the protected baseline validator. It is not the repository-required GitHub status or a Merge Queue canary. Any later commit that adds this review changes the exact head and must receive `Merge authority audit / protected-base validate` for that published candidate and then pass the normal Merge Queue. This is an expected pending integration condition, not a defect in the slice.

## Independent evidence checks

- Baseline census from Git, independently reconciled to the candidate ledgers: 198 `tests/**` files; 190 deterministic entrypoints plus eight excluded harness/fixture files; 137 `tests/verification/*.test.mjs` contracts; 36 Playwright specs; three active workflows; 25 archived workflows. There were no missing, extra, or duplicate ledger paths.
- Contract dispositions independently sum to 137: 2 retire, 98 provisionally retained, 28 rewrite, and 9 historical. Absent-workflow classifications sum to 56: 39 file/read-presence candidates and 17 fixture/policy-only references.
- Browser capability rows independently sum to 36: 33 `qualification_fixture`, two `bounded_real_world`, and one `real_fullworld`.
- Protected-base `docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json:3-6` contains exactly the two deleted paths. `verify-maintenance-diff.mjs:81-92,137-167` loads that inventory from the protected base and admits deletion only by exact path. Both deleted baseline tests independently reproduce ENOENT for intentionally absent active workflows.
- The focused command recorded in `validation.json` independently passed 35/35 with zero failures and zero skips on the reviewed code tree.
- The definition-of-done ledger makes no false programme-completion claim. Its PASS rows are narrowly factual (inventory, flag derivation, explicit security dependency, and active-topology count); routing, ownership, #376, FullWorld, visual evidence, PR/MQ equivalence, blocking fan-in, and final architecture remain BLOCKED, while suspended product-event/build behavior is marked NOT_APPLICABLE.

## Acceptance boundary

Accept this candidate only as the bounded documentation/governance preparation and exact protected-obsolete deletion slice. Do not cite its local tests, static ledgers, proposal, or maintenance audit as evidence that restoration architecture is implemented or that any product route is qualified. Final architecture acceptance requires the still-blocked executable changes and separately authorized shadow/PR/MQ canaries described above.
