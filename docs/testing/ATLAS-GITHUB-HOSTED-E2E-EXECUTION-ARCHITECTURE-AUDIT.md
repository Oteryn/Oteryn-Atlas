# Atlas GitHub-hosted E2E execution architecture audit

Lifecycle authority: Oteryn/Oteryn-Atlas#179

Audit base: `main@1c5c76c21c26a31ebc97363c2e2f604caa90db6f`.

## Purpose

This document defines the mandatory audit and target architecture for moving ordinary Atlas browser verification to GitHub-hosted runners **without replacing one bottleneck with a wasteful matrix of short-lived jobs**.

The optimization target is not maximum parallelism. The target is the lowest useful exact-head verification latency at stable zero-retry correctness, bounded compute/setup amplification, deterministic evidence, and no loss of regression-detection quality.

A fast design that repeats expensive setup on many shards, creates a Cartesian browser/viewport/seed matrix, uploads large passing artifacts, rebuilds identical products per shard, or serializes unrelated cheap checks on the E2E critical path is not an acceptable optimization.

## Fresh baseline observations

### Existing hosted capability

The repository already executes deterministic contracts, real Chrome/WebGL proof and Docker harness validation on GitHub-hosted `ubuntu-24.04` runners. Ordinary hosted execution is therefore an extension of a proven repository path, not a new trust domain.

Current `.github/workflows/docker-e2e.yml` already has per-PR `concurrency` with `cancel-in-progress: true`, runs on `ubuntu-24.04`, starts the current-code web overlay through Compose, builds the pinned Playwright image and enumerates the complete Playwright suite.

### Measured fixed setup cost

A successful hosted Docker E2E harness run on exact head `e9d70c58e7fce32b1cb8aa5d176ed5840a8174a4` started at approximately `20:08:22Z` and completed at approximately `20:09:00Z`, about 38 seconds wall-clock, while it **did not execute the 71 browser scenarios**; it only validated the preview and listed them.

The `docker build` step spent about 25.1 seconds materializing the pinned Playwright base image before the thin Atlas E2E layers were added. The log listed roughly 947 MB of base-image layers in that cold path. Atlas-specific `npm ci` took about one second and the final thin image export about three seconds.

This is a critical architecture constraint: creating many hosted shards can reduce browser execution time while multiplying fixed image/setup work. Therefore shard count must be selected from measured end-to-end wall-clock and setup-amplification data, never from the intuition that more parallel jobs are automatically faster.

### Current CI graph also has fixed-job overhead

The normal CI workflow launches multiple independent hosted jobs, each with its own runner provisioning and checkout. Many deterministic jobs are very short, while the real Chrome/WebGL proof is materially longer. This parallelism is often useful, but it demonstrates why the final design must audit the **whole workflow DAG**, not optimize Playwright in isolation.

## Optimization objective function

Treat the following as joint objectives, in this order:

1. preserve correctness, exact-head identity, provenance, rights boundaries and zero hidden retries;
2. minimize median and p95 developer/agent wall-clock time to authoritative PR verdict;
3. minimize unnecessary repeated setup/build/image/artifact work;
4. minimize queue amplification and work spent on superseded heads;
5. keep nightly/full safety-net throughput high enough to detect selector escapes promptly;
6. keep the architecture simple enough to diagnose and maintain.

Do not optimize raw test-process count, raw CPU utilization, one synthetic benchmark, or one isolated test duration.

## Mandatory GitHub-hosted execution audit

Before making hosted E2E authoritative, produce a measured audit of the current GitHub Actions execution graph.

For each workflow/job that can run on an ordinary PR, capture at least:

- trigger/path filters;
- dependencies (`needs`) and critical-path position;
- runner class/image;
- queue/provisioning time where observable;
- checkout/fetch time;
- dependency restore/install time;
- Docker/image pull/build/extract time;
- candidate product/publication construction time;
- preview/service startup time;
- browser execution time;
- summary/report time;
- artifact upload/download time and bytes;
- total job wall time;
- whether the same command/test/build is repeated in another job;
- whether cancellation of a superseded head actually stops expensive work;
- whether the job produces unique evidence or only duplicates an existing oracle.

The audit must cover representative `none`, `focused`, `targeted`, `broad`, `full` and nightly/depth examples rather than one cherry-picked fast run.

## Critical-path design

### Plan before expensive work

The trusted change classifier and deterministic verification plan must run before expensive browser execution. The plan must decide which groups are required before GitHub allocates the browser matrix.

