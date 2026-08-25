# Oteryn Atlas — Creature Gameplay Profiles

Alias: `ATLAS-CREATURE-GAMEPLAY-PROFILES`

MODE: Autonomous **cross-repository** implementation + TDD + audit + verification + protected merge + merged-main live acceptance + terminal closeout.

DO NOT STOP AT AUDIT OR PLANNING.

Your task is to implement the complete owner-approved Creature Gameplay Profiles programme across `Oteryn/Oteryn-Game` and `Oteryn/Oteryn-Atlas` so that selecting a real NPC or monster in FullWorld opens a useful player-facing Gameplay inspector while preserving the existing Semantic/provenance inspector.

The task is not complete when a DOM tab exists, when synthetic fixtures pass, when a quick card opens, when a Game exporter exists, or when pre-merge Playwright is green. It is complete only after the Game producer and Atlas consumer are merged through their protected lifecycles and merged-main Atlas live acceptance physically verifies real NPC trade and monster loot content in Chromium.

## Mandatory source documents

Read these before changing any product file:

1. `Oteryn/Oteryn-Atlas/docs/superpowers/specs/2026-08-25-atlas-creature-gameplay-profiles-design.md`
2. `Oteryn/Oteryn-Atlas/docs/superpowers/plans/2026-08-25-atlas-creature-gameplay-profiles.md`
3. `Oteryn/Oteryn-Atlas#159`
4. `Oteryn/Oteryn-Atlas/docs/agents/prompts/ATLAS-CREATURE-INTERACTION-CARDS.md`
5. `Oteryn/Oteryn-Atlas#114` — Item & Spawn Farm Explorer coordination
6. `Oteryn/Oteryn-Atlas#117` — Hunt Intelligence coordination
7. `Oteryn/Oteryn-Game/docs/contracts/OTERYN_GAME_ATLAS_EXPORT_CONTRACT_V1.md`
8. `Oteryn/Oteryn-Game/docs/contracts/OTERYN_GAME_PLATFORM_CATALOG_EXPORT_V1.md` for capability/completeness vocabulary only; Platform is not an Atlas runtime data source
9. `Oteryn/Oteryn-Game/tools/game-atlas-creatures/export.py`
10. root and every applicable nearer `AGENTS.md` in both repositories.

Design-time SHAs in the spec/issue are historical evidence only. Refresh GitHub authority before every mutation phase.

## Repositories

### Canonical Game/World/Content authority — writable for this programme

`https://github.com/Oteryn/Oteryn-Game`

Game owns the public gameplay-profile semantics and producer. This programme MAY modify Game only for the versioned public Game→Atlas export/read-model required by this feature. It MUST NOT change actual gameplay runtime behavior merely to make Atlas data easier to show.

### Atlas consumer/UI — writable

`https://github.com/Oteryn/Oteryn-Atlas`

Atlas owns bounded consumption, presentation, interaction, browser verification, publication, and live acceptance. Atlas is never allowed to reconstruct missing Game facts from legacy/reference/runtime sources.

## Product outcome

Deliver one coherent inspector experience:

```text
Gameplay | Semantic | Live state
```

`Gameplay` is the default tab for a selected creature.

`Semantic` remains the current technical/provenance view and must preserve its existing verified information: selected creature name/type, stable/public entity identity where present, placement record ID, position, origin, spawn area, resolution, presentation, authority, semantic digest, role resolution, and other current factual rows.

`Live state` remains reserved for genuinely dynamic future data. Do not put static shop, loot, combat, or placement facts there.

### NPC Gameplay

For a real selected NPC, show truthful sections when Game proves them:

- **Sells** — item, verified icon when available, unit price, currency, amount/pack semantics when proven;
- **Buys** — same normalized semantics;
- **Services** — bounded public taxonomy such as shop, bank, blessing, trainer, travel, quest;
- **Travel** — destination, price/currency and bounded conditions only when statically proven;
- **Locations** — derived from existing verified placement records, never from duplicated profile geometry.

### Monster Gameplay

For a real selected monster, show truthful sections when Game proves them:

- **Loot** — item, verified icon when available, integer-backed chance, min/max count;
- **Stats** — health, experience, armor/defense, speed only where source semantics are explicit;
- **Resistances / Immunities** — explicit Game facts only;
- **Spawns** — existing Atlas placement records joined by creature entity identity.

Quick card remains lightweight. It may show a bounded verified summary such as `Shop · 34 sells · 21 buys` or `Loot · 17 entries`, but profile loading must never delay or break direct creature activation.

