# Atlas F01–F16 parallel Chat remediation

Lifecycle: `Oteryn/Oteryn-Atlas#315`  
Audit source: PR `#342`, `docs/evidence/repository-audit-2026-09-06/round-4/FINDINGS.md`.

This file is a task-specific delta over current Atlas `AGENTS.md` and the bound META policy. Refresh live GitHub state before mutation; do not copy global procedures into lane prompts.

## Owner direction for this programme

The temporary Atlas maintenance state was intended to suspend the old test/verification execution stack, not to prohibit corrective engineering work identified by F01–F16. Runtime, tooling, documentation and verification code may be repaired through the normal protected repository process. The old aggregate verification stack must not be restored as a prerequisite. Production deployment remains outside this programme.

Because current repository authority may still encode a broader freeze, the Authority lane reconciles that mismatch first. Other implementation lanes may inspect/prepare independently but must not integrate a change that conflicts with still-effective protected authority.

## Parallelization

Start `Atlas Remediation Coordinator` and `Atlas Authority Fix` first.

After current authority permits remediation, run in parallel:
- `Atlas Canonical Foundation`;
- `Atlas Geometry Fix`;
- `Atlas Verification Fix`;
- `Atlas Docs Dependencies Fix`.

After Canonical Foundation is integrated and dependent lanes refresh `main`, run in parallel:
- `Atlas Publication Safety Fix`;
- `Atlas Runtime Safety Fix`.

One writable owner per overlapping file/branch. The Coordinator resolves ownership conflicts from live PR state.

---

## Alias: Oteryn: Atlas Remediation Coordinator

Coordinate terminal closure of F01–F16. Do not implement product code.

Track fresh `main`, #315, #342, open remediation PRs, heads, checks, review state and file overlap. Keep the lane dependency graph current, prevent two writers from owning the same surface, and integrate completed work through the repository's normal protected PR/Merge Queue path.

Lanes:
- Authority Fix: F03, F16 and current authority reconciliation;
- Canonical Foundation: F01;
- Geometry Fix: F06;
- Verification Fix: F11, F12, F13;
- Docs Dependencies Fix: F09, F10, F14, F15;
- Publication Safety Fix: F02, after F01;
- Runtime Safety Fix: F04, F05, F07, F08, after F01.

Do not treat `AUDIT_COMPLETE` as product qualification. Do not restore the retired aggregate verification stack. Stop only when every F is integrated or has a concrete externally verified blocker recorded with its next safe action.

---

## Alias: Oteryn: Atlas Authority Fix

Close F03 and F16 and reconcile current Atlas maintenance authority with the owner direction above.

Primary surfaces:
- `AGENTS.md`;
- Issue #315 current-state authority;
- `docs/maintenance/**` only where necessary;
- `tools/maintenance/verify-maintenance-diff.mjs`;
- focused maintenance-gate tests.

Make the current state unambiguous: the old verification/test execution stack remains suspended, but F01–F16 corrective engineering is not categorically frozen. This does not authorize production deployment or resurrection of the old aggregate gate.

For F03, replace the broad deletion permission for `tests/verification/**/*.test.mjs` with an explicit or equivalently precise obsolete-contract authority so unrelated verification tests cannot be deleted merely by matching a path pattern. Add fail-closed regressions.

The current protected-base maintenance gate may itself prevent modification of its own authority. Treat that as a bootstrap/control-plane problem to resolve through an actually authorized repository path; do not fabricate statuses or bypass protection without explicit authority.

DONE: current lifecycle/instructions match the owner direction, F03 is regression-covered, historical #315 wording cannot masquerade as current state, and the final candidate has valid protected integration evidence.

---

## Alias: Oteryn: Atlas Canonical Foundation

Close F01: Python and JavaScript canonical serialization/root identity must agree byte-for-byte for all allowed Atlas publication structures, including integer-like object keys.

Primary surfaces:
- `src/browser/loader.mjs`;
- `tools/fullworld-publication/publication.py`;
- existing canonical/root helpers and focused tests.

Define one language-neutral canonical contract. Do not rely on ordinary JavaScript object enumeration to preserve lexicographic key order.

Cover at least integer-like keys (`"2"`, `"10"`), nested objects, arrays, Unicode and representative current manifests. Prove Python/JS byte equality and root equality. Preserve valid publication/runtime semantics or make any required migration explicit and coherent.

Do not implement F02/F05 in this lane.