Do not start full Playwright speculatively for a PR that the trusted plan can prove requires no browser work.

### Do not serialize all cheap CI before E2E

Conversely, do not make browser E2E wait for every unrelated cheap/security job if that only increases end-to-end latency.

Audit the minimal preconditions that must succeed before expensive E2E can start, for example:

- exact checkout/plan identity;
- plan/schema validation;
- syntax/build prerequisite that would make browser execution meaningless if broken;
- exact candidate product/publication preparation when required.

Other independent checks may run in parallel and fan into `atlas-gate` later.

The chosen dependency DAG must be benchmarked against both:

- eager browser start, which reduces latency but can waste compute on obviously broken candidates;
- over-serialized browser start, which saves compute but adds avoidable wait time.

Select the smallest safe gating frontier from measurements and recent failure patterns.

## Build once versus build per shard

Any expensive immutable input consumed by multiple browser shards is a candidate for build-once fan-out, but build-once is not automatically better.

For each product/image/bundle, benchmark:

1. rebuild independently in every shard;
2. build once in a dedicated job, content-address it, upload once and download into shards;
3. restore from a trust-safe cache keyed by all correctness-relevant inputs;
4. use an immutable prebuilt base/runtime image plus a thin candidate-specific layer or bind-mounted candidate tests.

Choose by total wall-clock, bytes transferred, failure isolation and reproducibility.

A build artifact may be reused only when its digest and all producing inputs are bound into plan/evidence. Cache hits are performance optimizations, never correctness evidence.

Do not create an artifact fan-out step for tiny inputs when artifact upload/download costs more than recomputation.

## Playwright image strategy audit

The current cold Docker harness demonstrates that materializing the large pinned Playwright base image is a non-trivial fixed cost. Evaluate at least these strategies on the real GitHub-hosted runner image:

- current per-job custom image build;
- immutable rights-safe harness base built from protected-main `Dockerfile + lockfile` and referenced by digest, with candidate test/config code supplied separately;
- BuildKit/GitHub Actions cache for stable layers;
- official pinned Playwright base image used directly with candidate tests/dependencies mounted or installed as a thin step;
- native hosted Playwright/browser execution only if it can preserve the same pinned deterministic browser/runtime contract more efficiently.

Do not choose a strategy solely because its warm-cache run is fast. Measure cold and restored-cache paths and include cache miss behavior.

Do not publish restricted Game-derived product bytes inside a reusable public harness image.

## Adaptive execution packing

The scheduler must choose an execution shape based on the exact selected plan and measured duration history.

Supported shapes should include at least:

- no browser job;
- one hosted browser job with one or more in-job Playwright workers;
- two hosted shards;
- four hosted shards when the full/broad workload is large enough to benefit;
- specialist non-hosted group only when the catalog declares an exceptional capability requirement.

Do **not** hard-code one shard count for every plan.

The packing policy must consider:

- fixed runner/image/preview startup cost;
- predicted selected test duration;
- number of independent specs/groups;
- sequential/stateful affinity constraints;
- project/browser/viewport affinity;
- historical p50/p95 durations;
- artifact overhead;
- expected queue pressure;
- recent infrastructure variance;
- Actions compute/job amplification.

A small targeted plan should normally stay in one job if sharding would mostly duplicate setup. A long full plan may scale out when measured wall-clock savings clearly exceed setup and queue amplification.

Thresholds must be derived from benchmark data and versioned with the execution policy; do not guess static thresholds in advance.

## Workers versus shards

Treat Playwright workers and GitHub job shards as two different parallelism axes.

Benchmark them independently and together, but do not blindly maximize both.

For each representative plan compare at least:

- one shard / one worker;
- one shard / two workers;
- one shard / four workers where the runner supports it safely;
- two shards with the best measured per-shard worker count;
- four shards for sufficiently large broad/full work.

Record the total number of simultaneous browser processes implied by `shards × workers` and reject combinations that increase variance, OOM/crash rate, setup amplification or total job-minutes without a material wall-clock benefit.

A policy can legitimately choose, for example, more workers for one medium plan and more shards with fewer workers for another. There is no requirement for one universal worker count.

## Deterministic duration-aware balancing

Stable test IDs are required before duration-aware scheduling.

If static group splitting produces material imbalance, use historical rolling duration data only as scheduling metadata. Preserve correctness identity independently.

Prefer a deterministic, explainable packer such as longest-predicted-duration-first subject to affinity constraints. Preserve whole specs or declared sequential groups when splitting them would break state or duplicate expensive fixtures.

