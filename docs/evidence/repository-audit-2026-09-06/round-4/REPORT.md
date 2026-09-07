# Oteryn Atlas repository audit — final closure report

**Terminal state:** `AUDIT_COMPLETE`  
**Repository:** `Oteryn/Oteryn-Atlas`  
**Audited current main:** `5ea38a62fe1af8b8068adcb84350e9644905943c`  
**Current main tree:** `1024b0a7c32cab87e74655fba2a8cb7463cb3d44`  
**Lifecycle context:** Issue #315  
**Evidence PR:** #342

## 1. Executive conclusion

The repository audit is complete against the current tracked-file inventory. The denominator is 1140 current tracked leaf paths and every path has a closed coverage state: 131 `DIRECT`, 550 `GROUPED`, 459 `NOT_APPLICABLE`, 0 `PARTIAL`, 0 `UNVERIFIED`, 0 `INACCESSIBLE`.

This conclusion is intentionally narrower than product readiness. Atlas is still in maintenance mode: the active blocking path proves maintenance-diff admissibility, not the correctness of the suspended product verification stack or a current live deployment. No full current E2E, build, deployment, rollback, visual acceptance or vulnerability scan is claimed.

The audit found no verified P0. Current findings are P1 3, P2 11, P3 2. The highest-value fixes after the appropriate maintenance phase are path/output safety, maintenance deletion precision and cross-language canonical identity compatibility.

## 2. Current repository/control-plane snapshot

### GitHub

- `main`: `5ea38a62fe1af8b8068adcb84350e9644905943c`.
- PR #342 before this round persistence: open + draft, branch `docs/issue-315-audit-evidence-20260906`, head `d128a7da4f394a4b2fa2d56cc1728d25d36b87c2`.
- Issue #315 remains open and is the maintenance/verification programme context.
- Repository ruleset `22103758` is active and requires strict `Merge authority audit / protected-base validate` from GitHub Actions app 15368; Merge Queue is configured SQUASH/ALLGREEN.
- Organization ruleset `22352928` is active and binds the required merge-authority workflow from protected main.
- Current active workflow source is exactly:
  1. `.github/workflows/merge-authority-audit.yml`;
  2. `.github/workflows/merge-group-gate.yml`;
  3. `.github/workflows/terminal-branch-lifecycle.yml`.
- Latest inspected merge-group run on exact current main: `34139939000`, conclusion `success`; companion maintenance MQ gate run `34139938934`, conclusion `success`.
- Current open PR census returned 8. PR #344 is an in-flight UI/product draft and does not alter current main; it is treated as overlap evidence, not current authority.

The branch endpoint's legacy `protection.enabled` convenience field is not used as ruleset authority; effective rulesets above are the protection source used by this report.

## 3. Authority and instruction system

Current root `AGENTS.md` correctly records the maintenance freeze, the three-workflow inventory, current required status, verification capability route and merged-main-only deployment route.

`docs/agents/META_AGENT_POLICY_BINDING.json` binds Atlas to `Oteryn/Oteryn@1dedfc0f264fe0e23e5365dbe9280c2d96df50c5`, policy v3. The bound organization policy, prompting/evaluation standards and central validator family were inspected; the pin remains immutable provider authority rather than a moving-main reference.

`docs/agents/BRANCH_LIFECYCLE_POLICY.json` is executable control data, not merely prose: current `terminal-branch-lifecycle.yml` passes it to reusable Platform workflows pinned at `Oteryn/Oteryn-Platform@e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db`. The read reusable, write reusable and transitive `branch_lifecycle` / `terminal_branch_cleanup` / approval implementation were inspected at that exact Platform revision.

Two current active task packets were identified and inspected: FullWorld coordinator and Hunt Intelligence. Their task prompts are included in DIRECT instruction coverage. Other reusable prompts are task deltas/provenance until selected by live lifecycle authority and are classified NOT_APPLICABLE to this current audit execution rather than silently treated as active policy.

## 4. Current architecture

Observed product data path remains:

`Oteryn-Game authority / accepted immutable products -> Atlas offline generation/publication -> content-addressed semantic/pixel/index products -> HTTP/Nginx -> browser trust/loader/cache/runtime -> WebGL/Canvas and interaction/search/inspector/farm surfaces`.

Observed current integration path is intentionally smaller:

`protected main maintenance validator -> inert candidate diff -> required merge-authority check -> Merge Queue merge_group qualification`.

These are different proofs. A green maintenance integration path does not establish product runtime qualification.

The original audited main was `51623c7...`. Current main is five commits ahead. The 22 changed paths are all instruction/governance/maintenance-governance changes; runtime/product/E2E/build data-path source did not change. Changed authority surfaces were re-read before closure.

## 5. Coverage reconciliation

The complete denominator and deterministic classifier are in `COVERAGE.md` and `coverage-rules.json`.

The 550 GROUPED leaves are limited to four genuinely generated/repetitive families: creature-gameplay shards (508), bounded proof outputs (33), semantic-search generated JSON (2), and visual snapshot PNGs (7). Grouping is supported by inspected manifests/generators or producer contracts, integrity metadata, representative samples and relevant consumers.

NOT_APPLICABLE is used primarily for the currently suspended verification/test stack and clearly historical/provenance material. It never means PASS. All material current authored control/product surfaces needed for current-state conclusions are DIRECT; no material accessible current authored surface remains PARTIAL or UNVERIFIED.

## 6. Findings assessment

Current counts: **P0 0 / P1 3 / P2 11 / P3 2**. Full table and inherited-status reconciliation are in `FINDINGS.md`.

Three P1 findings:

