# ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX

ALIAS:
`ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX`

MODE:
Autonomous implementation + verification + integration + closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement and fully verify the creature label and NPC role badge redesign defined by Issue #115 and the active design packet:

`docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`

## Repositories

Primary repository:
`https://github.com/Oteryn/Oteryn-Atlas`

Canonical Game/World authority:
`https://github.com/Oteryn/Oteryn-Game`

Oteryn-Game is authoritative for creature identity, placement, outfit/presentation facts and NPC role semantics. Atlas is presentation/read-model code and must not invent new Game-owned facts.

## Mandatory preflight

Before any mutation:

1. Refresh `Oteryn/Oteryn-Atlas` and inspect current `main`.
2. Read root `AGENTS.md` and any nearer instructions for touched paths.
3. Read Issue #115 in full.
4. Read:
   - `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`
   - `src/browser/npc-markers.mjs`
   - `web/fullworld-creatures.mjs`
   - applicable creature/NPC tests and Playwright specs.
5. Refresh open PRs/issues that overlap creature rendering, especially #113, #111 and #85.
6. If #113 has landed, build on its canonical hit-test/selection/render snapshot API instead of duplicating it.
7. Record the exact starting `main` SHA in the implementation PR.

## Work boundary

Use Issue #115 as lifecycle authority.

Work on one dedicated branch from refreshed `main` and open one PR. Do not push ordinary implementation directly to `main`.

This is a presentation-layer redesign. Preserve factual creature world coordinates, floors, identity, role semantics, animation data and Game->Atlas authority boundaries.

## Required implementation

### A. Dedicated creature label system

Replace the current direct raw canvas `fillText(record.name, ...)` path with a reusable label renderer.

The label renderer must provide:
- compact translucent high-contrast background;
- restrained 1 px border/outline and shadow;
- crisp text under device pixel ratio scaling;
- deterministic screen-space placement relative to committed creature presentation bounds;
- distinct but subtle NPC vs monster accents;
- bounded size and clipping behavior;
- no DOM node per creature.

Do not use huge opaque panels. The map must remain the visual focus.

### B. Scale-aware LOD

Implement named deterministic LOD helpers rather than scattering magic zoom checks.

Required behavior:
- far zoom: no full name labels; only bounded essential marker presentation;
- medium zoom: selective readable names with reduced badge detail;
- close zoom: full names and richer NPC badge presentation;
- selected/hovered creature may receive deterministic promotion when canonical interaction state exists.

Tune thresholds from real-browser evidence. Do not claim a threshold is correct until visual acceptance supports it.

### C. NPC multi-role badge system

Preserve the canonical role order from `src/browser/npc-markers.mjs`.

Support the currently authoritative roles:
- bank;
- travel;
- shop;
- quest;
- blessing;
- trainer;
- neutral/other fallback only when authoritative role metadata does not resolve to a supported role.

Implement original Oteryn-designed role icon primitives. Do not use emoji and do not copy Tibia/CipSoft art.

Multi-role presentation:
- represent multiple authoritative roles instead of collapsing the NPC to one role;
- render at most 3 visible role badges;
- for more than 3 roles, render first 2 plus a deterministic `+N` overflow badge;
- filtering must never rewrite the underlying canonical role list.

### D. Collision and placement

Implement deterministic bounded collision handling for visible label/badge rectangles.

Priority:
1. selected creature;
2. hovered creature;
3. NPC label;
4. monster label;
5. secondary badge information.

The creature sprite/world anchor must never be moved to solve label overlap.

Use a small deterministic set of alternate label anchors. If no acceptable location is available, suppress the lower-priority label instead of overlapping everything.

The collision pass must operate only on the visible bounded creature set and must remain performant.

### E. Renderer observability

Extend truthful read-only diagnostics only as needed to prove:
- number of labels considered/drawn/suppressed;
- NPC role badges drawn;
- selected LOD level;
- committed transform linkage;
- label/badge geometry for deterministic tests.

Do not introduce test-only mutation authority.

### F. Interaction compatibility

Coordinate with Issue #113.

If #113 is merged or active with a stable API:
- consume its hover/selection state;
- preserve its screen-space hit target semantics;
- do not create a second competing selection/deep-link model.

If #113 is not merged:
- keep this work presentation-only and structure helpers so #113 can consume label/creature bounds later.

## TDD and verification requirements

Follow the repository's verification policy under #85.

Before implementation logic, add failing deterministic tests for:
- LOD classification;
- canonical role ordering;
- multi-role badge selection;
- overflow `+N` behavior;
- unknown/ambiguous role fallback;
- label geometry;
- deterministic alternate anchors;
- collision priority and suppression;
- DPR-independent CSS-pixel geometry invariants.

After implementation, run all applicable repository tests plus real Chromium acceptance.

Real-browser acceptance must cover at minimum:
- desktop: mixed NPC + monster scene;
- desktop: multiple nearby NPCs;
- a verified multi-role NPC;
- dense creature scene;
- far/medium/close zoom transitions;
- pan and zoom while labels remain aligned;
- floor change;
- animation on/off;
- NPC filtering;
- mobile viewport readability and control non-occlusion;
- no console/page errors.

Capture user-facing screenshot evidence at representative states under the #111/#85 visual acceptance approach when that infrastructure is available on current `main`.

Do not fabricate Game facts or fake production content for screenshots.

## Acceptance quality bar

The result must look like a finished game-atlas UI rather than a diagnostic overlay.

Names must remain readable against both light and dark map tiles without dominating the scene.

NPC role icons must communicate their function at a glance, stay visually coherent with the pixel-art world, and remain smaller/less visually dominant than the NPC sprite itself.

Dense scenes must degrade gracefully through LOD/collision suppression instead of becoming a wall of text and icons.

## Required checks before merge

1. Review complete changed-file set.
2. Review full diff on exact final head.
3. Run targeted and full applicable deterministic tests.
4. Run applicable Dockerized Playwright Chromium suite with retries disabled.
5. Review generated visual evidence, not only test exit codes.
6. Push branch and open PR referencing #115.
7. Wait for and verify exact-head required CI including `atlas-gate` and `provenance-gate`.
8. Resolve all review threads and refresh from `main` if overlapping creature work lands.
9. Squash merge only after the exact final head is green and reviewed.
10. Delete the completed task branch.
11. Close Issue #115 only when merged-main state satisfies the definition of done.

## Final report

Report FACT / INFERENCE / UNKNOWN separately.

Include:
- starting base SHA;
- final branch head SHA;
- PR number and URL;
- squash merge SHA;
- exact tests run and results;
- exact CI run/check results;
- visual acceptance evidence reviewed;
- whether #113 integration was required;
- whether live deployment/acceptance was performed or remains outside scope.

Do not claim completion before all required verification and merge conditions are directly confirmed.