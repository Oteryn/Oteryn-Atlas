# ATLAS-E2E-VERIFICATION-OPTIMIZATION-PRO-REVIEW

Purpose: independent senior review of the current #179 verification-platform architecture before further implementation/cutover.

Repository: `Oteryn/Oteryn-Atlas`
Lifecycle: Issue `#179`
Admission protected main for this review handoff: `082a7180b6b4dbb63b1990135d24e26afb65c516`

## Review mode

Review first. Do not implement runtime/workflow changes until the architecture review is complete.

Resolve fresh protected `main`, Issue #179, PRs #190/#195/#200 and any successors before drawing conclusions. The SHA above is provenance for this handoff, not immutable authority if `main` has advanced.

## Mandatory source set

Read all of the following from fresh protected `main`:

1. `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`
2. `docs/testing/ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md`
3. `docs/testing/ATLAS-GITHUB-HOSTED-E2E-READINESS-CONCURRENCY-CONTRACT.md`
4. `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
5. `AGENTS.md`
6. `tools/verification/impact-manifest.json`
7. `tools/verification/verification-catalog.json`
8. all relevant `.github/workflows/**`
9. the current complete `tests/**` and `e2e/**` inventory
10. Issue #179 and active stacked PRs #190/#195/#200 or their current successors.

For #179, treat the readiness/concurrency contract as mandatory authority alongside the implementation prompt and GitHub-hosted execution audit. If the main prompt does not yet mention it directly in its input list, do not infer that it is optional: Issue #179 explicitly binds it.

## Architecture that must be challenged, not merely accepted

The current intended model is:

- GitHub-hosted-first for ordinary deterministic/browser E2E;
- Molehill-PC specialist-only for capability-specific private visual/native Windows/GPU/LAN/hardware truth;
- Synology deployment-only, never ordinary/full E2E compute or normal product-build fallback;
- `none/focused/targeted/broad/full` selective verification;
- narrow agent inner-loop tests instead of full E2E after every small edit;
- granular stable-ID test catalog and fail-closed impact planning;
- full current-main safety net retained as periodic/force-full/bootstrap protection;
- measured adaptive execution packing instead of fixed sharding;
- explicit producer -> readiness manifest -> consumer -> fan-in barriers;
- exact immutable `QUALIFICATION_HEAD` for authoritative E2E;
- stale/superseded-head cancellation and rejection of old evidence;
- GitHub job/shard concurrency treated separately from Playwright workers inside one VM;
- no arbitrary sleeps or mutable partial paths as readiness signals;
- exact merged-main release artifact built once off Synology and promoted unchanged by digest;
- selector-escape feedback that widens back to full-safe verification after any proven under-selection.

Your job is to find flaws, missing invariants, race conditions, throughput traps, unnecessary complexity, under-testing, over-testing, rights/provenance risks, and hidden dependencies in this model.

## Required review questions

### 1. Readiness / races

Verify that the proposed readiness contract prevents all materially relevant races, including:

- test starts while producer/download/build is incomplete;
- producer exposes partially written path;
- shard sees stale/mismatched artifact;
- later push arrives while older E2E is still executing;
- cancelled old SHA completes after new SHA and is accidentally accepted;
- fan-in mixes evidence from different heads/plans/shards;
- mutable live LAN/Synology data changes underneath a PR qualification;
- `complete=true` can be emitted only after checksum/schema/count/size validation;
- cache restore cannot bypass digest/provenance validation.

Recommend additional negative tests if any race remains possible.

### 2. Agent workflow / qualification checkpoints

Audit whether `WORKING_HEAD` versus `QUALIFICATION_HEAD` is safe and useful.

Specifically verify that agents can iterate without launching broad/full browser campaigns after every tiny push, while no merge can occur without exact final-head required checks.

Challenge whether draft/ready-for-review is the right signal or whether another repository-owned checkpoint would be safer/faster.

### 3. GitHub-hosted execution performance

Audit the entire Actions DAG, not Playwright in isolation:

- runner queue/provisioning;
- checkout/fetch;
- package/dependency restore;
- Docker/Playwright image pull/build/extract;
- candidate product/publication build;
- preview startup;
- browser runtime;
- report/fan-in;
- artifact upload/download;
- duplicated work in other workflows;
- cancellation/superseded-head waste.

Confirm whether the current measured warning (~25 s Playwright base materialization and ~38 s hosted Docker harness path while merely listing 71 tests on the observed baseline run) is being used correctly as a design constraint rather than treated as a permanent constant.

### 4. Parallelism / concurrency

Do not assume `2` is the correct limit and do not assume maximum available GitHub concurrency should be consumed.

Audit separately:

- GitHub-hosted jobs/shards running as independent VMs;
- Playwright workers within a single VM;
- simultaneous browser process count = shards x workers;
- cross-PR concurrency/fairness;
- actual account/org service limit for Oteryn if authorized to resolve it;
- per-PR `max-parallel` policy;
- queue amplification;
- setup amplification;
- OOM/crash/shared-memory/CPU contention;
- shard imbalance.

Challenge the current candidate benchmark shapes: packed 1 job, 2 shards and 4 shards with plausible 1/2/4 workers where runner resources support them. Propose additional shapes only if evidence justifies them.

### 5. Test-suite quality

Independently re-audit the actual suite. Confirm or challenge the existing hypotheses:

- preserve geometry/render/state/history/race/fault/resilience independent oracles;
- split `creature-presentation-desktop`, `creatures-desktop`, `creature-interaction-*`, `audit-*` where independently selectable;
- move seeded journeys, stress, scale, performance depth and soak out of universal PR gating;
- retain fixed realistic journeys for broad/full integration proof;
- remove duplicated assertions only when unique behavior/oracle remains covered;
- required groups must not silently pass by `test.skip` when prerequisites are missing;
- add accessibility rules coverage only if it closes a real uncovered class;
- do not create full Chromium x Firefox x WebKit multiplication unless product support contract requires it.

Produce KEEP / MOVE / NARROW / SPLIT / MERGE / DELETE / ADD decisions with rationale.

### 6. Selective planner safety

Try to break the planner model:

- rename source+destination;
- multi-path changes;
- generated producer/consumer fan-out;
- shared runtime changes;
- verification-governance changes;
- candidate policy self-narrowing;
- unknown/unmatched runtime paths;
- stale integration base;
- changing main;
- missing/duplicate stable IDs;
- shard union mismatch;
- selector escape after cutover.

Verify that under-selection is correctness failure and over-selection is optimization failure.

### 7. CI architecture simplicity

Identify whether any proposed cache, scheduler, build-once fan-out, duration-aware packer or shard coordinator is more complex than its measured benefit justifies.

Prefer the simplest design that materially lowers p50/p95 authoritative PR verdict time without losing correctness.

### 8. PC and Synology boundaries

Verify no ordinary PR path still requires:

- Remote Desktop;
- Molehill just because it is locally faster;
- external `atlas-local-e2e` as normal authority;
- Synology to build or run browser E2E;
- mutable private-LAN publication for candidate tests.

Verify specialist and deployment exceptions are explicit, minimal and auditable.

## Required output

Return a structured review with:

1. `VERDICT`: APPROVE / APPROVE_WITH_CHANGES / REJECT.
2. Critical correctness blockers.
3. Performance/throughput blockers.
4. Missing race/readiness protections.
5. Test-suite over-testing/under-testing findings.
6. CI/DAG/cache/sharding architecture findings.
7. Recommended exact concurrency benchmark matrix.
8. Recommended changes to #179 / prompt / audit / readiness contract.
9. What should be removed or simplified.
10. What must remain non-negotiable.
11. A prioritized patch plan with P0/P1/P2 items.

For every factual repository claim cite exact file/path/PR/issue/SHA evidence. Separate FACT / INFERENCE / RECOMMENDATION / UNKNOWN.

Do not rubber-stamp the current design. The goal is to prove whether it is genuinely safe, fast and maintainable enough for terminal #179 cutover.