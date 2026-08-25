# ATLAS-CREATURE-WALKING-IN-PLACE-ANIMATION

ALIAS:
`ATLAS-CREATURE-WALKING-IN-PLACE-ANIMATION`

MODE:
Autonomous cross-repository implementation + verification + integration + protected merge + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement Atlas Issue #145 completely: make verified NPC and monster placements visibly animate with an authoritative fixed-direction moving/walk outfit cycle **in place** while Playback is ON, while preserving factual placement coordinates, floor, identity and all Game/Atlas authority boundaries.

The intended user-visible result is simple: an ordinary supported creature such as a Sheep, Pig, Chicken, NPC or monster should visibly "walk" or move its legs while remaining anchored to the same factual map tile. This task does **not** implement roaming.

## Repositories

Canonical Game/World/Content/appearance authority:
`https://github.com/Oteryn/Oteryn-Game`

Atlas consumer/runtime:
`https://github.com/Oteryn/Oteryn-Atlas`

Lifecycle issues:
- Atlas implementation: `Oteryn/Oteryn-Atlas#145`
- Game authority handoff: `Oteryn/Oteryn-Game#127`
- Parent Atlas programme: `Oteryn/Oteryn-Atlas#11`

Planning-time observed revisions are historical evidence only:
- Atlas `main`: `3125c5212d55b240b94e562023c3b9faede8db90`
- Game `main`: `5834e1dc44a4963ba1645d26e9f5599f5eda7604`
- accepted original Game animation producer merge: `8f6a4fdea4487a61c4cdaf1889d421ecd2265a31`

Refresh both repositories from GitHub before any mutation. Never implement against stale planning SHAs.

## Required source documents

Before changing code, read the current-main versions of all applicable instruction files and at minimum:

### Oteryn-Game
1. `AGENTS.md` and every nearer applicable instruction file;
2. Issue `Oteryn/Oteryn-Game#127`;
3. `docs/contracts/OTERYN_ATLAS_ANIMATED_APPEARANCES_V1.md`;
4. `docs/contracts/OTERYN_ATLAS_15_32_ANIMATION_CENSUS_V1.json`;
5. current `tools/game-atlas-appearances/**`;
6. current `tools/game-atlas-creatures/animated.py` and tests;
7. current `tools/game-atlas-outfit-spatial/**` and tests.

### Oteryn-Atlas
1. `AGENTS.md` and every nearer applicable instruction file;
2. Issue `Oteryn/Oteryn-Atlas#145`;
3. `docs/agents/prompts/ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME.md`;
4. `docs/testing/ATLAS-VERIFICATION-PLATFORM.md`;
5. current `tools/animation-runtime/build.py`;
6. current `src/browser/animation-runtime.mjs` and service wrapper;
7. current `web/fullworld-creatures.mjs`;
8. current creature/animation E2E and live-acceptance tests;
9. current Issue/PR state for #113, #115, #111/#118 and #85.

Use Superpowers/TDD workflow if available. Every implementation defect must be reproduced RED before the fix and retained as a permanent regression.

## Mandatory GitHub-first preflight

Before local or remote mutation:

1. Resolve exact current `main` SHA for both repositories.
2. Read current branch protection and required checks.
3. Refresh Atlas #145 and Game #127.
4. Search open PRs/branches touching Game appearance/creature exporters or Atlas animation/creature runtime.
5. Refresh Atlas #113 and #115 because they may own shared creature presentation geometry and interaction/label seams.
6. Refresh #111/#118/#85 and use the strongest currently merged exact-head visual/browser verification path.
7. Confirm this prompt has landed on Atlas `main`; do not implement product code on the docs/prompt branch.
8. Create dedicated implementation branches from refreshed `main` in each repository that actually needs changes.
9. Record exact starting SHAs and overlap reconciliation in each PR.

If the current Game publication already exposes a complete explicit moving-in-place playback projection that lets Atlas consume moving frames without choosing frame-group/direction semantics, prove that with exact path/schema evidence and skip unnecessary Game mutation. Otherwise implement Game #127 first.

