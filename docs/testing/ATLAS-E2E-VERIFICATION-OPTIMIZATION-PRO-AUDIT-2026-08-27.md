# Atlas E2E verification optimization — Agent Pro audit

Date: 2026-08-27 (Europe/Warsaw)

Lifecycle authority: `Oteryn/Oteryn-Atlas#179`

Review handoff PR: `#204`

Review record: `https://github.com/Oteryn/Oteryn-Atlas/pull/204#pullrequestreview-5035576635`

## Status and use

This document records the independent Agent Pro architecture audit requested through PR #204 for later engineering analysis. It is a point-in-time review artifact, not a replacement for `AGENTS.md`, Issue #179, the repository verification contracts, protected-branch policy, or exact-current-head CI evidence.

Before acting on any recommendation below, refresh protected `main`, the active stacked PR heads, relevant contracts and current GitHub Actions results. Historical SHAs and workflow runs are evidence of the audited state only.

## Audited snapshot

The audit was performed against the following exact GitHub state:

| Surface | Exact audited state |
| --- | --- |
| protected `main` | `082a7180b6b4dbb63b1990135d24e26afb65c516` |
| PR #204 | `f773bb6fa15c6aad3d367517bcdd5adbec53e59b` |
| PR #190 / Phase D | `53c850966d46d145ab9cb96c78302f278a8f9c7d` |
| PR #195 / Phase E | `10d482a1a9edb94ce90b281a2823c7a32fbbece5` |
| PR #200 / Phase F | `88f3b2b8b1e36c03bb86be6102006ac148f8d5ea` |
| required protected contexts observed | `provenance-gate`, `atlas-gate` |

## Executive verdict

| Element | Audit verdict |
| --- | --- |
| PR #204 handoff document | **PASS WITH CHANGES** — useful and coherent as a review entry point, but should include additional mandatory inspection targets |
| Issue #179 selective/hosted cutover | **NOT READY / REJECT FOR CUTOVER** |
| PR #190 Phase D | **BLOCKED** — exact-head GitHub-hosted E2E is red |
| PR #195 Phase E | **NOT VALID FOR HOSTED POLICY** — measurements are Molehill/Windows oriented and the branch is materially behind the current Phase D head |
| PR #200 Phase F | **MUST REMAIN DISABLED** — selector and rollout safety are not sufficient for activation |

The documentation PR being healthy does not approve the runtime architecture or selective cutover.

## Blocking findings

### P0 — GitHub-hosted E2E in PR #190 is not self-contained

**FACT**

Exact-head CI for `#190@53c850966d46d145ab9cb96c78302f278a8f9c7d` failed in GitHub Actions job `98343852115` (`GitHub-hosted Docker Playwright evidence`). The run executed 71 Playwright scenarios using one worker; 70 failed. The dominant failure was:

`publication fetch failed: 502`

The exact job is:

`https://github.com/Oteryn/Oteryn-Atlas/actions/runs/33018820227/job/98343852115`

On that head, `e2e/compose.yml` defaults `ATLAS_PUBLICATION_UPSTREAM` to `127.0.0.1:9`, while the Nginx test frontend proxies `/fullworld/` and `/data/creatures/` to that upstream. The hosted runner therefore starts the browser harness without a valid self-contained publication product.

**RECOMMENDATION**

The hosted lane must build or consume an immutable exact-digest publication artifact, verify its manifest/digest, publish it atomically to the test frontend, prove readiness for required publication routes, and only then start zero-retry Playwright. Do not substitute live Synology/LAN publication as the ordinary hosted dependency.

### P0 — authoritative control-plane decisions are candidate-controlled

**FACT**

On the audited Phase D head, `.github/workflows/ci.yml` checks out the candidate PR revision and executes candidate versions of the change classifier, Playwright census parser and verification planner. The candidate workflow also defines the final `atlas-gate` behavior and consumes `docs_only` / `requires_e2e` outputs to decide whether expensive browser qualification runs.

**INFERENCE — high confidence**

Unless repository administration independently guarantees a protected required workflow/control plane, a candidate can attempt to alter the code that decides how that same candidate is classified and qualified. That is an unsafe trust boundary for authoritative selective execution.