`Details` opens `inspector=gameplay`.

## Hard authority boundary

### Game owns facts

Game is the only authority for:

- creature gameplay profile semantic contract;
- public-field allowlist;
- creature entity identity;
- referenced item identity exposed to Atlas;
- NPC offers/services/travel semantics;
- monster loot/stats/resistance semantics;
- completeness and uncertainty state;
- deterministic producer behavior;
- exact source evidence provenance;
- product digest and immutable artifact identity.

### Atlas owns projection and presentation

Atlas may derive only:

- entity -> gameplay profile lookup indexes/cache;
- item row display state;
- integer chance -> human-readable percentage formatting;
- entity -> existing placement joins;
- bounded counts/summaries;
- UI sorting/filtering/windowing;
- URL/deep-link state.

### Never use as Atlas runtime authority

- Platform catalogue/API/database;
- OTBM;
- Canary/Crystal XML or Lua;
- browser-side source parsing;
- wikis/fansites;
- filenames/comments;
- display-name-only entity joins;
- image/sprite similarity;
- live GameNode memory;
- generated mock values.

Do not "repair" missing data to make the UI look complete.

## Game producer contract

Implement a Game-owned capability:

```text
creature-gameplay-profiles-v1
profile_schema_version = 1
```

Use the same stable creature `entity_id` seam as the existing placement/animated creature product. Factor the identity helper if necessary, with regressions proving existing placement IDs do not change.

The product must contain deterministic, bounded, content-digested manifest/shards and a deduplicated minimal referenced-item table.

NPC profile families:

```text
shop.state
shop.sells[]
shop.buys[]
services.state
services.values[]
travel.state
travel.destinations[]
```

Monster profile families:

```text
loot.state
loot.entries[]
stats.state
stats.health / experience / armor / defense / speed
resistances.state
resistances.elements[]
resistances.immunities[]
```

Loot probability is stored as integer parts-per-million:

```text
chance_ppm ∈ [0, 1_000_000]
```

Do not store floating-point probability authority.

## Completeness semantics

Use the closed first-version vocabulary:

```text
COMPLETE
PARTIAL
UNRESOLVED
AMBIGUOUS
UNKNOWN
NOT_APPLICABLE
```

An empty list proves absence only under `COMPLETE`.

Examples:

- `COMPLETE + sells=[]` -> Atlas may say the NPC sells no items under this profile.
- `UNKNOWN + sells=[]` -> Atlas must say shop data is not published/known.
- `PARTIAL + loot entries` -> show proven entries plus a visible partial-data notice.

Unsupported syntax must never be silently omitted while the section remains `COMPLETE`.

Reason codes are bounded and producer-owned. Atlas maps known codes to concise copy but does not infer semantics from unknown codes.

## Legacy/reference evidence boundary

Current Game tooling already normalizes migration/reference Crystal data inside a Game-owned importer/exporter boundary. Extend that pattern; do not move it into Atlas.

The initial gameplay extractor is static and fail closed. It may normalize explicitly supported static configuration shapes such as literal shop offers, static travel destinations, literal monster loot, numeric stats/elements/immunities.

It MUST NOT:

- execute Lua;
- `eval` source expressions;
- boot a game server to introspect behavior;
- run arbitrary callbacks;
- infer values from comments/file names;
- treat unsupported dynamic code as absent.

Computed/dynamic/unknown constructs make the affected section `PARTIAL`, `UNRESOLVED`, `AMBIGUOUS`, or `UNKNOWN`.

## Item identity and icons

Do not join items by display name in Atlas.

Game publishes a minimal referenced-item record for every item used by supported shop/loot facts. A resolved record may carry a publication-safe appearance reference only when existing Game/Atlas asset rights and provenance permit it.

If item identity is unresolved, preserve truthful display label and uncertainty but set no authoritative click-through identity. Atlas renders text and no fake item link.

Verified item icons are part of the target UX when a valid existing publication reference is available. Lack of a proven icon must not cause the row itself to disappear.

## Inspector state and deep links

Durable state:

```text
creature=<placement-record-id>
inspector=gameplay|semantic|live
```

Unknown inspector values fall back to Gameplay. `live` falls back to Gameplay while live authority is unavailable.

Reload/back-forward must preserve selected creature and inspector tab.

Gameplay profile loading is asynchronous. Opening the inspector must not wait for the complete product universe to load.

