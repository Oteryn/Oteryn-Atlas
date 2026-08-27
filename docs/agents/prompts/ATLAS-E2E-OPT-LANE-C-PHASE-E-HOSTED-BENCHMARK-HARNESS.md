# ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS

ALIAS:
`ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS`

EFFORT: High

SCOPE:
Prepare the Phase E GitHub-hosted whole-DAG benchmark harness and evidence schema in parallel with final Phase D. Do NOT publish final calibration, change authoritative worker/shard policy, merge #195, or benchmark around an unsafe/non-final controller. Final measurements are valid only after final Phase D merges.

MANDATORY START:
Resolve protected main, #195 and final Phase-D work fresh. Read #195 body plus the implementation/P0/data-capability prompts and current hosted execution audit.

GOAL:
Make Phase E ready to run immediately after final Phase D by implementing measurement-only tooling/workflows that capture the actual GitHub Actions critical path without predetermining the answer.

MEASURE AT MINIMUM:
- queue/provisioning;
- checkout/fetch;
- dependency restore/install;
- qualification product build + verification + readiness;
- browser image pull/build/extract;
- preview startup;
- Playwright execution;
- shard fan-out/fan-in;
- cache restore/save;
- artifact upload/download;
- cancellation/superseded waste;
- duplicate setup/work;
- total verdict wall-clock, job-minutes, variance, OOM/crash and useful plans/hour.

EXPERIMENT MATRIX TO PREPARE, NOT YET CONCLUDE:
- packed single hosted job baseline;
- workers=1 baseline, then 2/4 only if actual runner resources justify;
- 2/4 GitHub shards only for broad/full workloads where duplicated setup may pay back;
- cold versus restored-cache;
- current versus thinner immutable browser/harness image strategy where practical;
- build-once/content-addressed fan-out versus per-shard recomputation;
- eager versus gated DAG start where trust boundaries permit.

GUARDRAILS:
- no universal 1/2/4/6/8 ladder;
- do not maximize workers and shards simultaneously by default;
- exact head/plan/product/stable-ID identities must accompany every measurement;
- retries remain zero;
- measurement failures/infra failures are recorded, never hidden;
- Molehill measurements are specialist-only and cannot define ordinary defaults.

DELIVERABLE:
Commit/push a dedicated Phase-E-prep branch containing measurement schema, collection scripts/workflow contracts and docs. Tests must prove metrics cannot silently become zero/missing, timing identity is exact and benchmark tooling is measurement-only. Clearly mark all pre-Phase-D numbers as NON-AUTHORITATIVE. Coordinator will rebase/rebuild #195 on final Phase D and run the real repeated hosted measurements.
