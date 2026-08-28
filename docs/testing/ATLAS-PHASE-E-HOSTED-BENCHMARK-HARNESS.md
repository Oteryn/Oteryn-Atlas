# Atlas Phase E GitHub-hosted benchmark harness

## Status and authority

This document defines the measurement harness prepared by `ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS` for Issue #179. It does **not** calibrate production execution policy.

The preparation branch predates final protected Phase D. Therefore every timing, cost, failure-rate, cache, image, worker, or shard number produced before final protected Phase D merges is **`NON_AUTHORITATIVE_PRE_PHASE_D`**. Do not compare those numbers to select a production default and do not copy them into `worker-policy*` or another authoritative selector.

Authoritative Phase E measurement may begin only after the coordinator resolves final protected Phase D on protected `main`, rebuilds/rebases Phase E on that exact state, and confirms that the measured hosted workflow is the final safe controller. A later evidence record may use `AUTHORITATIVE_POST_PHASE_D` only with an exact `protectedPhaseDSha` and `phaseDState=FINAL_PROTECTED_MERGED`.

Retries = 0 for every benchmark run. `workflowRunAttempt=1` is mandatory; manually rerun attempts are not benchmark-eligible because they would violate the zero-retry first-run reliability objective.

Molehill remains specialist-only evidence for `real_fullworld`, native-GPU, soak, exceptional performance, and similar specialist lanes; Molehill results must not define ordinary GitHub-hosted defaults. Synology remains deployment-only and is not a benchmark authority.

Verification profile and data capability remain independent. In particular, `full` does not imply `real_fullworld`; an ordinary full functional plan may and normally should use `qualification_fixture` unless its oracle genuinely depends on bounded or real FullWorld bytes.

## Versioned inputs

The harness is versioned by:

- `tools/verification/hosted-benchmark-contract.json` — required identity and metric inventory;
- `tools/verification/hosted-benchmark-phase-map.json` — GitHub Actions step-name to benchmark-phase mapping;
- `tools/verification/hosted-benchmark-experiments.json` — measurement candidates only, never selected policy;
- `tools/verification/hosted-benchmark-schema.mjs` — fail-closed evidence validation;
- `tools/verification/collect-hosted-benchmark.mjs` — offline run/jobs metadata collector.

Every evidence record must carry all of these exact identity fields:

| Field | Requirement |
| --- | --- |
| `repository` | Exact `owner/name`. |
| `candidateSha` | Exact 40-hex candidate head measured by the workflow run. |
| `integrationBaseSha` | Exact protected integration base used for the plan. |
| `protectedPhaseDSha` | `null` while evidence is `NON_AUTHORITATIVE_PRE_PHASE_D`; exact merged Phase-D SHA for authoritative post-D evidence. |
| `planDigest` | Exact `sha256:` digest of the verification plan consumed by the hosted run. |
| `stableIdSetDigest` | Exact `sha256:` digest of the planned stable Playwright ID set. |
| `productDigest` | Exact `sha256:` digest of the immutable qualification product/artifact used by the run. |
| `browserHarnessDigest` | Exact `sha256:` digest of the browser/harness image or immutable harness identity. |
| `workflowRunId` | Exact GitHub Actions run ID. |
| `workflowRunAttempt` | Exact GitHub Actions run attempt; it must be `1`. |
| `workflowSha` | Exact SHA containing the measured workflow definition. |
| `profile` | Exact verification profile: `none`, `focused`, `targeted`, `broad`, or `full`. |
| `dataCapability` | Exact data capability: `qualification_fixture`, `bounded_real_world`, or `real_fullworld`. |

Identity values must be obtained from the final controller/evidence artifacts and GitHub run metadata. Do not reconstruct a digest from memory and do not substitute branch names for SHAs.

## Whole-DAG measurement surface

Phase E measures the workflow as a system, not only the Playwright command. The minimum measurement surface is:

- queue/provisioning;
- checkout/fetch;
- dependency restore/install;
- qualification build + verification + readiness;
- browser image pull/build/extract;
- preview startup;
- Playwright execution;
- shard fan-out/fan-in;
- cache restore/save;
- artifact upload/download;
- cancellation/superseded waste;
- duplicate setup/work;
- verdict wall-clock;
- job-minutes;
- runner logical CPU count;
- runner total memory;
- peak CPU percent;
- peak memory bytes;
- variance;
- OOM/crash;
- useful plans/hour.

The collector derives timestamps only from explicit GitHub run/job/step timestamps and explicit supplemental observations. It never converts missing data to zero. A legitimate zero is `MEASURED` only when its `source` establishes that zero; a phase that is genuinely absent is `NOT_APPLICABLE` with `value: null` and a source/reason.