**RECOMMENDATION**

Move authoritative classification, plan construction and final fan-in to protected-base code or an organization-required protected workflow. Candidate code should execute only in an unprivileged GitHub-hosted data plane. Bind evidence to exact base SHA, head SHA, merge-base SHA, changed-file digest and the exact controller/parser/schema/catalog/manifest identities.

### P0 — the selective planner is not safe for activation

**FACT**

The audited planner uses longest-prefix impact matching rather than compositional union, accepts a global supplied `stableTestIds` set, lacks explicit cross-domain dependency closure, and does not bind the plan to the exact planner/schema/parser implementation identities. The current manifest/catalog are still a small bootstrap skeleton rather than a complete model of the test estate.

**RISK**

A more specific prefix can suppress obligations that should also be inherited from a broader path/domain rule. A global stable-ID override can decouple the executed census from group semantics. Missing dependency closure can omit producers/consumers that are semantically required even when file-prefix matching appears narrow.

**RECOMMENDATION**

Before activation, use compositional union of all applicable impact rules, explicit dependency closure, exact catalog/manifest/controller digests, and a complete catalog that records stable IDs, domains, blocking semantics, oracle class, hosted compatibility, resource class, affinity/sequential requirements, timeouts and measured duration metadata.

### P0 — `full` is not bound to an exact stable-ID census

**FACT**

The audited GitHub-hosted validator requires a passed summary, exact head binding, zero retries, non-empty scenarios and unique stable IDs. It does not prove that a `full` run executed exactly the expected full stable-ID set.

The Playwright census parser and runtime summary reporter also do not implement identical normalization constraints for long IDs/titles/paths.

**RISK**

An accidental Playwright configuration narrowing could remove scenarios while still producing a non-empty, internally valid summary. Parser/reporter normalization drift can also make exact fan-in impossible or falsely mismatched at boundary cases.

**RECOMMENDATION**

Define one shared stable-ID algorithm and test it with long path/title fixtures. Every authoritative profile, especially `full`, must carry an exact expected stable-ID set/digest. Fan-in must prove set equality: no missing, unexpected or duplicated IDs.

### P0 — stale-head resource control is incomplete

**FACT**

The ordinary hosted workflow on the audited Phase D head has no top-level PR concurrency/cancel-in-progress contract and no immediate remote current-head recheck directly before the expensive browser execution.

**RISK**

Superseded heads can consume GitHub-hosted minutes and can produce evidence after a newer PR head exists. Cancellation alone is insufficient unless every authoritative evidence consumer also rejects stale-head artifacts.

**RECOMMENDATION**

Use PR-scoped concurrency with `cancel-in-progress: true` for ordinary GitHub-hosted qualification, re-check the exact current PR head immediately before expensive execution, and re-check exact-head identity again at evidence acceptance/fan-in.

### P0 — Phase E does not measure the target execution plane

**FACT**

PR #195 is materially diverged from the audited Phase D head and its benchmark harness is Windows/Molehill oriented, using PowerShell, local Docker/Desktop resource measurements and local slot capacity. That data is valid only for the specialist physical host context.

It does not measure the ordinary GitHub-hosted whole DAG: queue time, checkout, dependency restore/install, publication build/transfer, image pull/build/extract, preview startup, browser execution, shard fan-out/fan-in, cache restore/save, artifact cost or cancelled-head waste.

**RECOMMENDATION**

Rebase/rebuild Phase E only after final Phase D integration. Benchmark the actual GitHub-hosted target using representative targeted/broad/full plans, cold and warm repetitions, packed workers and plausible 2/4-shard options. Select workers/shards only from measured whole-DAG behavior, not Molehill capacity.

### P0 — Phase F must remain disabled

**FACT**

The audited `tools/verification/selective-rollout.json` is disabled, which is the correct safe state.

The audited selective controller validates digest shape rather than digest-to-bytes identity, derives browser requirement partly from group-name prefixes, and can return a non-heavy decision for a `focused` plan even if the plan contains a browser-heavy/full E2E group.

**RECOMMENDATION**

Do not enable selective rollout until exact digest binding, explicit capability metadata and exact stable-ID fan-in are implemented and backtested. Browser/heavy requirements must be semantic catalog properties, not inferred from group naming conventions.

