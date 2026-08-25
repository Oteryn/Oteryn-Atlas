# Atlas E2E verification optimization — second-pass corrections

Status: normative second-pass architecture review for Issue #174 and PR #175. This remains analysis/design only. It does not implement CI, E2E, runner, deployment, or product-runtime changes.

Authority snapshot rechecked on 2026-08-25:

- repository: `Oteryn/Oteryn-Atlas`
- protected base: `main@3ec4037c6304d164447ad46d029ac8ad40a9ae0d`
- first-pass review head before this addendum: `913c697a9f977aa5009395a09a1f323fdc1effa4`
- first-pass document: `docs/testing/ATLAS-E2E-VERIFICATION-OPTIMIZATION-REVIEW.md`
- governing policy: `AGENTS.md`
- verification contract: `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

This document tightens and, where stated, corrects the first-pass review. The implementation agent must read both documents, with this second pass taking precedence when the two differ.

## 1. Second-pass verdict

The first pass was directionally strong but was not yet a 10/10 implementation architecture.

The following gaps were material enough to require correction before implementation:

1. self-hosted-runner trust and host-security boundaries were under-specified;
2. the candidate classifier could otherwise become part of the policy that decides whether it must test itself;
3. plan/evidence freshness after protected `main` advances was not fully defined;
4. `build once -> test same artifact -> deploy same artifact` conflicted with the repository's squash-only merge model unless split into PR-candidate and merged-main release lifecycles;
5. current checkout-overlay heavy E2E still depends on a remote publication origin and therefore can load/contaminate Synology-backed execution;
6. current `e2e/compose.yml` uses host IPC, so Compose-project isolation alone is not complete isolation for parallel browser jobs;
7. exact suite identity must be a set of stable test IDs, not a scenario count;
8. resource budgeting needs disk, shared-memory, I/O, queue fairness, runner lifecycle and crash cleanup in addition to CPU/RAM/GPU;
9. benchmark methodology and telemetry need hardening before worker/slot defaults are trusted;
10. selective testing needs a shadow/calibration rollout and a force-full escape hatch before it may skip heavy work.

With the corrections below, the design is suitable as the target architecture for the implementation programme.

## 2. P0 — self-hosted runner trust boundary

Moving routine heavy verification into GitHub Actions on Molehill is correct, but self-hosted execution must not mean arbitrary PR code gains execution on a trusted Windows/LAN host.

### Required trust policy

Heavy Molehill jobs must be admitted only when the exact candidate is trusted under an explicit repository policy.

At minimum:

- ordinary fork PR code must not run automatically on Molehill;
- a fork PR that needs physical heavy proof remains blocked/pending until explicitly trusted/approved; it must never fall back to Synology;
- same-repository branches may use Molehill only under the repository's authorized contributor/actor policy;
- dependency/bot PRs must not be assumed safe merely because their branch is in the same repository;
- native Windows/GPU execution requires an equal or stronger trust level than Docker browser execution;
- self-hosted jobs use least-privilege GitHub permissions and no unrelated secrets;
- do not use `pull_request_target` to check out and execute an untrusted PR head;
- candidate code must not receive credentials that are unnecessary for the test plan.

Where practical, the native lane should run under a dedicated low-privilege Windows identity with bounded local/network access. Security controls must not be disabled to improve benchmark numbers.

The current CI behavior for fork runtime PRs is fail-closed because the physical evidence path is not available; the target architecture must preserve that property.

## 3. P0 — trusted bootstrap for the impact classifier

A selector cannot be allowed to certify its own narrowing decision when the selector, manifest, test catalog, publisher or workflow policy is itself changed by the PR.

### Required two-sided policy check

Use a trusted lower-bound policy from the current protected base together with the candidate policy:

`required plan = max/union(trusted-base lower bound, candidate plan)`

The candidate may widen verification but must not be able to silently narrow below the trusted base when governance/verification code is part of the diff.

Mandatory bootstrap rules outside the candidate-controlled narrowing path must force `full` when the change includes, as applicable:

- impact manifest/policy;
- verification-plan builder/validator;
- test catalog/group resolver;
- Playwright configuration or shared fixtures affecting selection/execution;
- E2E runner/scheduler/admission code;
- summary/evidence aggregation;
- visual-review policy/publisher;
- protected-gate workflow logic.

The bootstrap validator must use strict schema validation and canonicalized values. Plan/group IDs are allowlisted identifiers, never shell fragments or arbitrary candidate-provided commands.

### Multi-path aggregation

For ordinary changes:

- resolve every current and previous rename path;
- compute the union of all required test groups/domains;
- select the maximum minimum-risk profile across all matched surfaces;
- apply explicit cross-domain escalation rules where combined changes are more risky than either path independently;
- any unmatched runtime-impacting path fails closed to `broad`/`full`;
- malformed/empty/incomplete GitHub changed-file evidence fails closed.

Never use first-match-wins classification.

## 4. P0 — `main` advancement and evidence freshness

A verification plan is not permanently valid merely because the task head SHA did not change.

The plan must bind:

- exact task/head SHA;
- exact integration base SHA used for the diff;
- merge-base/diff identity;
- impact-policy digest;
- test-catalog digest;
- worker/resource-policy digest.

Immediately before merge readiness, resolve current protected `main` again.

If `main` advanced after plan creation:

1. do **not** declare the implementation invalid merely because upstream moved;
2. recompute impact against the new integration base;
3. compare old and new required plans;
4. preserve exact-head evidence only for groups whose required inputs/contracts are demonstrably unchanged;
5. run newly required or materially invalidated groups;
6. issue a new final plan/evidence aggregate bound to the new integration base;
7. refuse merge readiness if the published plan still references a stale base.

This preserves parallel-agent progress while keeping the final protected-branch evidence current.

A practical evidence model should therefore bind each shard/group to an input digest, not only the PR head SHA, so unaffected exact-head proof can be reused safely after a base refresh instead of rerunning everything by default.

## 5. P0 — correct artifact promotion under squash-only merges

The first-pass wording `PR exact source -> build -> test -> merge -> deploy same artifact` is too strong for the current repository merge policy.

`Oteryn/Oteryn-Atlas` allows squash merge and does not allow merge commits or rebase merges. The final merged-main SHA is therefore normally different from the PR head SHA.

It is incorrect to claim that a PR-head artifact is the exact merged-main artifact unless immutable content equivalence is separately and rigorously proven and revision metadata is handled correctly.

### Correct two-lifecycle model

#### PR candidate lifecycle

`PR head -> candidate plan -> candidate product/code artifact as needed -> exact-head verification -> merge gate`

This proves the candidate behavior required for protected merge.

#### Merged-main release lifecycle

`merged main SHA -> build release artifact once on Molehill/appropriate compute -> verify that exact release artifact -> transfer/promote that exact artifact -> Synology verifies digest/revision -> deploy -> bounded live smoke`

The release artifact is the artifact governed by the live revision identity.

Synology must not rebuild it.

If deterministic equivalence between a tested PR product payload and the merged-main product payload can be proven, record that as additional evidence; do not use equivalence as an excuse to mislabel a PR-head artifact with a merged-main SHA.

### Artifact transport and rights

Do not assume a public container registry is an acceptable destination for all product bundles. Atlas/Game-derived raster/publication products must preserve rights/provenance restrictions. Use a storage/transfer boundary authorized for the artifact class and expose only digest/provenance metadata publicly when raw product bytes are not authorized for publication.

## 6. P1 — remove heavy PR dependence on live Synology publication data

Current checkout-overlay architecture does not test a fully self-contained candidate.

`e2e/nginx/default.conf.template` proxies `/fullworld/**` and `/data/creatures/**` to `ATLAS_PUBLICATION_ORIGIN`, and `e2e/run.ps1` requires a publication origin when testing the current checkout.

That means parallel Molehill workers/jobs can still create substantial read load against the remote publication service and benchmark results can include NAS/network contention.

This does not mean Synology is literally executing Playwright, but it is contrary to the desired clean role split if heavy parallel qualification depends on Synology capacity.

### Target

Canonical PR heavy E2E should, where technically feasible, use an immutable local/staged publication bundle or exact product artifact on Molehill.

Benefits:

- heavy qualification is self-contained;
- multiple PRs do not pressure Synology;
- worker benchmarks measure Molehill/browser capacity rather than NAS/network saturation;
- exact input/product digests can be bound directly to the verification plan;
- failures are more reproducible offline.

During migration, if checkout-overlay against a remote publication remains necessary, its upstream revision/product digest and network dependency must be explicit plan evidence and concurrency must be bounded so the remote service is not accidentally used as a load-test target.

Synology's normal target remains deployment, integrity/revision checks and bounded live smoke only.

## 7. P1 — Compose isolation is currently incomplete

Current main has two materially different container IPC models:

- `e2e/compose.yml` uses `ipc: host` for the Playwright container;
- `e2e/compose.selfhosted.yml` uses per-container `shm_size: 1gb`.

Open PR #169 changes locks/slots/project identities but does not change the Compose files.

Therefore unique Compose project names, artifact directories and forwarder ports do **not** by themselves prove complete isolation for concurrent `e2e/run.ps1` jobs because those jobs still share the host IPC namespace.

Before enabling authoritative concurrent slots:

1. benchmark a per-container shared-memory model;
2. measure `/dev/shm` pressure for workers 2/4/6/8;
3. select a per-profile/container shared-memory budget from evidence;
4. remove `ipc: host` from the normal parallel path if the isolated model is stable;
5. keep zero retries/timeouts/tolerances unchanged;
6. reject worker/slot combinations that cause Chromium OOM/crash/shared-memory instability.

Do not guess that `1gb` is sufficient for 8 workers merely because nightly currently uses it.

## 8. P1 — split impact policy from test catalog

The target should use two versioned concepts rather than making one manifest own everything.

### Impact manifest

Maps changed repository surfaces and dependency fan-out to:

- impact domains;
- minimum risk profile;
- required verification group IDs;
- build/artifact requirements;
- hardware/exclusivity requirements where they are properties of the changed subsystem.

### Verification catalog

Maps stable verification group IDs to:

- exact test/spec identities;
- Playwright project(s);
- resource class;
- sequential/parallel eligibility;
- visual group IDs;
- full-safety-net membership;
- expected evidence type.

The existing `e2e/user-visual-scenarios.json` remains the authoritative visual-scenario catalog and should be referenced rather than duplicated.

### Exact suite identity, not counts

A plan/publisher must compare the exact required stable test-ID set with the exact executed test-ID set.

A count such as `64`, `70`, or `71` is only a diagnostic summary. It is not a sufficient correctness identity because one missing test and one unintended duplicate can preserve the count.

Recommended stable Playwright identity:

`project + normalized spec path + test title path`

The current summary reporter records project/title/category/duration but not the spec path/stable test ID in the emitted scenario object. It should be extended before duration history or exact catalog validation depends on it.

The reporter's filename-based category model is also incomplete for future resource scheduling: for example `soak-desktop.spec.mjs` is not a first-class `soak` category in the current category set unless separately annotated. Resource policy must use explicit catalog metadata/annotations rather than infer exclusivity solely from filenames.

## 9. Active overlap beyond PR #169

The implementation agent must refresh and reconcile active work immediately before mutation.

Second-pass review found additional active test-platform overlap:

- PR #141 adds bounded Firefox/WebKit compatibility depth on Molehill and contains real evidence that Firefox WebGL2 behavior differs between headless and headed/Xvfb execution;
- PR #163 currently describes a 71-scenario required primary census on its feature branch;
- PR #170 currently describes a 70-scenario required primary census on its feature branch.

These are further evidence that a magic full-suite count is not a durable contract.

Cross-browser compatibility depth from #141 is a separate concern from the native Windows/RX 9070 XT hardware-truth lane. Do not merge those purposes into one test class.

## 10. P1 — scheduler needs fairness, freshness and backpressure

Resource admission alone is insufficient.

The orchestration design must also address queue behavior:

- superseded PR heads should not keep consuming heavy capacity once a newer head exists;
- normal PR concurrency should use a per-PR concurrency key so obsolete exact-head jobs can be cancelled safely;
- cancellation of obsolete work must never be reinterpreted as success evidence;
- independent PRs need fair access so one full plan does not monopolize all normal browser capacity while other targeted plans starve;
- performance/soak/native-exclusive jobs queue rather than compete with conflicting heavy work;
- nightly has an explicit off-peak/priority policy and must not cancel deployment work;
- resource admission records why a job is running, queued, blocked or rejected.

Optimize two objectives, not only one:

1. useful verified plans per hour;
2. bounded queue/tail latency for independent PRs.

## 11. P1 — resource budget includes disk, I/O and shared memory

The host budget must model at least:

- CPU;
- host RAM;
- Docker/WSL memory;
- browser shared memory;
- disk free-space floor;
- disk/build I/O pressure;
- GPU ownership for native work;
- exclusive-host ownership for calibrated performance/soak.

Live second-pass Molehill snapshot:

- physical RAM reported by Windows: `65,940,058,112` bytes (about 61.4 GiB);
- free physical memory at the observation: about 31.2 GiB;
- C: free space at the observation: about 300.7 GiB;
- Docker reports 16 CPUs and `50,513,698,816` bytes memory (about 47.0 GiB);
- Docker data VHDX size at the observation: about 69 GiB;
- Docker logical inventory remained about 30.97 GB images and 40.62 GB BuildKit cache, with about 20.39 GB cache reported reclaimable.

These are observations, not recommended thresholds.

The implementation must benchmark/select safety reserves rather than hard-code them from this snapshot.

## 12. P1 — runner lifecycle and isolation

Second-pass host inspection found one active `Runner.Listener.exe` for `oteryn-molehill-atlas`, launched with `Runner.Listener.exe run`. No `actions.runner*` Windows service was present in the service list at that observation.

For routine canonical CI this lifecycle is too implicit.

The implementation programme must define:

- how each Molehill runner instance starts automatically after reboot/logoff conditions that matter to the machine;
- separate runner names and work directories;
- dedicated runner health/identity verification;
- supported runner version/update policy and version captured in evidence;
- stale workspace/container cleanup after crashes;
- bounded operator recovery through Desktop Commander;
- no shared mutable checkout between runner instances.

A crash-safe janitor may remove only Atlas-labeled stale run resources after strong identity/age checks. It must not run broad `docker system prune` as normal cleanup.

## 13. P1 — benchmark telemetry and experimental rigor

Open PR #169 samples CPU from `Win32_Processor.LoadPercentage`.

A live read during this second pass returned a blank `LoadPercentage` on Molehill. Therefore that signal must not be the sole CPU utilization oracle for the authoritative benchmark.

Use a verified performance-counter/telemetry source and cross-check with per-container telemetry where practical, for example:

- Windows performance counters for total CPU/disk;
- Docker stats for active containers;
- host/Docker memory and OOM/container-exit evidence;
- shared-memory use/pressure for browser containers.

### Benchmark environment fingerprint

Every benchmark set must capture at least:

- Atlas exact SHA;
- publication/product artifact digest;
- Windows build;
- runner version;
- Docker Desktop/engine version;
- WSL/kernel/backend identity where applicable;
- Playwright image digest and browser version;
- worker count/profile;
- relevant power/thermal state metadata when measuring performance;
- GPU/driver identity for native lanes.

### Experimental order

Do not always benchmark `2 -> 4 -> 6 -> 8` in the same order and then interpret thermal/cache drift as a worker effect.

After a recorded warm-up, counterbalance/randomize candidate order across repetitions while keeping workload/environment identity fixed. Record cold-build cost separately from warm steady-state execution.

If the baseline workload itself produces deterministic failures/flakes during calibration, fix that first; do not choose a worker policy from an unstable benchmark.

### Profile-specific worker policy

The result may legitimately be different for `targeted`, `broad` and `full` plans. The final policy should be versioned per profile/resource class, not one universal worker number.

The effective worker cap also cannot exceed the number of proven-independent schedulable units in the plan.

## 14. P1 — Docker tag/cache proliferation mechanism

Current Compose services with `build:` and no stable content-addressed `image:` name produce project-scoped image identities when each run uses a unique Compose project.

Unique projects are correct for runtime isolation but can therefore amplify image-tag proliferation.

Target optimization:

- preserve the existing useful dependency layer boundary in `e2e/Dockerfile`;
- create a reusable dependency/harness base keyed by Dockerfile + lockfile + Playwright digest and other true dependency inputs;
- keep exact candidate test/source content in a small exact-source layer or measured staging model;
- use stable input-digest image identity where safe;
- serialize only the build of the same missing image digest, not all E2E execution;
- remove obsolete run-specific image tags without destroying useful BuildKit cache;
- benchmark Windows bind mounts versus Linux/WSL-native staging before switching models.

Concurrent jobs must never share mutable output/artifact volumes.

## 15. P1 — evidence and artifact classes

Selective execution must also become selective in evidence production without weakening failure diagnostics.

Define at least two artifact classes:

### Uploadable machine evidence

Examples:

- verification plan and digest;
- executed stable test-ID list;
- summary/failure metadata;
- timing/resource telemetry;
- environment fingerprint;
- artifact/product digests;
- visual-review manifest and screenshot digests where publication policy allows the metadata.

### Restricted local visual/debug evidence

Raw screenshots, videos, traces or full-frame material containing Game-derived raster pixels remain subject to the repository's rights/provenance policy and must not be treated as routine public evidence.

The verification plan should decide which reporters/evidence are required:

- machine-readable summary is always required for heavy browser plans;
- failure diagnostics remain strong;
- targeted passing runs need not generate expensive rich reports if measurement proves they add material cost and are not required evidence;
- broad/full/debug plans may retain richer reports;
- no raw visual frame is auto-approved.

Any reporter reduction must be benchmarked and must not reduce diagnostic quality for failures.

## 16. P1 — first-class Actions execution plus separate visual approval

Making heavy execution a first-class GitHub Actions job does not remove the requirement for genuine visual review.

Do not design a job that occupies a Molehill runner while waiting indefinitely for a person/visual-capable agent to review frames.

Preferred lifecycle:

1. GitHub Actions schedules and executes the exact heavy plan on Molehill;
2. machine evidence is aggregated and the runner is released;
3. restricted required frames remain in the trusted review location;
4. the reviewer actually opens every plan-required frame;
5. a lightweight exact-head, plan-bound visual approval manifest/status is published;
6. `atlas-gate` requires the heavy execution result plus visual approval when the plan says visual review is required.

Desktop Commander may remain a legitimate artifact-inspection/control plane for restricted visual review. It should no longer be required to launch normal PR test execution.

The legacy `atlas-local-e2e` status may be migrated/split; do not remove its safety properties until the new heavy-execution and visual-approval signals are both proven and protected by `atlas-gate`.

## 17. P1 — shadow mode before selective cutover

Do not switch directly from `all non-doc runtime changes -> full heavy` to selective skipping.

Required rollout:

### Stage 1 — shadow classification

Generate `none/focused/targeted/broad/full` plans while continuing the old full-heavy requirement for runtime PRs.

Record what the selective plan would have omitted.

Use completed full runs to detect cases where a test outside the proposed selective plan fails. Every such escape becomes a permanent impact-policy regression.

### Stage 2 — selective execution with full safety net already active

Enable selective PR gating only after:

- planner/catalog contracts are stable;
- shadow evidence demonstrates acceptable behavior;
- complete full current-main nightly/scheduled safety net is already running;
- emergency force-full override exists.

### Force-full escape hatch

Provide a repository-controlled, auditable way to force a PR or all PRs to `full` without weakening code/tests. Planner error/unsupported version/unknown impact also forces broad/full automatically.

Do not provide an override that can force less verification than the policy requires.

## 18. P2 — duration-aware sharding should not duplicate Playwright

Playwright already schedules independent spec files across workers. A custom duration-aware shard planner is most valuable when work is split across multiple independent jobs/containers/runners, not necessarily inside one Playwright process.

Therefore revise first-pass Phase F:

1. first capture stable spec/test IDs and file-level durations;
2. benchmark built-in Playwright worker scheduling;
3. split abnormally long sequential specs only when independence can be proven;
4. add custom longest-processing-time-first sharding only if multi-job static partitioning or measured imbalance justifies it;
5. never split stateful ordered journeys merely to make charts look balanced.

Timing history may influence scheduling only. It can never make a test optional.

Canonical timing history should be learned from trusted successful main/nightly evidence; PR timing can be observed without becoming an authoritative scheduling input until validated.

## 19. P2 — remaining coverage-side observations

These are not reasons to replace the current test stack, but the implementation programme must not lose them while optimizing execution.

### Network-condition depth

A fresh repository search did not identify an explicit latency/throttled-bandwidth/offline/reconnect matrix. Existing `resilience-desktop.spec.mjs` has valuable fail-closed HTTP/publication/corruption coverage, but that is not the same thing as a calibrated network-condition matrix.

Evaluate bounded deterministic cases for:

- high latency;
- interrupted/aborted range transfer;
- offline transition and recovery;
- very slow completion/reordering where product behavior is material.

Only add scenarios with distinct behavioral value.

### Mutation testing

Do not add broad mutation testing to every PR. Evaluate targeted mutation testing for critical pure selector/geometry/state logic or scheduled depth where it gives independent evidence.

### Accessibility and cross-browser

Accessibility remains a first-class relevant group for user-visible plans. Open PR #141's cross-engine work should remain a bounded compatibility-depth surface, not expand every PR into every browser.

## 20. Corrected implementation order

The first-pass staged programme remains useful but should be reordered as follows.

### Phase 0 — trust/bootstrap contracts

Before selectivity:

- define trusted-vs-untrusted self-hosted admission;
- add trusted-base lower-bound classification/bootstrap;
- define stable test catalog IDs;
- define plan/base freshness semantics;
- define restricted vs uploadable artifact classes.

### Phase A — measurement + shadow plan

- land worker/concurrency telemetry tooling;
- fix/replace unreliable CPU telemetry;
- generate plans in shadow mode without skipping current heavy requirements;
- record complete environment fingerprints;
- measure cold/warm Docker, bind-mount/staging and shared-memory behavior.

### Phase B — runner orchestration and isolation

- reconcile PR #169;
- reconcile active PR #141 and current test-catalog changes;
- make heavy execution first-class Actions work;
- provide managed runner startup/health;
- remove host-IPC dependency from parallel normal path after proof;
- add crash-safe Atlas-scoped cleanup.

### Phase C — benchmark-selected resource policy

- run workers 2/4/6/8 repeatedly;
- benchmark profile-specific one-job and two-job combinations;
- define CPU/RAM/Docker-memory/shared-memory/disk/I/O budgets;
- define queue fairness and exclusivity policy.

### Phase D — plan-bound evidence

- aggregate exact stable test-ID sets;
- bind head/base/policy/catalog/environment digests;
- split machine execution evidence from genuine visual approval;
- keep zero retries and exact-head review.

### Phase E — enable selective PR testing

Only after full current-main safety net is already active and shadow evidence is acceptable:

- enable none/focused/targeted/broad/full execution;
- preserve force-full escape hatch;
- keep UNKNOWN fail-closed;
- monitor classifier escapes and permanently repair policy/tests.

### Phase F — Docker and scheduling efficiency

- reuse content-keyed images/layers;
- clean tags without destroying useful cache;
- introduce multi-job duration sharding only if measured worthwhile;
- decouple heavy PR qualification from Synology publication capacity.

### Phase G — native hardware truth

- add trusted bounded Windows/GPU lane;
- capture real hardware/browser/driver identity;
- keep it distinct from Docker correctness and #141 cross-browser compatibility.

### Phase H — merged-main release artifact promotion

- build exact merged-main release artifact once on Molehill/appropriate compute;
- verify the same artifact;
- transfer/promote by digest under the correct rights boundary;
- Synology verifies and deploys it without rebuilding;
- bounded live smoke remains on Synology.

## 21. Additional acceptance criteria

The first-pass acceptance criteria remain mandatory. Add all of the following:

31. Untrusted fork/candidate code cannot execute automatically on Molehill or native Windows lanes.
32. Candidate changes to classifier/manifest/catalog/publisher cannot reduce verification below the trusted-base lower bound.
33. A final gate cannot pass with a verification plan bound to a stale integration-base SHA.
34. Main advancement recomputes the plan and renews only materially invalidated evidence rather than restarting implementation by default.
35. Full-plan correctness compares exact stable test identities, not only scenario count.
36. Open test-catalog growth from concurrent feature PRs cannot silently invalidate a hard-coded full census.
37. Parallel normal jobs do not share host IPC; shared-memory sizing is benchmark-backed.
38. Heavy PR qualification no longer depends on Synology serving broad parallel test traffic in the target state.
39. Resource admission accounts for disk/I/O/shared-memory headroom as well as CPU/RAM/GPU.
40. Runner startup/health survives ordinary host restart lifecycle and each instance has a unique work directory/identity.
41. Stale crashed Atlas containers/images/workspaces are cleaned safely without broad Docker prune.
42. Benchmark CPU/resource telemetry is verified non-null and accurate enough for policy selection.
43. Benchmark order/environment controls prevent cache/thermal/background-load drift from masquerading as worker improvement.
44. Worker policy may differ by profile and aggregate two-job throughput is measured before defaults are chosen.
45. Superseded PR-head heavy work is cancelled/ignored without publishing success for the new head.
46. Scheduler fairness prevents one full job from indefinitely starving independent targeted work.
47. Selective policy runs in shadow mode before it is allowed to skip previously required heavy E2E.
48. A force-full control exists; no force-less control exists.
49. Restricted Game-derived visual/debug artifacts are not exposed through an unauthorized artifact channel.
50. First-class GitHub heavy execution can complete and release the runner before manual visual approval, while `atlas-gate` still requires genuine plan-bound review where applicable.
51. Duration-aware custom sharding is implemented only if it measurably improves multi-job balance beyond built-in Playwright scheduling.
52. The deployed release artifact is built from the exact merged-main SHA, or any claimed equivalence to earlier candidate content is explicitly proven without falsifying revision identity.

## 22. Final target architecture after second pass

The corrected destination is:

`GitHub PR exact head`
`-> trusted-base bootstrap + candidate impact policy`
`-> stable verification catalog`
`-> current-base-bound none/focused/targeted/broad/full plan`
`-> hosted cheap gates`
`-> trusted self-hosted admission`
`-> resource/fairness scheduler`
`-> isolated local-publication Docker correctness on Molehill`
`-> optional cross-engine depth and trusted native GPU truth`
`-> exact stable-test-ID evidence aggregate`
`-> genuine selective visual approval when required`
`-> protected atlas-gate/provenance-gate`
`-> squash merge`
`-> exact merged-main release artifact built once off Synology`
`-> same release artifact verified and promoted by digest`
`-> Synology integrity/revision + bounded live smoke only`
`-> complete current-main full nightly/depth safety net`

This architecture preserves the original quality standard while removing unrelated heavy work, preventing unsafe selector/runner shortcuts, and making concurrency a measured system property rather than a guessed worker/slot number.

## 23. Implementation alias

The recommended alias remains:

`ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION`

The implementation agent must read this second-pass document in addition to the first-pass review and must re-resolve current `main`, active overlapping PRs, runner state, test catalog and Molehill measurements before any mutation.