1. cross-language canonical JSON incompatibility for integer-like keys;
2. unsafe output-root overlap/destructive builder pattern;
3. maintenance test-deletion allowance broader than the stated obsolete-governance purpose.

Important P2 findings include optional cache failure propagation, post-buffer response bounds, coordinate round/boundary drift, range-cache accounting/in-flight duplication, resolved-URL confinement failure, stale E2E/operations documentation, incomplete npm dependency update coverage, negative-floor benchmark parsing, missing per-CDP-RPC deadline and the remaining two split-required creature-gameplay E2E specs.

One prior finding is retired: current `tools/fullworld-generation/verify_handoff.py` does independently reconstruct the canonical verified descriptor-list root after shard digest checks before comparing the declared fabric root.

## 7. Security and trust boundaries

Strengths verified in current source include Game/Atlas authority separation, digest/root validation, bounded schemas, protected-base maintenance execution, candidate-inert validation, pinned transitive Platform workflow revision and rights attestations scoped to exact asset digests.

No complete current dependency vulnerability/SBOM/secret-history/SAST scan was executed. Therefore this report does not label dependencies vulnerable or declare the repository vulnerability-free. Dependabot currently covers GitHub Actions but not the npm Playwright surface in `e2e/package.json`.

The URL confinement finding is a trust-boundary correctness issue: textual path validation is not equivalent to validating the final resolved URL's origin and expected path prefix.

## 8. Verification and product qualification

Current execution performed by this closure is deliberately narrow and reproducible: canonicalization and URL-resolution probes plus live GitHub readback and static current-source inspection. Details are in `VERIFICATION.md`.

No suspended product test pipeline was restored or dispatched. No full current E2E, real-fullworld, browser visual approval, live deployment or rollback acceptance was performed. These are current qualification gaps by design under maintenance, not hidden audit gaps.

The current data-capability inventory is materially better than the earlier audit state: all E2E specs have explicit capability assignments. The remaining known split debt is explicitly recorded on two creature-gameplay specs that still combine bounded-real Game facts with functional UI/state behavior.

## 9. Documentation/governance debt

Current root maintenance/check terminology is coherent. The remaining stale surfaces are lower in the hierarchy:

- `e2e/README.md` still describes historical heavy required qualification/workflows;
- `docs/operations/ATLAS-LIVE-OPERATIONS.md` and `docs/recovery/ATLAS-LIVE-RECOVERY.md` are marked ACTIVE but refer to Synology workflow files that are currently suspended;
- root README still describes the initial Semantic Thais Z7 proof;
- Issue #315 opening decision text is historical and can be mistaken for current state without its later comments/current merged authority.

The v3 policy cleanup materially reduces duplicated always-loaded instructions, but task prompts can still carry historical procedural weight. The current information-architecture document correctly says reusable prompts are task-specific deltas and live GitHub Issues own mutable lifecycle.

## 10. Remediation roadmap

### Safety first

1. Add shared resolved-path disjointness/stage-then-publish guard before destructive output handling.
2. Narrow maintenance verification-test deletion to an explicit protected obsolete contract inventory or equivalent semantic authority.
3. Define one language-neutral canonical JSON/root encoding with shared cross-language vectors.
4. Enforce final URL origin + expected path-prefix confinement after resolution/normalization.

### Reliability

5. Make optional persistent cache truly degradable while preserving digest verification.
6. Enforce streaming/body limits before unbounded buffering where payload classes are large.
7. Fix coordinate quantization/bounds and range-cache replacement/in-flight behavior.
8. Add per-RPC CDP deadline/abort semantics.
9. Fix negative-floor filename parsing by documented grammar/metadata rather than naive splitting.

### Verification restoration

10. Split the two creature-gameplay mixed E2E specs; retain qualification_fixture for functional oracles and bounded_real_world only for real-source contract facts.
11. Restore verification in shadow, qualify real PR/MQ canaries, then make only impact-applicable groups blocking as #315 requires.

### Documentation/operations

12. Reconcile E2E and live operations/recovery docs with the actual maintenance/post-maintenance topology.
13. Add npm dependency-update coverage and run an authorized current dependency/security scan when that phase is restored.
14. Refresh root README and historical Issue-facing guidance without creating a second mutable lifecycle source.

## 11. Remaining limitations

These are explicit limitations, not unverified repository coverage:

- no current full product qualification;
- no current production/live acceptance;
- no current rollback exercise;
- no current full vulnerability/SBOM/secret-history scan;
- no new visual approval;
- findings are not remediated by this task.

They affect readiness claims, not the terminal audit-state conclusion.

## 12. DONE-WHEN reconciliation

1. Live GitHub authority refreshed — **YES**.
2. Current tracked inventory reconciled — **YES, 1140**.
3. Every tracked area has an explicit state — **YES**.
4. No material accessible authored current area remains UNVERIFIED/PARTIAL — **YES**.
5. Active/transitive control plane inspected where accessible — **YES**, including pinned Platform implementation.
6. Inherited material findings revalidated/retired — **YES**.
7. Significant new findings investigated — **YES**, including resolved-URL confinement and active runbook drift.
8. Runtime/build/deployment claims limited to obtained evidence — **YES**.
9. Historical results separated from current execution — **YES**.
10. Inaccessible areas listed/materiality assessed — **YES; none in tracked repository coverage**.
11. Final evidence internally reconciled — **YES**.
12. Evidence diff restricted to authorized audit evidence — **to be verified by post-write readback**.
13. Persisted commit/head read back — **to be verified by post-write readback**.
14. No product/runtime/control-plane state changed — **to be verified by diff/readback**.
15. Conclusion evidence-based — **YES**.

The terminal status becomes durable only after the post-write checks in items 12–14 succeed. The final user-facing completion report must use that remote readback, not this pre-commit text alone.
