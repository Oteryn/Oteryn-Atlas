# ATLAS-PRODUCTION-UI-SHELL-V1

ALIAS:
`ATLAS-PRODUCTION-UI-SHELL-V1`

MODE:
Autonomous bounded multi-agent implementation + verification + integration + protected squash merge + merged-main live acceptance.

DO NOT STOP AT AUDIT OR PLANNING ONCE THE IMPLEMENTATION DEPENDENCY GATE IS OPEN.

If the dependency/ownership gate is not open, report `WAITING_EXTERNAL` with the exact blocking PR/Issue/SHA, release workers, make no no-op/retrigger commits and stop the run. Resume only from fresh GitHub state when the blocker changes.

## Mission

Implement the owner-approved Oteryn Atlas Production UI Shell V1 defined by programme Issue #185, the merged design spec and the merged implementation plan.

The user-visible result must move Atlas from the current engineering/debugger-oriented FullWorld shell to a polished production application while preserving the proven map renderer, map state, deep links, creature interaction geometry, gameplay/data authority boundaries and truthful fail-closed behavior.

Approved product composition:

`global navigation rail + contextual left panel + dominant map surface + contextual right analysis panel + on-demand Developer Mode`

The redesign is a shell/composition evolution of the existing FullWorld application. It is not a renderer rewrite, framework migration or second Atlas application.

## Canonical repository

Atlas runtime/consumer:
`https://github.com/Oteryn/Oteryn-Atlas`

Read-only external authority as needed for dependency verification:
`https://github.com/Oteryn/Oteryn-Game`

Oteryn-Game remains canonical World/Content/gameplay-fact authority. This alias grants **no Game mutation authority**. If a missing Game product such as item/drop/task farm intelligence is still absent, keep the affected Atlas capability unavailable/partial; do not implement the Game producer from this prompt.

## Programme authority

Parent planning/design programme:
`Oteryn/Oteryn-Atlas#185`

Required current-main documents:
- `docs/superpowers/specs/2026-08-26-atlas-production-ui-shell-v1-design.md`
- `docs/superpowers/plans/2026-08-26-atlas-production-ui-shell-v1.md`
- this prompt
- root and every nearer applicable `AGENTS.md`
- `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`

Planning-time Atlas main `abb799b5bb0905c8f2e8b57e67950334db39d5f7` and historical PR heads are evidence only. Resolve all current identities again before mutation.

## Mandatory GitHub-first preflight

Before any local/remote product mutation:

1. Resolve exact current protected Atlas `main` SHA and branch protection.
2. Read current `AGENTS.md` and nearer instructions for every intended path.
3. Verify this prompt, the design spec and the implementation plan are already on protected `main`. Never implement from the docs/programme branch.
4. Refresh parent Issue #185.
5. Refresh Atlas PR #162 / Issue #145 (walking-in-place animation).
6. Refresh Atlas PR #170 / Issue #165 (Creature Gameplay Profiles).
7. Refresh Atlas Issue #117 (Hunt Intelligence).
8. Refresh Oteryn-Game Issue #75 (item/drop/task farm-intelligence export) read-only.
9. Search current open PRs/branches touching `web/fullworld*`, `src/browser/**`, `e2e/**`, verification policy or shell-adjacent product state.
10. Resolve current heavy-E2E runner/slot policy and current exact-head verification requirements.
11. Record current live merged-main Synology revision/acceptance only as baseline evidence; do not deploy or mutate live during implementation.

## Hard dependency/ownership gate

Shared Product Shell implementation must not start while #162 or #170 still has unresolved active ownership over the same shared FullWorld/runtime/inspector surfaces.

If either remains active and overlapping:
- do not create a competing implementation branch that edits its owned hot files;
- do not cherry-pick unfinished candidate semantics as authority;
- do not reimplement animation, gameplay inspector state or gameplay data consumers;
- report `WAITING_EXTERNAL` with exact current state and stop cleanly.

If either merges, refresh `main` and consume the merged contract.
If either closes unmerged/superseded, verify that terminal state and current `main` before assuming ownership.
If explicit ownership transfer/reconciliation exists, record the exact evidence in the implementation Issue/task packet before proceeding.

## Fresh implementation lifecycle

Issue #185 is planning/programme authority and does not by itself authorize runtime mutation.

After the dependency gate is open:

