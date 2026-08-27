# Atlas E2E Issue #179 Final Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Issue #179 with protected GitHub-hosted ordinary E2E, measured Phase E policy, proven Phase F selective cutover and terminal governance/deployment closeout.

**Architecture:** One coordinator owns the protected sequential merge chain. Four isolated lane agents prepare independent control-plane, hosted-Q, benchmark and shadow/backtest deliverables; coordinator reviews and integrates them only when their prerequisites are protected on main.

**Tech Stack:** GitHub Actions, Node.js verification tools/tests, Playwright, Docker Compose, nginx, GitHub protected branches/checks.

**Spec:** `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md`

## Global Constraints

- `profile=full` does not imply `real_fullworld`.
- Ordinary browser E2E is GitHub-hosted and self-contained on `qualification_fixture`.
- Molehill is specialist/transition-only; Synology is deployment-only.
- Candidate policy/census may widen but never narrow protected authority.
- Retries remain zero; exact stable-ID set equality is required.
- Selective execution remains disabled until Phase F cutover proof.
- Every merge is exact-head fenced against freshly resolved protected main.

---

### Task 1: Close protected bootstrap #208

**Files:** no implementation change expected unless exact evidence exposes a defect.

- [ ] Re-resolve #208 head/main and reject stale local evidence if either changed materially.
- [ ] Inspect every required visual frame from exact 77/77 summary; run repository approval script with reviewer identity.
- [ ] Publish `atlas-local-e2e` bound to exact summary/plan/visual-contract SHA.
- [ ] Rerun failed GitHub jobs on the same SHA; require `atlas-gate` and `provenance-gate` success.
- [ ] Merge exact expected #208 head and verify protected merged-main SHA/checks.

### Task 2: Close protected policy v2 #209

**Files:** `tools/verification/*`, `AGENTS.md`, `docs/testing/*`, policy catalog/impact tests.

- [ ] Reconcile #209 onto merged #208/main without reverting capability-scoped stable census.
- [ ] Run deterministic policy/schema/plan tests; expected 0 fail/skip.
- [ ] Qualify any remaining transitional exact-head gate without changing target hosted-first architecture.
- [ ] Merge exact expected head with selective execution still disabled; verify merged main.

### Task 3: Integrate parallel Phase D lanes

**Consumes:** Lane A protected control-plane branch and Lane B hosted-Q branch.

- [ ] Review Lane A for protected lower-bound + safe candidate census union, plan identity, stale-head and exact fan-in.
- [ ] Review Lane B for immutable neutral Q data, no real-data leakage, Range/readiness and ordinary browser proof.
- [ ] Rebase/transplant approved deltas onto final Phase-D branch from current protected main.
- [ ] Run deterministic full verification contracts and `git diff --check`.
- [ ] Run exact zero-retry GitHub-hosted ordinary full-safety plan; prove no `real_fullworld` group unless explicitly required.
- [ ] Merge final Phase D exact head; verify main and protected checks.

### Task 4: Rebuild and measure Phase E

**Consumes:** final protected Phase D and Lane C measurement harness.

- [ ] Rebuild/rebase #195 from final Phase-D main; discard historical Molehill-default calibration authority.
- [ ] Run repeated real hosted whole-DAG packed baseline with workers=1, cold and restored-cache paths.
- [ ] Run workers=2/4 and shards=2/4 only where workload/resource evidence justifies; record queue/setup/job-minute amplification.
- [ ] Compare image/cache/build-once alternatives with exact shared-input identities.
- [ ] Select deterministic versioned adaptive policy from measured end-to-end verdict latency, not isolated browser runtime.
- [ ] Commit raw evidence + policy digest; merge exact Phase E and verify main.

### Task 5: Rebuild, shadow and cut over Phase F

**Consumes:** measured protected Phase E and Lane D corpus/evaluator.

- [ ] Rebuild/rebase #200 on Phase-E main with `enabled=false`.
- [ ] Backtest representative historical paths/renames/multi-domain/governance regressions against full-safe exact ID truth.
- [ ] Run live shadow comparisons and add permanent regression for every selector miss.
- [ ] Prove current-main full safety net, `force-full` widening and tested durable `SELECTOR_ESCAPE`.
- [ ] Require zero unexplained false negatives and bounded over-selection before enabling savings.
- [ ] Enable selective execution only in the final reviewed cutover commit; merge exact head and verify main.

### Task 6: Administrative and lifecycle closeout

- [ ] Re-resolve branch protection/rulesets/admin bypass/concurrency and required check identities.
- [ ] Prove normal PRs do not require Molehill/local status; specialist F routes only when protected plan requests it.
- [ ] Prove Synology is deployment-only and exact merged-main artifact promotion preserves digest/revision/rollback.
- [ ] Run realistic concurrent-PR/supersession safety proof and final current-main full safety net.
- [ ] Produce FACT / INFERENCE / UNKNOWN final report with SHAs, stable-ID census, benchmark metrics and selector proof.
- [ ] Close #179 only after all acceptance criteria are terminal on protected main.
