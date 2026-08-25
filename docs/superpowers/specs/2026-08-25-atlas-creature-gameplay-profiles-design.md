# Atlas Creature Gameplay Profiles — Design

Status: owner-approved design for implementation planning  
Alias: `ATLAS-CREATURE-GAMEPLAY-PROFILES`  
Programme issue: `Oteryn/Oteryn-Atlas#159`  
Atlas allocation base: `708314e65cfda4e3f9d1eaecb6567ca9aee179e2`  
Game evidence head at design refresh: `8b6f8e6c0ab0f849a87a7a3a8eb97d8367649d26`

## 1. Product problem

The current FullWorld creature flow successfully identifies NPC and monster placements and exposes a technical `Semantic` inspector with provenance, record identity, entity identity, position, resolution state, source authority, semantic digest, presentation state, and verified NPC role categories. That surface is valuable for verification, but it is not the primary information a player expects after selecting an NPC or monster.

The product must add a user-facing gameplay profile next to the existing technical view:

- NPCs: what the NPC sells, what it buys, which services it provides, and where it can transport the player when those facts are explicitly proven;
- monsters: what it can drop, core published combat facts, resistances/immunities, and where its already-published placements occur;
- all facts must remain provenance-safe and fail closed when Game evidence is incomplete, ambiguous, unsupported, or unavailable.

The existing `Semantic` view remains intact. This programme does not replace it with a wiki-style page; it adds a first-class gameplay view while preserving technical provenance as a peer tab.

## 2. User experience decision

The Inspector becomes a three-tab surface:

```text
Gameplay | Semantic | Live state
```

`Gameplay` is the default tab when a creature is selected through search, a deep link, the quick card `Details` action, or direct map activation.

`Semantic` remains the current technical/provenance surface and continues to expose the existing factual record without removing stable IDs, resolution, source, authority, digest, presentation, or placement information.

`Live state` remains reserved for genuinely mutable runtime/player/world state. Static shop offers, loot tables, combat metadata, and spawn placements must never be moved into `Live state` merely because the UI needs another tab.

The selected inspector tab is durable URL state. The canonical parameter is:

```text
inspector=gameplay|semantic|live
```

Unknown values fail closed to `gameplay`. If `live` is unavailable, the tab remains disabled and a deep link requesting it falls back to `gameplay` without inventing live data.

## 3. Scope

### 3.1 NPC Gameplay

The first production gameplay profile for an NPC may expose these sections when proven:

1. **Sells**
   - referenced item identity when resolved;
   - display name;
   - unit price as an integer;
   - currency identity or explicit `gold` fallback only when Game classifies that currency semantics;
   - amount/pack semantics only when the producer can prove them.
2. **Buys**
   - the same normalized fields as Sells.
3. **Services**
   - closed public service taxonomy for the first profile: `bank`, `blessing`, `trainer`, `shop`, `travel`, `quest`;
   - service facts are additive to, and may be more specific than, the current role badges.
4. **Travel**
   - destination label and resolved destination identity/position only when proven;
   - price/currency when statically proven;
   - conditions only when they can be expressed as a bounded public fact. Dynamic script behavior that cannot be normalized is not summarized heuristically.

### 3.2 Monster Gameplay

The first production gameplay profile for a monster may expose:

1. **Loot**
   - referenced item identity when resolved;
   - display name;
   - integer probability in parts-per-million (`chance_ppm`, 0..1,000,000) rather than floats;
   - minimum and maximum count as non-negative integers;
   - nested/container loot only when the producer can normalize it without executing arbitrary script logic.
2. **Stats**
   - health;
   - experience;
   - armor/defense when the source semantics are explicit;
   - speed when the source semantics are explicit.
3. **Resistances / Immunities**
   - closed element/status identifiers;
   - integer percent modifiers where the source provides them;
   - explicit immunities only when directly proven.
4. **Spawns**
   - rendered from the existing authoritative placement records already consumed by Atlas;
   - the gameplay profile must not duplicate every spawn record merely to populate this section.

## 4. Non-goals

This programme does not implement:

- a second Game truth model inside Atlas;
- browser parsing of Lua, XML, OTBM, Canary, CrystalServer, or repository files;
- a synchronous Game Server API as the primary data path;
- live spawn occupancy, kill timers, player state, stock, market prices, or server economy;
- hunt analytics such as observed XP/h, profit/h, route optimization, or party efficiency;
- inferred quest-chain semantics from keywords or file names;
- full item encyclopaedia pages beyond the minimal referenced-item facts necessary to render gameplay rows truthfully;
- mutation of Oteryn-Game gameplay runtime behavior;
- executing arbitrary Lua to discover shop, travel, or loot behavior.

Future Oteryn analytics may enrich the creature experience, but that must be a separately labelled derived-data layer and must not overwrite Game-published static facts.

## 5. Authority and repository ownership

The existing Game → Atlas authority boundary remains normative.

### 5.1 Oteryn-Game owns

- gameplay-profile semantic contract and capability revision;
- public-field allowlist and classification;
- stable entity and referenced-item identity exposed to Atlas;
- normalization of migration/reference evidence into public-safe Game facts;
- completeness and uncertainty classification;
- deterministic producer behavior;
- producer-side tests and golden/synthetic fixtures;
- exact source evidence revision and producer provenance;
- immutable artifact identity and digest.

### 5.2 Oteryn-Atlas owns

- consumer-side schema/semantic validation;
- hard resource bounds and fail-closed loading;
- entity-profile lookup/indexing;
- joining an entity profile to already-authoritative placement records by `entity_id`;
- inspector UI, tabs, quick-card summary, deep-link state, item-row presentation, accessibility;
- browser and visual acceptance;
- merged-main publication and live acceptance.

### 5.3 Forbidden shortcuts

Atlas must not reconstruct missing Game facts from:

- Platform catalogue/API/database;
- OTBM;
- Canary or CrystalServer Lua/XML;
- display-name matching against external datasets;
- public wikis;
- client IDs interpreted as canonical Game identity;
- live server memory;
- arbitrary browser-side heuristics.

If Game does not publish a fact, Atlas must render the affected section as unavailable, partial, ambiguous, or unresolved according to producer evidence.

## 6. Product and capability model

Game publishes a complete immutable product with capability ID:

```text
creature-gameplay-profiles-v1
```

The product is separate from placement geometry. One profile describes one resolved creature entity; any number of spawn/placement records may reference that entity.

### 6.1 Product manifest

The canonical manifest must expose semantic equivalents of:

```json
{
  "contract_id": "oteryn-game-atlas-export-v1",
  "semantic_revision": 1,
  "capability": "creature-gameplay-profiles-v1",
  "profile_schema_version": 1,
  "producer_repository_sha": "<exact Oteryn-Game SHA>",
  "source_evidence": {
    "repository": "<evidence repository>",
    "sha": "<exact evidence SHA>"
  },
  "counts": {
    "npc_profiles": 0,
    "monster_profiles": 0,
    "referenced_items": 0
  },
  "shards": [],
  "semantic_digest": "sha256:<digest>"
}
```

Exact physical file names and shard dimensions may be selected by the producer implementation, but they must be deterministic, content-digested, bounded, and explicitly described in the Game-owned capability contract before Atlas consumes them.

### 6.2 Profile identity

A gameplay profile uses the same stable `entity_id` namespace published by the creature placement product. Atlas must never join profiles to placements using `name`.

If a legacy/reference definition cannot be resolved to a stable exported entity identity, the producer may expose a diagnostic unresolved record, but Atlas must not bind that record to a resolved placement through fuzzy matching.

### 6.3 Referenced item identity

The gameplay product includes a deduplicated minimal referenced-item table sufficient for shop and loot rows.

A referenced item record contains:

```json
{
  "item_ref": "<Game-owned stable/export identity>",
  "name": "Example Item",
  "resolution_state": "RESOLVED",
  "appearance_ref": null
}
```

`appearance_ref` is optional and may be emitted only when Game already owns a publication-safe reference that Atlas can render under existing rights/provenance policy.

If only the item display label is proven but canonical/export identity is not, the relation may preserve the label with `item_ref: null` and a non-RESOLVED item resolution state. Atlas then renders text without a clickable item profile link.

## 7. Completeness and uncertainty

Every profile subsection carries explicit support/completeness state. The vocabulary is:

- `COMPLETE` — the producer proves the subsection is fully represented for this profile under the capability contract;
- `PARTIAL` — some facts are proven, but the producer detected unsupported/dynamic constructs or other bounded omissions;
- `UNRESOLVED` — source evidence exists but cannot be safely normalized;
- `AMBIGUOUS` — two or more materially plausible interpretations remain;
- `UNKNOWN` — evidence required to establish the subsection is absent;
- `NOT_APPLICABLE` — the subsection does not apply to this creature kind.

