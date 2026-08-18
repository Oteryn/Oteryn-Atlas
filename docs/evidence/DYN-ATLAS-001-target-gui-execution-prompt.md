# DYN-ATLAS-001 — target GUI integration execution prompt

Alias: `DYN-ATLAS-001-TARGET-GUI-INTEGRATION-FINAL`

Execute autonomously in `Oteryn/Oteryn-Atlas` and bring the **new semantic Atlas** from its current PR #4 state to a real integrated browser application matching the owner-approved target GUI direction recorded in:

`docs/evidence/DYN-ATLAS-001-target-gui-runtime-contract.md`

Do not substitute the legacy heavy raster/full-map Atlas from `blakinio/Otheryn`. Do not use a precomposed Thais PNG as the browser map. Do not stop at documentation, a mockup or a static shell.

## 0. Revalidate live state first

Before changing anything:

1. read root `AGENTS.md` and every applicable governance/task instruction;
2. fetch current `main`, PR #4, branch head, changed paths, CI state and open review threads;
3. verify whether `main` advanced since the task branch was created and integrate current `main` without dropping task-owned changes;
4. verify the exact 15.32 rights closure already present in the repository; the active task record may be stale and must be reconciled with the later rights-gate closure rather than treating the old blocked status as authority;
5. verify the exact Game semantic identities and do not silently replace them;
6. remove/resolve any technical `__dummy__` artifact before final acceptance.

Current canonical proof identities to revalidate, not blindly trust:

```text
Game semantic artifact
sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e

tiles.jsonl
ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984

proof-local semantic root candidate
sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1

15.32.zip
1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f
Drive file ID 1Dlo3bS4K1nS3mw4BhPZdlHT7lX5zRAvv

bounded proof
x=[32280,32441)
y=[32155,32306)
floor=-7
24311 tiles
39282 presentation records
39282 resolved primitives
862 appearance source IDs
990 sprite source IDs
```

If the historic GitHub Actions Game artifact has expired, reproduce it only from the pinned Game producer/import evidence and verify the exact artifact/tile digests. Do not weaken verification because an Actions artifact expired.

## 1. Architectural boundary — non-negotiable

The runtime must remain:

```text
Oteryn-Game authority
 -> immutable semantic export
 -> Atlas semantic chunks/indexes
 -> content-addressed deduplicated pixel store
 -> WebGL2 browser renderer
 -> semantic overlays/search/inspector
```

Browser code MUST NOT parse or depend on OTBM, Legacy IR, Canary/Crystal world sources, Tibia asset metadata or old atlas raster chunks as fallback authority.

`blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce` may be used only as pinned offline reference/import evidence where the existing contracts explicitly permit it. It must never become browser runtime authority.

## 2. Build the real visual pipeline

Complete the exact-source visual proof rather than retaining the Canvas2D wireframe.

Required result:

- deterministic content-addressed pixel publication for the 990 referenced semantic sprite IDs;
- deduplicate identical dimension+RGBA content while preserving Game/appearance/sprite identity separation;
- browser verifies pixel manifest/root/pack/blob identities before use;
- WebGL2 renderer consumes only verified semantic primitives plus verified pixel publication;
- exact Game-owned dimensions, presentation order, pattern/phase resolution and displacement are honored;
- runtime batching/cache/texture placement is transport state only and `identityAuthority=false`;
- no permanent framework choice is inferred from this proof. A small direct WebGL2 renderer is acceptable if it satisfies the contracts; PixiJS is not mandatory unless current repository decisions explicitly require it.

The visual origin rule for the bounded static proof is:

```text
world pixel x = tile.x * 32 - (widthUnits - 32) + displacement.dxUnits
world pixel y = tile.y * 32 - (heightUnits - 32) + displacement.dyUnits
```

Do not derive collision/walkability/mechanics from visual footprint.

## 3. Implement the owner-approved GUI direction

Build a functional dark professional Atlas shell around the real renderer.

### Top bar

Include:

- OTERYN ATLAS identity;
- X/Y/floor state;
- copy/deep-link affordance;
- zoom controls;
- global search surface prepared for factual semantic indexes.

Coordinate/deep-link state must be deterministic and round-trip.

### Left rail

Provide a compact semantic-layer/navigation panel and render/floor controls.

Reserve categories such as:

- NPCs;
- monsters;
- teleports;
- houses/house doors;
- Action IDs / Unique IDs;
- towns/temples;
- waypoints;
- mechanics;
- raids/quest areas/POIs and future approved semantic datasets.

IMPORTANT: a layer is active only when a real new-Atlas/Game semantic dataset exists. If data does not exist in DYN-ATLAS-001, render the control disabled or explicitly `NOT AVAILABLE IN THIS PROOF`. Do not fabricate markers/data just to make the GUI look complete.

The exact bounded proof has one exported floor only. Do not invent other floors. A floor selector can communicate the current floor and disabled/unavailable states.

### Central map

The map is the dominant surface and must use the real new WebGL2 renderer.

Required interactions:

- pan/drag;
- wheel and button zoom;
- click/picking of factual semantic tiles/entities;
- current coordinate feedback;
- selected-tile highlight without altering semantic truth;
- responsive sizing suitable for a 1920x1080 desktop view.

Do not render one giant precomposed Thais screenshot underneath the controls.

### Right inspector

Provide a contextual inspector with factual tabs/sections such as:

- Tile / Entities;
- Properties when real data exists;
- Provenance / developer details.

At minimum the current proof must expose real position, tile identity, stack/presentation order, appearance source IDs, sprite source IDs and Game/source-profile provenance.

Product-friendly names, houses, mechanics, walkability, boss status etc. may appear only when backed by an accepted semantic dataset. Otherwise show UNKNOWN or omit.

### Diagnostics

Provide an optional developer diagnostics panel using measured runtime state only, e.g.:

- WebGL2 backend availability;
- loaded semantic chunks;
- visible primitives;
- actual draw-call count;
- verified pixel-store/texture byte counts;
- measured decode/upload/render timings when collected.

Never display invented `60 FPS`, cache hit rate, memory usage or performance numbers copied from a concept image.

### Minimap

A minimap/overview is desirable in the final product direction, but DYN-ATLAS-001 must not revive the old 4x/8x raster corpus to obtain one. For this bounded proof implement an overview only if it can be derived safely from the current new-Atlas semantic/runtime data without becoming a second authority. Otherwise show it as deferred/disabled.

## 4. Search and semantic layers

Do not use old Atlas layer files as runtime dependencies.

For this task:

- coordinate search should work;
- current proof inspector/picking must work;
- create clean extension points/contracts for future semantic layer shards/search indexes;
- implement any additional layer only if the required new-Atlas/Game data is already authoritative and bounded enough to validate completely.

Do not expand scope into full-world content migration merely to populate the GUI.

## 5. Visual/reference qualification

A mockup is not acceptance evidence.

Create deterministic representative parity cases covering at least:

- 32x32;
- 64x64;
- 64x32;
- 32x64 source pixels where present;
- nonzero displacement;
- stacked presentations;
- nonzero pattern/depth cases available in the exact fixture.

Reference output may be generated offline using the pinned reference implementation only as visual evidence. Browser output must come from the new Atlas runtime.

Capture numeric pixel-diff evidence. If byte-perfect equality is impossible due to a documented GPU/color/alpha boundary, define and justify an objective deterministic metric; do not use visual inspection alone.

## 6. Required real screenshot

Before declaring GUI integration successful, run the actual application in Chromium/Chrome at a desktop viewport and capture a **real 1920x1080 screenshot**.

The screenshot must show the running application with:

- real Thais Z7 map pixels from the new renderer;
- top coordinates/search shell;
- left layer/control rail;
- right inspector;
- actual measured/available diagnostics where appropriate.

