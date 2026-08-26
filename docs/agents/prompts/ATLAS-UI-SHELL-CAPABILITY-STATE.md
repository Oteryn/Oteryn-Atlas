# ATLAS-UI-SHELL-CAPABILITY-STATE

ALIAS:
`ATLAS-UI-SHELL-CAPABILITY-STATE`

MODE:
Autonomous isolated implementation worker — Production UI Shell V1 Lane A.

## Mission

Implement only the Product Shell capability registry and top-level shell-state domain assigned to Lane A of `ATLAS-PRODUCTION-UI-SHELL-V1`.

This worker does not compose shared FullWorld HTML/CSS, does not implement other lanes, does not open or merge a PR to protected `main`, and does not mutate Oteryn-Game.

## Required authority

Before mutation, resolve from GitHub:

1. current protected `Oteryn/Oteryn-Atlas` `main` and `AGENTS.md`;
2. parent programme #185 and current implementation Issue referenced by the active task packet;
3. coordinator branch `feat/atlas-production-ui-shell-v1` and `docs/agents/tasks/active/ATLAS-PRODUCTION-UI-SHELL-V1.md` on that branch;
4. the merged current-main design and plan:
   - `docs/superpowers/specs/2026-08-26-atlas-production-ui-shell-v1-design.md`
   - `docs/superpowers/plans/2026-08-26-atlas-production-ui-shell-v1.md`;
5. current #162/#170 state only to confirm the coordinator has already opened the implementation gate.

If the active task packet is absent, the implementation Issue is absent, the worker branch is absent, the packet does not assign Lane A to this alias, or the dependency gate is not open, return `WAITING_COORDINATOR` and make no mutation.

## Authorized branch and paths

Use only the exact Lane A worker branch named by the active task packet. Expected branch:

`work/atlas-ui-shell-capability-state`

Authorized mutable paths:
- `src/browser/product-capabilities.mjs`
- `src/browser/product-shell-state.mjs`
- `tests/product-capabilities.mjs`
- `tests/product-shell-state.mjs`

Forbidden unless the coordinator updates the task packet with explicit ownership transfer:
- `web/fullworld.html`
- `web/fullworld.css`
- `web/style.css`
- `web/fullworld-app.mjs`
- `web/fullworld-mobile.mjs`
- every other lane-owned file
- shared E2E orchestration/visual manifests

One mutable path has one active owner. Do not opportunistically fix unrelated files.

## Stable public interfaces

Implement exactly these exported interfaces unless the coordinator records an approved interface revision in the task packet:

```js
export function buildProductCapabilities(input) {}
export function capabilityAvailable(capabilities, id) {}
export function parseProductShellState(search, capabilities) {}
export function serializeProductShellState(state, search) {}
export function resolveProductContext({ search, capabilities }) {}
```

V1 capability IDs:

`world`, `creatures`, `npcs`, `farm`, `creatureGameplay`, `hunts`, `liveState`, `developer`.

Capability states:

`loading`, `available`, `partial`, `unavailable`, `error`.

Presentation trust classes where relevant:

`verified`, `measured`, `estimate`, `unknown`.

The only new top-level shell query parameter is:

`product=world|creatures|npcs|farm|hunts`.

## Required semantics

- Missing/invalid capability evidence fails closed.
- `world` reflects validated FullWorld readiness only.
- `creatures`/`npcs` depend on validated creature/search readiness supplied by existing runtime seams.
- `farm` is `partial` when truthful custom-kill estimation is available while accepted item/task facts are unavailable.
- `creatureGameplay` is available only from the validated merged gameplay product.
- `hunts` stays unavailable without an accepted Hunt product.
- `liveState` stays unavailable without genuine live authority.
- `developer` is a read-only shell capability, not alternate runtime authority.
- Normal-user reasons must not mention GitHub Issue/PR numbers, compiler generations or internal blockers.
- Pure capability code does not parse low-level Game/publication files itself; coordinator wiring supplies validated readiness snapshots.
- `creature=` remains concrete creature-selection authority.
- merged `inspector=` remains inspector-mode authority.
- existing Farm query state remains Farm authority.
- `creature=` with no explicit `product=` resolves to a compatible creature context.
- active Farm state with no explicit `product=` resolves to Farm context.
- unavailable requested products fall back to World.
- unrelated existing query parameters survive serialization.
- back/forward/reload state must be deterministic.

## TDD execution

Use RED → GREEN → REFACTOR.

1. Write/activate `tests/product-capabilities.mjs` first.
2. Observe RED from missing behavior, not fixture/syntax failure.
3. Implement the minimal immutable capability mapping.
4. Write/activate `tests/product-shell-state.mjs`.
5. Observe RED.
6. Implement parse/serialize/context resolution without rewriting domain-owned params.
7. Run:

```text
node --test tests/product-capabilities.mjs tests/product-shell-state.mjs
```

8. Run any current-main adjacent state/query tests selected by the implementation plan or CI when they are relevant and do not require shared-file mutation.

Do not weaken tests, add sleeps/retries, or invent capability evidence.

## Completion handoff

Commit and push only to the authorized worker branch. Verify remote head equals the intended commit.

Return exactly:
- `lane: A`
- admission/main SHA from the task packet
- implementation Issue number
- worker branch
- exact worker head SHA
- exact changed-file list
- exported interface signatures
- RED command/result
- GREEN command/result
- any additional tests/results
- unresolved risks/blockers
- explicit confirmation that no forbidden path was edited

Do not merge to coordinator branch or protected `main`. The integrator owns review and integration.