An empty array is authoritative absence only when its subsection state is `COMPLETE`. An empty array under `PARTIAL`, `UNKNOWN`, `UNRESOLVED`, or `AMBIGUOUS` must never be presented as "none".

Atlas presents uncertainty at section level, not as a global red error that hides proven data from other sections.

Example:

```json
{
  "shop": {
    "state": "PARTIAL",
    "sells": [ ... ],
    "buys": [ ... ],
    "reason_codes": ["DYNAMIC_SHOP_CALLBACK_UNSUPPORTED"]
  },
  "travel": {
    "state": "UNKNOWN",
    "destinations": [],
    "reason_codes": ["NO_STATIC_TRAVEL_EVIDENCE"]
  }
}
```

Reason codes are closed, producer-owned, bounded strings. Atlas maps known codes to concise user copy and preserves unknown future codes as a generic unavailable/partial message rather than interpreting them.

## 8. Normalization rules

The producer may consume legacy/reference Lua/XML only inside the Game-owned importer/exporter boundary, as migration evidence. The output is a normalized immutable Game projection. Browser/runtime consumers never receive source paths as authority and never execute source scripts.

The initial extractor is intentionally static and fail closed:

- static literal shop entries may be normalized;
- static literal travel destinations may be normalized;
- static monster loot table entries may be normalized;
- static monster numeric stats/elements/immunities may be normalized;
- computed tables, runtime callbacks, loops, dynamic mutation, unknown helper semantics, or arbitrary function execution cause the affected subsection to become `PARTIAL`, `UNRESOLVED`, or `AMBIGUOUS` according to evidence;
- unsupported syntax never causes the producer to silently omit entries while claiming `COMPLETE`.

The implementation may use a bounded structural parser or a deliberately constrained parser for known configuration shapes, but it must not `eval`, execute Lua, run a game server, or infer values from comments/file names to make the profile appear complete.

## 9. Normalized profile shapes

### 9.1 NPC

```json
{
  "entity_id": "npc-entity:<stable-id>",
  "kind": "npc",
  "name": "Example NPC",
  "shop": {
    "state": "COMPLETE",
    "sells": [
      {
        "item_ref": "item:<stable-id>",
        "item_name": "Health Potion",
        "item_resolution_state": "RESOLVED",
        "unit_price": 50,
        "currency": "gold",
        "amount": 1
      }
    ],
    "buys": []
  },
  "services": {
    "state": "COMPLETE",
    "values": ["shop", "quest"]
  },
  "travel": {
    "state": "COMPLETE",
    "destinations": []
  }
}
```

### 9.2 Monster

```json
{
  "entity_id": "monster-entity:<stable-id>",
  "kind": "monster",
  "name": "Example Monster",
  "loot": {
    "state": "COMPLETE",
    "entries": [
      {
        "item_ref": "item:<stable-id>",
        "item_name": "Gold Coin",
        "item_resolution_state": "RESOLVED",
        "chance_ppm": 800000,
        "min_count": 1,
        "max_count": 100
      }
    ]
  },
  "stats": {
    "state": "COMPLETE",
    "health": 1000,
    "experience": 700,
    "armor": 25,
    "defense": null,
    "speed": 200
  },
  "resistances": {
    "state": "COMPLETE",
    "elements": [
      {"type": "fire", "percent": -10}
    ],
    "immunities": ["paralyze"]
  }
}
```

Fields that are not proven are `null` only when the subsection state makes that absence non-authoritative. The producer contract must distinguish a genuinely optional field from an unsupported capability.

## 10. Atlas consumer architecture

Atlas introduces one bounded gameplay-profile service responsible for:

1. loading and validating the profile manifest;
2. validating exact contract/capability/schema IDs;
3. validating digest, bytes, counts, identity format, state vocabulary, integer bounds, and shard paths;
4. lazily loading only the shard needed for the selected creature entity;
5. maintaining a bounded LRU-style cache;
6. returning a frozen normalized consumer model;
7. never mutating the current placement source or semantic record.

The service exposes a single conceptual interface:

```js
const result = await gameplayProfiles.get(entityId)
```

where `result` is one of:

```text
{ status: 'ready', profile, manifestDigest }
{ status: 'unavailable', reason }
{ status: 'error', reason }
```

A profile validation failure fails only the gameplay-profile surface. It must not disable the base map, creature rendering, search, or the existing Semantic inspector.

## 11. Inspector presentation

### 11.1 Header

The current Inspector header remains. Creature name/type remain visible independently of tab selection.

### 11.2 Gameplay — NPC

Section order:

1. Sells
2. Buys
3. Services
4. Travel
5. Locations summary

Large shops are virtualized or rendered with a bounded initial window plus explicit expansion/search. The UI must not synchronously create thousands of rows on every inspector update.

Each trade row provides:

- item icon only when a verified appearance reference is available;
- item name;
- price;
- currency;
- amount/pack label when applicable;
- click-through only when a resolved item identity exists.

### 11.3 Gameplay — monster

Section order:

1. Loot
2. Stats
3. Resistances / Immunities
4. Spawns

Loot supports deterministic sorting by source order initially and user sorting by chance/name as a presentation-only transformation. Display percentages are derived from integer `chance_ppm`; the stored authoritative value remains integer.

The Spawns section is built from current Atlas placement records matching the selected `entity_id`. It may show total known placements and a bounded nearest/representative list. It does not duplicate profile data or assert global completeness beyond the current placement product's own authority.

### 11.4 Section uncertainty copy

Examples:

- `Shop data partially published by Game.`
- `Loot profile unresolved for this creature.`
- `Travel data not published by Game.`

The UI must not say `No loot`, `Buys nothing`, or `No travel` unless the respective subsection is `COMPLETE` and the normalized list is empty.

## 12. Quick card integration

The quick card remains intentionally lightweight. Once a validated profile is ready it may add bounded summaries such as:

```text
Shop · 34 sells · 21 buys
```

or

```text
Loot · 17 entries
```

A summary is shown only when the relevant subsection is `COMPLETE` or `PARTIAL` with proven entries. It must not block opening the quick card while a gameplay shard loads.

`Details` opens the Inspector with `inspector=gameplay`.

## 13. Deep-link and history behavior

Durable state consists of:

- selected creature `creature=<record_id>`;
- map/view state already owned by FullWorld;
- inspector tab `inspector=gameplay|semantic|live`.

Switching tabs uses `history.replaceState` unless the existing Atlas navigation contract requires push semantics for comparable inspector UI. Reload and back/forward must preserve the selected creature and selected tab without requiring a new map click.

A gameplay profile may load asynchronously after the inspector opens. The selected tab does not revert merely because its data is loading.

## 14. Performance and resource bounds

The implementation must set hard producer and consumer limits before merge, derived from measured artifact census rather than guessed production scale. At minimum the contract must bound:

- manifest bytes;
- shard bytes;
- profiles per shard;
- referenced items per shard/product;
- shop rows per profile;
- loot rows per profile;
- travel destinations per NPC;
- resistance/immunity entries per monster;
- string bytes;
- nested depth;
- browser cache shard count/bytes.

Exceeding a bound fails the affected profile product closed. It never causes unbounded browser allocation.

The browser must not preload the complete gameplay-profile universe on page load.

## 15. Security, licensing, and public safety

- No secrets, private server logic, admin metadata, unreleased content, credentials, workstation paths, or anti-abuse internals are exposed.
- No arbitrary script execution is allowed during extraction.
- Item/outfit pixels are rendered only through already-approved asset/publication paths with explicit rights/provenance authority.
- Source evidence paths may be used internally by the producer for diagnostics but are not browser authority and need not be published to end users.
- Atlas escapes all labels as text; no source-supplied HTML is rendered.
- All external-looking links are generated from trusted Atlas navigation, not source strings.

## 16. Test strategy

### 16.1 Game producer TDD

Producer tests must include synthetic fixtures for:

- complete NPC sells/buys;
- complete empty shop;
- partial shop caused by unsupported dynamic construct;
- travel destination with static price;
- monster loot with chance/count normalization;
- complete empty loot;
- nested/unsupported loot becoming partial rather than silently omitted;
- health/experience/armor/speed;
- resistance/immunity normalization;
- duplicate identity;
- unresolved item identity;
- deterministic output under input ordering changes;
- semantic digest mismatch/corruption;
- hard-limit rejection;
- no script execution.

