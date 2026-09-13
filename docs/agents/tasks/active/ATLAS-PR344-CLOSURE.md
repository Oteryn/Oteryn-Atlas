# Atlas PR #344 closure project

Status: active closure task
Primary target: PR #344 / Issue #343
Supporting authority task: PR #483 when still applicable

This file is a task-specific delta over `AGENTS.md` and the bound Oteryn organization policy. Refresh live GitHub state before every material action; aliases below are discovery shortcuts, not authority or proof of current state.

## Objective

Close PR #344 without one long-lived agent accumulating stale context or widening scope. Use short sequential sessions: **one agent, one bounded responsibility, then stop**.

Do not restart a broad redesign/audit. Do not modify protected verification, browser oracles, baselines, thresholds, retries, routing, rulesets, Merge Queue behavior, or product code unless the active step explicitly establishes that layer as the responsible one.

## Sequence

### 1. `Oteryn: atlas344 fix-evidence`

**Outcome:** make failed protected visual evidence diagnosable.

- Refresh protected `main`, PR #344, PR #483, and the latest protected verification run.
- If #483 remains the applicable authority path, give it the smallest real implementation that retains failing Playwright `*-actual.png` / `*-diff.png` evidence without changing contract outcomes or exit status.
- Validate and integrate that evidence-retention change through the repository's protected path.
- Do not change #344 product/UI bytes or visual acceptance semantics.

**STOP:** protected `main` can retain the required failed visual evidence, or return one concrete blocker with evidence.

### 2. `Oteryn: atlas344 diagnose`

**Outcome:** identify the single responsible layer for the remaining #344 visual failure.

- Refresh protected `main` and exact #344 head; reconcile/merge-forward only as required by current authority.
- Run the required exact-head protected verification and inspect retained actual/diff evidence for the failing visual contract.
- Make no product or oracle changes.
- End with exactly one disposition:
  - `PRODUCT_BUG`
  - `BASELINE_ORACLE_BUG`
  - `UNKNOWN` with the exact missing evidence.

**STOP:** one evidence-backed disposition is recorded. Do not repair it in this session.

### 3. `Oteryn: atlas344 fix`

**Outcome:** repair only the cause established by the diagnosis.

- Read the latest evidence-backed disposition before changing anything.
- `PRODUCT_BUG`: make the minimum #344 product/CSS/behavior correction and focused regression evidence.
- `BASELINE_ORACLE_BUG`: keep the authority/oracle migration separate from #344 and use the protected-authority path.
- `UNKNOWN`: do not guess or widen scope; stop on the missing evidence.
- No broad re-audit, cosmetic follow-up, opportunistic refactor, or unrelated cleanup.

**STOP:** the diagnosed cause has one minimal validated repair, or one concrete blocker is recorded.

### 4. `Oteryn: atlas344 close`

**Outcome:** terminal verification and integration only.

- Refresh exact #344 head, protected `main`, review threads, required checks, and merge authority.
- Run/obtain the required exact-head protected plan, execute, review, and any applicable independent review.
- If all required gates are green, move through the normal Ready / protected Merge Queue path and perform protected-main readback.
- Do not add features or repair newly discovered failures in this same session.

**STOP:** return either `PR344_MERGED` with protected-main readback identity, or exactly one current evidence-backed blocker for a new bounded session.

## Anti-loop rules

1. A diagnostic agent does not implement the fix it discovers.
2. A fix agent does not reopen a full-PR audit.
3. A closure agent does not develop new fixes; a red gate becomes the next single bounded task.
4. Every session starts from fresh GitHub state, not from a previous agent's narrative or historical SHA.
5. No retry-until-green, no no-op/retrigger commits, no oracle chasing, and no bypass of protected verification or Merge Queue.
6. Keep #344 candidate changes separate from protected verification/oracle authority changes.

## Intended flow

`evidence retention -> diagnosis -> one repair -> terminal verification / Merge Queue`
