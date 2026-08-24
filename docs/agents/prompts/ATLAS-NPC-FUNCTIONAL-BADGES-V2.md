# ATLAS-NPC-FUNCTIONAL-BADGES-V2

ALIAS:
`ATLAS-NPC-FUNCTIONAL-BADGES-V2`

MODE:
Autonomous focused implementation + deterministic verification + handoff.

DO NOT STOP AT AUDIT OR PLANNING.

Parent lifecycle authority: `Oteryn/Oteryn-Atlas#115`.
Read first:
- root `AGENTS.md`;
- `docs/agents/prompts/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/tasks/active/ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md`;
- `docs/agents/prompts/ATLAS-CREATURE-PRESENTATION-PARALLEL-AGENT-SUITE.md`.

## Mission

Implement the generic truthful **`functional-icons-v2` NPC badge model** for every published NPC, including bounded multi-role selection and original Oteryn integer-grid pixel primitives. This worker does not wire badges into the shared creature Canvas; the integration coordinator owns runtime fan-in.

Albinius and Eremo are acceptance fixtures only. Never hard-code their names, IDs, positions or role lists in production code.

Oteryn-Game remains authoritative for role facts. Do not mutate Game data, infer new roles or rewrite canonical role ordering.

## Mandatory preflight

1. Refresh GitHub and resolve exact current `main`.
2. Read current Issue #115, Issue #64, merged PR #83 context, `src/browser/npc-markers.mjs`, `tests/npc-markers.mjs`, and role projection tests.
3. Revalidate the current role schema/order from code rather than copying stale planning assumptions.
4. Create an isolated branch/worktree from refreshed `main`, recommended `work/115-npc-functional-badges-v2`.
5. Record starting SHA in handoff.

## Owned files

Preferred:
- modify `src/browser/npc-markers.mjs` only for pure role/badge slot selection helpers;
- create `src/browser/npc-badge-primitives.mjs` for repository-owned integer-grid badge definitions/render-command generation;
- modify `tests/npc-markers.mjs`;
- create `tests/npc-badge-primitives.mjs`.

Keep changes narrow and pure. Do not wire Canvas layers here.

## Forbidden shared edits

Do NOT modify:
- `web/fullworld-creatures.mjs`;
- `web/fullworld-app.mjs`;
- `web/fullworld.css`;
- `src/browser/creature-render-diagnostics.mjs`;
- `src/layers/minimap-lod.mjs`;
- geometry/layout files owned by another worker;
- any Oteryn-Game file.

## Required role semantics

Preserve the canonical role order from `npc-markers.mjs`:
`bank`, `travel`, `shop`, `quest`, `blessing`, `trainer`.

Add a pure helper equivalent to `npcBadgeSlots(record, activeFilter = 'all', maxSlots = 3)` returning immutable bounded descriptors.

Required behavior:
- no supported factual roles -> one neutral `other`/`npc` slot;
- 1 factual role -> show it;
- 2 factual roles -> show both in canonical order;
- 3 factual roles -> show all three in canonical order;
- >3 factual roles -> maximum three visual slots, normally first two factual roles plus overflow `+N`;
- if active factual `npcRole` filter belongs to the NPC and would otherwise be hidden, show first canonical factual role + active factual role + overflow `+N`;
- filtering MUST NOT rewrite or reorder the record's canonical factual role list;
- overflow count equals exactly the number of factual roles not shown as explicit role slots;
- `other` is presentation fallback only when factual supported roles are absent/ambiguous according to existing semantics.

Keep existing `npcRoleGlyph()` behavior compatible unless the new helper can reuse it without changing public semantics.

## Required pixel-grid badge primitives

Provide original repository-owned primitives for:
- bank -> coin/stacked coin;
- travel -> compass/direction;
- shop -> bag/pouch;
- quest -> scroll/exclamation;
- blessing -> star/halo;
- trainer -> book/training;
- other -> neutral NPC fallback.

Use integer-grid cells/commands suitable for `fillRect`/nearest-neighbor Canvas drawing. The production primitive model must not depend on emoji, copied Tibia/CipSoft art, SVG icon packs, anti-aliased arcs or external image assets.

A preferred pure representation is an immutable list of integer cells or rectangles, e.g. `{ x, y, width, height, tone }`, where all geometry values are safe integers within a documented small grid. The integrator will map semantic tones to final Atlas colors.

Overflow `+N` is not a fake role. Represent it as a separate overflow descriptor containing the exact hidden count so the integrator can draw compact text in the third slot.

## Mandatory TDD

Use strict RED -> GREEN -> REFACTOR. Capture the expected RED failure before production implementation.

Required tests:
- canonical role order remains unchanged;
- 0-role/ambiguous NPC -> neutral fallback;
- 1 role -> one role slot;
- 2 roles -> two slots;
- 3 roles -> three slots;
- 4 roles -> first two + `+2`;
- 5 roles -> first two + `+3`;
- filtered factual role already visible -> no unnecessary reorder;
- filtered factual role hidden by overflow -> first canonical + active filtered + exact `+N`;
- invalid/unsupported metadata continues to obey existing validation semantics;
- returned descriptors are immutable or treated as immutable according to repository conventions;
- every role primitive uses integer-grid geometry only;
- every primitive stays inside its declared grid;
- no primitive requires external/copied artwork;
- overflow descriptor cannot be confused with a factual role.

Use generic synthetic role shapes in deterministic unit tests. Named real NPCs belong only in integration/browser acceptance.

## Verification

Run the focused marker and primitive tests plus existing role/index tests affected by the helper. Preserve all pre-existing role-filter semantics.

Do not run/publish the full Molehill browser gate; the integration coordinator owns final visual qualification.

## Handoff

Push the worker branch. Do not open a PR to `main` and do not merge anything.

Return:
- starting `main` SHA;
- branch and final commit SHA;
- changed files;
- RED command/failure summary;
- GREEN commands/pass counts;
- exact exported slot/primitive APIs;
- compatibility notes for existing `npcRoleGlyph`/filters;
- integration instructions for Canvas drawing;
- explicit confirmation of no named-NPC production exceptions, no role inference and no Oteryn-Game mutation.