# Atlas CI / test / build audit and restoration design — 2026-09-07

Status: **AUDIT / DESIGN ONLY — verification restoration remains paused**

Audited repository: `Oteryn/Oteryn-Atlas`

Audited protected baseline: `main@f00815858bb5b031c502ad19fb96a05ff66b4d84`

Controlling maintenance authority: Issue #315 (`PAUSED_BEFORE_VERIFICATION_RESTORATION` at the audited baseline)

Related routing debt: Issue #376

This document records the second-pass audit of Atlas CI, tests, builds, verification routing, data-capability placement and execution topology. It is deliberately broader than the first pass: it includes active workflows, the complete suspended workflow inventory, reusable workflows in `Oteryn/Oteryn-Platform`, verification control-plane code, deterministic tests, Playwright inventory, scheduled/manual lanes, security scanning, Merge Queue behavior, data capabilities and observed Actions history.

This document **does not authorize** restoring suspended workflows, starting shadow restoration, adding blocking product groups, changing production publication/deployment, or moving ordinary E2E to FullWorld/Molehill. Those transitions remain controlled by #315 and the protected repository authority.

## 1. Executive verdict

The repository already contains the right core architectural idea — verification profile is independent from data capability, ordinary E2E uses `qualification_fixture`, bounded compatibility uses `bounded_real_world`, and complete-product proofs use `real_fullworld`. The problem is no longer the absence of that model. The current restoration blocker is that the model and the dormant execution topology are not yet semantically complete or internally consistent.

The old CI stack must **not** be restored 1:1. It contains broad event-driven reruns, duplicated responsibilities, no-op allocation, historical workflow contracts and a large protected execution control plane. The future system should be rebuilt around one protected impact plan and a much smaller set of execution lanes.

The second pass found additional restoration-critical defects beyond the previously recorded #376 routing debt:

1. `deterministic.core` is not currently a safe restoration target: it includes `tests/verification/*.test.mjs`, while multiple tests in that directory still open workflow paths such as `.github/workflows/ci.yml`, `.github/workflows/verification-depth.yml`, `.github/workflows/protected-hosted-executor.yml`, `.github/workflows/protected-verification-controller.yml`, `.github/workflows/protected-admission.yml` and `.github/workflows/synology-live-acceptance.yml`. Those historical workflows now live under `docs/maintenance/suspended-workflows/`; the old active paths no longer exist.
2. `tests/**` impact is routed to `deterministic.core`, but `deterministic.core` only declares `tests/verification/*.test.mjs`. A change to an ordinary product test can therefore select a group that does not execute the changed test.
3. `tools/fullworld-generation/**`, `tools/fullworld-publication/**`, `tools/fullworld-runtime/**`, `tools/fullworld-layers/**` and `tools/fullworld-minimap/**` are explicitly classified as `fullworld-complete-product`, yet the impact manifest currently selects only `deterministic.core + e2e.full`, with no `real_fullworld` group. This conflicts with the repository capability policy for complete publication/root linkage, generator/compiler determinism and overview/minimap consistency.
4. The planner supports dedicated `performance` and `soak` resource classes and uses them to make execution exclusive, but the current catalog places `performance-desktop.spec.mjs` and `soak-desktop.spec.mjs` inside `e2e.full` with resource class `browser-full`. That specialist scheduling capability is therefore dormant.
5. `profile=full` is intentionally **not** equivalent to “run every verification capability”. Unknown paths fall back to `deterministic.core + e2e.full`; they do not automatically select `bounded_real_world`, `real_fullworld` or restricted visual review. This makes impact-manifest completeness a safety-critical property, not an optimization detail.
6. The current `visual.creatures` group selects the complete desktop/mobile visual specs. Those specs contain broad Atlas chrome/search/inspector/layer/animation journeys in addition to creature-specific assertions. Therefore every `src/browser/creature-*` change can select a larger visual/review workload than its name implies.
7. The active terminal branch lifecycle starts its reusable `close` workflow for every `pull_request_target: closed`; at least one observed merged/irrelevant closure executed `close / validate-operation` while the actual cleanup jobs were skipped. This is small but real control-plane runner waste.
8. Workflow-based CodeQL is suspended with the rest of the old stack. Whether organization/default CodeQL setup supplies equivalent coverage is not proven by repository evidence and must be checked separately before security coverage is declared complete.

## 2. Authority and evidence inspected

The audit used the protected baseline and live GitHub configuration, including:

- `AGENTS.md`
- `docs/agents/META_AGENT_POLICY_BINDING.json`
- organization policy pinned by that binding
- Issue #315
- Issue #376
- `docs/maintenance/ATLAS-MAINTENANCE-MODE.md`
- `docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json`
- `tools/maintenance/verify-maintenance-diff.mjs`
- all active `.github/workflows/**`
- all files under `docs/maintenance/suspended-workflows/**`
- `.github/dependabot.yml`
- repository rulesets `22103758` and `22352928`
- current and recent GitHub Actions runs/jobs
- the two pinned terminal-lifecycle reusable workflows in `Oteryn/Oteryn-Platform@e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db`
- `docs/agents/operations/VERIFICATION_CAPABILITY.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`
- `tools/verification/impact-manifest.json`
- `tools/verification/verification-catalog.json`
- `tools/verification/e2e-data-capability-inventory.json`
- `tools/verification/build-verification-plan.mjs`
- verification contract tests under `tests/verification/**`
- deterministic/product tests under `tests/**`
- Playwright configuration, support code and all current E2E specs under `e2e/**`.

