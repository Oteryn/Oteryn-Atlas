# ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION — data-capability amendment

Lifecycle authority: `Oteryn/Oteryn-Atlas#179`

Status: **normative amendment** to `docs/agents/prompts/ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION.md` and its P0 amendment.

This amendment corrects an over-broad assumption discovered during rebuilt Phase D work: ordinary browser E2E must not be treated as requiring the complete real FullWorld publication merely because the Atlas UI is rendered over a map.

Where this amendment is stricter or more specific than the current implementation prompt, P0 amendment, hosted execution audit, readiness/concurrency contract, active PR descriptions, or historical handoff documents, this amendment governs lifecycle #179 until the primary documents are textually reconciled.

## Core rule

**Verification scope and world-data requirement are independent axes.**

A verification profile describes how much behavior must be proven:

- `none`
- `focused`
- `targeted`
- `broad`
- `full`

A data capability describes the smallest world/product data needed by the selected oracle:

- `qualification_fixture`
- `bounded_real_world`
- `real_fullworld`

`profile=full` MUST NOT imply `dataCapability=real_fullworld`.

A full functional browser safety-net may execute entirely against a small deterministic qualification world when every selected oracle is independent of complete real-world bytes.

The complete real FullWorld product is specialist input and may be required only by groups whose oracle genuinely depends on full-product identity, scale, completeness, transport or real-world publication semantics.

## Why this distinction is mandatory

Current FullWorld evidence records a complete publication of about 19 GB. Requiring that product for ordinary NPC, monster, inspector, search, state, geometry, LOD, responsive, accessibility, race/fault and similar functional tests would:

- turn an unrelated static world asset into a global CI dependency;
- make ordinary GitHub-hosted E2E depend on a product much larger than needed by the oracle;
- force unnecessary large storage/download/build costs;
- make specialist local FullWorld availability block unrelated UI/runtime correctness work;
- couple test latency and reliability to a mostly static product that changes far less often than Atlas runtime/UI code;
- undermine the central #179 rule: prove everything necessary and nothing unrelated.

This is forbidden.

## Data capabilities

### `qualification_fixture`

Default for ordinary functional E2E.

A small immutable deterministic world product that uses the same relevant production-facing protocol and runtime seams as the real publication, including as applicable:

- world manifest;
- floor manifest;
- semantic chunks;
- content IDs/digests;
- HTTP range behavior;
- loader validation;
- renderer/world transform;
- creature/NPC/monster data;
- pixel transport needed by the selected scenario;
- readiness manifest and exact input identity.

It MUST NOT be a JavaScript mock that bypasses the real loader/renderer/interaction path when the test is intended to prove those paths.

The qualification fixture should contain only enough deterministic topology and entities to exercise the required oracles. Example contents may include:

- multiple floors;
- a bounded pan/zoom region;
- edge-of-viewport cases;
- NPC and monster placements;
- overlapping creature placements;
- shop/travel/inspector/search examples;
- LOD transitions;
- intentionally malformed/missing variants for fault tests;
- representative range/chunk boundaries.

Size target is bounded and reviewable; it should be measured in MB-scale where practical, not GB-scale.

### `bounded_real_world`

Used when a test must prove integration against real canonical Atlas/Game-derived world data, but does not require complete FullWorld.

Examples:

- one known real NPC/monster region;
- one or a few real semantic chunks;
- a real range-response boundary;
- bounded publication-to-runtime identity proof;
- a regression tied to a specific real-world location/content shape.

The selected bounded product must remain immutable, digest-bound and rights/provenance compliant.

### `real_fullworld`

Reserved for tests whose oracle genuinely requires the complete real FullWorld product or complete-product properties.

Examples include:

- complete FullWorld publication integrity;
- all required floor/shard census and root linkage;
- generator/compiler complete-world determinism;
- complete-product corruption/missing-shard detection;
- full-world scale/performance/soak where full data volume is the subject;
- real complete overview/minimap/product consistency when bounded data cannot prove the behavior;
- release/full-product acceptance that explicitly claims complete-world correctness.

A test MUST NOT request `real_fullworld` merely because:

- the page is `fullworld.html`;
- a creature is displayed over a map;
- the test pans/zooms or switches floors;
- the historical Molehill harness used the full product;
- the test is classified `full`;
- full data happens to be locally available;
- using the real product feels more realistic.

## Mandatory test-suite data audit

In addition to KEEP / MOVE / NARROW / SPLIT / MERGE / DELETE / ADD, every browser group/test must receive a reviewed minimum data capability.

For every group record at least:

- `dataCapability`;
- the oracle fact that justifies it;
- exact required fixture/product identity;
- whether complete real FullWorld is semantically required;
- execution tier;
- rights/provenance class;
- whether missing data means BLOCKED/FAIL versus the group not being selected.

The default is the **least powerful sufficient capability**.

If reviewers cannot explain why complete real-world bytes change the correctness oracle, the group MUST NOT require `real_fullworld`.

## Expected default classifications

Revalidate exact current tests, but use these as the starting presumption:

### Normally `qualification_fixture`

- smoke desktop/mobile;
- state/navigation/history/deep-link/reload;
- search/degraded-search behavior where real complete census is not the subject;
- NPC/monster card interaction;
- inspector/details/copy-link;
- creature selection/hit-testing/chooser behavior;
- creature presentation layout/LOD/modes;
- animation functional behavior;
- pan/zoom/floor transform geometry;
- renderer/framebuffer probes whose oracle is renderer behavior rather than complete-world bytes;
- responsive/mobile behavior;
- accessibility;
- race/fault/resilience against loader/runtime boundaries;
- Atlas-owned rights-safe visual shell/component tests;
- fixed user journeys whose assertions do not claim complete-world product correctness;
- Farm/feature UI behavior where a bounded fixture proves the feature contract.

### Candidate `bounded_real_world`

- specific real NPC/monster publication integration;
- known real-location regression;
- one/few real semantic chunk + range transport proof;
- real publication manifest linkage for representative chunks;
- selected real-data search or layer integration where synthetic data would not prove source compatibility.

### Candidate `real_fullworld`

- complete publication integrity/census/root proof;
- complete generator/compiler publication proof;
- complete scale/performance/soak;
- complete overview/minimap cross-world validation when the full data volume is the claim;
- complete product/release acceptance.

## Molehill role after this amendment

Molehill-PC may own `real_fullworld` groups when the complete real product is only safely/practically available there or another specialist capability requires that host.

This does **not** restore Molehill as the ordinary E2E executor.

The target split is:

- ordinary functional E2E + `qualification_fixture` -> GitHub-hosted;
- bounded real-world tests -> GitHub-hosted where rights/storage make this safe and practical, otherwise explicit specialist lane;
- `real_fullworld` -> Molehill/approved specialist execution when selected by protected plan;
- Synology -> deployment-only; it is not a fallback source or compute plane for PR qualification.

A selected `real_fullworld` group may run on Molehill without forcing unrelated GitHub functional groups onto Molehill.

## Full test does not mean full map

The term `full` in verification planning means the complete required functional/safety verification set for the candidate according to policy.

It does not mean:

- download the whole map;
- build the whole map;
- use the full real publication for every browser scenario;
- send all selected groups to Molehill.

The authoritative plan therefore binds both dimensions independently, for example:

```text
profile = full
requiredGroups = [ ...complete functional set... ]
qualificationFixtureGroups = [ ... ]
boundedRealWorldGroups = [ ... ]
realFullWorldGroups = [ ...maybe empty... ]
```

`realFullWorldGroups` may legitimately be empty for a `full` plan.

## Impact planning

The protected impact planner must select `real_fullworld` only when the changed surface or required oracle affects complete-world behavior.

Changes that SHOULD normally remain on fixture/bounded data unless exact dependencies prove otherwise include:

- creature UI/card/inspector code;
- creature interaction/hit-testing;
- NPC badges/labels;
- search UI/state/history;
- mobile/responsive shell;
- accessibility;
- presentation layout/LOD/animation logic;
- generic geometry/render interaction;
- ordinary CSS/UI changes.

Changes that may escalate to `real_fullworld` include:

- FullWorld generator/fabric logic;
- publication compiler/serializer/root semantics;
- full-world manifest/floor/chunk identity rules;
- complete-product verifier;
- complete overview/minimap producer semantics;
- product transport logic whose correctness specifically depends on complete-world scale;
- complete-world scale/performance policy;
- rights/provenance changes governing complete-world product use;
- unknown verification/governance mutations where the protected controller cannot prove that complete-product obligations remain unaffected.

Unknown impact remains fail-closed, but fail-closed escalation must be semantically appropriate. It may escalate verification profile to `full` without automatically escalating data capability to `real_fullworld` unless complete-product impact is also unknown/material.

## Qualification fixture requirements

The qualification world must be treated as a versioned verification product.

It must have:

- repository-owned schema/manifest;
- stable fixture ID/version;
- exact digest/root;
- deterministic builder or committed deterministic bytes according to rights/size policy;
- explicit scenario coverage map;
- negative fixtures for malformed/missing/corrupt cases where useful;
- no accidental dependency on live LAN/Synology state;
- no mutable `latest` identity;
- a documented reason when a production seam is intentionally not exercised.

Changes to fixture builder/schema/manifest/loader integration bootstrap affected verification to a sufficiently broad/full functional plan because fixture trust is verification infrastructure.

The fixture is not Game semantic authority and must not silently become a production source.

## Real-data split inside existing tests

Where a current spec mixes ordinary functional assertions with real-FullWorld assertions, split it.

Example:

- `creature-interaction-functional` -> `qualification_fixture`, GitHub-hosted;
- `creature-real-publication-integration` -> `bounded_real_world`;
- `fullworld-complete-integrity` -> `real_fullworld`, specialist/scheduled/change-triggered.

Do not make a broad functional file request `real_fullworld` because one assertion inside it needs real data. Move the real-data oracle to its own independently selectable group.

