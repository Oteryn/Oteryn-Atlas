# ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION — P0 amendment

Lifecycle authority: `Oteryn/Oteryn-Atlas#179`

Status: **normative amendment** to `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`.

Source review evidence: `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-PRO-AUDIT-2026-08-27.md` from PR #204.

This amendment incorporates the independent Agent Pro P0 findings into the mandatory implementation contract. The Pro audit itself remains point-in-time review evidence; the requirements below are forward-looking lifecycle constraints and must be validated against fresh protected `main` and exact current PR heads before implementation or cutover.

Where this amendment is stricter than the current implementation prompt, execution audit, readiness contract, active stacked PR descriptions, or older handoff documents, this amendment governs lifecycle #179 until the primary documents are reconciled.

## P0 cutover rule

Selective work-saving execution MUST remain disabled until every requirement in this amendment is implemented, negative-tested, exact-head verified, and the complete current-main safety net is green.

A green documentation PR, partial hosted migration, scenario count, or shadow planner result does not approve cutover.

## P0-1 — protected authoritative control plane

Authoritative qualification logic MUST NOT be controlled solely by the candidate revision it is evaluating.

Protected-base code or an equivalently protected required workflow/control plane MUST own the authoritative versions of:

- exact changed-file and rename evidence parsing;
- stable Playwright census/ID generation used for requirements;
- impact classification;
- dependency closure and producer/consumer fan-out;
- verification-plan construction;
- verification-plan schema validation;
- final shard/evidence fan-in;
- exact-head acceptance and final qualification decision.

Candidate code may execute as an unprivileged data-plane input and may request/widen additional verification, but candidate-controlled planner/parser/catalog/controller code MUST NOT be able to narrow the protected lower bound for the same candidate.

The final plan/evidence identity MUST bind at least:

- protected controller/source identity or required-workflow identity;
- protected base SHA;
- candidate head SHA;
- merge-base SHA;
- exact changed-file/rename digest;
- planner/controller digest;
- parser/stable-ID algorithm digest;
- schema digest/version;
- trusted and candidate manifest digests;
- trusted and candidate catalog digests;
- execution-policy digest;
- expected stable-ID set digest;
- candidate/publication input digests.

If the repository/organization cannot prove an adequately protected authoritative controller, selective skipping MUST remain disabled and qualification MUST fail closed to the full-safe path.

## P0-2 — compositional impact selection and dependency closure

`longest-prefix-wins` is forbidden for authoritative selective planning.

For every changed path, including both rename source and destination, the planner MUST:

1. collect **all applicable impact rules**;
2. union their required groups/domains/capabilities;
3. take the maximum minimum profile;
4. apply explicit cross-domain escalation rules;
5. expand dependency closure for shared producers, generated products, consumers and known fan-out;
6. union the result across every changed path.

A more-specific rule may add/narrow descriptive context, but it MUST NOT suppress obligations inherited from a broader applicable rule unless a protected-base contract explicitly proves the broader obligation is inapplicable.

Unknown runtime paths, malformed/incomplete changed-file evidence, dependency-closure failure, or policy ambiguity fail closed to `broad/full` as defined by the protected controller.

Permanent negative/regression tests MUST cover overlapping prefixes, nested feature/shared-runtime paths, renames, multi-path changes, producer/consumer fan-out and cross-domain changes.

## P0-3 — exact stable-ID census and one canonical algorithm

One repository-owned canonical stable-ID algorithm MUST be shared by census generation, planning, runtime reporting and final fan-in. Equivalent duplicate implementations are not sufficient unless equivalence is mechanically proven by common fixtures.

Stable identity MUST remain equivalent to:

`project + normalized spec path + title path`

Normalization MUST be versioned and regression-tested for at least:

- long spec paths;
- long nested title paths;
- punctuation/unicode/whitespace boundaries supported by the repository;
- duplicate human-readable titles in different files/projects;
- platform path separator differences;
- truncation/collision boundaries.

Every authoritative plan MUST carry the exact expected stable-ID set or a content digest plus deterministic recoverable set identity for every required browser group/profile.

`full` specifically MUST mean the exact current full-safety-net stable-ID set, not `non-empty scenarios`, a magic count such as `71`, or a wildcard interpreted only at runtime.

Final fan-in MUST prove exact set equality:

- no missing IDs;
- no unexpected IDs where the plan forbids extras;
- no duplicate IDs;
- union of shard executed IDs equals the exact planned set;
- every result binds the same head/plan/controller/catalog/policy identity.

Counts are telemetry only.

## P0-4 — self-contained immutable publication readiness

Ordinary GitHub-hosted E2E MUST NOT depend on live Synology, private LAN publication, mutable remote build directories, agent-local partially prepared inputs, or a producer whose completion is inferred by elapsed time.