## 3. Current active GitHub Actions topology

Exactly three repository workflows are active under `.github/workflows/` on the audited baseline:

| Workflow | Purpose | Main triggers | Audit assessment |
| --- | --- | --- | --- |
| `merge-authority-audit.yml` | required protected-base maintenance admission | `pull_request_target` opened/reopened/synchronize/edited; `merge_group` | trust boundary is correct; trigger/cancellation can be tightened |
| `merge-group-gate.yml` | maintenance Merge Queue gate | `merge_group` | currently duplicates the same maintenance diff validation |
| `terminal-branch-lifecycle.yml` | organization branch lifecycle | selected PR/push paths, all PR closures, daily schedule, manual | valid governance lane; close trigger is broader than necessary |

No normal product test/build/depth/publication/deployment workflow is active. That is intentional under #315.

### 3.1 Required branch/ruleset behavior

Repository ruleset `22103758` protects the default branch, requires pull requests and linear history, allows squash merge, enables Merge Queue and explicitly requires only:

`Merge authority audit / protected-base validate`

Organization ruleset `22352928` additionally requires `.github/workflows/merge-authority-audit.yml@main` as the protected workflow authority.

**FACT:** `merge-group-gate.yml` is not the explicitly named required-status context in ruleset `22103758`. It still executes on each Merge Queue checks request, but its separate necessity should be re-proven before it is retained in the final architecture.

### 3.2 Duplicate Merge Queue work

Both active maintenance workflows perform the same essential sequence for `merge_group`:

1. checkout exact protected base with full history;
2. checkout exact merge-group candidate with full history;
3. execute `trusted-base/tools/maintenance/verify-maintenance-diff.mjs trusted-base candidate`.

Recent Actions history confirms both workflows ran against the same Merge Queue candidate. For example the candidate that produced `main@f00815858...` generated a `Merge authority audit` merge-group run (`34159140292`) and the maintenance Merge Queue gate run (`34159140161`) at the same queue transition.

**Finding A-MQ-01 — P1 / over-execution:** the current maintenance Merge Queue performs duplicate checkouts and duplicate diff-policy validation.

**Recommendation:** while maintenance authority remains unchanged, preserve required-check identity. At restoration design time, prove whether the second `atlas-gate` contributes an independent invariant. If it does not, consolidate the duplicate work rather than preserving two validators.

### 3.3 PR metadata retrigger

`merge-authority-audit.yml` subscribes to `pull_request_target: edited` and has `cancel-in-progress: false`.

**Finding A-TRIGGER-01 — P1 / over-execution:** title/body metadata edits can start a new protected-base validation without a candidate-code change, and older runs are intentionally not cancelled.

This is a small cost while the job is only maintenance admission, but the pattern must not be copied into future product verification.

### 3.4 Terminal lifecycle close overhead

The parent lifecycle workflow invokes the pinned `close` reusable on every `pull_request_target: closed`. Inside the platform reusable, cleanup is further conditioned on an unmerged same-repository PR.

Observed run `34158364240` executed `close / validate-operation` successfully while `close / close-event-cleanup` and `close / apply-reviewed-manifest` were skipped.

**Finding A-LIFECYCLE-01 — P2 / over-execution:** the parent workflow allocates a reusable validation runner for closure events that the reusable later proves do not need cleanup.

**Recommendation:** eventually move the merged/same-repository eligibility condition to the parent call so obviously irrelevant close events never allocate the reusable job. Preserve the read-only daily lifecycle inventory; it is a separate governance control, not product CI.

## 4. Complete suspended workflow inventory

The historical stack contains **25 suspended workflow files** under `docs/maintenance/suspended-workflows/`:

1. `codeql.yml`
2. `mobile-layout.yml`
3. `ci.yml`
4. `protected-main-depth.yml`
5. `synology-runner-health.yml`
6. `docker-e2e.yml`
7. `protected-base-advance-dispatcher.yml`
8. `protected-admission.yml`
9. `verification-depth.yml`
10. `semantic-search.yml`
11. `creature-overlays.yml`
12. `creature-gameplay-profiles.yml`
13. `protected-hosted-fan-in-promotion.yml`
14. `protected-hosted-executor.yml`
15. `protected-bounded-real-identity-repin.yml`
16. `protected-publication-readiness-promotion.yml`
17. `protected-qualification-product-promotion.yml`
18. `synology-live-acceptance.yml`
19. `protected-hosted-compose-promotion.yml`
20. `protected-verification-controller.yml`
21. `protected-qualification-repair.yml`
22. `protected-hosted-readiness-wiring-promotion.yml`
23. `protected-hosted-readiness-reentry-promotion.yml`
24. `legacy-molehill-transition-qualification.yml`
25. `protected-execution-promotion-qualification.yml`

There is also `tools/maintenance/minimal-merge-group-gate.yml`, which is a maintenance template/reference rather than an active Actions workflow.

**Finding A-TOPOLOGY-01 — P1 / complexity:** restoring the previous stack would reintroduce a large number of overlapping controllers, promotion/re-entry workflows and specialist transition mechanisms. The archive is evidence and migration history, not a target topology.

## 5. Historical trigger and build problems