## Non-negotiable semantics

### What Playback OFF means
Playback OFF must preserve the current deterministic verified static/reference creature presentation.

Do not replace the static/idle reference image with a moving frame merely to simplify the implementation.

### What Playback ON means
For every resolved NPC/monster presentation with a verified moving outfit frame group, Playback ON should render that moving frame sequence **in place** using authoritative frame order/timing and a deterministic Game-owned fixed direction.

### What "in place" means
For every animation frame:
- factual `record_id` is unchanged;
- factual/entity identity is unchanged;
- X is unchanged;
- Y is unchanged;
- floor is unchanged;
- spawn/placement authority is unchanged;
- Atlas world anchor is unchanged.

Only presentation pixels change.

### What this task must never do
Do NOT implement or simulate:
- roaming;
- random movement radius;
- pathfinding;
- collision navigation;
- AI;
- turning based on live state;
- patrols;
- aggro;
- attacks;
- deaths;
- respawns;
- occupancy/live-spawn state;
- server-observed facing;
- interpolation between world tiles.

Do not use a fake one-pixel/sub-tile wobble to create the impression of movement. The anchor remains fixed.

## Existing authoritative capability that must be reused

The accepted Game contract already distinguishes:
- outfit idle frame group `0`;
- outfit moving frame group `1`;
- explicit direction/pattern semantics;
- deterministic south/default presentation semantics;
- authoritative phase/timing metadata;
- the fact that a moving outfit frame group may be presented in place without claiming real movement.

The current creature handoff historically used `prefer-outfit-idle-else-moving-in-place-v1`, which causes most ordinary creatures with an idle group to remain visually static even though a moving group exists.

The implementation must close that presentation gap without moving semantic authority into Atlas.

## Phase 1 — Oteryn-Game authoritative playback handoff

### A. Preserve static projection
Keep the existing deterministic static projection semantics intact for Playback OFF.

Do not silently redefine `static_projection` to mean moving playback.

### B. Export a separate explicit playback projection
When a valid unique moving outfit frame group exists, export a separate Game-owned playback projection for moving-in-place rendering.

Use a clear versioned field/contract such as `playback_projection`, `moving_in_place_projection` or the current repository's preferred equivalent.

The exact field name may follow current conventions, but its semantics must be explicit and independently validated.

At minimum the projection must carry or unambiguously bind:
- the moving frame-group/program identity;
- selection policy identity;
- fixed presentation direction;
- concrete direction/pattern index;
- pattern-z/mounted-state decision;
- enabled addon pattern rows;
- resolved colors/mask semantics through the existing presentation identity;
- displacement/spatial metadata;
- phase count;
- authoritative/effective animation timing descriptor;
- explicit statement/flag/contract that this is presentation-only moving-in-place and does not change world position.

Atlas must not reconstruct any of these decisions from raw sprite arrays.

### C. Fixed-direction V1 policy
Use Game-owned direction semantics.

For the currently accepted semantics, prefer the deterministic south/default presentation where valid:
- pattern width `1`: use the sole valid presentation as south;
- pattern width `>=4`: use the Game-defined south index;
- unsupported/ambiguous direction dimensions such as widths `2` or `3`: fail closed for the moving-in-place projection rather than invent meanings.

If current Game contract has evolved, use the current explicit equivalent and document the migration.

Do not make Atlas choose a direction.

### D. Moving group selection
Use only a verified authoritative moving outfit frame group.

If moving group is:
- absent;
- duplicated/ambiguous;
- malformed;
- unsupported;
- missing sprites;
- invalid timing;
- invalid geometry;

then do not fabricate moving playback. Preserve the factual creature record and fall back to the already verified current presentation path.

### E. Contract versioning
Do not silently change the meaning of an existing capability/schema in a way that makes old and new publications indistinguishable.

If the extension is not strictly backward-compatible under current contract rules, bump/version the relevant creature/appearance capability explicitly and update Atlas atomically after the Game producer is merged.