DONE: F01 is no longer reproducible and deterministic cross-language vectors prove the contract.

---

## Alias: Oteryn: Atlas Geometry Fix

Close F06 in `src/browser/semantic.mjs` and its focused tests.

A coordinate must not pass bounds validation and then become invalid after quantization/rounding. Define and enforce the intended post-quantization boundary contract.

Cover minimum/maximum, just-inside/outside values, values whose legality changes after rounding, and normal valid values. Avoid unrelated renderer/geometry changes.

DONE: invalid rounded coordinates fail closed and valid coordinates preserve intended semantics.

---

## Alias: Oteryn: Atlas Verification Fix

Close F11, F12 and F13 without restoring or activating the old aggregate verification stack.

Primary surfaces:
- `tools/dyn-atlas-semantic/benchmark.py` and its filename/compiler contract;
- `tools/fullworld-runtime/qualify_browser.mjs`;
- `tools/verification/e2e-data-capability-inventory.json`;
- `tools/verification/verification-catalog.json`;
- the two creature-gameplay E2E specs currently marked split-required and only the support needed for that split.

F11: parse negative floors from an unambiguous grammar/metadata contract, not naive hyphen splitting.

F12: give each potentially blocking `cdp.send()` an effective per-RPC deadline/abort behavior compatible with the outer deadline.

F13: split mixed creature-gameplay tests so functional UI/state oracles use `qualification_fixture`, while only genuine real-source Game facts require the minimum `bounded_real_world` capability. Do not escalate to `real_fullworld` without a real oracle dependency.

DONE: focused regressions close F11/F12/F13, catalog/inventory match actual tests, and no workflow/blocking gate is reactivated by this lane.

---

## Alias: Oteryn: Atlas Docs Dependencies Fix

Close F09, F10, F14 and F15.

Primary surfaces:
- `e2e/README.md`;
- `.github/dependabot.yml`;
- `e2e/package.json` only if required by the dependency-update configuration;
- `docs/operations/ATLAS-LIVE-OPERATIONS.md`;
- `docs/recovery/ATLAS-LIVE-RECOVERY.md`;
- root `README.md`.

Remove stale claims that suspended/retired workflows are current authority. Describe the actual current topology while clearly marking suspended/history material. Add npm dependency-update coverage for the Playwright package surface without performing an unrelated dependency upgrade. Refresh the root README to the current Atlas scope and maintenance state instead of the original Semantic Thais Z7 proof.

Keep docs short and source-of-truth oriented; do not create new policy copies.

DONE: F09/F10/F14/F15 are no longer present in current documentation/configuration.

---

## Alias: Oteryn: Atlas Publication Safety Fix

Start from fresh `main` after Canonical Foundation is integrated. Close F02.

Primary surface: `tools/fullworld-publication/publication.py` plus any other current builder entry point only when the same destructive-output defect is directly verified.

Before destructive output handling, prove resolved-path disjointness between output/staging and all source/fabric/handoff/assets/previous-product inputs that must survive. Prefer safe staging followed by validated publish/replace.

Regression cases should include output=input, unsafe ancestor relationships, resolved/symlink aliases where supported, normal build, and failure-before-publish preserving the last good product.

Do not redefine the F01 canonical contract.

DONE: no destructive operation occurs before the safety proof and normal publication still succeeds.

---

## Alias: Oteryn: Atlas Runtime Safety Fix

Start from fresh `main` after Canonical Foundation is integrated. Close F04, F05, F07 and F08.

Primary surfaces:
- `src/browser/fullworld.mjs`;
- `src/browser/verified-content-cache.mjs`;
- bounded-response logic in `src/browser/loader.mjs`;
- `src/browser/creature-gameplay-profiles.mjs`;
- analogous relative-path consumers only where F08 is directly confirmed;
- focused runtime tests.

F04: persistent cache is an optimization; open/get/put failure must degrade to verified network retrieval without weakening digest checks.

F05: enforce actual body limits before unbounded full-response allocation; use bounded/streamed reading appropriate to the payload class.

F07: fix replacement byte accounting and share same-key concurrent in-flight loads deterministically.

F08: after URL resolution/normalization, enforce final trusted origin and expected path prefix. Reject encoded traversal, origin/scheme escape and equivalent normalization bypasses.

Do not redefine F01 canonical semantics or F06 geometry behavior.

DONE: focused failure/concurrency regressions close F04/F05/F07/F08 while integrity checks remain fail-closed.