### 5.1 Review events caused broad product reruns

The old suspended `ci.yml` subscribed to `pull_request_review` events (`submitted`, `edited`, `dismissed`). Most lightweight/medium jobs were not independently impact-filtered.

**Finding A-TRIGGER-02 — P1 / over-execution:** a review-state change could rerun repository contracts, semantic/browser proofs and deterministic tests with no candidate-code change.

Future product verification must be SHA/diff driven. Review events may affect review/fan-in state, but must not reconstruct unchanged test evidence unless review semantics genuinely require it.

### 5.2 Old classifier was too coarse

The legacy classifier effectively distinguished documentation-only work from most other changes. Heavy browser qualification was therefore selected for a very broad class of unrelated edits.

**Finding A-ROUTING-01 — P0/P1 / over-execution:** event/path routing was insufficiently semantic.

The current `impact-manifest.json` is the correct replacement direction, but its semantic completeness must be fixed before it can become authoritative.

### 5.3 No-op root build allocation

The old `project` job allocated Ubuntu, checked out the repository, then conditionally performed npm work only if root `package.json` existed. The audited root has no `package.json`; the Node package is `e2e/package.json`.

**Finding A-BUILD-01 — P1 / waste:** the old job could consume a runner for an empty build decision.

**Rule for the replacement:** existence/necessity decisions belong in the protected planner before runner allocation.

### 5.4 Standalone workflow overlap

Historical workflows such as `semantic-search.yml`, `mobile-layout.yml`, `docker-e2e.yml`, `creature-overlays.yml` and `creature-gameplay-profiles.yml` contained useful proofs but also formed independent trigger/path topologies alongside the aggregate CI.

The examples illustrate both sides:

- `mobile-layout.yml` had relatively narrow path filters and a real Chrome proof — useful verification, but better represented as a semantic group.
- `docker-e2e.yml` included `AGENTS.md` in its trigger paths — too broad for browser E2E.
- `semantic-search.yml` rebuilt pinned real sources and validated complete catalog properties — valid integration proof, but it should be selected by source-contract impact rather than exist as an independent overlapping trigger system.
- `creature-gameplay-profiles.yml` correctly exercised exact source publication and deterministic consumer contracts, but current #376 shows its semantics were not fully transferred into the new impact model.

## 6. Scheduled/manual lanes

Historical scheduled workflows include:

- `codeql.yml`: weekly Monday 03:41 plus push/PR/manual;
- `protected-main-depth.yml`: daily 03:17 plus manual;
- `verification-depth.yml`: daily 01:17 plus manual.

The active terminal lifecycle has a daily 03:39 governance inventory schedule. Dependabot remains active weekly for GitHub Actions (`/`) and npm (`/e2e`).

**Finding A-SECURITY-01 — P1 / UNKNOWN coverage:** repository workflow-based CodeQL is suspended. The audit did not prove an equivalent organization/default CodeQL setup outside this repository workflow. Do not state that code-scanning coverage is absent or present until that external/default setup is verified.

**Recommendation:** when #315 allows restoration, security scanning should be restored/evaluated as an independent security lane. It should not depend on product impact routing and should not force ordinary browser/FullWorld verification.

## 7. Verification profile and data-capability architecture

The current repository policy correctly separates:

Verification profile:

- `none`
- `focused`
- `targeted`
- `broad`
- `full`

Data capability:

- `qualification_fixture`
- `bounded_real_world`
- `real_fullworld`

Repository policy explicitly states that `profile=full` does **not** imply `real_fullworld`.

Runner placement is also correct in principle:

- GitHub-hosted: ordinary functional E2E using the smallest immutable source that proves the oracle;
- `bounded_real_world`: bounded compatibility checks requiring selected real bytes;
- Molehill: specialist-only for complete-product bytes/native Windows/GPU/restricted specialist proof;
- Synology: trusted merged-main deployment/live acceptance only, not an ordinary E2E farm.

This separation must be preserved.

## 8. Playwright/data-capability inventory

`tools/verification/e2e-data-capability-inventory.json` currently inventories **36 Playwright specs**. The capability split is materially correct:

### `qualification_fixture`

- `accessibility-desktop.spec.mjs`
- `accessibility-mobile.spec.mjs`
- `audit-desktop.spec.mjs`
- `audit-mobile.spec.mjs`
- `creature-gameplay-desktop.spec.mjs`
- `creature-gameplay-mobile.spec.mjs`
- `creature-interaction-desktop.spec.mjs`
- `creature-interaction-mobile.spec.mjs`
- `creature-presentation-desktop.spec.mjs`
- `creature-presentation-mobile.spec.mjs`
- `creatures-desktop.spec.mjs`
- `degraded-search-desktop.spec.mjs`
- `desktop.spec.mjs`
- `farm-explorer-desktop.spec.mjs`
- `farm-explorer-mobile.spec.mjs`
- `geometry-desktop.spec.mjs`
- `geometry-mobile.spec.mjs`
- `layer-audit-desktop.spec.mjs`
- `mobile.spec.mjs`
- `performance-desktop.spec.mjs`
- `race-desktop.spec.mjs`
- `render-probes-desktop.spec.mjs`
- `resilience-desktop.spec.mjs`
- `responsive-mobile.spec.mjs`
- `scale-desktop.spec.mjs`
- `soak-desktop.spec.mjs`
- `state-desktop.spec.mjs`
- `stress-desktop.spec.mjs`
- `user-journey-desktop.spec.mjs`
- `user-journey-mobile.spec.mjs`
- `visual-desktop.spec.mjs`
- `visual-mobile.spec.mjs`
- `workflows-desktop.spec.mjs`

