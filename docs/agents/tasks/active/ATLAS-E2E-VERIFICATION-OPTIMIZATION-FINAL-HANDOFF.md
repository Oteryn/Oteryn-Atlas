# ATLAS E2E Verification Optimization — Final Handoff

Checkpoint date: 2026-08-27
Lifecycle: `Oteryn/Oteryn-Atlas#179`
Primary authority: `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md` + P0 amendment + data-capability amendment.

## Fresh state at handoff creation

These SHAs are checkpoints, not permission to skip GitHub re-resolution.

- protected `main`: `b26f4fdf5a80581eaf699815023c7aaadc01d42f` (`#214` merged live-acceptance repair).
- PR #208 `feat/issue-179-protected-controller-bootstrap`: `9564aa6724da19ba32781c1a3ebefc53996bb851`, mergeable, non-draft.
- PR #209 `feat/issue-179-protected-policy-v2`: `a4e85d1d599be58f35e9b67e66c4011f08556e12` observed exact local/remote; includes hosted-first policy staging and capability-scoped full stable census.
- PR #213 `feat/issue-179-phase-d-final`: remote observed `f9cea6c0d9b87ec646682e10632c09ded2cdaaa9` after parallel hosted-full-safe resolver/fan-in work; resolve fresh.
- PR #195 remains historical Phase E draft and must be rebuilt only after final Phase D.
- PR #200 remains historical Phase F draft and selective rollout must remain disabled until Phase E + shadow/full-safety proof.

## #208 exact physical evidence already produced

A clean isolated checkout at exact `9564aa6724da19ba32781c1a3ebefc53996bb851` executed the transitional legacy plan with workers=1/retries=0.
Result: **77/77 scenarios PASS, 0 failure/skip**.
Summary path on Molehill at handoff time:
`C:\Temp\oteryn-atlas208-bootstrap-9564-r1\artifacts\e2e\atlas179-pr208-9564-r1\summary.json`

This is NOT yet a published passing status. Required next action: inspect every required visual frame under repository visual-acceptance contract, bind review to exact summary/plan/visual-contract digests, publish `atlas-local-e2e`, rerun failed GitHub jobs on the SAME SHA, require `atlas-gate` + `provenance-gate` green, then exact-head merge #208.

## Preserved ancillary hosted-Q work

No code remains only on the old local disk state. A dedicated handoff branch was created from then-current `#213@f9cea6c...`:

`handoff/issue-179-ancillary-hosted-q`

It contains:
- neutral qualification animation/creature/search ancillary product builder + mutation proof;
- read-only hosted mounts for fixture `/data/creatures/**` and `/web/semantic-search/**`;
- fixture-owned `/web/creature-gameplay/**` unavailable namespace to prevent leakage of real checkout gameplay bytes;
- Nginx static creature publication path and readiness check.

Targeted verification after transplant onto `f9cea6c...`: **16/16 PASS**, covering ancillary products, publication/readiness, HTTP Range positive/negative behavior, tamper-after-readiness rejection, hosted full-safe resolver and exact summary validation.

This branch is a review/cherry-pick source only. Lane B/coordinator must compare it against fresh #213 and take only still-missing deltas.

## Already-proven important contracts

- policy v2 separates verification profile from data capability;
- `profile=full` does not inherently request `real_fullworld`;
- ordinary `e2e.full` is qualification-fixture capable;
- `integration.creature-gameplay` is bounded real-world only;
- complete animation census is explicit `real_fullworld` specialist work;
- gameplay mixed specs were split: fixture UI/state desktop/mobile versus a real-data desktop compatibility spec;
- final data-split contract had zero `splitRequired` after the split;
- capability-scoped full stable census prevents specialist IDs from contaminating ordinary Q full plans;
- qualification trust/source validators keep production defaults fail closed and identify Q data as Atlas fixture-owned rather than Game authority;
- hosted publication uses immutable readiness/digest/Range seams and rejects mutation.

## Remaining critical work

### Sequential coordinator path
1. Finish #208 visual review/status/check rerun/merge.
2. Reconcile #209 on merged main, qualify exact head under protected authority, merge with selective disabled.
3. Integrate protected hosted control plane (Lane A) + hosted-Q browser work (Lane B) into final Phase D/#213.
4. Prove exact current-head zero-retry hosted ordinary full safety net with exact stable-ID fan-in and no real-FullWorld dependency.
5. Merge final Phase D and verify protected merged main.
6. Rebuild #195 on final Phase D; run repeated real GitHub-hosted whole-DAG Phase E measurements and merge measured adaptive policy.
7. Rebuild #200 on final Phase E; run historical/live shadow, full-safety and selector escape proof; cut over only at zero unexplained false negatives.
8. Final admin/concurrency/rights/provenance/Molehill/Synology audit; close #179.

### Parallel lanes allowed now
A. Protected hosted control-plane correctness — candidate census widening, protected v2 plan/executor/fan-in/stale-head.
B. Hosted qualification browser lane — fixture namespaces, ordinary browser execution and full-safety evidence.
C. Phase E benchmark harness preparation — measurement-only tooling, no final calibration before Phase D.
D. Phase F shadow/backtest preparation — corpus/evaluator/SELECTOR_ESCAPE tooling, selective execution remains disabled.

The lane prompts live in `docs/agents/prompts/` and are self-contained. One coordinator must review/integrate their outputs; do not let lane agents merge shared protected branches independently.

## Key unresolved design detail for Lane A

Protected-base Playwright census alone cannot discover a brand-new test introduced by the candidate (e.g. the new bounded-real gameplay spec). Candidate census alone cannot be trusted to delete protected tests. The intended invariant is:

`exact plan IDs = (protected-base census ∪ safely accepted candidate census) ∩ selected group specs/projects + explicit catalog IDs`

Candidate census must be produced in unprivileged/no-secrets/no-LAN isolation and parsed/validated with protected code. It can widen only; protected-base IDs remain non-removable. Fan-in still requires exact equality.
