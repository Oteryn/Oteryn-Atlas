# R1–R3 correction ledger

Task: Oteryn/Oteryn-Atlas#315. Invocation: Atlas Restoration Lead,
PR #391 prompt at `59f40b0253fc11931f2baca460d281d06bf92ddf`.

## Authority and predecessor

- Fresh protected admission main: `6a4172d518dd85b6447d6a4785eb0f87fc6c8a46`.
- Previous implementation: #390 `46da2f861a770897eb516f88ab994d9bbb2a46d5`,
  tree `658ea7c43ba14acaa1d42ee7638bf1afb5018b36`.
- Previous admission: #389 `eb78d628c8e588bce46af1387e601f774fbd9bc8`.
- Predecessor checkpoint: #315 comment 5580153826, BLOCKED by immutable
  maintenance admission. The new prompt supplies a material correction finding:
  ordinary candidate test bytes must execute without protected hash repin.
  Actual filesystem regression reproduces that defect; correction work RUNNING.
- Bound META: `1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`, policy 3.0.0.
- Repository ruleset 22103758 remains active: strict protected-base audit and
  Merge Queue. No new bypass authorization; #387 exception consumed.
- #315 remains open, R1–R3 implementation authorized, R4/activation paused.
  Both existing PRs remain unmerged pending correction and independent review.

## Execution allocation

Isolated workspace, medium implementation effort. One writer on existing
`refs/heads/fix/issue-315-r123-completion`, workspace
`/workspace/scratch/c76a43147df2/atlas-restoration`. Previous published worker
released ownership at the BLOCKED predecessor; no newer claim in live #315
comments or overlapping restoration PR was present at preflight.
Sol High read-only design lanes: deterministic trust and inactive transport /
deployment scope. Separate Sol High final review follows implementation.
No product workflows are active; local focused deterministic checks are the
appropriate execution route. No host exception or Remote Desktop is used.
Shared central files belong to the single integrator; reviewers do not mutate.

## Read-once context and invalidation

| Input revision | Inspected invariants | Invalidation |
| --- | --- | --- |
| protected main above: AGENTS.md and META binding | Protected-base maintenance authority; exact-path admission; no activation | Reload only if authority changes |
| bound META above: organization, execution-access, bounded-autonomy and AI-review contracts | GitHub-first, one writer, candidate freeze, independent material review | Bound commit change |
| PR #390 tree above: deterministic-execution.mjs | Protected interpreter/argv; every source hash currently gates leaves and edge proofs | Resolver edit |
| PR #390 tree above: build-verification-plan.mjs, schema, impact manifest | Protected/candidate union, fallback, explicit uncertainty, exact ownership | Routing/schema edit |
| PR #390 tree above: verification-metadata.mjs and catalog | One execution catalog; derived ownership projections | Catalog/projector edit |
| PR #390 tree above: execution contract, producer, deployment contract | Inactive semantic and transport contracts | Scope corrections |

## Reproduction and routing correction

Actual changed-byte regression in verification-execution-contract.test.mjs:
protected fixture owns `tests/example.mjs` and its baseline source hash;
candidate filesystem replaces its bytes. Before fix: 1 test, 1 failure,
`source proof changed: tests/example.mjs`. Changing changedFiles alone is not
used as proof. The regression also requires a failing candidate test to remain
visible after successful command resolution.

Canonical routing now derives changed-test owners from each catalog independently.
The impact manifest retains product/source semantics and additive obligations.
Removed 90 duplicate test routing entries and 36 manually repeated browser test
exclusions. All 239 baseline per-test plans preserve selected groups, profiles
and execution blockers. Focused routing/readiness suite: 27/27, no skips/retries.

This ledger records local engineering evidence only, not protected integration,
real browser execution, visual approval, or complete-product qualification.

## Corrected qualification

- Changed leaf regression GREEN: real Node process observes candidate marker;
  intentionally throwing candidate bytes still fail. No fixture policy repin.
- Full verification/maintenance: 1065 PASS, zero fail/skip/retry/todo.
- Current declared graph: 202 entries, 183 roots, 202 unique coverage claims;
  53 product + 149 verification. Hidden new candidate edges get no coverage
  credit; exact physical runtime census remains a later R4 evidence obligation.
- Playwright actual listing: 79 cases, 36 specs. Canonical review frames: 30.
- Removed four files added only by the prior candidate (generic producer module,
  its test and two fixture helpers). No protected-main file deletion.
- Sol High architecture design: PASS for bounded correction. Final independent
  exact-head verdict and admission review remain required on the PRs.
- Required-now: protected planning/commands/candidate identity, visual obligations,
  publication/source authenticity, specialist fail-closed complete-product proof,
  inactive qualification/retention/rollback/isolation semantics.
- Defer-to-R4: GitHub run/job/ZIP transport, generic receipts/fan-in PASS, event
  dispatch, execution-window controller. No active consumer exists for them.
- Deployment keeps candidate product digest equality as qualification evidence;
  removes resource naming, cleanup/finalize orchestration and unrelated helpers.

## Admission composition correction

Independent Sol review rejected the previous corrected tree because admission
changes the maintenance regression bytes while the implementation catalog still
pinned the old source. Both candidates now use identical maintenance test bytes,
SHA-256 `936e96801dc94c2aae1ce331dcc9f37cf23971588533eaf7dea6679086181235`,
and the implementation catalog pins that exact baseline. After admission first,
this shared test has no implementation diff. No candidate self-admission is used.
The focused composition suite passes 58/58; full verification/maintenance passes
1065/1065 with zero skips/retries. The final admission must retain these exact test
bytes and the composed tree must be checked before requesting an owner decision.