### F. Game TDD
Before implementation logic, add failing tests for at least:
- unique moving-group selection;
- idle/static projection remains unchanged;
- south/fixed direction selection;
- width-1 direction case;
- width-2/3 fail-closed behavior;
- malformed/ambiguous moving group;
- moving timing preservation;
- addon/color/spatial reuse;
- no factual X/Y/floor mutation;
- deterministic double-build output;
- product verification rejects corrupted playback projection.

Run the exact-source producer tests required by current Game policy.

### G. Game PR and merge
Create one Game implementation PR for #127.

Before merge:
- inspect complete diff;
- run all applicable exact-head tests/governance checks;
- require current Game gate/CI/review requirements;
- resolve all review threads;
- squash merge only when green.

Record the exact Game merge SHA, product root/capability identity and playback coverage census. Atlas implementation must consume this merged authority, never an unmerged branch artifact.

## Phase 2 — Atlas browser product generation

After the Game producer is merged, refresh Atlas `main` again before mutation/rebase.

### A. Consume merged Game authority only
Update Atlas product generation to pin the new exact Game merge SHA/root/capability.

Never parse DAT/SPR/OTBM or legacy runtime sources in the browser.

### B. Preserve static pixels separately from moving playback
The Atlas browser-safe creature animation product must represent both concepts separately:
- deterministic static/reference presentation for Playback OFF;
- moving-in-place phase sequence for Playback ON when available.

Do not use "phase 0 of moving" as a substitute for the verified static/idle reference unless Game explicitly says they are the same presentation.

A reasonable shape is one creature presentation program containing a static content reference plus an optional moving playback program, but follow current product architecture and version it explicitly.

### C. Precompose moving frames using existing authoritative composition
Reuse the existing verified outfit composition pipeline:
- base layer;
- optional mask layer;
- colors;
- addons;
- exact source sprite references;
- displacement;
- content-addressed RGBA blobs.

Do not duplicate a second outfit renderer with subtly different semantics.

### D. Content-addressed dedupe and boundedness
Continue deduplicating RGBA blobs by content identity.

Measure the exact new:
- creature program count;
- supported moving-in-place count;
- unsupported reason counts;
- pixel blob count;
- pixel bytes;
- bucket count;
- manifest/program bytes.

Do not arbitrarily raise runtime caps just to make the product fit. If an existing cap is genuinely too small, record exact measured evidence, justify the smallest safe versioned bound change and cover it with regression tests.

### E. Static compatibility oracle
For records whose static authority did not change, prove Playback OFF restores the exact same verified static RGBA presentation as before this feature.

Do not accept "looks similar" as the oracle.

## Phase 3 — Atlas runtime behavior

### A. Keep one shared logical animation clock
Reuse the existing shared deterministic animation timeline.

Do not add one timer per NPC/monster.

Preserve current synchronized/asynchronous phase semantics and deterministic instance offsets where applicable.

### B. Explicit static vs playback frame selection
Refactor the creature animation API so the caller cannot accidentally conflate static and moving playback.

Use a clear API such as separate static/playback methods or an explicit playback-mode argument.

Required behavior:
- Playback OFF -> verified static/reference content;
- Playback ON + verified moving projection -> moving-in-place phase at current logical time;
- Playback ON + no verified moving projection -> preserve the current verified idle animation/static fallback; never guess.

### C. Anchor invariance
Creature world/screen anchoring must use the same factual world coordinate throughout playback.

A frame change must not mutate record position or map transform.

The runtime diagnostics must make it possible for tests to prove that animation frame identity changes while record/world anchor identity does not.

### D. Geometry and displacement safety
Before choosing the final geometry approach, census static-vs-moving bitmap geometry and displacement for the exact product.

If static and moving presentation bounds are invariant, prove and reuse that invariant.

If they are not invariant, use one stable verified presentation envelope/union derived from authoritative static+moving bounds or the current shared #113/#115 geometry seam. Do not let labels, badges or hitboxes jitter every animation frame.

Never create a second competing creature geometry model.

### E. #113/#115 compatibility
Refresh current implementation state before touching shared creature runtime files.