### `bounded_real_world`

- `api-contract-desktop.spec.mjs`
- `creature-gameplay-source-contract-desktop.spec.mjs`

### `real_fullworld`

- `fullworld-animation-census-desktop.spec.mjs`

This confirms the architecture correction: interaction/cards/inspector/search/state/history/geometry/pan/zoom/LOD/accessibility/responsive/race/fault/stress-type functional oracles do not intrinsically require the complete FullWorld product.

## 9. Verification catalog audit

Current catalog groups:

- `deterministic.core`
- `e2e.common-smoke`
- `e2e.creatures`
- `e2e.full`
- `fullworld.animation-census`
- `integration.source-contract`
- `visual.creatures`

### 9.1 `e2e.full` is too coarse

`e2e.full` mixes accessibility, audit, gameplay, creature interaction/presentation, search degradation, farm, geometry, layer audit, performance, race, render probes, resilience, responsive behavior, scale, soak, state, stress, user journeys, visual and workflow scenarios in one `browser-full` class.

**Finding A-CATALOG-01 — P0/P1 / over-execution and scheduling loss:** semantic domains that have materially different cost/oracles/resource needs are collapsed into one group.

The planner already understands `performance` and `soak` resource classes and treats those classes as exclusive. The current catalog does not use those classes. Therefore the planner cannot apply its intended specialist/exclusive scheduling semantics to the performance/soak specs.

Recommended target groups include at least:

- `e2e.smoke`
- `e2e.creatures.functional`
- `e2e.search`
- `e2e.geometry-render`
- `e2e.state-history`
- `e2e.responsive-accessibility`
- `e2e.race-fault-resilience`
- `e2e.farm`
- `e2e.user-journeys`
- `visual.user-facing`
- `performance.bounded`
- `stress.seeded`
- `soak.bounded`
- `integration.source-contract`
- one or more explicit `real_fullworld.*` specialist groups.

### 9.2 `visual.creatures` name/scope mismatch

The group contains the complete `visual-desktop.spec.mjs` and `visual-mobile.spec.mjs`. The desktop spec includes general Atlas-owned chrome, search/inspector, overview/layers and animation/creature scenarios.

**Finding A-CATALOG-02 — P1 / over-execution:** `src/browser/creature-*` currently selects the whole restricted visual specs, not only creature-relevant visual stable IDs.

**Recommendation:** route reviewed visual acceptance at stable-test/scenario granularity, or split the visual specs into semantically owned files/groups. Preserve restricted visual-review evidence where it is genuinely required.

### 9.3 Overlapping visual specs need one evidence contract

`visual-desktop.spec.mjs` and `visual-mobile.spec.mjs` are present both inside `e2e.full` and `visual.creatures`. The planner deduplicates stable Playwright IDs, so this does not automatically imply duplicate test execution in every executor. However group evidence semantics differ: `e2e.full` is `machine-summary`, while `visual.creatures` is `restricted-visual-review`.

**Finding A-CATALOG-03 — P1 / semantic ambiguity:** the same scenarios can be selected through groups with different evidence classes.

**Required design decision:** user-facing visual scenarios that require reviewed frames must carry that obligation from scenario identity itself (or from a single owning group), not depend on which overlapping group happened to select them.

## 10. Planner and impact routing audit

### 10.1 Good properties to preserve

`build-verification-plan.mjs` has several strong fail-closed properties:

- protected and candidate catalogs/manifests are merged conservatively;
- unknown/invalid changed-path evidence falls back to a broad safety plan;
- verification-governance changes force full profile;
- group dependencies are recursively resolved and cycles rejected;
- stable test IDs are deduplicated;
- retries are zero;
- `requiredDataCapabilities` are explicit;
- `requiresRealFullWorld` is computed semantically from selected capabilities;
- `real_fullworld` cannot be represented as an ordinary hosted group under schema validation;
- native/performance/soak classes can make execution exclusive.

These are architectural assets and should not be discarded with the historical workflows.

### 10.2 `full` is a broad qualification fallback, not every capability

The planner fallback constant is:

`['deterministic.core', 'e2e.full']`

It does not automatically include:

- `integration.source-contract`
- `fullworld.animation-census`
- `visual.creatures`.

This is consistent with the policy that a full verification **profile** does not imply FullWorld. It is nevertheless easy for maintainers to misread `profile=full` as “all tests”.

**Finding A-SEMANTICS-01 — P1 / correctness-risk through ambiguity:** specialist proofs are only selected if impact mapping explicitly asks for them. An unmapped path whose true oracle needs bounded/real/visual proof can fall back broadly yet still miss the specialist proof.

**Recommendation:** document/encode the distinction as `full qualification profile` versus specialist capabilities and add semantic closure tests. Do not solve this by making every unknown path run FullWorld.

### 10.3 Confirmed gameplay source-contract gap (#376)

Issue #376 correctly records that a change to `src/browser/creature-gameplay-profiles.mjs` needs the functional creature/gameplay proof **and** the minimum truthful `bounded_real_world` source-contract proof. The current generic `src/browser/creature-*` mapping does not express that split.