### P0 — execution boundaries are not yet terminally corrected

**FACT**

The audited repository still contains routine deep/nightly browser responsibilities assigned to Molehill and build/test responsibilities on Synology that exceed the intended terminal boundary.

**TARGET BOUNDARY**

- GitHub-hosted: ordinary deterministic PR E2E, targeted/broad/full functional Playwright and the complete routine safety net.
- Molehill: explicit specialist exceptions only — rights-restricted/private visual review, native Windows/browser/GPU truth, LAN-only smoke, hardware/driver reproduction, or a specifically justified specialist benchmark.
- Synology: immutable merged-main artifact receive/verify, deployment, identity, rollback and bounded external smoke/live acceptance only.

### P0 — administrative proof is incomplete

**UNKNOWN**

The audit directly confirmed protected `main` and required contexts `provenance-gate` and `atlas-gate`, but could not fully verify all administrative/ruleset details, including strict-head requirements, bypass actors, required-workflow binding, merge-queue behavior and effective organization/account concurrency limits.

These items must be verified by an administrator before final cutover approval.

## Stack integrity observations

**FACT**

At audit time the implementation stack was not linear:

- PR #195 was substantially behind/diverged from the current Phase D branch;
- PR #200 was diverged from Phase E.

Therefore existing Phase E/F conclusions cannot be treated as applying automatically to the final reconciled Phase D implementation. Phase E should be rebuilt/rebased on final Phase D; Phase F should then be rebuilt/rebased on final Phase E.

## Test-suite disposition

The following disposition is a review recommendation, not a deletion authorization.

### Split into smaller independent-oracle tests

- `audit-desktop` / `audit-mobile`
- `creature-interaction-desktop` / `creature-interaction-mobile`
- `creature-presentation-desktop` / `creature-presentation-mobile`
- `creatures-desktop`
- `visual-desktop` / `visual-mobile`

These files currently mix several independently valuable oracles and long user journeys. Smaller tests improve selective mapping, failure localization and shard balance without weakening behavioral coverage.

### Narrow on ordinary PR; retain deeper hosted scheduled coverage

- accessibility
- farm explorer
- responsive
- performance
- scale
- stress

Keep cheap/blocking invariants on PR. Keep deeper repeated/timing/scale variants in measured hosted scheduled depth where they provide additional signal.

### Move out of ordinary PR depth

- soak
- full timing/performance depth
- large scale sweeps
- multi-seed stress depth

These should remain hosted unless a specific specialist capability is required.

### Delete

**None approved by this audit.**

A test should be removed only after measured redundancy, oracle equivalence and regression/escape history show that removing it does not reduce defect detection.

## Recommended target architecture

### 1. Protected trusted controller

A protected-base/required-workflow controller should own:

- exact changed-file evidence;
- exact census generation;
- impact classification;
- dependency closure;
- authoritative plan construction;
- final evidence fan-in and exact-head acceptance.

### 2. Immutable publication input

Build once per exact input identity where measurements justify it. Bind publication bytes to manifest/digest and make shards consume the same immutable product rather than independently contacting mutable LAN/live state.

### 3. Conservative packed browser execution first

Start with a single GitHub-hosted browser job and a conservative explicit worker count until measurements justify scaling. Preserve zero retries and first-failure evidence.

### 4. Sharding only after whole-DAG measurement

Use 2 or 4 GitHub-level shards only when end-to-end wall-clock improvement materially exceeds setup, queue, cache, artifact and duplicated-job-minute amplification. Do not maximize both workers and shards by default.

### 5. Exact fan-in

For every selected plan:

- union of executed stable IDs must equal the planned stable-ID set;
- all shard evidence must share exact head, plan and policy identity;
- no missing, unexpected or duplicated IDs are allowed;
- stale/cancelled/superseded evidence must be rejected.

### 6. Specialist Molehill path

Use explicit dispatch/admission only. Preserve exact-head trust checks, closed reason/capability codes, bounded machine-wide resource admission, isolated Compose/artifact namespaces and restricted visual evidence handling.

### 7. Deployment-only Synology

