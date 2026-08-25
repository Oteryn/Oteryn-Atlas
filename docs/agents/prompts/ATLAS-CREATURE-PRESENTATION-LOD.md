# ATLAS-CREATURE-PRESENTATION-LOD

ALIAS:
`ATLAS-CREATURE-PRESENTATION-LOD`

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

Implement a pure, generic **creature presentation LOD policy** for all published NPCs and monsters. The policy must consume the product's canonical effective FullWorld representation rather than recreating AUTO/minimap transition logic inside the creature subsystem.

Do not wire runtime events or Canvas layers here. The integration coordinator owns shared runtime changes.

## Mandatory preflight

1. Refresh GitHub and resolve exact current `main`.
2. Read Issue #115 and current `src/layers/minimap-lod.mjs`, especially `lodBlend()` and `LOD_POLICY`.
3. Read current FullWorld view publication in `web/fullworld-app.mjs` and creature drawing code only to understand inputs; do not edit them.
4. Recheck Issue #113. Hover promotion is allowed only if #113 has merged a canonical hover state before integration; this module may accept an optional `hovered` input but must not create hover ownership.
5. Create an isolated branch/worktree from refreshed `main`, recommended `work/115-creature-presentation-lod`.
6. Record starting SHA in handoff.

## Owned files

Preferred:
- create `src/browser/creature-presentation-lod.mjs`;
- create `tests/creature-presentation-lod.mjs`.

Do not modify the canonical minimap LOD module. This worker consumes its effective output contract.

## Forbidden shared edits

Do NOT modify:
- `src/layers/minimap-lod.mjs`;
- `web/fullworld-app.mjs`;
- `web/fullworld-creatures.mjs`;
- `web/fullworld.css`;
- `src/browser/creature-render-diagnostics.mjs`;
- geometry or NPC badge modules owned by other workers;
- any Oteryn-Game file.

## Required policy contract

Provide a pure immutable helper equivalent to:

```js
creaturePresentationLod({
  mode,
  effectiveRepresentation,
  zoom,
  overview,
  selected,
  hovered,
  kind,
})
```

The helper may return a named policy object such as:

```js
{
  tier: 'hidden' | 'sparse' | 'far' | 'medium' | 'close' | 'promoted',
  showLabel: boolean,
  showPrimaryBadges: boolean,
  showSecondaryBadges: boolean,
  maxLabelWidth: number,
}
```

Names may differ if repository conventions suggest better ones, but semantics must remain explicit and testable.

## Canonical-mode rules

- forced `minimap`: sparse annotation class; ordinary full creature labels suppressed;
- forced `classic`: same sparse annotation class as minimap;
- `map`: normal detail presentation with deterministic far/medium/close label tiers;
- `auto`: determine sparse/detail behavior from the **effective representation produced by canonical FullWorld LOD**, not by copying `LOD_POLICY` transition thresholds into this module;
- `minimap-fallback` and transition states must be treated truthfully from the supplied effective representation;
- technical overview suppresses ordinary annotation density so the map cannot become a wall of labels;
- selected creature may receive bounded promotion even when ordinary labels are suppressed;
- hovered creature may receive bounded promotion only when the integrator supplies a canonical #113 hover state;
- NPCs may receive slightly stronger annotation than monsters at the same tier, but this is presentation priority only and must not imply gameplay importance/difficulty;
- no behavior may depend on a creature name, ID, location or inferred gameplay fact.

## AUTO threshold prohibition

Do not duplicate `LOD_POLICY.detailZoom`, `LOD_POLICY.minimapZoom`, stream enter/exit thresholds or equivalent hidden numeric copies to decide whether AUTO is minimap/detail. The caller must provide canonical effective representation from `lodBlend()` or an equivalent current-main product seam.

Zoom may still be used for **within-detail** far/medium/close presentation tuning. Keep those constants named and local to creature presentation, and make them deterministic under tests. The integration coordinator may tune final values using Chromium evidence before final merge.

## Mandatory TDD

Use strict RED -> GREEN -> REFACTOR and capture the expected RED failure before production implementation.

Required deterministic tests:
- forced minimap suppresses ordinary labels;
- forced classic matches sparse minimap class;
- forced map supports far/medium/close detail tiers;
- auto + effective minimap stays sparse even if a tempting duplicated zoom threshold would say otherwise;
- auto + effective detail/transition permits the correct bounded detail tier;
- overview suppresses ordinary label density;
- selected promotion overrides ordinary suppression in a bounded way;
- optional hovered promotion works only through the explicit input;
- selected has precedence over hovered;
- NPC vs monster policy differences are limited to presentation flags/priority and never gameplay facts;
- invalid mode/effective representation inputs fail deterministically according to repository conventions;
- no test requires a named real creature.

Add a source-contract test if useful to prove this module does not import or duplicate the canonical AUTO threshold values.

## Verification

Run the focused tests and any existing minimap LOD tests affected by imports. The branch must be green for all behavior this worker owns.

Do not run/publish the full Molehill browser gate; final real-browser tuning and exact-head verification belong to the integrator.

## Handoff

Push the worker branch. Do not open a PR to `main` and do not merge anything.

Return:
- starting `main` SHA;
- branch/final commit SHA;
- changed files;
- RED and GREEN commands/results;
- exported policy API and exact tier semantics;
- named within-detail constants requiring browser tuning, if any;
- exact shared-runtime signal the integrator must expose from canonical `lodBlend()`;
- explicit confirmation that no AUTO threshold duplication, named-creature exception or Oteryn-Game mutation was introduced.