If browser tests require a publication/product, the hosted workflow MUST provide the equivalent of:

`exact inputs -> temporary producer output -> completeness/schema/count/size/digest validation -> atomic publish -> readiness manifest -> consumer preflight -> Playwright`

The readiness manifest MUST bind at least:

- exact candidate/input identity;
- plan digest;
- producer/run identity;
- publication/product digest;
- schema/version;
- object/file count where meaningful;
- byte size where useful;
- browser/harness identity;
- `complete: true` emitted only after validation succeeds.

Each consumer/shard MUST validate the readiness manifest and required digests before launching Playwright.

Missing, partial, mismatched or stale publication input is `BLOCKED/FAIL`, never a successful skip.

Arbitrary sleeps are forbidden as readiness evidence.

## P0-5 — stale-head fencing and cancellation

Ordinary hosted qualification MUST have PR-scoped concurrency with `cancel-in-progress: true` or a measured equivalent that reliably cancels superseded expensive work.

Cancellation alone is not authoritative proof. The system MUST also:

- query/resolve the current remote PR head immediately before expensive browser execution;
- refuse to start if it differs from the planned candidate SHA;
- bind artifacts to exact head + plan + shard identity;
- re-check exact current-head identity at evidence acceptance/fan-in;
- reject all stale/cancelled/superseded evidence even if the old job later reports success.

Negative tests MUST cover the race where a new push occurs between plan creation and browser start, during browser execution, and immediately before fan-in.

## P0-6 — Phase D / PR #190 exit criteria

Phase D cannot merge merely because routing moved from Molehill to a GitHub-hosted runner.

Before Phase D is merge-ready it MUST prove on its exact current head:

- ordinary hosted E2E has a self-contained immutable publication/product input;
- readiness is explicit and fail closed;
- no ordinary hosted E2E requires LAN/Synology;
- stale-head fencing/cancellation is effective;
- candidate code cannot authoritatively self-narrow the controller lower bound;
- hosted summary validation is bound to the expected exact stable-ID set for the plan/full run;
- zero retries and current independent oracles remain intact;
- any Molehill path is capability-coded specialist-only.

Historical failed or successful heads are evidence only and cannot satisfy current-head readiness.

## P0-7 — Phase E / PR #195 must be rebuilt on the final target plane

Phase E MUST be rebased/rebuilt after the final Phase D protected merge. Old Molehill/Windows worker measurements may be retained only as specialist-host evidence.

Ordinary policy MUST be calibrated on the actual GitHub-hosted execution architecture and include representative targeted/broad/full plans with whole-DAG timing:

- queue/provisioning;
- checkout;
- dependency restore/install;
- publication/product preparation;
- image pull/build/extract;
- preview startup;
- browser execution;
- shard fan-out/fan-in;
- cache restore/save;
- artifact transfer;
- cancellation/superseded-head waste.

Benchmark a simple packed baseline first, then plausible workers and 2/4 hosted shards only where workload size justifies them. Measure cold and cache-restored paths and use repeated clean runs sufficient to distinguish noise.

Final worker/shard/packing policy MUST be adaptive, versioned and selected on end-to-end PR-verdict latency plus setup/job-minute/variance evidence, not on local PC capacity or isolated browser time.

## P0-8 — Phase F / PR #200 remains disabled until semantic proof exists

`enabled=true` is forbidden until all of the following are proven:

- exact digest-to-bytes binding for controller/manifest/catalog/plan/execution policy;
- semantic catalog capability/resource metadata, with no heavy/browser decision inferred solely from naming prefixes;
- compositional rule union and dependency closure;
- exact stable-ID set equality at fan-in;
- trusted protected controller lower bound;
- historical regression backtest with no unexplained false negative;
- live shadow comparison to full-safe outcomes;
- complete current-main GitHub-hosted safety net;
- tested `force-full` widening;
- tested `SELECTOR_ESCAPE` fallback to full-safe behavior;
- stale-head cancellation/rejection;
- evidence that small targeted plans are not slowed by unnecessary setup/sharding.

Under-selection is a correctness defect and blocks cutover. Over-selection is an optimization defect and may be tuned without weakening safety.

## P0-9 — terminal execution boundaries

The terminal ownership model remains:

- **GitHub-hosted:** ordinary deterministic PR verification, targeted/broad/full functional Playwright, routine complete safety net, rights-safe hosted visual/accessibility/depth work where hardware-specific truth is not the purpose;
- **Molehill-PC:** explicit capability-specific specialist proof only, such as restricted/private visual review, native Windows/browser/GPU/driver truth, LAN-only smoke or physical-hardware reproduction;
- **Synology:** immutable merged-main artifact receive/verify, deployment, health/readiness, revision/integrity proof, rollback and bounded externally executed live smoke only.