Required phase names are mapped through `hosted-benchmark-phase-map.json`. On a successful run, a missing required phase makes collection fail closed. On a failed/cancelled run, an unreached required phase is recorded explicitly as `NOT_APPLICABLE` so the measurement failure remains recordable rather than disappearing.

`duplicateSetupMs` is descriptive duplicated setup time: for checkout/fetch, dependency restore/install, qualification preparation, browser-image preparation, and preview startup, the collector counts repeated mapped occurrences after the first occurrence. It is not itself a policy threshold.

`runnerLogicalCpuCount`, `runnerMemoryTotalBytes`, `peakCpuPercent`, and `peakMemoryBytes` are required `MEASURED` observations for a successful benchmark. `peakCpuPercent` is normalized to 0–100% of total hosted-runner CPU capacity, and `peakMemoryBytes` cannot exceed measured runner total memory. These observations are the guardrail for deciding whether a later `workers=2`, `workers=4`, `workers=6`, or `workers=8` packed experiment is eligible to run; they are not themselves a production threshold.

`varianceMs` is an aggregate dispersion field. For comparison summaries use a documented millisecond spread over repeated clean verdict wall-clock observations, consistently across candidates; single-run records keep it explicit `NOT_APPLICABLE`. `usefulPlansPerHour` is likewise aggregate: count only exact-identity, non-superseded plans that reach a valid verdict during the measured observation window.

## Experiment sequence — prepare, do not conclude

Start every representative workload with `packed-w1`: one hosted job, `workers=1`, `shards=1`. This is the fixed-cost and critical-path baseline. The packed measurement ladder is `workers=1/2/4/6/8`, with each tier measured as a separate single-job experiment.

`workers=2` is conditional on measured hosted-runner CPU/memory headroom and a clean packed baseline. `workers=4` is conditional on `workers=2` remaining stable and showing real resource headroom. `workers=6` is conditional on `workers=4` remaining stable with resource headroom, and `workers=8` is conditional on `workers=6` remaining stable with resource headroom. A higher tier that is ineligible or unstable remains recorded as such and must not be substituted into policy selection.

2 shards are candidates only for `broad` and `full` when setup amortization is plausibly favorable. 4 shards are candidates only for `broad` and `full` after 2-shard evidence shows a material wall-clock benefit that can justify duplicated setup and extra job-minutes. Sharding is not a default for focused/targeted work.

Never maximize workers and shards simultaneously. The prepared candidates keep workers above one and shards above one on separate axes. Do not materialize a worker × shard Cartesian matrix unless a later, evidence-backed design explicitly calls for one.

Compare the other axes deliberately, one controlled hypothesis at a time:

- cold vs restored cache;
- current vs thin immutable browser/harness image;
- per-shard recomputation vs build-once content-addressed product fan-out;
- eager vs gated DAG start where the trust boundary permits early work.

These are experiment candidates, not conclusions. The measurement harness has `measurementOnly=true`, `selectionApplied=false`, and cannot update the authoritative verification plan, worker policy, required checks, or selective-execution enablement.

## Representative workloads and repetitions

After final Phase D is merged, collect representative samples for targeted, broad, and full functional plans on the ordinary GitHub-hosted path. Use `qualification_fixture` unless the test oracle explicitly requires another data capability. Specialist `real_fullworld` measurements remain separate.

For every material candidate comparison, run **at least 3 clean repetitions** per representative workload and condition. Run more repetitions when spread is large enough that ordering is unstable. Keep cold-cache and restored-cache samples separate; do not average unlike conditions into one number.

Also exercise concurrent-PR/superseding-head behavior so cancellation waste and useful plans/hour can be measured. A cancellation or infrastructure failure is evidence, not a sample to delete. Record it with its exact outcome/failure class, then decide separately whether it belongs in a clean-latency distribution.

## Export exact GitHub Actions metadata

Run this only against the exact GitHub-hosted workflow run being measured. `RUN_ID` is the exact Actions run ID and `GITHUB_REPOSITORY` is `Oteryn/Oteryn-Atlas` for this repository.

```bash
mkdir -p artifacts/verification/phase-e-benchmark

gh api "repos/$GITHUB_REPOSITORY/actions/runs/$RUN_ID" \
  > artifacts/verification/phase-e-benchmark/run.json

gh api "repos/$GITHUB_REPOSITORY/actions/runs/$RUN_ID/jobs?per_page=100" \
  > artifacts/verification/phase-e-benchmark/jobs.json

jq -e '.total_count == (.jobs | length)' \
  artifacts/verification/phase-e-benchmark/jobs.json >/dev/null
```

The pagination equality check is fail-closed: if the run ever exceeds one 100-job page, update the export procedure to combine all pages before measuring rather than silently dropping jobs.

## Prepare exact identity and experiment inputs

