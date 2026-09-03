# Atlas Verification Simplification Design

**Issue:** #315

## Goal

Replace the retired qualification bootstrap/repin chain with one ordinary verification architecture that is understandable from current `main` and does not require PR-number or branch-name recovery choreography.

## Invariants

- Verification profile and data capability are independent axes.
- Ordinary functional browser E2E uses `qualification_fixture` unless the oracle explicitly requires `bounded_real_world` or `real_fullworld`.
- Pure `tests/verification/**` changes are deterministic-only by default.
- Executable verification authority (`tools/verification/**`, protected workflows) remains fail-closed and may require full browser qualification.
- `workers=1`, `retries=0` remain unchanged for protected qualification.
- Production source authority remains fail-closed. Qualification data never impersonates production source identity.
- `atlas-gate`, exact-head fencing, Merge Queue and protected-base planning remain authoritative after the maintenance merge.

## Architecture

### 1. Functional qualification fixture on protected main

Adopt the already measured functional qualification-world bytes from the retired #268 work as a clean current-main change, without importing its branch history. The fixture remains small and immutable but traverses the same manifest/floor/chunk/range/loader/runtime seams used by production.

The protected main qualification product becomes the ordinary baseline for functional browser verification. This removes the need for a separate digest-repin PR before ordinary E2E can run.

### 2. Trust-aware runtime consumers

Runtime consumers derive ancillary source expectations from `FULLWORLD_TRUST`. `web/fullworld-creatures.mjs` must use `ancillarySourceExpectations(FULLWORLD_TRUST).creatures` rather than hard-coded production contract/capability/digest values.

With production trust, the resolved values are byte-for-byte equivalent to today's production constants. With qualification trust, only the exact fixture-owned contract/capability/digest/fixture identity is accepted.

### 3. Deterministic verification-test policy

`tests/verification/**` maps to `focused + deterministic.core`. This prevents a test-only regression repair from recursively requiring the unrelated full browser matrix.

`tools/verification/**`, workflow authority and ordinary runtime/UI changes keep their existing broader lower bounds.

### 4. Qualification authority changes after this repair

The active architecture must no longer depend on the historical #268/#300/#303 branch topology. A future qualification product change is proved by protected-base code against the exact candidate in a networkless/read-only sandbox and complete GitHub-hosted browser safety net. The proof is tied to current PR/head/base and published only by protected workflow authority.

Historical one-shot recovery code may remain temporarily unreachable during this maintenance merge, but no active workflow or lifecycle may require reopening or stacking on those retired branches. Follow-up deletion of unreachable tombstones is cleanup, not an admission dependency.

## Maintenance transition

Current `main@2963a11ea85dd97a2719577f1a2ca4b8e5791b8e` cannot admit this authority repair through its own broken lower-bound path. Repository owner temporarily enabled `pull_requests_only` bypass for exactly this maintenance transition. The implementation PR still requires deterministic/CodeQL/review evidence; only the old self-blocking `atlas-gate` is bypassed for the squash merge.

Immediately after merge:

1. verify the new protected-main deterministic suite;
2. run the protected full qualification baseline on the merged SHA;
3. verify ordinary PR planning uses the functional qualification fixture;
4. remove the temporary ruleset bypass actor.

## Non-goals

- No force push or direct write to `main`.
- No reduction of browser assertions or retries.
- No routine Molehill requirement for qualification E2E.
- No fake success status.
- No resurrection of retired PRs/issues.