Every shard must emit the exact executed stable-ID set. The final fan-in must prove the union exactly equals the required stable-ID set and must reject missing IDs, unexpected IDs where policy forbids them, and duplicates that could hide omissions.

A stale or missing duration history must fall back deterministically; it must never fail closed by dropping required tests.

## Matrix explosion prevention

Never create a blind Cartesian product of:

`browser × viewport × DPR × feature group × shard × seed × visual mode`.

The catalog must define which dimensions are semantically required for each group.

For ordinary PRs:

- canonical Chromium/project coverage remains the main browser path unless the declared support contract requires another browser;
- responsive/mobile groups select only the required viewport/DPR profiles;
- seeded stress does not multiply ordinary targeted functional tests;
- visual scenarios are plan-scoped;
- cross-browser smoke is bounded to supported critical paths;
- full combinatorial depth belongs to nightly/manual only when it proves a real supported contract.

The execution plan must expose the final matrix cardinality so accidental multiplication is testable.

## Preview/service amortization

Within a hosted job, start the exact candidate preview/product service once and run all compatible selected groups against it rather than repeatedly rebuilding/restarting the same environment per test file.

Restart only where isolation is part of the oracle, a fault test intentionally mutates the service, or contamination measurements prove reuse unsafe.

Where multiple shards need identical immutable publication data, prefer content-addressed local inputs or a measured build-once fan-out rather than a live LAN/NAS origin.

## Cache architecture

Caches are acceleration only.

Every cache key must include all correctness-relevant immutable inputs. Examples include:

- Playwright base/browser image digest;
- `e2e/Dockerfile` digest;
- package lockfile digest;
- toolchain/runtime version;
- product-builder inputs/schema version where generated products are cacheable.

Do not use a broad mutable cache key that allows a candidate to silently consume incompatible output.

Do not treat a cache as provenance or evidence. Revalidate digests after restore where the cached object participates in qualified inputs.

Measure cache restore/save time and bytes. Disable caches whose transfer/serialization cost exceeds their saved work.

## Artifact policy

Passing jobs should emit the minimum evidence needed for exact plan verification and diagnosis:

- compact machine summary;
- stable-ID execution list;
- plan/shard/input digests;
- required small rights-safe reports.

Rich traces, screenshots, video, logs and diffs should be retained primarily for failures or explicitly required visual-review groups.

Do not upload large videos/screenshots from every passing functional test merely because storage is available.

Restricted visual evidence remains on its approved private path.

Fan-in should download only summaries needed for gate validation, not every large failure artifact from successful shards.

## Cancellation and stale-head efficiency

Use concurrency keys that scope expensive work to the exact PR/head purpose.

When a new commit supersedes an old PR head:

- queued obsolete browser jobs must be cancelled;
- running obsolete heavy work should stop promptly where safe;
- cancelled work cannot satisfy exact-head evidence;
- final fan-in must reject results from the old SHA even if artifact names collide.

Measure **superseded-work waste** as runner/job time spent after a head became obsolete.

The design should reduce this value materially without making cancellation cleanup unsafe.

## Failure propagation and sibling-shard policy

Do not assume either `fail-fast: true` or `false` is always optimal.

Classify failures:

- plan/input/build/preview/preflight failures mean all browser shards are invalid and siblings should stop;
- a deterministic product assertion failure already blocks the PR, but finishing other short shards may produce useful independent defects;
- very long depth siblings may be cancelled after a blocking failure if their additional information value is low.

Choose and document the sibling-cancellation policy from measured cost and diagnostic value. Never convert a cancelled shard into successful complete-suite evidence.

## Workflow deduplication and job granularity

Audit repeated setup and repeated tests across `ci.yml`, feature workflows and the future hosted E2E workflow.

Possible optimizations include:

- fan one common deterministic result into multiple gate consumers instead of rerunning identical Node tests;
- preserve separate feature workflow only when it adds unique real-source/build/environment proof;
- combine several tiny checks into one job when runner startup dominates and failure isolation remains acceptable;
- keep independent longer checks parallel when combining them would lengthen the critical path;
- avoid a dedicated job whose only work is a few milliseconds unless its security/trust boundary requires separate permissions.

Do not optimize for fewer YAML jobs as an aesthetic goal; optimize measured critical-path latency and useful work.

## Benchmark design

The hosted architecture decision must be based on reproducible benchmarks using exact SHAs and stable test sets.