Write `identity.json` from the controller's exact plan/product/stable-ID evidence and GitHub metadata. All identity fields from the table above are mandatory. Pre-final-D evidence must set `protectedPhaseDSha` to `null`; after final protected Phase D, authoritative measurement must bind its exact SHA. Confirm `workflowRunAttempt=1`; if GitHub reports a later attempt, do not use that run for calibration.

Write `experiment.json` using one declared candidate from `hosted-benchmark-experiments.json` and exactly one value from each comparison axis. For example, the first baseline is `packed-w1` with workers/shards both one; the actual profile still comes from `identity.profile`.

Do not hand-edit an observed worker or shard count to make a candidate look favorable. If the executed shape differs from the declared candidate, discard the comparison and fix the run definition.

## Supplemental observations

`collect-hosted-benchmark.mjs` deliberately cannot infer some facts from GitHub timestamp metadata alone. Supply them explicitly in `supplemental.json`:

- `supersededWasteMs`: `MEASURED` only from an explicit superseding-head observation; a confirmed non-superseded run may record sourced zero;
- `runnerLogicalCpuCount`: measured logical CPU count from the actual GitHub-hosted runner used by the benchmark;
- `runnerMemoryTotalBytes`: measured total memory bytes from that runner;
- `peakCpuPercent`: measured peak CPU utilization normalized to 0–100% of total runner CPU capacity over the benchmark observation window;
- `peakMemoryBytes`: measured peak used-memory bytes over the same observation window;
- `varianceMs`: `NOT_APPLICABLE` for one run, then measured in the repeated-run comparison summary;
- `oomCrashCount`: `MEASURED` only after runner/job/log evidence has been classified; do not infer zero merely because GitHub says `failure` or `success`;
- `usefulPlansPerHour`: `NOT_APPLICABLE` for one run, then measured over the concurrent observation window.

Every supplemental observation uses the same shape as other metrics: `status`, `value`, `unit`, and non-empty `source`. Missing supplemental metrics fail collection rather than silently becoming zero. A successful run also fails validation if any required runner resource observation is `NOT_APPLICABLE`; a failed run may preserve an unreached resource observation as explicit `NOT_APPLICABLE` with a failure-specific source.

If a workflow does not conclude successfully, pass an explicit `failureClass`/`--failure-class` when known: `ASSERTION`, `INFRASTRUCTURE`, `OOM_CRASH`, `CANCELLED`, or `SUPERSEDED`. If classification is genuinely unavailable, the collector records `UNCLASSIFIED_FAILURE`; measurement failure evidence must be recorded, never hidden by deleting the run.

## Collect one evidence record

For preparation/pre-final-D runs, omit authority overrides so the collector can emit only `NON_AUTHORITATIVE_PRE_PHASE_D`:

```bash
node tools/verification/collect-hosted-benchmark.mjs \
  --run artifacts/verification/phase-e-benchmark/run.json \
  --jobs artifacts/verification/phase-e-benchmark/jobs.json \
  --identity artifacts/verification/phase-e-benchmark/identity.json \
  --experiment artifacts/verification/phase-e-benchmark/experiment.json \
  --supplemental artifacts/verification/phase-e-benchmark/supplemental.json \
  --output artifacts/verification/phase-e-benchmark/evidence.json
```

For a non-successful run with a known infrastructure classification, add for example `--failure-class INFRASTRUCTURE`. Do not use `AUTHORITATIVE_POST_PHASE_D` merely because the branch contains a plausible Phase-D SHA; the coordinator must first prove that SHA is the final merged protected Phase D and that the measured workflow was built on it.

## Comparison and decision record

A later Phase E calibration record should retain every raw evidence file and summarize, by workload and condition:

1. verdict wall-clock p50/p95 and repeated-run spread (`varianceMs` definition used by that comparison);
2. queue/provisioning p50/p95;
3. fixed setup time and useful Playwright execution time;
4. duplicated setup/work and shard fan-out/fan-in cost;
5. total job-minutes and artifact/cache transfer cost;
6. runner CPU/memory headroom before any higher-worker experiment;
7. OOM/crash, assertion-failure, infrastructure-failure, cancellation, and superseded-run counts/rates;
8. useful plans/hour under the measured concurrent workload;
9. exact coverage/identity equality for plan, product, stable-ID set, candidate head, integration base, harness, and workflow.

The decision objective is the fastest safe reviewer verdict with bounded CI cost and clean first-run reliability, not maximum parallelism. A faster browser command is not a win if queueing, image/setup duplication, artifact transfer, instability, or job-minutes make the whole DAG worse.

No production worker/shard default may be selected from this preparation branch. The coordinator must rebuild/rebase the Phase E calibration lane on final protected Phase D, repeat the hosted measurements, preserve raw evidence, and only then propose a versioned policy change through normal protected review.
