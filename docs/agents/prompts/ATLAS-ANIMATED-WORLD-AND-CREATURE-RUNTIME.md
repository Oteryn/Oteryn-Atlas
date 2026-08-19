# Oteryn Atlas — Animated World and Creature Runtime

Alias: `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME`

Programme: full-world Atlas

Lifecycle authority: GitHub Issue #11 owns mutable programme state. This document defines the technical execution contract only.

## Goal

Add animation as an independent, optional Atlas runtime layer without changing World/Content authority or the factual NPC/monster/spawn layers.

The animation toggle controls **playback only**:

- animation layer **OFF**: the base world, visible NPCs and visible monsters render at a deterministic static reference phase;
- animation layer **ON**: only appearances with verified authoritative animation metadata play their verified phases/timing;
- NPC/monster visibility remains controlled by their own semantic layers, not by the animation toggle.

The animation layer MUST NOT simulate movement, AI, pathfinding, spawn state, combat state, facing changes or any other live server state.

## Authority boundary

1. `Oteryn-Game` remains canonical World/Content authority.
2. `Oteryn-Atlas` remains a derived semantic projection/read model.
3. Animation phases, frame order, durations and appearance/outfit mappings may be used only when exported through an accepted, pinned Game/appearance contract or another already-authorized Atlas publication contract.
4. Never infer animation timing, entity identity, creature state or mechanics from pixels, sprite numbering, filename order, legacy raster data, OTBM, Canary/Crystal sources or visual similarity.
5. Missing or incomplete animation metadata is not permission to guess. The affected appearance remains static and exposes a factual unsupported/blocker state.
6. Pixel packs remain presentation bytes, not semantic authority.

## Layer contract

Runtime layer id: `animation`

The layer is orthogonal to:

- base map composition;
- `npcs`;
- `monsters` / spawn datasets;
- POIs and other semantic overlays;
- search and inspector factual datasets.

Required behavior:

- `animation=off` is a valid complete runtime mode and must remain deterministic;
- disabling animation must not hide NPCs, monsters or animated environment objects that are otherwise enabled/visible;
- enabling animation must not create NPCs/monsters that are absent from their factual layers;
- the static reference phase must be deterministic for a pinned publication;
- animation state must not modify semantic roots, entity roots, spawn roots or base content identities;
- runtime animation/GPU placement metadata must have `identityAuthority=false`;
- if the GUI persists the toggle in a deep link, it is presentation/runtime state only and must not affect factual identity.

## Scope

### A. Animated environment

Support verified multi-phase world appearances such as water, fire, fields, lights/decorative effects and other animated map appearances **only where authoritative phase/timing metadata exists**.

When the animation layer is disabled, render the deterministic static reference phase for the same appearance.

### B. NPC appearance animation

For NPCs supplied by the factual NPC layer:

- render the same factual NPC record regardless of animation toggle;
- with animation OFF, show its deterministic static reference appearance;
- with animation ON, play only verified authoritative outfit/appearance phases and timing;
- do not synthesize walking, turning, speech, route movement or live position changes.

### C. Monster appearance animation

For monsters supplied by the factual monster/spawn layer:

- render the same factual spawn/monster record regardless of animation toggle;
- with animation OFF, show its deterministic static reference appearance;
- with animation ON, play only verified authoritative outfit/appearance phases and timing;
- do not simulate patrols, wandering, aggro, attacks, deaths, respawns or live spawn occupancy.

Static Atlas spawn data is not live creature state.

## Required upstream hand-offs

Before implementation can claim `PROVEN`, the agent must verify and pin:

1. accepted full-world publication identity;
2. authoritative appearance/outfit animation metadata source;
3. frame/phase order semantics;
4. duration/timing semantics, including any special loop/asynchronous rules that are actually exported;
5. authoritative mapping from rendered environment/NPC/monster appearances to the published pixel references;
6. stable NPC and monster/spawn layer contracts for creature overlays.

For each requirement classify `PROVEN`, `BLOCKED`, `UNKNOWN` or `N/A` with exact source revision/path/root evidence.

## Runtime design requirements

