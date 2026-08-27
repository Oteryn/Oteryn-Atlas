# ATLAS-E2E-OPT-LANE-D-PHASE-F-SHADOW-BACKTEST

ALIAS:
`ATLAS-E2E-OPT-LANE-D-PHASE-F-SHADOW-BACKTEST`

EFFORT: High

SCOPE:
Prepare Phase F shadow/backtest/full-safety/selector-escape tooling while selective execution remains disabled. Work on an isolated branch. Do NOT set `enabled=true`, change protected required checks, merge #200, or choose final execution shape before Phase E evidence exists.

MANDATORY START:
Resolve protected main, #200 and current policy-v2/final-D branches fresh. Read the main prompt, P0 amendment, data-capability amendment and #200 body.

GOAL:
Create a deterministic evidence harness that can compare selective plans against full-safe truth across historical and live changes immediately after Phase E merges.

PREPARE:
- representative historical changed-file/rename/multi-domain corpus including known regressions and verification-governance changes;
- shadow planner output captured beside full-safe expected stable-ID set;
- exact false-negative/over-selection classification;
- permanent regression case format for every selector miss;
- full-safety current-main comparison tooling;
- `force-full` widening tests;
- `SELECTOR_ESCAPE` state/feedback mechanism that forces safe full behavior after a proven miss;
- matrix-cardinality guard tests;
- stale/cancelled evidence rejection inputs compatible with protected fan-in.

PROOF RULES:
- zero unexplained false-negative escapes is required before cutover;
- candidate policy may widen but never narrow protected lower bound;
- unknown/malformed/governance changes fail closed;
- under-selection is a correctness blocker; over-selection is optimization debt;
- scenario counts are telemetry only; compare exact stable-ID sets;
- selector escape must be durable/auditable and cannot narrow;
- a full current-main hosted safety net must exist before savings become authoritative.

CONFLICT AVOIDANCE:
Do not edit the production protected controller/planner files owned by Lane A unless unavoidable. Prefer standalone corpus/evaluator/feedback modules, tests and docs with a narrow interface. Do not edit Phase E worker-policy selection owned by the coordinator/Lane C.

DELIVERABLE:
Commit/push a dedicated draft branch/PR with deterministic unit/property tests and a documented corpus. Mark selective execution disabled in code/config. Record exact base/head and what must be rerun after Phase E. Coordinator alone decides cutover and merges rebuilt #200.