If #113 direct interaction cards or #115 label/badge geometry has landed:
- reuse its canonical presentation-bounds seam;
- preserve selection/deep-link behavior;
- preserve labels/badges;
- preserve hit testing;
- ensure animation-only phase changes do not cause unnecessary label-layout recomputation;
- ensure no stale clickable rectangles remain.

If overlapping PRs are still active on the same files, sequence/rebase rather than creating a stale competing implementation.

### F. User-facing presentation wording
Do not claim live movement or server state.

Where inspector/diagnostics expose the mode, use truthful wording such as:
- `Verified moving outfit playback · in place`;
- `Fixed presentation direction: south`;
- `World position unchanged`.

Do not call it patrol, walking route, roaming or live facing.

## Required deterministic verification

Add/extend permanent tests for at least:

1. Playback OFF selects the verified static content, not moving phase 0.
2. Playback ON selects moving phase content when a verified moving projection exists.
3. Same logical time + same record -> deterministic moving phase.
4. Moving timing/loop behavior follows Game metadata.
5. Unsupported moving projection falls back safely.
6. `record_id`, entity identity, X, Y and floor remain unchanged across many moving phases.
7. No position or transform mutation is emitted by animation-only frames.
8. Animation OFF restores exact static RGBA.
9. Static/moving geometry envelope is correct.
10. DPR 1/2 CSS-pixel anchor invariants remain correct.
11. Pan/zoom/floor changes cannot leave stale creature pixels.
12. Shared labels/badges/interaction geometry remains synchronized.
13. No per-creature timers are introduced.
14. Concurrent bitmap/bucket loads remain single-flight/bounded.
15. New publication/program corruption fails closed.

Use independent expected-value or pixel oracles wherever practical.

## Required full product census

Do not prove this feature using only one NPC and one monster.

Build a complete exact-publication census that records for every resolved creature presentation:
- static projection availability;
- moving-in-place projection availability;
- moving phase count;
- whether moving phases are visually distinct;
- fixed direction identity;
- unsupported reason where applicable.

Report aggregate counts separately for NPC and monster presentations/placements.

No current count is assumed immutable. Exact execution-time census is authoritative.

## Required ordinary-creature acceptance

Explicitly inspect ordinary animals visible in normal Atlas scenes.

At minimum attempt exact-source verification for:
- Sheep;
- Pig;
- Chicken.

If authoritative Game data says one of these has a valid moving playback projection, it must visibly animate in place in the final Atlas browser product.

If one is unsupported, do not fake it. Record the exact authoritative unsupported reason and use another verified ordinary creature as an additional acceptance fixture.

These names are acceptance targets only; implementation must be generic for all supported creatures.

## Required real-browser pixel proof

Use pinned Chromium/Playwright under the current repository harness.

For at least:
- one ordinary animal/monster spawn with verified moving playback;
- one verified NPC with moving playback;
- one additional monster if the ordinary-animal fixture is not representative;

prove all of the following against the exact candidate:

1. Playback OFF -> capture deterministic creature-overlay backing-canvas RGBA for the target region.
2. Record factual world anchor/record ID/floor.
3. Enable Playback.
4. Observe at least one **actual creature pixel change** caused by moving playback.
5. Confirm world anchor/record ID/floor remain exactly unchanged.
6. Confirm the creature has not shifted into another tile.
7. Disable Playback.
8. Require exact restoration of the static creature pixels.
9. Require zero relevant page/console/request/runtime failures.

Do not use a frame counter, timer increment or `frameUpdates > 0` as sufficient proof.

The pixel oracle must isolate the creature backing canvas/target region so moving torches, fountains or other world animation cannot create a false pass.

## Required user-facing visual acceptance

Because this is a visible rendering change, execute the current #111/#118 visual-user acceptance path.

Required review should include representative desktop/mobile screenshots with:
- Playback OFF;
- Playback ON with a visibly moving-in-place creature fixture;
- mixed NPC/monster scene;
- labels/badges if currently shipped;
- no clipping/occlusion/anchor drift.

