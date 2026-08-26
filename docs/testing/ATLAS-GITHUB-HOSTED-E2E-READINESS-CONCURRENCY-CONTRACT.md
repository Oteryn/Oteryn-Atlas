# Atlas GitHub-hosted E2E readiness and concurrency contract

Lifecycle authority: Oteryn/Oteryn-Atlas#179

This contract closes two failure classes that must not appear after ordinary E2E moves to GitHub-hosted runners:

1. browser verification starting against an incomplete candidate/product/publication while an agent or producer is still downloading/building/writing it;
2. treating "parallel" as a fixed small number or as unlimited fan-out without distinguishing GitHub jobs from browser workers inside one VM.

## Core rule: tests consume immutable ready inputs, never work in progress

A GitHub-hosted E2E consumer must never depend on a mutable local agent directory, an agent's still-running download, a partially written remote path, a live Synology build directory, or another producer whose completion is inferred by time/sleep.

Git commits/pushes are atomic inputs to Actions: a workflow qualifies one exact pushed SHA. Any additional work still present only on an agent machine is not part of that candidate and must not be smuggled into the test environment later.

If a required input is not already immutable at workflow start, the workflow itself must own a producer stage and an explicit readiness barrier.

## Candidate states

Treat a PR head as two logically different states:

- `WORKING_HEAD` — the agent is still iterating. Cheap deterministic checks may run, but expensive browser qualification should be avoided when the repository can identify this state safely.
- `QUALIFICATION_HEAD` — an exact pushed SHA selected for authoritative plan execution. It is immutable; any subsequent push creates a different head and invalidates/cancels the old qualification.

For long-lived draft implementation PRs, evaluate using draft/readiness state as a measured optimization: cheap plan/deterministic checks may run while draft, while expensive hosted E2E starts at an explicit qualification checkpoint such as ready-for-review or another repository-owned exact-head signal. Do not adopt this merely by convention; encode and test it so required final checks still run automatically before merge.

If implementation must continue after a failed qualification, return the PR to working mode where practical, batch the fix, then qualify the new exact head. Do not intentionally launch a full/broad browser campaign after every tiny intermediate push.

## Readiness barrier

A browser shard may start only after all prerequisites selected by the exact verification plan are complete.

The barrier must be represented by job dependencies/evidence, not timing assumptions.

### 1. Plan barrier

A trusted producer resolves and validates:

- exact PR head SHA;
- current integration/base identity needed by the plan;
- changed-path/diff digest;
- trusted/candidate policy and catalog digests;
- selected profile/groups/stable test IDs;
- required candidate products/publications;
- chosen execution shape.

No expensive browser matrix is allocated before this plan is known.

### 2. Input barrier

Every required external/product input is either:

- already content-addressed and verified by digest; or
- fetched/built inside a producer job into a temporary location and verified before publication.

A producer must never expose a directory/file as ready while it is still being populated.

For downloaded/generated inputs use a transactional pattern equivalent to:

`temporary path -> complete download/build -> schema/count/size/digest validation -> atomic publish/rename -> readiness manifest`

Do not use `sleep N` and hope a download/build has completed.

### 3. Candidate manifest

The producer emits a machine-readable readiness manifest bound at least to:

- repository;
- exact candidate SHA;
- plan digest;
- producer job/run identity;
- every product/input content digest;
- expected file/object count where meaningful;
- byte size where useful for truncation detection;
- schema/product version;
- harness/browser/image digest;
- creation completion timestamp;
- `complete: true` only after all validation succeeds.

`complete: true` must be impossible to emit on producer failure/cancellation/partial output.

### 4. Consumer barrier

E2E consumers use `needs`/equivalent explicit dependency on the successful readiness producer when shared prepared inputs are required.

Every shard revalidates before browser start:

- its workflow SHA equals the plan SHA;
- readiness manifest says complete;
- required content digests match;
- selected shard/group IDs match the plan;
- no required input is missing;
- no stale artifact from another SHA/run is accepted.

If any check fails, the shard fails/blocks before Playwright. It does not retry against a mutable source.

### 5. Fan-in barrier

Final browser evidence is accepted only when:

- every required shard/group completed successfully;
- all shards bind the same candidate SHA, plan digest and shared-input digests;
- the exact union of executed stable test IDs equals the required set;
- cancelled/stale/old-head evidence is rejected;
- required visual/specialist evidence is present when selected.

## Superseded-head race protection

Use per-PR/purpose `concurrency` with `cancel-in-progress` for expensive hosted qualification.

In addition, immediately before expensive preparation/browser execution, verify that the PR's current head is still the workflow candidate SHA. If the PR has advanced, stop obsolete expensive work rather than qualifying a head that cannot merge.

A new push must never mutate inputs of an already running qualification. It creates a new exact candidate and a new plan.

An old run that completes during a cancellation race remains evidence only for its old SHA and cannot satisfy the new head.

Measure `superseded-work waste` and optimize it, but never reuse stale success merely to save compute.

## Parallelism has two levels

### GitHub job/shard concurrency