1. Create a new Atlas Issue titled `feat(ui): implement Production UI Shell V1`.
2. Reference #185 and copy the exact current implementation baseline, dependency resolution, authority constraints and Definition of Done.
3. Create coordinator branch `feat/atlas-production-ui-shell-v1` from exact refreshed protected `main`.
4. Create one active task packet at `docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md` with exact issue/base/branch/ownership/evidence state.
5. Use one writable coordinator worktree and isolated worker worktrees/branches.
6. The coordinator owns the only implementation PR to `main`; subordinate lanes do not create/merge independent PRs to protected `main`.

## Required Superpowers execution model

Use `superpowers:subagent-driven-development` for implementation unless unavailable; if unavailable use the repository-supported equivalent isolated multi-agent workflow.

Before each worker starts, give it a self-contained prompt with:
- exact current `main` and implementation Issue;
- exact owned paths;
- exact forbidden coordinator/shared paths;
- interfaces consumed/produced from the merged plan;
- RED → GREEN test commands;
- required handoff shape;
- no authority to merge to `main`.

One mutable path may have only one active owner.

## Parallel topology

### Wave 1 — launch concurrently after Task 0

**Lane A — Capability + shell state**
Own only:
- `src/browser/product-capabilities.mjs`
- `src/browser/product-shell-state.mjs`
- `tests/product-capabilities.mjs`
- `tests/product-shell-state.mjs`

Must produce the exact public interfaces from the implementation plan and preserve capability states `loading|available|partial|unavailable|error`.

**Lane B — Design system**
Own only:
- `web/product-shell.css`
- `tests/product-shell-style-contract.mjs`

Must implement semantic surfaces/text/brand/interaction/state/spacing/radius tokens and accessible reusable shell primitives. No shared HTML edits.

**Lane D — Map HUD**
Own only:
- `src/browser/map-hud-model.mjs`
- `web/fullworld-map-hud.mjs`
- `tests/map-hud-model.mjs`

Must adopt existing zoom/floor/view/layer controls without duplicating camera/floor handlers or AUTO thresholds.

**Lane F — Developer Mode**
Own only:
- `src/browser/developer-diagnostics.mjs`
- `web/fullworld-developer-panel.mjs`
- `tests/developer-diagnostics.mjs`

Must preserve truthful read-only diagnostics and advanced provenance on demand. Missing measured values remain unavailable, never invented as zero.

Coordinator reviews every Wave 1 full diff and reruns lane tests. Freeze Lane A interfaces before Wave 2.

### Wave 2 — launch concurrently after Lane A acceptance

**Lane C — Navigation + left context**
Own only:
- `src/browser/product-navigation.mjs`
- `src/browser/context-panel-model.mjs`
- `web/fullworld-context-panel.mjs`
- `tests/product-navigation.mjs`
- `tests/context-panel-model.mjs`

Navigation order is `World`, `Creatures`, `NPCs`, `Items / Farm`, `Hunts`. Availability comes only from Lane A. Reuse existing search/filter/domain controls; do not create duplicate datasets/handlers.

**Lane E — Right context / inspector**
Own only:
- `src/browser/inspector-context-model.mjs`
- `web/fullworld-inspector-shell.mjs`
- `tests/inspector-context-model.mjs`

Must consume terminal/merged #170 inspector/gameplay contracts. When verified creature gameplay exists, product hierarchy is `Gameplay | Semantic | Live state | Provenance`, Gameplay default, Live state disabled without genuine authority. No second gameplay-data consumer.

If #170 ownership is not terminal/reconciled, Lane E waits; do not guess.

## Coordinator-owned shared hot files