## Performance and boundedness

Do not preload every gameplay profile in the browser.

Game must measure real product census and freeze hard limits with documented safety margin. Atlas must enforce its own consumer bounds.

At minimum bound:

- manifest bytes;
- shard bytes;
- profiles per shard;
- referenced items;
- strings/nesting;
- shop rows per profile;
- loot rows per profile;
- travel destinations;
- resistance/immunity entries;
- browser cache shard count/bytes.

Large shops/loot tables must use bounded windowing/search/expansion rather than blindly creating thousands of DOM rows.

## Mandatory coordination

### #114 Item & Spawn Farm Explorer

This programme owns the Game-published creature gameplay facts needed for NPC shops and monster loot. #114 may consume the merged item/loot identity and relation primitives. Do not create a second incompatible creature->loot truth model inside Atlas.

### #117 Hunt Intelligence

This programme owns static creature facts only. Hunt Intelligence may later combine monster facts/placements with measured Game Intelligence aggregates, but this task must not introduce XP/h, profit/h, party multipliers, recommendations, or telemetry into the static gameplay profile.

## Required execution order

Follow the implementation plan task-by-task unless refreshed repository state proves a step unsafe.

### Phase A — Game lifecycle and producer

1. Refresh exact Game `main`, branch protection, issues/PRs, and overlapping work.
2. Create one dedicated Game implementation issue.
3. Create one dedicated Game branch from exact current main.
4. TDD the shared creature entity identity seam without changing existing placement IDs.
5. Add `OTERYN_GAME_ATLAS_CREATURE_GAMEPLAY_PROFILES_V1.md`.
6. TDD static NPC shop/services/travel extraction.
7. TDD static monster loot/stats/resistance extraction.
8. Add explicit complete/partial/unknown behavior and closed reason codes.
9. Add referenced-item normalization without name-based canonical repair.
10. Add deterministic manifest/shards, semantic digest, hard bounds, corruption checks.
11. Measure real evidence census; document actual supported coverage and unsupported dynamic shapes.
12. Add dedicated Game CI/workflow and run all current governance/tests.
13. Perform independent audit.
14. Push one Game PR, resolve review findings with regressions, require green CI, squash merge.
15. Record exact merged Game SHA and gameplay product digest.

Do not start final Atlas integration against an unmerged Game candidate.

### Phase B — Atlas consumer and UX

1. Refresh exact Atlas `main` and overlapping work after Game merge.
2. Create/continue one dedicated Atlas implementation issue and branch.
3. Pin exact merged Game producer SHA/digest through existing provenance/publication rules.
4. TDD `src/browser/creature-gameplay-profiles.mjs` bounded lazy loader.
5. TDD pure inspector tab state and `inspector=` URL semantics.
6. TDD gameplay display model for complete/partial/unknown sections.
7. Add `Gameplay | Semantic | Live state` to the existing Inspector.
8. Preserve existing Semantic/provenance content and regressions.
9. Render NPC Sells/Buys/Services/Travel/Locations.
10. Render monster Loot/Stats/Resistances/Spawns.
11. Join profile/placement by `entity_id` only.
12. Add quick-card profile summary without blocking #113 direct interaction.
13. `Details` defaults to Gameplay.
14. Add bounded large-profile row behavior and mobile accessibility.

### Phase C — Exact browser verification

Add real Chromium E2E that proves actual user behavior, not DOM presence.

Desktop mandatory flows:

- directly click a real rendered NPC;
- quick card opens;
- Details opens Gameplay;
- assert a real exact Sell or Buy row and price from the pinned Game product;
- switch to Semantic and verify existing provenance survives;
- switch back;
- reload/deep-link preserves selection/tab;
- directly click a real rendered monster;
- assert a real Loot row, chance/count and one Stats fact;
- verify Spawns come from placement identity;
- verify a PARTIAL/UNKNOWN section never claims authoritative empty data.

Mobile mandatory flows:

- direct NPC tap -> Gameplay trade data;
- direct monster tap -> Gameplay loot data;
- tabs readable/operable;
- long rows and bounded lists do not clip critical controls;
- Escape/focus/drawer behavior remains correct.

Run the complete exact-head Molehill Docker Playwright gate through `e2e/run.ps1`, workers=1, retries=0. Do not run a competing full gate concurrently.

Open and actually inspect every required user-facing screenshot before publishing `atlas-local-e2e=success`.

### Phase D — Fix live acceptance depth