Actually open and inspect the required exact-revision screenshots/artifacts before publishing success. Do not auto-approve unseen images.

## Performance and boundedness

This feature must not turn visible creature animation into an unbounded per-frame workload.

Preserve:
- viewport culling;
- shared clock;
- bounded cache;
- content-addressed blob reuse;
- single-flight bucket/bitmap loading;
- hidden-tab behavior;
- no DOM node or timer per creature.

Run current deterministic performance/soak checks applicable to animation and creature rendering.

Do not invent new timing SLOs without a reviewed baseline. Existing structural budgets remain binding.

## Exact-head Atlas qualification

Before Atlas merge:

1. refresh/rebase onto current Atlas `main` and reconcile all overlapping creature-runtime PRs;
2. run complete applicable deterministic Node/contract/property suites;
3. run product/compiler double-build determinism and provenance checks;
4. run current full Docker Playwright exact-head PR gate on Molehill-PC through the serialized repository wrapper/lock, workers=1, retries=0;
5. run moving-in-place pixel-specific E2E on exact head;
6. run current visual-user evidence generation/review;
7. run `git diff --check`;
8. inspect the complete changed-file set and full final diff;
9. push exact final head and verify remote SHA;
10. require exact-head `atlas-gate`, `provenance-gate`, CodeQL/security and all current required creature/browser checks;
11. resolve all review threads;
12. squash merge only when all exact-head evidence is green.

Never merge based on stale earlier-head tests.

Never weaken retries, tolerances, allowlists, timeouts, provenance or security gates to obtain green status.

## Merge ordering

Required order:

1. Game #127 implementation and authoritative producer contract merge first, if Game changes are required.
2. Atlas implementation refreshes to the exact merged Game authority.
3. Atlas #145 implementation merges second.

Do not merge Atlas consumer code that depends on an unmerged Game branch.

## Live deployment boundary

Task branches must never be deployed as live Atlas.

After Atlas squash merge, record exact merged `main` SHA.

If the current trusted main-only Synology workflow is automatically triggered by the merged `main` push, monitor and verify that normal workflow and its exact-revision desktop/mobile live acceptance. Do not bypass it or manually mutate Synology.

If any additional manual/live mutation requires separate authority under the current policy, stop only that mutation and record the blocker; the protected code merge may still be complete if all repository requirements are satisfied.

## Definition of Done

The task is complete only when:

- Game authority explicitly exposes verified moving-in-place playback semantics where needed;
- Atlas consumes only merged Game authority;
- Playback OFF preserves verified static/reference creature pixels;
- Playback ON makes all supported NPC/monster presentations use their verified fixed-direction moving outfit cycle in place;
- ordinary supported animals visibly move their legs/body in the browser rather than appearing as static markers/sprites;
- factual X/Y/floor/identity never change during playback;
- no roaming/pathfinding/AI is introduced;
- unsupported moving presentations remain truthful static/idle fallbacks;
- complete product census is recorded;
- deterministic tests pass;
- exact creature pixel-change/restore browser proof passes;
- current desktop/mobile visual-user acceptance is reviewed;
- full exact-head required CI passes;
- required Game and Atlas PRs are squash-merged in correct order;
- lifecycle issues are updated/closed only when their definitions are actually met;
- completed branches are deleted according to repository policy.

## Final report

Return a compact evidence-backed closeout with:
- Game PR number, base/head/merge SHA if Game changed;
- Atlas PR number, base/head/merge SHA;
- final Game capability/product root and Atlas animation root;
- exact moving-in-place NPC/monster coverage census;
- Sheep/Pig/Chicken support result with exact reasons;
- deterministic test totals;
- Docker Playwright exact-head result;
- pixel-change + static-restore fixture identities;
- visual-review evidence;
- `game-gate`/Atlas `atlas-gate`/`provenance-gate`/security status as applicable;
- Issue #127/#145 state;
- branch cleanup state;
- exact remaining limitations.

No invented completion claims. If a material authority/dependency is missing, fail closed, record the exact blocker and leave only the affected claim incomplete.