**Finding A-ROUTING-02 — P0 / false negative:** confirmed open routing debt.

### 10.4 New complete-product/Real-FullWorld mismatch

The impact manifest maps all of the following to domain `fullworld-complete-product`:

- `tools/fullworld-generation/`
- `tools/fullworld-publication/`
- `tools/fullworld-runtime/`
- `tools/fullworld-layers/`
- `tools/fullworld-minimap/`

but selects only:

`deterministic.core + e2e.full`

The repository capability policy says `real_fullworld` is reserved for complete publication/census/root linkage, generator/compiler determinism, full-product scale/performance/soak and overview/minimap consistency.

No later cross-domain escalation references `fullworld-complete-product`; a code search finds that domain only in `impact-manifest.json`.

**Finding A-ROUTING-03 — P0 / false negative:** the current semantic domain name declares complete-product impact without selecting a complete-product data capability/group.

This does **not** mean every file in those directories must always run the ~19 GB product. The fix is to split the paths/oracles accurately enough that only changes capable of invalidating complete-product properties select an explicit `real_fullworld.*` group, while ordinary pure logic stays on fixture/bounded proofs.

### 10.5 Test-only changes can miss the changed test

Current impact rules map:

- `tests/verification/` -> `deterministic.core`
- all other `tests/` -> `deterministic.core`.

Current `deterministic.core` declares only:

`tests/verification/*.test.mjs`

The repository contains many deterministic product tests outside that pattern, including root `tests/*.mjs`, `tests/fullworld-layers/*.test.mjs`, `tests/fullworld-runtime/*.test.mjs`, `tests/properties/*.test.mjs`, Python tests such as `tests/fullworld-publication/test_output_safety.py`, and feature-specific contracts such as the creature gameplay tests.

**Finding A-ROUTING-04 — P0 / false negative:** a test-only change outside `tests/verification/*.test.mjs` can select a deterministic group that does not contain the changed test.

The historical aggregate CI used a wider explicit deterministic list, and dedicated feature workflows executed additional feature tests. Those semantics have not yet been fully represented in the new catalog.

**Required invariant:** modifying/adding a test must always run that test (or its owning semantic suite) before the plan is considered complete.

### 10.6 Semantic mapping tests are insufficiently complete

`tests/verification/impact-manifest.test.mjs` strongly validates manifest schema and malformed policy rejection, including rejection of hosted `real_fullworld`, but it uses small synthetic manifests. It does not prove the semantic completeness of the repository’s actual current `impact-manifest.json` against the actual test/capability inventory.

**Finding A-ROUTING-05 — P0/P1 / missing meta-verification:** schema correctness is better covered than semantic ownership completeness.

Required additional contract classes:

- every production path/domain has an owning verification mapping;
- every `bounded_real_world` spec has at least one truthful producer/consumer path binding;
- every `real_fullworld` spec/complete-product oracle has explicit impact bindings;
- every user-facing visual review scenario has an explicit visual-review obligation;
- every test path maps to itself/its owner;
- every catalog spec exists;
- every Playwright spec in the capability inventory exists in exactly the intended semantic groups;
- no ordinary functional group can acquire `real_fullworld` accidentally;
- positive **and negative** routing matrix tests prove both required execution and required non-execution.

## 11. Deterministic verification contract reset is required

This is a newly confirmed restoration blocker.

`deterministic.core` points at `tests/verification/*.test.mjs`. Multiple tests in that directory still load the historical active workflow topology directly. Examples include:

- `ci-workflow-contract.test.mjs`
- `bootstrap-catalog-workflow-contract.test.mjs`
- `pr-browser-trust.test.mjs`
- `pr-review-fanin-workflow.test.mjs`
- `review-event-classification.test.mjs`
- `e2e-proxy-contract.test.mjs`
- `protected-hosted-workflow-contract.test.mjs`
- `protected-execution-environment.test.mjs`
- `protected-visual-reference.test.mjs`
- `protected-verification-lifecycle-workflow-contract.test.mjs`.

For example, `ci-workflow-contract.test.mjs` opens `.github/workflows/ci.yml`, `.github/workflows/verification-depth.yml`, `.github/workflows/synology-live-acceptance.yml` and other historical active files at module load. `.github/workflows/ci.yml` is absent on the audited main; its archived copy is under `docs/maintenance/suspended-workflows/ci.yml`.

Likewise `bootstrap-catalog-workflow-contract.test.mjs` immediately reads `.github/workflows/ci.yml`.

**Finding A-CONTRACT-01 — P0 / restoration blocker:** the future deterministic gate cannot simply run all historical verification-contract tests from their old paths. Some contracts intentionally describe a topology that no longer exists.

**Required action before restoration:** classify every `tests/verification/*.test.mjs` as one of:

1. **keep/current invariant** — still describes the desired architecture;
2. **rewrite** — valuable invariant, but bind it to the new simplified topology;
3. **archive/retire** — only proves a retired promotion/re-entry/recovery design;
4. **maintenance-only** — proves the current three-workflow freeze and should not be confused with final product CI.

Do not make tests green by pointing all old contracts at archived YAML. Archive files are historical evidence, not the target production workflow topology.

## 12. Dormant verification control-plane complexity