Routine nightly/full browser depth MUST move to GitHub-hosted. Synology MUST NOT become a fallback build farm or E2E compute plane.

## P0-10 — administrative proof before cutover

Before terminal selective approval, resolve and record the effective repository/organization controls relevant to trust and concurrency, including when accessible:

- branch protection and applicable rulesets;
- required status/check app identity;
- strict/up-to-date head semantics;
- bypass actors/roles;
- required-workflow binding or equivalent protected-controller mechanism;
- merge queue behavior if enabled;
- fork/untrusted token/secret boundaries;
- self-hosted dispatch/trust boundaries;
- effective GitHub Actions hosted concurrency/service limits for Oteryn;
- any organization policy that changes which workflow revision controls required qualification.

Unverified administrative facts MUST remain explicit `UNKNOWN`; they cannot be assumed favorable for cutover.

## Mandatory repair order

Unless fresh evidence proves a safer dependency order, execute:

1. repair Phase D publication/readiness so hosted E2E is truly self-contained;
2. establish the protected authoritative controller boundary;
3. implement PR-scoped cancellation plus current-head fencing at execution and fan-in;
4. replace longest-prefix selection with compositional union + dependency closure;
5. unify stable-ID generation and exact planned/executed set equality;
6. complete the granular catalog/manifest and semantic capability metadata;
7. merge the corrected Phase D through protected gates;
8. rebuild/rebase Phase E on final Phase D and run fresh hosted whole-DAG calibration;
9. rebuild/rebase Phase F on final Phase E and keep rollout disabled through shadow/backtest/full-safety proof;
10. migrate routine nightly/full depth to hosted and reduce Synology/Molehill to terminal specialist/deployment boundaries;
11. verify administrative/ruleset/concurrency facts;
12. perform final full safety net + concurrent PR/supersession validation before #179 closeout.

## Mandatory negative proofs

At minimum add/retain tests proving:

- candidate changes to planner/parser/controller cannot reduce protected-base requirements;
- overlapping impact prefixes union rather than override;
- dependency fan-out adds required producer/consumer groups;
- rename source+destination union correctly;
- unknown path fails closed;
- full expected stable-ID set cannot silently shrink after Playwright/config/catalog changes;
- census and runtime reporter produce identical IDs for long/boundary fixtures;
- missing/unexpected/duplicate stable IDs reject fan-in;
- partial publication/readiness cannot start Playwright;
- wrong publication digest/schema/count/size blocks consumers;
- stale PR head is rejected immediately before expensive work;
- old-head success is rejected during final fan-in;
- cancelled shard cannot satisfy completeness;
- heavy/browser capability cannot be hidden by a misleading group name/profile;
- selective controller cannot accept only digest shape when bytes do not match the digest;
- `force-full` and selector fallback only widen;
- ordinary plans cannot request Molehill without an allowlisted capability reason;
- Synology cannot accept ordinary browser/depth/build resource classes;
- administrative unknowns cannot be treated as successful cutover evidence.

## Added acceptance criteria

Lifecycle #179 is not terminal until objective current-head evidence proves:

1. authoritative classifier/planner/parser/fan-in code is protected from candidate self-certification;
2. all applicable impact rules compose and dependency closure is explicit/tested;
3. every authoritative browser plan has an exact expected stable-ID set/digest;
4. full means exact current full-safety-net membership and cannot silently shrink;
5. one canonical stable-ID normalization contract is shared/proven across census and runtime reporting;
6. ordinary hosted E2E consumes only immutable ready publication/product inputs;
7. readiness is transactional and fail closed with no timing-based completion assumption;
8. superseded heads are cancelled/fenced and stale evidence is rejected at fan-in;
9. final Phase D demonstrates self-contained exact-head hosted E2E before merge;
10. Phase E measurements come from the final GitHub-hosted target plane and whole DAG;
11. Phase F remains disabled until protected planning, semantic capabilities, exact fan-in, backtest and safety fallback are proven;
12. nightly/full routine depth is GitHub-hosted;
13. Molehill/Synology remain specialist/deployment-only respectively;
14. repository/organization administrative trust controls and effective hosted concurrency are verified or explicitly block cutover;
15. no P0 finding from the Pro audit remains unresolved on the final exact implementation heads.

## Freshness rule

The Pro audit recorded facts at specific historical SHAs. Before treating any individual P0 as still present, re-check the exact current branch/head. A later implementation may have repaired the observed symptom.

However, the **invariants in this amendment remain mandatory** even if a specific historical example has already been fixed.