Workers must not edit these unless the coordinator explicitly transfers one exact path for one exact task:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css` when acting as global shell composition
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- shared E2E orchestration/configuration
- formal visual-review manifests

The coordinator integrates reviewed lane commits and performs all shared wiring.

## Product semantics that must remain true

### World / map
- existing WebGL/full-world renderer remains the rendering authority;
- map is the dominant surface;
- no second camera, floor, coordinate transform, selection or creature hit-test system;
- zoom/floor/view controls are presentation-relocated only;
- current deep links/history remain deterministic.

### Product navigation
- `World` available only when verified FullWorld activation succeeds;
- `Creatures` / `NPCs` depend on validated creature/search products;
- `Items / Farm` may be `partial` while custom kill estimate is available but Game item/drop/task facts remain absent;
- `Hunts` stays unavailable until accepted Hunt products exist;
- `Live state` stays unavailable until a genuine live source exists;
- normal user-facing unavailable copy never references GitHub Issues, compiler generations or internal blockers.

### Farm
Preserve current truthful custom kill estimator semantics and existing Farm state ownership.
Do not fabricate:
- item cards;
- average drop chances;
- task requirements;
- named “Best places”;
- item-source facts absent from accepted Game products.

Future full Farm probability/ranking semantics remain governed by the existing Farm Explorer spec.

### Creature Gameplay
If #170 is merged, reuse its exact Game-derived consumer, completeness states, `inspector=` behavior and Gameplay/Semantic content. Do not duplicate or repair identity by display name.

### Hunt
Production Shell V1 creates integration seams only. It does not invent Hunt data, metrics, routes or recommendations.

### Developer Mode
Move technical diagnostics/provenance out of normal default chrome while keeping them reachable/read-only. Developer Mode must not mutate product state, inject fake data or become alternate authority.

## Shell state contract

The only new top-level shell query parameter is:

`product=world|creatures|npcs|farm|hunts`

Rules:
- `creature=` remains concrete creature selection authority;
- merged `inspector=` remains inspector-tab authority;
- existing Farm parameters remain Farm authority;
- `creature=` with no explicit `product=` resolves to a compatible creature context;
- active Farm state with no product resolves to Farm context;
- unavailable requested product fails closed to World;
- unrelated query params survive serialization;
- back/forward/reload restore a coherent product context.

## Coordinator integration sequence

After both waves are reviewed:

1. Refresh `main` and normal non-force merge-up according to current `AGENTS.md`.
2. Integrate reviewed lanes A → B → D/F → C/E.
3. Add/activate RED integrated shell contract before shared markup mutation.
4. Recompose `web/fullworld.html` into topbar + global nav + contextual left panel + existing map stage + product analysis panel + Developer Mode host.
5. Preserve existing essential DOM IDs, map canvases, quick card and current product runtime hooks unless a newly merged authoritative contract explicitly changed them.
6. Load `web/product-shell.css` after current styles and make map reclaim the permanent diagnostics height.
7. Build one capability bridge from already validated runtime readiness into Lane A. Pure capability code never parses low-level products itself.
8. Wire `product=` history without duplicating domain state.
9. Adopt existing map controls into HUD with existing handlers intact.
10. Adopt existing World/Creature/NPC/Farm controls into contextual left panel.
11. Wire the right product-first inspector around merged gameplay/Semantic/provenance content.
12. Wire on-demand Developer Mode from existing truthful diagnostics.
13. Remove stale engineering lifecycle copy (`G3`, `G4 PROVEN`, `UPSTREAM_BLOCKED`, `PRESENTATION DEPENDENCY`, `VERIFYING ROOTS`, `DETAIL STREAM`, Issue-owned status prose) from the default normal-user shell while preserving advanced factual provenance.
14. Run all new deterministic tests and every current GUI/FullWorld/mobile/search/creature/Farm/gameplay test selected by current CI.
15. Commit/push exact integrated coordinator head.

Do not weaken existing runtime tests just because DOM composition changed. Update test selectors only when they tested old chrome rather than required behavior, and retain independent behavioral oracles.

## Lane G — integrated responsive/accessibility/browser verification

After coordinator integration, dispatch one independent Lane G to own:
- `e2e/tests/production-ui-shell.spec.mjs`
- `tests/production-shell-accessibility-contract.mjs`

It must verify at least:

### Desktop
- clean World default;
- global product navigation and context switches;
- global search;
- pan/zoom/floor/view mode;
- creature click → quick card → Details → Gameplay/Semantic when available;
- NPC role/filter flow;
- Farm custom-kill flow with truthful partial/unavailable item intelligence;
- left/right panel open/close while map remains usable;
- Developer Mode open/close;
- reload/back/forward/deep-link restoration;
- loading/empty/partial/unavailable/error treatment;
- no page/console/network failures.

### Mobile/tablet
- map remains primary viewport rather than a compressed strip;
- compact product navigation;
- context drawer/sheet;
- details drawer/bottom sheet;
- quick-card coexistence;
- Escape/backdrop/focus return;
- current accepted touch-target sizing and safe-area behavior.

### Geometry/accessibility
- no map/creature world-anchor or hit-test drift when panels open/close/resize;
- DPR 1/2 synchronization;
- semantic landmarks;
- accessible icon-only names;
- visible focus;
- active/selected/expanded/disabled semantics;
- important trust/state meaning not color-only;
- essential product text not encoded in 8–9px labels.

Lane G returns failing evidence to the coordinator for shared-hot-file fixes unless ownership is explicitly transferred.

## Visual acceptance

Use the current repository visual-review mechanism and require exact-head full frames for at least:
- clean World default;
- World with left context open;
- creature Gameplay;
- Semantic/Provenance advanced view;
- Farm partial/unavailable state;
- Developer Mode;
- mobile default map;
- mobile context drawer/sheet;
- mobile details sheet.

Every required screenshot must actually be opened and reviewed before approving/publishing local E2E evidence. Do not auto-approve unseen screenshots.

## Testing and Molehill concurrency

Targeted lane deterministic tests may run concurrently when they do not share mutable fixtures/output.

Heavy browser qualification must obey current repository policy. At planning time `e2e/run.ps1` has a measured safe default of 2 isolated concurrent full slots; refresh this before execution and never exceed current selected capacity.

Each heavy slot must keep unique Compose project/artifact namespace and independent publication forwarder/origin as current policy requires.

Lane-local heavy evidence is supporting evidence only. Final acceptance must run against one frozen integrated candidate SHA.

Any post-freeze code-changing commit invalidates final proof for the previous SHA.

## Worker return format

Every lane handoff must state:
- lane name;
- exact admission main SHA;
- worker branch;
- exact worker head SHA;
- exact changed-file list;
- exact exported interfaces;
- each test command with exact result;
- observed RED evidence;
- final GREEN evidence;
- unresolved risks/blockers;
- confirmation that no forbidden path was edited.

Reject vague “tests pass” summaries or handoffs without an exact head/full diff.

## Final candidate and protected merge

The coordinator alone performs final integration/merge lifecycle:

1. Integrate Lane G and review the full changed-file set/full diff.
2. Freeze exact `candidate_sha`.
3. Run complete current deterministic/hosted checks.
4. Run full exact-head Molehill qualification through current `e2e/run.ps1`, workers/retries/slot rules unchanged.
5. Open and review all required screenshots; bind visual review to exact candidate and browser summary.
6. Publish `atlas-local-e2e` only through the current approved exact-head publisher after true success.
7. Open/update the single implementation PR linked to the fresh implementation Issue and parent #185.
8. Require current `atlas-gate`, `provenance-gate`, CodeQL and every other current required/specialized check.
9. Resolve review threads and perform final independent full-diff audit.
10. Any code-changing review fix creates a new candidate and requires all invalidated proof again.
11. Squash merge only with expected-head fencing and without weakening protection.
12. Clean completed worker/coordinator branches according to current policy.
13. Close the fresh implementation Issue only when the implementation Definition of Done is actually met.

## Merged-main live acceptance

After protected squash merge:

1. Resolve exact resulting protected `main` SHA.
2. Require normal merged-main hosted checks.
3. Require Synology Live Acceptance on that exact SHA under current deployment policy.
4. Verify live container `org.oteryn.revision` and `X-Oteryn-Atlas-Revision` equal the exact merged SHA.
5. Run bounded live desktop/mobile product smoke that proves production shell, map interaction, representative creature details and truthful capability states.
6. Never deploy a task branch or detached candidate.
7. If live acceptance fails, fix on a fresh protected PR with permanent regression; do not hand-edit production to make it pass.

## Terminal Definition of Done

Do not claim completion until all are verified:
- live default Atlas looks and behaves like a production product rather than engineering dashboard;
- map remains dominant and current renderer/camera/floor/deep-link behavior remains correct;
- one global nav + one contextual left panel replace the monolithic mixed rail;
- right panel is product-first and keeps Semantic/Provenance advanced access;
- merged Creature Gameplay is native/default where supported and not duplicated;
- Farm custom kill remains truthful while unavailable item/task facts stay gated;
- Hunt has extension seams without fake Hunt facts;
- capability availability comes from validated runtime/publication state;
- default permanent diagnostics are removed but Developer Mode preserves truthful read-only diagnostics;
- desktop/tablet/mobile/a11y/geometry behavior passes exact-head acceptance;
- required screenshots were actually reviewed;
- exact-final-head protected gates pass;
- implementation PR is squash-merged and branches cleaned;
- merged-main Synology Live Acceptance passes on the exact resulting SHA.

Return the fresh implementation Issue, implementation PR, final candidate SHA, squash-merge SHA, exact verification results, live-acceptance run/result and any remaining explicitly unavailable upstream capabilities.