## Trigger policy for real FullWorld

Real FullWorld execution must be plan-selected, not universal.

It may run:

- on PRs touching complete-world generator/publication/identity/transport surfaces;
- on changes to a regression whose oracle requires complete real data;
- on explicit force-full-product verification;
- on scheduled/nightly/periodic complete-product safety runs;
- before release/terminal closeout where full-product acceptance is required.

It should not run for unrelated ordinary runtime/UI PRs.

Even when `real_fullworld` is selected, run only the exact selected real-FullWorld groups unless a complete full-product safety run is itself the required oracle.

## Current Phase D blocker correction

The absence of a GitHub-accessible complete ~19 GB FullWorld product MUST NOT be recorded as a global blocker for all Phase D hosted E2E.

Correct blocker semantics are:

- it blocks only selected groups whose minimum `dataCapability` is `real_fullworld` and which cannot be executed on an approved specialist path;
- it does not block ordinary functional groups that can be proven with `qualification_fixture`;
- it does not justify routing ordinary GitHub-hosted functional E2E back to Molehill;
- it does not justify weakening/removing FullWorld-specific tests;
- it does not authorize copying restricted/full product bytes to an unapproved storage path.

Phase D must therefore first separate ordinary functional correctness from complete FullWorld product correctness.

## Required Phase D repair order after this amendment

1. inventory every current browser test/group and assign minimum `dataCapability`;
2. split mixed functional/real-FullWorld specs where one real-data assertion causes unnecessary complete-product coupling;
3. build/version the minimal immutable qualification world through the same relevant production loader/manifest/chunk/range/runtime paths;
4. move ordinary fixture-backed groups to self-contained GitHub-hosted execution;
5. add semantic catalog capability fields and protected planner enforcement;
6. prove `profile=full` can execute with `realFullWorldGroups=[]` when complete-world impact is absent;
7. preserve bounded real-world integration groups separately;
8. preserve complete real-FullWorld groups separately and route them to Molehill/approved specialist execution only when selected;
9. then resolve storage/builder/rights requirements for any real-FullWorld groups that genuinely need hosted execution;
10. continue protected controller, stable-ID exact fan-in, readiness and stale-head P0 work unchanged.

## Mandatory negative proofs

Add tests proving at minimum:

- `profile=full` does not imply `real_fullworld`;
- creature/UI-only changes cannot select real FullWorld without an explicit protected dependency rule;
- a group declaring `qualification_fixture` cannot silently consume LAN/Synology/full local product;
- a group declaring `real_fullworld` cannot pass using the small qualification fixture;
- mixed specs are rejected or split when a single real-data oracle would inflate unrelated group capability;
- candidate catalog changes cannot downgrade protected-base `real_fullworld` requirement for a group that genuinely needs it;
- candidate catalog changes cannot upgrade all ordinary groups to Molehill/real-FullWorld without protected policy justification if this would bypass hosted execution policy;
- missing real FullWorld blocks only the affected selected groups, not unrelated GitHub fixture groups;
- qualification fixture corruption/digest mismatch fails closed;
- qualification fixture cannot become production/Game semantic authority;
- real-FullWorld group evidence binds exact publication root/product identity and exact candidate/plan identity.

## Added acceptance criteria

Lifecycle #179 is not terminal until current-head evidence proves:

1. verification profile and data capability are modeled independently;
2. every browser group has an explicit reviewed minimum data capability;
3. a deterministic immutable qualification world exists and exercises the relevant real loader/runtime seams;
4. ordinary NPC/monster/UI/state/geometry/LOD/accessibility/race/fault tests no longer require complete FullWorld unless their oracle explicitly proves otherwise;
5. mixed tests have been split so complete-product requirements do not contaminate unrelated functional groups;
6. `full` functional verification can run without complete FullWorld when the selected groups do not require it;
7. real-FullWorld execution is plan-selected and capability-coded;
8. complete real-FullWorld groups remain available on Molehill/approved specialist execution when genuinely required;
9. missing ~19 GB FullWorld cannot globally block unrelated Phase D GitHub-hosted functional E2E;
10. complete FullWorld integrity/scale/product oracles are preserved and are not replaced by fixtures;
11. the protected planner cannot self-narrow or self-broaden these capability boundaries unsafely;
12. before/after timing shows that ordinary PR E2E no longer pays complete-world build/download/startup cost when unrelated.

## Non-negotiable preservation

This amendment does not weaken:

- exact-head qualification;
- zero retries;
- protected authoritative planning;
- exact stable-ID fan-in;
- publication/readiness integrity;
- independent geometry/render/fault/state oracles;
- FullWorld complete-product integrity coverage;
- rights/provenance restrictions;
- selector escape fallback;
- Molehill specialist trust/admission requirements;
- Synology deployment-only boundary.

It changes only **where complete real-world data is actually required**.

The governing principle is:

> Use the smallest immutable data product that can prove the selected oracle. Full real-world bytes are specialist evidence, not the default background for ordinary E2E.