Store the screenshot/evidence in a repository-appropriate task/evidence location if repository policy permits binary evidence; otherwise publish it through the established CI artifact mechanism and record its exact run/artifact identity in durable text evidence.

The screenshot must not contain fake layer results or fake performance values.

## 7. Tests and fail-closed behavior

Add/retain tests for:

- semantic manifest/root/chunk SHA verification;
- malformed/forged semantic negatives;
- pixel manifest/root/pack/blob verification;
- missing/forged pixel negatives;
- every resolved primitive maps to an authorized pixel reference;
- deterministic sprite/content dedupe;
- exact anchor/displacement behavior;
- pan/zoom/deep-link round trip;
- inspector stack/order/provenance;
- browser source scan forbidding OTBM/Legacy world runtime fallback;
- WebGL2 real-browser smoke/parity test;
- GUI controls never advertise unsupported layer data as factual.

Run all repository-selected lint/build/test/typecheck checks applicable to changed files.

## 8. Reconcile documentation honestly

Update the active task and PR description so they reflect current reality:

- exact 15.32 rights gate is closed for its exact digest;
- Canvas wireframe is no longer the final visual proof once WebGL2 integration lands;
- record the pixel publication/root/pack identities actually produced;
- record real visual/parity/runtime measurements;
- distinguish PROVEN / DERIVED / UNKNOWN;
- do not claim full-world completion from the bounded Thais Z7 proof.

## 9. Synology preview

After local/browser acceptance is green, deploy an isolated preview of the **new Atlas application** to Synology. Do not deploy the old flattened PNG preview.

Authorized execution context supplied by the project owner:

- Remote Desktop Commander user: `chagpt`;
- that user has access to Synology.

Before any NAS mutation, revalidate live device/session identity, filesystem path, Docker/HTTP runtime and port ownership. Do not trust historic PIDs/containers/hashes. Never put secrets into repo, logs or screenshots.

Prefer an isolated LAN preview that does not alter canonical Platform/Gateway services. Verify it from a separate client and record the exact preview revision. Public DNS/Cloudflare is a separate mutation and must not be conflated with Atlas acceptance.

## 10. Final lifecycle

Do not stop after coding.

Final sequence:

1. clean generated junk (`__pycache__`, debug output, temporary Chrome profiles, accidental build files) from the commit;
2. full diff/path ownership review;
3. rebase/update against current `main` safely;
4. run all local deterministic tests;
5. push the exact implementation head;
6. wait for and verify **exact-head** GitHub CI success;
7. resolve review threads and update PR evidence;
8. mark PR #4 Ready only when acceptance is actually met;
9. squash merge using the exact expected head SHA;
10. archive/close the task according to repository governance;
11. verify final `main` contains the intended implementation and no `__dummy__`/temporary artifacts;
12. report exact merge SHA, CI run(s), semantic root, pixel root/pack identity, screenshot evidence and preview URL if deployed.

## Hard stop conditions

Stop and report a precise blocker rather than weakening architecture if:

- Game semantic identity cannot be reproduced/verified;
- exact rights/digest evidence is missing or contradictory;
- real pixels cannot be tied to the authorized source;
- browser runtime would require legacy/OTBM fallback;
- current repo governance forbids a required mutation;
- a semantic layer would require inventing facts not provided by Game/accepted Atlas indexes.

A Chrome harness/tooling failure is **not** permission to replace real-browser qualification with a mockup. Repair or simplify the harness while retaining objective runtime evidence.

## Definition of done

This execution is complete only when the new Atlas has a real integrated GUI matching the accepted product direction, displays the bounded real Thais Z7 through the new semantic/pixel/WebGL pipeline, preserves inspector/pan/zoom/deep-link behavior, contains no legacy browser authority, has objective real-browser qualification and a real GUI screenshot, passes exact-head CI, and the task lifecycle is closed according to governance.

Do not claim that DYN-ATLAS-001 itself is the full world. It is the architecture/GUI proof on which later full-world semantic chunking, indexes and layers will scale.