Benchmark at least:

### Targeted plan

A realistic bounded feature plan with a few browser groups.

Compare one packed job versus any proposed sharding. Verify that additional shards actually reduce authoritative wall-clock after setup.

### Broad plan

A shared runtime/render/state change requiring multiple expensive groups.

Compare workers and two-shard execution, and four shards if warranted.

### Full plan

The complete current stable-ID functional suite.

Compare at least one-job, two-shard and four-shard shapes with the best safe worker counts. Include cold and restored-cache samples.

### Concurrent development

Simulate multiple independent PR plans plus a superseded head. Measure queue time, cancellation, artifact isolation and useful verified plans/hour.

### Nightly depth

Measure full functional + depth scheduling without allowing stress/soak/performance work to block normal PR verdicts or deployment.

Use at least three clean repetitions for material candidates and more when variance is high. Randomize/counterbalance order where cache/service drift could bias the result.

## Metrics and decision criteria

Record at least:

- PR verdict wall-clock p50/p95 by profile;
- queue/provisioning p50/p95;
- fixed setup seconds per hosted job;
- useful browser seconds per job;
- **setup amplification ratio** = summed repeated setup across shards / useful browser execution;
- build-once fan-out upload/download cost;
- cache hit/miss restore/save cost;
- shard duration spread and slowest/median ratio;
- total job-minutes per plan;
- Actions artifact bytes;
- first-run assertion failure rate;
- infrastructure failure rate;
- browser/container OOM/crash rate;
- superseded-work waste;
- duplicate command/test invocations per plan;
- final exact stable-ID coverage;
- useful verified plans/hour under realistic concurrent load.

The selected architecture must show a material wall-clock improvement for broad/full work **without making targeted work slower through setup amplification**.

If a complex sharder/cache/build-fanout architecture does not beat a simpler packed-job design by a material margin, choose the simpler design.

## Proposed target execution flow

The default target should conceptually be:

```text
PR head
  |
  v
trusted diff/classifier + plan  ----> none/focused: cheap checks only
  |
  +----> minimal required deterministic preflight
  |
  v
execution-shape selector
  |
  +----> small targeted plan: 1 packed GitHub-hosted browser job
  |
  +----> medium broad plan: measured 1-2 hosted shards
  |
  +----> long full plan: measured 2-4 hosted shards
  |
  +----> specialist capability explicitly required: Molehill specialist group only
  |
  v
stable-ID/evidence fan-in
  |
  v
atlas-gate + provenance-gate
```

Build/artifact preparation should be inserted once before shard fan-out only when measurement proves it saves total time or guarantees exact shared input identity more cleanly.

## Anti-patterns explicitly forbidden

The final implementation must reject these patterns unless a benchmark and correctness argument specifically proves an exception:

- one GitHub job per Playwright test;
- fixed four/eight-shard matrix for every PR;
- simultaneous high worker count inside every high shard count;
- full E2E before trusted plan classification;
- rebuilding the same expensive candidate publication in every shard when measured fan-out is cheaper;
- always introducing a build-artifact job when recomputation is cheaper;
- downloading/uploading all videos/traces/screenshots on green runs;
- using Synology as a cache/build server for hosted PR E2E;
- keeping Molehill in the ordinary PR critical path because it is faster per core;
- unbounded browser/viewport/DPR/seed Cartesian matrices;
- caching outputs without correctness-complete keys/digest validation;
- making E2E wait for unrelated long checks merely because they are in the same workflow;
- duplicating the same deterministic command in several workflows without a documented independent-environment reason;
- reporting speedup using only browser-test time while ignoring queue/setup/build/artifact time.

## Required architecture deliverable before cutover

Before hosted selective E2E becomes authoritative, #179 must contain or merge a current audit artifact that records:

1. current workflow DAG and duplicate-work inventory;
2. measured fixed hosted-job/setup costs;
3. image/cache strategy comparison;
4. build-once versus rebuild-per-shard comparison for shared candidate inputs;
5. workers-versus-shards benchmark for targeted/broad/full;
6. deterministic packing/sharding policy and version;
7. critical-path dependency decision;
8. cancellation/failure-propagation policy;
9. passing/failing artifact policy;
10. before/after latency, setup amplification and compute/job-minute measurements;
11. rejected alternatives and why they were rejected;
12. rollback plan to a simpler/full-safe execution shape.

No architecture is accepted because it looks scalable on paper. It must win on exact measured Atlas workloads.