Synology should consume immutable merged-main artifacts and prove deployment identity/rollback/smoke. It should not become a fallback build farm or routine deep E2E plane.

## Required repair order

1. Make PR #190 GitHub-hosted E2E self-contained with an immutable publication product and explicit readiness.
2. Move authoritative classification, planning and final gate logic to a trusted protected control plane.
3. Add PR-scoped cancellation and immediate current-head fencing before expensive execution and evidence acceptance.
4. Complete the catalog/manifest, implement compositional selection/dependency closure, and bind every profile to an exact stable-ID census.
5. Unify stable-ID generation between census and runtime reporting, including long-title/path regression tests.
6. Rebuild/rebase PR #195 on the final Phase D head and run a fresh GitHub-hosted whole-DAG benchmark with committed cold/warm evidence.
7. Rebuild/rebase PR #200 on final Phase E; keep rollout disabled until shadow backtest, selector-escape accounting and force-full rollback are proven.
8. Move routine nightly/full depth to GitHub-hosted infrastructure and reduce Synology to deployment-only responsibility.
9. Verify repository/organization administrative controls that were inaccessible during the audit.

## Handoff document additions recommended by the audit

PR #204's review handoff should explicitly require inspection of:

- `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-AUDIT-EVIDENCE.md`;
- planner, schema, parser, reporter and evidence validators;
- selective execution controller and rollout state;
- branch protection, rulesets, required-workflow/check-app binding and Actions concurrency settings;
- workflow event/token/fork/secret/self-hosted trust boundaries;
- exact current stacked PR heads at both audit start and audit end;
- exact-head runtime conclusions, not only static code review.

## UNKNOWN / evidence still required

The following were not fully verified during this audit and remain explicit unknowns:

- complete branch protection/ruleset configuration;
- bypass actors and strict-up-to-date enforcement;
- merge-queue behavior;
- required-workflow binding and effective check-app identity requirements;
- organization/account GitHub Actions concurrency and billing limits;
- fresh hosted p50/p95 timings after publication readiness is repaired;
- real cache hit rates and cold/warm setup amplification;
- historical flake rate and selector escape rate;
- final exact stable-ID census after the stack is reconciled.

These unknowns affect optimization/cutover approval but do not invalidate the directly observed Phase D hosted E2E failure or the static trust/selection findings above.

## Primary evidence references

- Issue #179: `https://github.com/Oteryn/Oteryn-Atlas/issues/179`
- PR #204: `https://github.com/Oteryn/Oteryn-Atlas/pull/204`
- published review: `https://github.com/Oteryn/Oteryn-Atlas/pull/204#pullrequestreview-5035576635`
- PR #190: `https://github.com/Oteryn/Oteryn-Atlas/pull/190`
- PR #195: `https://github.com/Oteryn/Oteryn-Atlas/pull/195`
- PR #200: `https://github.com/Oteryn/Oteryn-Atlas/pull/200`
- failing Phase D hosted E2E job: `https://github.com/Oteryn/Oteryn-Atlas/actions/runs/33018820227/job/98343852115`
- implementation handoff: `docs/testing/ATLAS-E2E-EXECUTION-OPTIMIZATION-HANDOFF.md`
- verification review: `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-REVIEW.md`
- second pass: `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-SECOND-PASS.md`
- hosted execution architecture audit: `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md`
- hosted execution evidence: `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-AUDIT-EVIDENCE.md`
- readiness/concurrency contract: `docs/testing/ATLAS-GITHUB-HOSTED-E2E-READINESS-CONCURRENCY-CONTRACT.md`
- platform contract: `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

## Audit limitation

An independent local checkout/rerun was not available in the audit session. Runtime conclusions were therefore based on direct inspection of exact repository blobs/SHAs through the authorized GitHub integration and exact-head GitHub Actions state/logs, including the complete failed job `98343852115`.

## Final audit decision

PR #204 is a useful review handoff artifact, but Issue #179 and the audited #190/#195/#200 implementation stack are **not ready for selective cutover**. The shortest safe path starts with a self-contained exact-digest publication input for GitHub-hosted Phase D E2E and with moving authoritative qualification decisions into a protected trusted control plane.