### 16.2 Atlas deterministic tests

Consumer tests must cover:

- exact manifest/capability/schema acceptance;
- unknown revision rejection;
- invalid digest/bytes/count/path rejection;
- invalid entity/item identity rejection;
- invalid completeness vocabulary rejection;
- malformed trade/loot integer bounds;
- lazy shard lookup by entity ID;
- bounded cache eviction;
- gameplay failure isolated from existing Semantic inspector;
- complete-empty vs unknown-empty copy semantics;
- placement join by entity ID only;
- durable `inspector=` state.

### 16.3 Real browser acceptance

Desktop and mobile Chromium must prove, on the exact final Atlas head and a pinned merged Game product:

1. directly click a real NPC on the map;
2. open quick card;
3. click Details;
4. Inspector opens on Gameplay;
5. Sells/Buys show proven rows and prices;
6. switch to Semantic and verify the existing provenance information is still present;
7. return to Gameplay without losing selection;
8. reload/deep-link preserves creature and tab;
9. directly click a real monster;
10. Loot and Stats render proven data;
11. a PARTIAL/UNKNOWN fixture shows uncertainty and does not claim empty truth;
12. large shop/loot remains responsive and bounded;
13. mobile tab controls and rows remain readable with valid hit targets;
14. no runtime errors, clipping, or destructive overlap with map controls.

User-facing visual evidence must be opened and reviewed before `atlas-local-e2e=success` is published.

### 16.4 Live acceptance

The merged-main Synology live acceptance must be extended so that its creature smoke physically exercises this feature. A green live gate must prove at least:

- deployed exact Atlas revision header/label;
- published exact gameplay-profile Game digest/revision;
- desktop direct creature activation -> Details -> Gameplay row content;
- mobile direct creature activation -> Gameplay content;
- one NPC trade assertion and one monster loot assertion;
- Semantic tab still works after switching;
- no browser/runtime errors.

Rendering/search/inspector-selection alone is not sufficient evidence for this feature.

## 17. Delivery sequencing

The implementation is one programme with ordered repository authority.

### Phase A — Game producer

1. refresh Oteryn-Game main and overlapping work;
2. create a Game issue and dedicated branch/PR;
3. freeze `creature-gameplay-profiles-v1` capability contract and public allowlist;
4. implement deterministic producer/extractor with TDD;
5. publish census/evidence and hard bounds;
6. run Game governance/CI/audit;
7. merge Game PR;
8. record exact merged Game SHA and product semantic digest.

### Phase B — Atlas consumer/UI

1. refresh Atlas main after Game merge;
2. create/continue the Atlas implementation issue and dedicated branch/PR;
3. pin the exact merged Game producer SHA/digest in the publication workflow according to existing provenance rules;
4. implement bounded gameplay-profile consumer;
5. add Gameplay tab and preserve Semantic;
6. integrate quick card and URL state;
7. add desktop/mobile E2E and visual evidence;
8. extend Synology live acceptance so it tests actual Gameplay tab behavior;
9. run exact-head full qualification and merge.

### Phase C — merged-main live closeout

1. allow only merged `main` to deploy;
2. verify exact container/header identity;
3. run the extended live gameplay acceptance;
4. retain bounded evidence;
5. terminally close both repository issues only when repository-specific DoD is met.

No task branch is deployed to Synology.

## 18. Definition of done

The programme is complete only when all of the following are true:

- Game has a merged, versioned, deterministic public gameplay-profile capability with explicit completeness semantics and bounded extraction;
- Atlas consumes only that Game-owned projection for gameplay facts;
- NPC Gameplay shows truthful Sell/Buy/Services/Travel sections;
- monster Gameplay shows truthful Loot/Stats/Resistances/Spawns sections;
- complete-empty and unknown/partial are visibly different;
- current Semantic/provenance view remains available and regression-covered;
- Details defaults to Gameplay;
- durable URL state works across reload/history;
- direct desktop/mobile creature activation reaches real gameplay content;
- exact-head deterministic, security, provenance, browser, visual, and performance gates are green;
- merged-main Synology live acceptance physically verifies one NPC trade flow and one monster loot flow;
- no Atlas runtime fallback to legacy/reference sources exists;
- no direct Game gameplay-runtime behavior was changed merely to satisfy Atlas presentation;
- task branches are cleaned up after merge according to repository policy.
