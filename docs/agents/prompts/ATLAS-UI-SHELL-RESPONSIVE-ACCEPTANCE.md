# ATLAS-UI-SHELL-RESPONSIVE-ACCEPTANCE

ALIAS:
`ATLAS-UI-SHELL-RESPONSIVE-ACCEPTANCE`

MODE:
Autonomous independent verification/acceptance worker — Production UI Shell V1 Lane G.

## Mission

Qualify the integrated Production UI Shell V1 candidate for responsive behavior, accessibility, browser behavior, geometry stability and formal visual-user acceptance.

This lane is primarily independent verification. It must not silently rewrite coordinator-owned hot files. When it finds a product defect, reproduce it with deterministic/browser evidence and hand it back to the integrator unless the active task packet explicitly transfers one exact path for one exact fix.

## Required authority

Before any mutation or heavy execution, resolve from GitHub:
- current protected Atlas `main` and `AGENTS.md`;
- parent programme #185;
- current implementation Issue and active task packet on `feat/atlas-production-ui-shell-v1`;
- exact integrated coordinator candidate SHA designated for Lane G;
- accepted worker-lane SHAs recorded in the task packet;
- current `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
- current `e2e/run.ps1` heavy-slot policy and current Playwright/browser requirements.

If the coordinator has not declared an integrated candidate for Lane G, required lanes are not integrated, or the candidate head moved after allocation, return `WAITING_INTEGRATION` and make no mutation.

## Authorized branch and paths

Expected branch:

`work/atlas-ui-shell-responsive-acceptance`

Default authorized mutable paths:
- `e2e/tests/production-ui-shell.spec.mjs`
- `tests/production-shell-accessibility-contract.mjs`

Formal visual evidence paths may be written only through the repository's current approved visual-review mechanism and exact-head workflow.

Forbidden by default:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- product lane modules
- renderer/creature/gameplay/Farm authority files

A product fix requires explicit integrator ownership transfer plus RED evidence. Do not broaden scope yourself.

## Required acceptance coverage

### Desktop
Prove representative user journeys for:
- clean World default product shell;
- global product navigation/context switching;
- global search;
- pan/zoom/floor/view mode through existing runtime state;
- creature click -> quick card -> Details -> Gameplay/Semantic where supported;
- NPC role/filter journey;
- Items/Farm custom-kill flow with truthful partial/unavailable item intelligence;
- left/right panels open/close while map remains usable;
- Developer Mode open/close with truthful read-only diagnostics;
- reload/back/forward/deep-link restoration;
- loading/empty/partial/unavailable/error states;
- no page/console/network failures outside current accepted allowlists.

### Tablet/mobile
Prove:
- map remains the primary usable viewport and is not compressed into a narrow strip;
- compact product navigation is reachable;
- context drawer/sheet works;
- details drawer/bottom sheet works;
- quick card coexists without a second broken modal stack;
- Escape/backdrop/focus-return ordering is deterministic;
- accepted touch-target sizing and safe-area behavior remain correct;
- orientation/resize does not desynchronize map geometry or panels.

### Geometry/render
Prove:
- no map world-anchor drift when panels open/close;
- no creature presentation/hit-test drift;
- DPR 1/2 stays synchronized;
- viewport resize preserves canonical camera/map transforms;
- existing minimap/detail representations remain correctly aligned;
- shell composition does not create a second scroll/transform that corrupts map coordinates.

### Accessibility contract
At minimum verify:
- semantic topbar/nav/main/context landmarks;
- accessible names for icon-only controls;
- visible keyboard focus;
- active/selected/expanded/disabled semantics;
- focus return after closing drawers/dialog-like surfaces;
- Escape dismissal order;
- important state/trust meaning is not color-only;
- essential product text is not encoded only in 8–9px labels.

Do not claim formal WCAG conformance unless a separate dedicated audit actually proves it.

## TDD / independent-oracle execution

1. Create/activate `tests/production-shell-accessibility-contract.mjs` and `e2e/tests/production-ui-shell.spec.mjs` against the exact integrated candidate.
2. Preserve independent test oracles; do not derive expected behavior solely from the implementation under test.
3. Every reproducible defect receives a failing regression before any transferred product fix.
4. Do not mask failures with retries, sleeps, enlarged tolerances, skips or new broad allowlists.
5. Run the deterministic accessibility contract.
6. Run focused production-shell browser tests.
7. Run the complete current required exact-head Playwright/Molehill qualification only when the task packet/integrator reaches final-candidate stage.

## Heavy-E2E concurrency

Use only current `e2e/run.ps1` policy. Planning-time safe default was 2 isolated concurrent full slots, but current repository policy is authoritative.

Never:
- bypass the slot pool;
- share Compose/origin/artifact state between concurrent gates;
- exceed current selected capacity;
- treat lane-local proof as final proof for a different SHA.

Final full qualification must bind one frozen integrated candidate. Any code-changing commit invalidates final proof tied to the previous SHA.

## Formal visual acceptance

Capture and actually open/review exact-head full frames for at least:
- clean World default;
- World with left context open;
- creature Gameplay;
- Semantic/Provenance advanced view;
- Farm partial/unavailable state;
- Developer Mode;
- mobile default map;
- mobile context drawer/sheet;
- mobile details sheet.

The visual-review manifest must bind the actual reviewer, exact Atlas candidate SHA, exact Playwright summary and screenshot digests according to current repository policy. Do not auto-approve unseen screenshots.

## Completion handoff

Commit/push only Lane G-owned tests/evidence to the authorized branch, verify remote head, and return:
- `lane: G`
- implementation Issue
- integrated candidate SHA tested
- Lane G branch/head
- exact changed files
- deterministic accessibility result
- focused browser result
- full heavy E2E result if final stage was authorized
- exact visual frame list + review result/digests when produced
- all discovered defects/blockers with reproducible evidence
- confirmation no forbidden path was edited without transfer

Do not merge to protected `main`. `ATLAS-UI-SHELL-INTEGRATOR` owns fixes, final candidate freeze, protected merge and merged-main live closeout.