Each hosted shard is a separate VM. This provides true horizontal parallelism and isolation, but each shard repeats some runner/setup/image/preview overhead.

The repository must discover the actual organization/account hosted-runner concurrency available at execution time/settings and must not assume a value from documentation alone. GitHub's service limit is plan-dependent and may be much larger than two.

Repository execution policy should use its own measured `max-parallel`/packing limits below the service maximum so one Atlas PR cannot create wasteful matrix amplification.

### In-job Playwright workers

Workers share one hosted VM. For the current public-repository standard `ubuntu-24.04` class, the declared class is 4 vCPU and 16 GB RAM; therefore worker count must be benchmarked independently of shard count.

Do not infer that 4 vCPU means four heavy browser workers are optimal. Browser, preview, Docker and reporting contend for the same VM resources.

Benchmark at least 1/2 workers and 4 only where the workload/resources support it. Reject a higher worker count when it worsens wall-clock, variance, OOM/crash rate or deterministic stability.

## Expected Atlas concurrency shape

Do not encode this as a permanent constant before benchmark, but use it as the default hypothesis to test:

- `none/focused`: 0 browser shards;
- small `targeted`: 1 packed browser job, normally 1-2 workers;
- larger `targeted/broad`: 1-2 hosted shards, each with the measured safe worker count;
- long `full`: compare 2 versus 4 hosted shards; use 4 only when end-to-end wall-clock materially improves after repeated setup/queue/artifact cost;
- specialist private/native/LAN group: separate Molehill job only when the catalog explicitly requires that capability;
- nightly depth: separate cadence/concurrency so it does not block ordinary PR verdicts.

More than two hosted E2E jobs may run concurrently, and multiple independent PRs should be able to use separate hosted VMs concurrently subject to the account service limit. The architecture must not recreate the old two-slot physical-PC bottleneck on GitHub.

However, "GitHub permits N concurrent jobs" is not a reason for one PR to consume N. Per-PR shard count is an optimization result, not an entitlement.

## Account/service concurrency baseline

As of 2026-08-26, current GitHub documentation lists standard GitHub-hosted total concurrent-job limits by plan as 20 (Free), 40 (Pro), 60 (Team), and 500 (Enterprise), with a 256-job maximum for one job matrix. These are service ceilings, not Atlas target settings, and are subject to change.

Before terminal #179 cutover, record the actual Oteryn organization/account hosted concurrency visible in GitHub settings/API if authorized. If it cannot be resolved, record it `UNKNOWN` and design Atlas conservatively below the documented minimum service ceiling rather than pretending the exact capacity is known.

For the public `Oteryn/Oteryn-Atlas` repository, standard `ubuntu-24.04` jobs currently receive 4 vCPU / 16 GB RAM and public-repository standard-runner minutes are documented as free/unlimited; concurrency still follows the applicable account/organization limit.

## Cross-PR fairness

Ordinary GitHub-hosted jobs do not need a Molehill-style machine-wide slot lock because separate hosted VMs do not share the physical browser host.

Still prevent pathological consumption:

- cap per-PR shard parallelism from the measured policy;
- cancel superseded heads promptly;
- do not let nightly/depth intentionally consume all available concurrency during active PR work;
- avoid one job per individual test;
- keep specialist self-hosted resources in their own strict capacity pool;
- report queue time and useful verified plans/hour under concurrent PR load.

If service concurrency becomes the bottleneck, optimize packing/fairness first; do not move normal work back to Molehill/Synology.

## Negative proofs required

Tests/contracts must prove at least:

- E2E shard cannot start before a required producer/readiness manifest succeeds;
- `complete: true` cannot be emitted for partial/cancelled producer output;
- wrong input digest blocks consumer before browser start;
- wrong/stale PR head stops obsolete expensive work;
- old-head artifact cannot satisfy new-head fan-in;
- one shard cannot consume another run's artifact accidentally;
- required stable test IDs cannot disappear when a shard is cancelled;
- draft/working-head optimization, if enabled, cannot allow merge without exact qualification-head required checks;
- per-PR shard cap prevents accidental matrix explosion;
- multiple independent PRs can run hosted E2E concurrently without a global two-slot lock;
- increasing workers/shards beyond the selected measured policy cannot silently become authoritative without policy/version change and bootstrap/full verification.

## Acceptance criteria

This contract is satisfied only when:

1. ordinary E2E has no dependency on unfinished agent-local downloads/builds;
2. every nontrivial shared candidate input has explicit producer/readiness/fan-in identity;
3. consumer jobs start only after successful prerequisites and validate immutable digests;
4. superseded heads cancel/stop obsolete expensive work and cannot satisfy current-head gates;
5. active development does not reflexively launch broad/full qualification after every small intermediate change when a safe qualification-checkpoint mechanism is available;
6. workers and hosted shards are measured independently;
7. hosted parallelism is not artificially capped at the old two-slot physical-host model;
8. per-PR parallelism remains adaptive and bounded against setup amplification;
9. concurrent-PR load tests demonstrate isolation, fairness and materially improved throughput;
10. final policy records actual service/account concurrency when discoverable, runner class, shard cap, worker policy and rollback path.