1. Use one shared deterministic animation timeline/clock model rather than per-object timers.
2. Given the same publication identity and the same logical animation time, frame selection must be deterministic.
3. Separate logical phase selection from texture/GPU placement.
4. Reuse the existing content-addressed pixel store; do not duplicate complete sprite data solely for animation.
5. Batch compatible animated draws in WebGL and avoid one draw/timer per entity.
6. Apply viewport culling so off-screen animated objects do not consume per-frame work.
7. Pause/throttle animation work when the Atlas tab is hidden and resume without corrupting logical state.
8. Keep browser memory bounded and measure CPU/GPU/frame-time impact with animation OFF versus ON.
9. The animation toggle must be independently reversible at runtime without reloading factual semantic layers where avoidable.
10. No live-state/network bridge is introduced by this task.

## Fail-closed/static fallback rules

The safe fallback for **animation capability** is static rendering, not disappearance and not guessed playback.

If an appearance lacks proven animation metadata:

- retain the verified static rendering already available for that appearance;
- mark animation support for that appearance/dataset as `BLOCKED` or `UNKNOWN` as appropriate;
- do not fabricate frame order or timing;
- do not reopen legacy runtime inputs.

If pixel or semantic identity verification fails, preserve the existing Atlas fail-closed behavior; static fallback is allowed only when the static bytes themselves are already verified and authorized.

## GUI requirements

Expose animation as its own layer/toggle in the semantic/runtime layer rail.

The control must make the distinction explicit:

- NPC layer: controls factual NPC visibility;
- Monster/spawn layer: controls factual monster/spawn visibility;
- Animation layer: controls playback of verified animated appearances for the environment and currently visible creature overlays.

The inspector should expose, where available:

- animation capability/status;
- appearance/outfit reference;
- phase count;
- timing profile identity;
- current presentation phase as runtime diagnostics, clearly non-authoritative.

Do not present runtime phase as live game/server state.

## Validation

Add deterministic automated tests for at least:

- animation OFF produces stable static reference phases across repeated renders;
- animation ON selects the same frame for the same logical time;
- phase boundaries and looping follow the verified upstream timing contract;
- disabling animation does not remove enabled NPC/monster records;
- enabling animation does not add entities absent from factual layers;
- missing/corrupt animation metadata does not trigger guessed playback or legacy fallback;
- animation state cannot change semantic/entity/spawn content identities;
- hidden/off-screen culling does not change logical frame selection when an object becomes visible again.

Real-browser/WebGL qualification must compare animation OFF versus ON over representative dense and sparse world regions and record measured:

- frame/render time;
- draw calls/batching;
- CPU usage where measurable;
- GPU/browser memory where measurable;
- visible animated primitive/creature counts;
- any throttling/culling behavior.

Do not invent performance numbers.

## Integration order

This workstream belongs after stable full-world pixel/appearance publication contracts and alongside/after stable NPC + monster/spawn layer contracts, but **before final full-world GUI qualification and programme closeout**.

Recommended programme placement: **Phase B.5**.

Dependencies:

- `ATLAS-FULLWORLD-COMPILER-PUBLICATION` for verified full-world appearance/pixel publication;
- `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` for factual NPC and monster/spawn datasets;
- `ATLAS-FULLWORLD-GUI-RUNTIME` as the consumer/integration target.

The GUI agent may prepare the toggle and runtime extension points earlier, but must not claim animated factual creatures before the required upstream contracts are proven.

## Definition of done

- a separate `animation` runtime layer/toggle exists;
- with animation OFF, environment/NPC/monster appearances remain visible and deterministic/static when their underlying factual/base layers are enabled;
- with animation ON, all supported appearances use verified authoritative phase/timing data;
- unsupported animation remains explicit and static rather than guessed;
- NPC/monster semantic visibility and identities are independent of animation playback;
- no AI, movement/pathfinding or live server state is simulated;
- WebGL batching/culling and browser resource behavior are measured at full-world scale;
- deterministic, negative and real-browser tests pass on the exact head;
- exact-head CI passes before merge-ready status;
- final evidence records pinned upstream revisions/roots, supported/unsupported counts and measured runtime impact.