Even though workflows are suspended, the repository still contains a substantial `tools/verification/**` implementation, including planning, protected admission, hosted execution, evidence, anti-loop, lifecycle, bounded-real-world and visual-review components.

Examples include:

- `build-verification-plan.mjs`
- `bounded-real-world.mjs`
- `consume-protected-admission.mjs`
- `run-protected-admission.mjs`
- `protected-hosted-plan.mjs`
- `protected-hosted-gate.mjs`
- `protected-semantic-routing.mjs`
- `protected-admission-policy.mjs`
- `protected-admission-evidence.mjs`
- `base-advance-compatibility.mjs`
- `anti-loop-common.mjs`
- `collect-protected-visual-capture.mjs`
- `verification-authority-manifest.json`
- catalog/manifest/schema/stable-ID/evidence helpers.

**Finding A-CONTROL-01 — P1 / complexity:** workflow suspension reduced active Actions topology but did not remove the historical control-plane surface. Restoration must explicitly choose the minimal components to retain.

A concrete example of historical complexity is the archived `protected-hosted-executor.yml`: its trigger is `workflow_dispatch`, while its preflight code still contains branches for `workflow_run` and later expressions also retain workflow-run fallbacks. That is unreachable/dead compatibility logic in the archived topology and should not be copied into a new executor.

## 13. Correctness vs completeness vs necessity assessment

| Area | Correctness | Completeness | Necessity | Complexity | Verdict |
| --- | --- | --- | --- | --- | --- |
| protected maintenance admission | strong trust boundary | complete for current freeze | required | low/moderate | keep, trim duplicate triggers/work |
| Merge Queue maintenance second gate | same validator is correct | duplicates required audit | independent necessity unproven | low | consolidate if no independent invariant |
| terminal lifecycle | correct governance concept | functionally complete | required separately | moderate due reusable calls | keep, reduce close over-trigger |
| legacy aggregate CI | historically functional | broad but semantically uneven | not justified as final topology | high | do not restore 1:1 |
| current impact planner | strong fail-closed mechanics | semantic mappings incomplete | central to target architecture | moderate | keep and finish |
| verification catalog | useful capability metadata | groups too coarse/missing product deterministic ownership | central | moderate | refactor |
| capability inventory | strong and explicit | 36 E2E specs represented | central source of truth | low | keep, cross-check automatically |
| deterministic core | useful concept | currently historical-workflow-heavy and misses product tests | needed after reset | high debt | P0 contract reset |
| bounded real source contracts | correct minimum capability | #376 mapping incomplete | required where real bytes are oracle | low | fix routing |
| Real-FullWorld | correctly isolated for animation census | complete-product domains lack generic truthful group(s) | specialist only | high cost | add narrowly scoped specialist groups |
| visual review | valid independent oracle | ownership/evidence overlap ambiguous | only for user-visible review obligations | high human cost | split/routable scenarios |
| performance/stress/soak | appropriate fixture capability for bounded oracles | resource classes not represented in catalog | selective | potentially high | split from e2e.full |
| CodeQL workflow | valid security lane historically | currently suspended | security requirement independent of product impact | separate | verify external coverage then restore/design separately |
| Dependabot | current paths correct | GitHub Actions + `/e2e` npm covered | justified | low | keep |

## 14. Target architecture

The target should have clear layers rather than many independent workflow families.

### Layer 0 — protected admission / maintenance authority

Current phase: retain the required protected-base maintenance audit exactly as authority demands.

Future normal phase: admission/ruleset identity remains stable and must not execute candidate policy as authority.

### Layer 1 — one protected impact planner

Inputs:

- protected-base policy/catalog;
- candidate catalog only as conservative widening input;
- exact merge-base/head changed paths including rename source paths;
- exact Playwright stable-ID census;
- explicit data capability inventory.

Outputs:

- verification profile;
- impact domains;
- exact semantic group IDs;
- exact stable test IDs where browser tests are selected;
- deterministic product commands/suites;
- required data capabilities;
- required runner/resource classes;
- evidence classes;
- one immutable plan digest.

No expensive runner should start until this plan exists.

### Layer 2 — GitHub-hosted deterministic/product qualification

Create semantic deterministic groups that actually own the repository’s tests, rather than making `deterministic.core` mean only verification control-plane tests.

At minimum distinguish:

- planner/governance contracts;
- browser/runtime pure contracts;
- search contracts;
- creature/gameplay contracts;
- fullworld publication/runtime/layer deterministic contracts;
- property/invariant tests;
- Python producer/publication safety tests.

A changed test must select itself/its owner.

### Layer 3 — GitHub-hosted ordinary browser qualification

Use only `qualification_fixture` except the explicitly bounded real contract lane.

Separate browser groups by semantic oracle and cost so UI/search/state/geometry/race/accessibility work does not pull unrelated performance/soak/visual work.

### Layer 4 — bounded real-world compatibility

Only paths whose oracle depends on selected authoritative Game-derived bytes select `bounded_real_world`.

Examples:

- API/source contract;
- creature gameplay source contract.

This lane remains GitHub-hosted if its bounded immutable inputs fit hosted limits and policy.

### Layer 5 — specialist Real-FullWorld / native / reviewed evidence

Only a protected plan with explicit capability need may use Molehill.

Split complete-product proofs by oracle, for example:

- `real_fullworld.animation-census`
- `real_fullworld.publication-root`
- `real_fullworld.generator-determinism`
- `real_fullworld.overview-minimap-consistency`
- `real_fullworld.scale-performance` only where the oracle truly depends on complete product scale.

Do not use one ~19 GB FullWorld group as the default browser test farm.

### Layer 6 — independent security scanning

CodeQL/security analysis is orthogonal to product impact. Keep a separate security schedule/PR policy as required by repository/organization security policy.

### Layer 7 — publication/deployment/live acceptance

Publication/deployment must stay separate from PR qualification. Synology remains merged-main deployment/live-acceptance only. Do not use Synology as fallback capacity for ordinary or specialist E2E.

### Layer 8 — one product fan-in when restoration is authorized

After shadow/canary proof, expose one stable required product verification context. It should accept skipped semantic groups only when the protected plan proves they are not required.

Do not require dozens of path-filtered status contexts directly in branch protection; that produces missing-check/deadlock complexity.

## 15. Trigger policy for the target system

### Candidate-changing events

Product verification may run on:

- PR open/reopen/synchronize when candidate SHA/diff changes;
- Merge Queue `merge_group` against exact queue candidate.

### Non-code review/metadata events

Do not re-execute unchanged product suites for:

- title/body edit;
- review submit/edit/dismiss;
- label-only/review-state changes.

Those events may update a lightweight review/fan-in decision if required, but must reuse exact-SHA evidence rather than rebuild it.

### Main push

Use main push only for proofs whose oracle is “merged main is healthy/current”, not as an automatic duplicate of all already-qualified PR work unless post-merge composition adds a new risk.

### Schedule

Scheduled depth is additive:

- rotating deterministic stress seeds;
- bounded repeated critical cases;
- specialist Real-FullWorld/nightly proofs where complete-product coverage is required;
- security schedules.

Scheduled depth must not become a hidden requirement for ordinary PR completion.

## 16. Required routing regression matrix

Before any restoration, add table-driven tests that prove both positive and negative routing. Minimum examples:

| Change | Must select | Must not select by default |
| --- | --- | --- |
| ordinary docs | docs/contracts only | Playwright, bounded-real, Real-FullWorld |
| `AGENTS.md` | instruction/governance admission only unless policy semantics changed | product E2E |
| creature interaction runtime | deterministic creature + creature functional | FullWorld, performance, soak |
| gameplay profile source | gameplay functional + `integration.source-contract` + `bounded_real_world` | Real-FullWorld |
| search runtime | search deterministic + search browser | unrelated creature visual/soak |
| state/history | state/history browser + relevant deterministic | source-contract/FullWorld |
| geometry/render | geometry/render browser + invariants | source-contract/FullWorld |
| responsive/accessibility | responsive/accessibility | performance/soak/FullWorld |
| race/fault | race/fault/resilience | visual review unless UI impact requires it |
| performance bounded workload | performance group, exclusive policy if required | FullWorld unless oracle is complete scale |
| soak bounded workload | soak group, exclusive policy | FullWorld unless oracle is complete scale |
| visual chrome | visual acceptance/review | FullWorld unless real product pixels are explicitly the oracle |
| API/source contract | bounded real contract | FullWorld |
| animation publication/census | explicit real-fullworld census | unrelated broad ordinary suite where not needed |
| fullworld publication root logic capable of changing complete product identity | deterministic producer + explicit real-fullworld root proof | unrelated UI suites if not impacted |
| fullworld overview/minimap compiler semantics | deterministic compiler + explicit complete-product consistency proof when required | default whole E2E matrix |
| modified ordinary product test | the changed test/owning suite | unrelated browser suites |
| verification planner/catalog/manifest | planner contracts + conservative broad qualification | silent specialist omission |
| unknown path | fail-closed broad qualification | implicit assumption that broad == every specialist capability |

## 17. Migration plan respecting #315

### Phase R0 — documentation/audit only — current phase

- record this audit;
- do not restore workflows;
- do not add new blocking product checks.

### Phase R1 — contract and inventory reset — after explicit authority

1. classify every `tests/verification/*.test.mjs` as keep/rewrite/retire/maintenance-only;
2. remove future-gate dependency on archived workflow paths;
3. create authoritative deterministic product-test ownership;
4. make test-only changes execute the changed test;
5. close #376;
6. split complete-product paths and add truthful Real-FullWorld mappings;
7. split `e2e.full` by semantic group/resource class;
8. normalize visual-review ownership;
9. add actual-manifest semantic closure tests.

No active workflow restoration is required to complete the model-level work if future maintenance authority permits those paths.

### Phase R2 — protected shadow planner

Only after #315 resumes restoration:

- run planner non-blocking;
- collect selected groups/capabilities and compare with manually reviewed expected routing;
- no heavy execution solely because shadow exists.

### Phase R3 — hosted canary

Canary representative changes for:

- docs-only;
- deterministic-only;
- creature UI;
- gameplay source contract;
- search;
- geometry/state/race;
- visual;
- planner/governance.

Measure false positives, false negatives, runner allocation and wall time.

### Phase R4 — specialist canary

Run only explicit bounded-real/Real-FullWorld cases. Prove that ordinary E2E remains independent of the ~19 GB product and that unavailable specialist capacity blocks only selected specialist proof.

### Phase R5 — single blocking fan-in

After PR/Merge Queue parity and canary evidence are proven:

- enable one required product fan-in;
- atomically align ruleset required context;
- keep security and publication/deployment logically separate;
- observe Merge Queue for missing-check/deadlock behavior.

### Phase R6 — historical topology retirement

Once the new path is stable:

- keep only documentation/evidence that still provides historical value;
- remove or clearly mark dead protected controller/promotion/re-entry code that no final workflow uses;
- prevent contract tests from pinning retired architecture forever.

## 18. Acceptance criteria

Restoration is not complete until all of the following are directly proven:

1. Every current Playwright spec is represented in the capability inventory and all paths exist.
2. Every product deterministic test has an owning group/entrypoint.
3. A changed test always runs itself/its owner.
4. Every specialist data capability has explicit truthful impact bindings.
5. No ordinary UI/runtime test requires `real_fullworld` merely because it is E2E.
6. FullWorld runs only when an oracle requires complete product bytes.
7. `requiresRealFullWorld` is true only for plans that actually contain a `real_fullworld` group.
8. Performance and soak resource classes are actually represented by catalog groups if the planner treats them specially.
9. Visual review obligations cannot disappear because the same spec was reached through another machine-summary group.
10. Unknown paths fail closed without pretending that broad qualification proves specialist source/fullworld obligations.
11. Planner/catalog/manifest changes conservatively widen verification.
12. PR and Merge Queue produce equivalent semantic plans for equivalent diffs.
13. Non-code review/metadata edits do not rerun unchanged product suites.
14. No runner is allocated for an empty/no-op build decision.
15. GitHub-hosted ordinary E2E does not depend on Molehill or the complete FullWorld product.
16. Synology is never used as ordinary E2E fallback.
17. Security scanning coverage is explicitly known and documented.
18. The final required product fan-in has one stable identity and cannot silently pass missing required groups.
19. Historical workflow-contract tests no longer require files that are intentionally absent from the active topology.
20. The new architecture has materially fewer active workflow/control-plane transitions than the 25-workflow archive.

## 19. Priority register

### P0 — correctness/restoration blockers

- **A-CONTRACT-01:** historical workflow-contract tests inside `deterministic.core` reference absent active workflow paths.
- **A-ROUTING-04:** generic `tests/**` mapping can fail to execute the changed product test.
- **A-ROUTING-03:** `fullworld-complete-product` paths do not currently select an explicit Real-FullWorld proof despite repository capability policy.
- **A-ROUTING-02 / #376:** gameplay-profile changes miss bounded-real source-contract proof.
- **A-ROUTING-05:** no complete actual-manifest/capability ownership closure contract.
- **A-CATALOG-01:** `e2e.full` is too coarse to preserve selective execution/resource semantics.

### P1 — efficiency/architecture

- **A-MQ-01:** duplicate Merge Queue maintenance validation.
- **A-TRIGGER-01:** PR `edited` retrigger and no cancellation in required audit.
- **A-TRIGGER-02:** historical review events caused unchanged product reruns.
- **A-BUILD-01:** historical root build could allocate a no-op runner.
- **A-CATALOG-02:** creature impact selects broad visual specs.
- **A-CATALOG-03:** overlapping visual spec groups carry different evidence semantics.
- **A-SEMANTICS-01:** `full` naming can be mistaken for all specialist capabilities.
- **A-CONTROL-01 / A-TOPOLOGY-01:** dormant/historical protected control plane is much larger than the target should be.
- **A-SECURITY-01:** repository CodeQL workflow is suspended; external/default coverage remains unknown.

### P2 — cleanup/optimization

- **A-LIFECYCLE-01:** reusable close validation is allocated for closure events whose actual cleanup later skips.
- keep weekly Dependabot for Actions and `/e2e` npm;
- keep daily branch lifecycle inventory as governance, while measuring it separately from product CI.

## 20. Unknowns that must remain explicit

The audit does **not** claim the following without additional execution/access evidence:

- that every dormant deterministic/Playwright test currently passes on `main@f00815858...`; execution is intentionally suspended;
- that organization/default GitHub CodeQL setup does or does not provide code-scanning coverage while repository `codeql.yml` is suspended;
- that every archived workflow is obsolete — some contain useful invariant logic, but they must be individually classified before reuse;
- exact future runner-minute savings before shadow/canary measurement;
- whether the second maintenance Merge Queue gate has an external/ruleset semantic dependency not visible in repository required-status configuration.

These unknowns do not weaken the confirmed structural findings above; they define what must be measured or verified during authorized restoration.

## 21. Final recommendation

Do not “repair CI” by copying the 25 suspended workflow files back into `.github/workflows/`.

The shortest safe path is:

1. reset stale verification contracts;
2. make deterministic product-test ownership complete;
3. close #376 and the newly identified complete-product routing gap;
4. split broad E2E/visual/performance/soak groups;
5. add semantic routing-closure tests that prove both execution and non-execution;
6. only after #315 explicitly resumes restoration, run one protected shadow planner;
7. canary hosted and specialist lanes independently;
8. promote one stable required product fan-in;
9. retire historical controller/promotion/re-entry topology that the final system does not need.

The architectural invariant is simple: **execute the smallest truthful proof required by the changed behavior, but never omit a proof because routing metadata is incomplete.** Profile controls breadth; data capability controls what bytes are necessary; runner class follows the selected oracle rather than the test filename or historical workflow placement.
