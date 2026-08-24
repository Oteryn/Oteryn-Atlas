# ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#115`.
Canonical implementation contract: `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`.
Active task packet: `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`.
Planning baseline for this suite: `main@2d2775c7d834258be0baad5cc19d5366cd6bab58`.

The SHA above is provenance only. Every worker MUST refresh GitHub and start from the exact current `main` SHA at execution time.

## Scope

This suite implements one generic creature-presentation system for **every published NPC and monster** in Atlas. Named creatures such as Albinius and Eremo are acceptance fixtures only. Production code MUST NOT contain creature-specific branches, role exceptions, coordinates, names or IDs.

Oteryn-Game remains canonical World/Content authority. Workers may read Game-derived publication data but MUST NOT mutate Oteryn-Game or invent Game-owned creature facts.

Issue #113 currently remains separate interaction work. Unless #113 has merged before a worker starts, #115 stays presentation-only and exposes reusable geometry without adding click/tap/hover/card ownership.

## Parallel workers

Run these four workers concurrently from separate branches/worktrees:

- `ATLAS-CREATURE-PRESENTATION-GEOMETRY-LAYOUT` — **XHigh** — canonical CSS-pixel bounds, label geometry, ellipsis, collision, reserved-rect solver and animation-independent layout key.
- `ATLAS-NPC-FUNCTIONAL-BADGES-V2` — **High** — truthful multi-role selection and original integer-grid badge primitives for every NPC.
- `ATLAS-CREATURE-PRESENTATION-LOD` — **High** — mode/effective-representation aware creature label/badge policy without duplicating AUTO thresholds.
- `ATLAS-CREATURE-PRESENTATION-VERIFICATION` — **High** — independent RED browser/diagnostic acceptance contracts and real-data scenario fixtures; no runtime implementation.

After all four workers finish, run:

- `ATLAS-CREATURE-PRESENTATION-INTEGRATOR` — **XHigh** — review worker commits, integrate on the single #115 implementation branch, own shared runtime files, make all contracts green, execute exact-head verification, open the only implementation PR to `main`, and squash merge when protected gates pass.

## Isolation and ownership

Each worker MUST use its own branch/worktree and MUST NOT share a writable workspace. Worker branches are handoff branches, not PRs to `main`; the integrator owns the single implementation PR required by #115.

Workers A/B/C own only their focused pure modules and tests. They MUST NOT edit shared runtime integration files such as `web/fullworld-creatures.mjs`, `web/fullworld-app.mjs`, `web/fullworld.css` or `src/browser/creature-render-diagnostics.mjs`. Worker D owns verification files only and MUST NOT implement runtime code.

If a worker discovers that its contract requires a shared-runtime change, it records the exact requested integration change in its handoff instead of editing the shared file.

## TDD and handoff law

Production-code workers MUST use RED -> GREEN -> REFACTOR and preserve terminal evidence of the expected RED failure before implementation. Verification worker intentionally contributes independent RED acceptance contracts. No agent may hard-code a named creature merely to make an acceptance case pass.

Every worker handoff must include:

1. exact starting `main` SHA;
2. branch name and final commit SHA;
3. changed-file list;
4. RED command/output summary;
5. GREEN command/output summary where the worker owns production code;
6. any integration assumptions or shared-file requests;
7. explicit confirmation that no Oteryn-Game files or Game-owned facts were changed.

## Fan-in rules

The integrator reviews diffs before consuming any worker commit. Do not trust a worker's success claim without rerunning its tests. Integrate geometry first, badges second, LOD third, then verification contracts; resolve shared runtime wiring only on the integration branch.

The final implementation must preserve `drawnNpcIcons` compatibility semantics, expose versioned `creature-labels-v1` / `functional-icons-v2` diagnostics, keep presentation geometry in CSS pixels across DPR 1/2, and prove that logical animation time alone does not churn label layout generation.

No production/live deployment is authorized by this suite. Deployment remains governed by the repository's explicit deployment policy and separate owner authorization.