The current Synology creature smoke historically proved rendering/search/inspector selection but did not physically prove #113 direct cards or this Gameplay tab. Do not repeat that gap.

Extend `.github/workflows/synology-live-acceptance.yml` and its browser script so merged-main live acceptance physically proves:

- exact Atlas revision header/label;
- exact gameplay product Game revision/digest;
- desktop direct NPC activation -> Details -> Gameplay -> one exact trade assertion;
- mobile direct monster activation -> Gameplay -> one exact loot assertion;
- Semantic tab still works after switching;
- no runtime/HTTP/page errors.

A green deployment that never enters Gameplay is NOT acceptance for this task.

### Phase E — protected merge and live closeout

1. Run the complete deterministic Atlas CI-equivalent suite required by current workflows.
2. Run `git diff --check` and full changed-file/diff audit.
3. Perform independent review.
4. Push exact Atlas head and open one PR.
5. Run exact-head Molehill full browser qualification and visual review.
6. Publish `atlas-local-e2e=success` only for exact clean pushed head.
7. Require `atlas-gate`, `provenance-gate`, CodeQL and all applicable feature checks green.
8. Squash merge with exact expected head SHA.
9. Do not deploy the task branch.
10. Let merged-main Synology deployment/acceptance execute under current repository authority.
11. Require terminal live Gameplay assertions introduced by this task.
12. Close implementation issues and clean completed branches.

## TDD requirements

Every defect or new behavior must be red-green verified.

Game regression set must cover at least:

- complete NPC shop;
- complete empty shop;
- partial dynamic shop;
- static travel;
- complete monster loot;
- complete empty loot;
- partial dynamic/nested unsupported loot;
- health/experience/armor/defense/speed;
- resistance/immunity normalization;
- unresolved item identity;
- duplicate IDs;
- deterministic ordering/bytes/digests;
- invalid chance/count/price;
- oversize/bounds rejection;
- corruption/digest mismatch;
- proof that extractor executes no arbitrary script.

Atlas regression set must cover at least:

- manifest/schema/capability/digest validation;
- lazy shard load;
- bounded cache eviction;
- invalid entity/item identity;
- complete-empty versus unknown-empty copy;
- gameplay product failure isolated from Semantic/map/creature rendering;
- entity-ID-only placement join;
- identical display names with distinct identity do not cross-join;
- chance formatting from `chance_ppm`;
- unresolved item is not a fake link;
- `inspector=` round trips;
- quick card works before profile load completes;
- #113 hit/chooser/no-double-tile-selection regressions remain green;
- large list boundedness.

## No fake completion

Do NOT declare this programme complete if any of these are true:

- only docs/specs exist;
- Game producer is unmerged;
- Atlas is reading synthetic fixtures in production;
- real shop/loot data is still absent but UI tables exist;
- Atlas uses Platform or legacy source as runtime fallback;
- Gameplay is a disabled/placeholder tab;
- Semantic was removed or degraded;
- browser tests click search results but never directly activate a creature;
- tests assert only DOM nodes rather than exact real facts;
- visual evidence was not opened/reviewed;
- `atlas-local-e2e` is stale/copied/retried evidence;
- Atlas PR is unmerged;
- Synology live acceptance did not enter Gameplay and assert one real NPC trade plus one real monster loot fact.

If a subsection cannot be safely extracted, ship truthful `PARTIAL/UNKNOWN/UNRESOLVED` semantics for that subsection and report exact coverage. Never fabricate missing data.

## Terminal report

At completion report:

- Game issue + PR numbers;
- exact merged Game SHA;
- Game gameplay capability/schema and semantic digest;
- measured real coverage: number of NPC profiles, NPCs with complete/partial shops, monster profiles, complete/partial loot profiles, referenced items, unsupported reason counts;
- Atlas issue + PR numbers;
- exact merged Atlas SHA;
- deterministic Game/Atlas test counts;
- exact-head Molehill Playwright pass count, workers, retries;
- visual review scenario count/status;
- `atlas-gate` / `provenance-gate` / CodeQL / applicable checks;
- Synology deployed revision;
- live desktop NPC trade assertion result;
- live mobile monster loot assertion result;
- any intentionally unsupported gameplay subsections;
- branch cleanup state.

Do not stop until all repository-specific Definition of Done conditions are terminally satisfied or a genuine external authority blocker makes further safe progress impossible. In the blocker case, report the exact blocker and all already-merged truthful work; do not weaken gates or invent facts to bypass it.
