# Oteryn Atlas — Full-World Agent Execution Suite

Status: EXECUTION PROMPT SUITE

Base architecture: `main` after merged DYN-ATLAS-001 semantic Thais Z7 WebGL2 GUI proof.

This suite coordinates the next programme phase: generation of the complete world on the owner's local workstation, publication of every exported floor, semantic layers/indexes, full-world browser runtime, optional authoritative animation playback, CI/preview and final closeout.

## Global non-negotiable rules

- `Oteryn-Game` remains canonical World/Content authority.
- `Oteryn-Atlas` remains a derived semantic projection/read model.
- Browser runtime MUST NOT parse OTBM, Legacy IR, Canary/Crystal world sources or old Atlas raster chunks as fallback authority.
- The legacy heavy raster Atlas is reference/import evidence only and never browser runtime authority.
- Heavy full-world generation MUST run on the owner's local workstation, not GitHub-hosted runners.
- Optimize the local pipeline for the owner's 64 GB RAM, fast NVMe and multi-core CPU using measured dynamic worker sizing, bounded queues/backpressure, resume/checkpointing and local cache reuse.
- Do not blindly force maximum worker count. Measure throughput, RAM pressure and NVMe queue behavior and choose the fastest stable configuration.
- GitHub Actions are primarily verification/qualification: exact-head integrity, determinism, browser/WebGL smoke, repository contract and selected reproducibility checks.
- Every factual layer must come from accepted Game/Atlas semantic data. Never infer gameplay facts from pixels or sprite appearance.
- Animation is an independent runtime/presentation layer. With animation disabled, otherwise-visible environment/NPC/monster appearances remain deterministic and static; enabling animation may play only verified authoritative phases/timing and must never simulate movement, AI or live server state.
- Unsupported or unavailable layers remain explicitly `UNKNOWN`, `N/A` or `BLOCKED` until authoritative data exists.
- Every agent must read current `AGENTS.md`, applicable task/governance instructions and current `main` before mutation.
- Use dedicated task branches/PRs with disjoint path ownership where practical. Require exact-head CI before merge.
- Record PROVEN / DERIVED / UNKNOWN separately and attach exact revisions, roots, checksums and runtime evidence.

---

# Agent 0 — ATLAS-FULLWORLD-COORDINATOR

Alias: `ATLAS-FULLWORLD-COORDINATOR`

Role: programme coordinator and integration authority.

Execute autonomously across the full-world Atlas programme. Do not duplicate the heavy generation work owned by the local generation agent. Maintain a dependency graph, path ownership, acceptance gates and exact revision ledger for all agents.

Responsibilities:

1. Revalidate current `main` in `Oteryn/Oteryn-Atlas` and `Oteryn/Oteryn-Game` before scheduling work.
2. Treat DYN-ATLAS-001 as the completed bounded architecture/GUI proof and preserve all its authority boundaries.
3. Coordinate these agents:
   - `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`
   - `ATLAS-FULLWORLD-COMPILER-PUBLICATION`
   - `ATLAS-SEMANTIC-LAYERS-AND-INDEXES`
   - `ATLAS-FULLWORLD-GUI-RUNTIME`
   - `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME`
   - `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT`
4. Assign non-overlapping owned paths and explicit hand-off artifacts.
5. Maintain a factual programme ledger with exact source revisions, census results, publication roots, layer status, animation capability/status, CI runs, preview revision and unresolved blockers.
6. Do not allow an agent to substitute legacy/raster authority, guessed semantics, guessed animation timing or stale artifacts.
7. Re-plan dynamically when census/performance evidence changes the optimal floor/shard strategy.
8. Before final completion verify that the complete exported world, every exported floor, intended factual layers, animation layer contract, browser runtime, CI and preview satisfy their contracts.

Definition of done:
- all subordinate tasks have objective evidence and clean hand-offs;
- every intended layer has `ENABLED/PROVEN` or a precise authoritative blocker;
- the animation layer is either `ENABLED/PROVEN` for supported appearances or carries precise per-capability blockers without guessed playback;
- full-world publication and runtime are merged;
- final exact-head CI and post-merge `main` inspection pass;
- final task set is archived and preview points at the intended merged revision.

---

# Agent 1 — ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC

Alias: `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`

Role: exclusive owner of heavy local generation on the owner's workstation.

Repositories:
- source authority: `Oteryn/Oteryn-Game`
- consumer target/evidence: `Oteryn/Oteryn-Atlas`

Execution environment:
- run heavy generation on the owner's local PC;
- exploit 64 GB RAM, fast NVMe and all useful CPU parallelism;
- preserve Windows/WSL headroom so the machine does not thrash or starve the OS.

Required workflow:

1. Live-revalidate workstation identity, available CPU threads, usable RAM, WSL limits, NVMe filesystem/free space and current repo revisions.
2. Run a full-world census before the heavy build:
   - all exported floors;
   - bounds per floor;
   - tile counts per floor;
   - presentation/primitive counts per floor;
   - unique appearance/sprite references per floor and globally;
   - expected intermediate/final byte sizes.
3. Benchmark a representative subset with multiple worker counts. Select the fastest stable worker pool based on measured throughput, not a fixed guess. Start near 12–14 heavy workers when appropriate, but adjust from evidence.
4. Design a resumable shard model, preferably floor-first or floor×region according to census results.
5. Use NVMe for workdir, intermediate shards, hash cache and resume metadata.
6. Use bounded queues/backpressure so peak resident memory stays within a safe local budget. Target high utilization without swap/thrash; reserve adequate memory for OS/WSL/browser tooling.
7. Export/generate the complete authoritative source projection for every floor using deterministic shard identities.
8. Every shard must be independently resumable/verifiable and record exact source revision and digest.
9. On interruption/restart, reuse valid completed work and do not regenerate unchanged shards.
10. Produce performance evidence:
    - selected worker count and benchmark table;
    - elapsed time;
    - CPU utilization/throughput;
    - peak RAM;
    - NVMe read/write volumes/throughput where measurable;
    - output bytes;
    - resume/checkpoint proof;
    - identified bottlenecks.

Generated artifact and incremental rebuild contract:
- Every generated artifact MUST record its input hashes, dependency nodes, output hashes and generation metadata sufficient to reproduce and verify the artifact deterministically.
- Unchanged artifacts MUST be reused when their verified inputs, dependencies and output identity remain unchanged.
- A changed dependency MUST rebuild only the affected downstream outputs identified by the dependency graph.
- Local world changes MUST NOT force unrelated world shards/artifacts to rebuild; a full-world rebuild is permitted only when the dependency graph proves global impact.
- Incremental generation MUST remain deterministic and fail closed when dependency or hash evidence is missing, inconsistent or corrupt.

Do not own:
- final browser GUI;
- semantic layer UX;
- Synology deployment;
- final PR merge lifecycle.

Definition of done:
- full census exists;
- complete all-floor source/fabric output exists;
- every shard validates against the pinned Game source;
- generation is deterministic and resumable;
- generated artifacts carry verified input/dependency/output identities and support deterministic affected-output-only rebuilds;
- local machine utilization is evidence-driven and near optimal without thrashing;
- downstream agents receive exact paths/manifests/digests.

---

# Agent 2 — ATLAS-FULLWORLD-COMPILER-PUBLICATION

Alias: `ATLAS-FULLWORLD-COMPILER-PUBLICATION`

Role: turn the complete local generation output into the canonical full-world Atlas publication.

Input:
- verified outputs/manifests from `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`.

Responsibilities:

1. Extend the bounded semantic publication model to every exported floor/world shard without changing Game authority.
2. Produce deterministic:
   - world manifest/root;
   - per-floor manifests/roots;
   - semantic chunk indexes;
   - content identities;
   - publication metadata and source provenance.
3. Preserve logical address separately from content identity.
4. Build the full-world authorized pixel publication:
   - collect all semantic sprite refs;
   - content-address dimension+RGBA identity;
   - deduplicate globally across floors/regions;
   - use deterministic pack segmentation if one pack becomes operationally unreasonable;
   - keep texture/GPU placement runtime-only with `identityAuthority=false`.
5. Add fail-closed verification for manifests, roots, chunks, packs, blobs and sprite mappings.
6. Verify every resolved primitive maps to exactly one authorized pixel reference.
7. Publish or hand off verified appearance/animation metadata needed for the animation layer when such metadata is authoritative and available; do not infer phase order/timing from pixel refs.
8. Add corruption/missing/forged negatives and deterministic rebuild checks.
9. Record counts and performance:
   - floors;
   - tiles;
   - presentations/primitives;
   - sprite refs;
   - unique pixel blobs;
   - semantic bytes;
   - pixel bytes;
   - dedupe savings;
   - compile/verify timings;
   - exact roots/checksums.
10. Do not freeze a permanent serializer/chunk/framework choice merely because the proof implementation scales sufficiently.

Shared publication/runtime chunk contract with `ATLAS-FULLWORLD-GUI-RUNTIME`:

`WorldChunk` MUST expose:
- `chunk_id`;
- `floor`;
- `bounds`;
- `semantic_root`;
- `pixel_root`;
- `dependencies`;
- `content_hash`;
- `estimated_memory_cost`.

Runtime chunk lifecycle states are:
- `LOAD`;
- `VISIBLE`;
- `CACHED`;
- `EVICTED`;
- `INVALIDATED`.

Chunk rules:
- Chunk invalidation MUST be content/dependency-hash based and fail closed on inconsistent identity evidence.
- Local world changes MUST invalidate only affected chunks and dependent indexes/publication artifacts.
- The runtime MUST never require a full-world reload solely because a local set of world chunks changed.
- Publication identities remain authoritative for Atlas-derived data; lifecycle/cache state is runtime-only and never world authority.

Definition of done:
- complete world publication for every exported floor exists;
- all identities verify fail-closed;
- full-world pixel publication exists and is deterministic;
- all resolved primitives reconcile;
- `WorldChunk` publication hand-off is complete, deterministic and sufficient for hash-based local invalidation;
- any animation metadata hand-off is explicit, pinned and non-inferred;
- evidence is sufficient for GUI/layer/animation agents to consume without legacy inputs.

---

# Agent 3 — ATLAS-SEMANTIC-LAYERS-AND-INDEXES

Alias: `ATLAS-SEMANTIC-LAYERS-AND-INDEXES`

Role: create factual semantic overlay datasets and search/spatial indexes for the complete world.

Upstream authority:
- accepted `Oteryn-Game` semantic data and verified full-world Atlas publication only.

Priority layer families:
1. towns / temples;
2. teleports / floor transitions;
3. houses / house doors;
4. Action IDs / Unique IDs;
5. waypoints where authoritative;
6. mechanics / raids / quest areas / factual POIs where authoritative;
7. NPCs;
8. monsters/spawn datasets;
9. minimap/overview only when safely derived from current semantic data without creating a second authority.

Rules:

- Never derive entity type, name, collision, walkability, quest state, boss status or mechanics from sprite appearance.
- Never import old Atlas layer files as runtime authority.
- For each layer, first prove the authoritative upstream field/dataset and its semantics.
- If upstream lacks sufficient data, stop that layer with exact `BLOCKED/UNKNOWN` evidence rather than fabricate it.

For every enabled layer implement:
- deterministic dataset/index format;
- source provenance and root/content identity;
- per-floor/spatial/viewport query index;
- search index where semantically appropriate;
- fail-closed browser loader;
- inspector-facing factual fields;
- enabled/disabled layer metadata;
- tests for duplicate/missing/corrupt identities;
- full-world reconciliation counts.

Layer toggling must be independent from base map pixel composition. NPC and monster/spawn visibility must also remain independent from the separate animation playback toggle.

Definition of done:
- every intended layer has a documented authoritative source and exact status;
- all `PROVEN` layers have full-world datasets/indexes/loaders/tests;
- unsupported layers are clearly disabled with exact blockers;
- GUI and animation agents receive stable factual NPC/monster layer contracts where proven.

---

# Agent 4 — ATLAS-FULLWORLD-GUI-RUNTIME

Alias: `ATLAS-FULLWORLD-GUI-RUNTIME`

Role: scale the DYN-ATLAS-001 WebGL2 GUI from bounded Thais Z7 to the complete world, every exported floor and factual semantic layers.

Starting point:
- current merged WebGL2 Atlas GUI/runtime on `main`.

Runtime state architecture:

`RuntimeState` MUST be serializable and deterministic. It MUST include:
- floor;
- camera position;
- zoom;
- visible semantic layers;
- selected entity/object;
- search query;
- animation mode;
- debug/diagnostic flags.

Runtime state rules:
- Runtime state is presentation/navigation state and is not authoritative world data.
- UI components are projections of `RuntimeState`; they MUST NOT become a second store of world truth.
- Equivalent `RuntimeState` MUST serialize deterministically for URL deep links and restore deterministically.
- The contract MUST remain suitable for future replay/export, debugging and AI tooling integration without promoting runtime state to Game/Atlas authority.

UI framework authority rule:
- Forbidden as component/framework authority: selected NPC identity as a world fact, map/world data, entity/object facts or any other Game/Atlas-owned truth.
- Allowed as local component state: temporary visual state, animation presentation state and input handling state that does not redefine world facts.
- World truth belongs to Game authority, verified Atlas publication and runtime contracts; framework/component state is never world authority.

Shared `WorldChunk` consumption contract:
- Agent 4 MUST consume the `WorldChunk` contract published by `ATLAS-FULLWORLD-COMPILER-PUBLICATION` with `chunk_id`, `floor`, `bounds`, `semantic_root`, `pixel_root`, `dependencies`, `content_hash` and `estimated_memory_cost`.
- Runtime lifecycle is `LOAD` → `VISIBLE`/`CACHED` → `EVICTED`, with `INVALIDATED` entered when verified content/dependency hashes change.
- Invalidation MUST be hash based; local world changes invalidate/reload only affected chunks and dependencies.
- The runtime MUST never require a full-world reload for local world changes.

Future-safe World Query API boundary:
- Atlas consumers SHOULD NOT read generated files directly; publication/file loaders are implementation adapters behind a stable consumer boundary, not a source of world authority.
- The future `World Query API` boundary MUST support region queries, entity queries, object queries, semantic layer queries and provenance queries.
- The boundary exists for AI agents, analytics, developer tools and future editors while preserving Game authority, Atlas projection provenance and fail-closed semantics.

Responsibilities:

1. Replace proof-bounded assumptions with verified full-world manifests/bounds/floors.
2. Implement deterministic floor switching for all exported floors; never invent unavailable floors.
3. Implement viewport-driven semantic chunk loading/unloading and prefetching suitable for full-world scale.
4. Keep base pixel map and semantic overlay layers separate.
5. Connect enabled factual layers from `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` to:
   - layer toggles;
   - map overlays/picking;
   - search;
   - inspector.
6. Provide/consume the independent `animation` runtime toggle defined by `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME`; disabling it must leave otherwise-visible NPCs, monsters and environment appearances static rather than hidden.
7. Preserve coordinate/deep-link round trip. Extend URL state to relevant floor/layer state deterministically through `RuntimeState`. If animation state is persisted, classify it as presentation/runtime state only.
8. Complete product UX:
   - floor selector;
   - semantic layer rail;
   - independent animation toggle;
   - global factual search;
   - inspector/provenance;
   - minimap only if authoritative overview exists;
   - diagnostics using measured runtime values only.
9. Scale WebGL/runtime performance:
   - spatial culling;
   - chunk cache;
   - texture/pixel pack loading strategy;
   - bounded browser memory;
   - draw batching;
   - incremental layer loading;
   - animation batching/culling hooks without per-object timers.
10. Qualify multiple representative regions/floors in real Chrome, including transitions between sparse/dense locations.
11. Capture real full-world GUI screenshots and objective browser smoke/performance evidence; do not invent FPS/cache/memory values.

Runtime resource budgets and degradation:
- Runtime MUST define and track a maximum loaded-chunk budget.
- Runtime MUST define and track a browser memory budget.
- Runtime MUST track GPU/texture memory budget/usage where the browser/platform exposes a trustworthy measurement; otherwise record the metric as `UNKNOWN`/unavailable rather than invent it.
- Runtime MUST define draw-batch limits/targets and a deterministic cache eviction policy.
- Under resource pressure it MAY reduce prefetch, unload distant chunks and reduce optional layers.
- Under resource pressure it MUST NOT hide factual data that is required to be visible, change world semantics or silently fall back to legacy/raster data.

Real-browser acceptance evidence MUST include measured:
- initial load time;
- chunk loading latency;
- peak browser RAM;
- GPU memory when trustworthy measurement is available;
- draw call count;
- visible chunk count;
- cache hit ratio;
- animation ON versus OFF performance delta.

Measurements MUST come from real browser execution. FPS, memory, cache or other performance values MUST NOT be invented; unavailable measurements remain explicit `UNKNOWN`/`N/A` with the reason recorded.

Definition of done:
- the browser can navigate the complete exported world and every exported floor;
- enabled layers work from verified data;
- search/inspector/deep-links work across floors from deterministic `RuntimeState`;
- chunk loading/invalidation follows the shared `WorldChunk` contract without full-world reload for local changes;
- runtime budgets, cache policy and real-browser acceptance measurements are recorded with actual evidence;
- the animation toggle is independent from factual NPC/monster visibility and preserves static rendering when OFF;
- semantic/pixel separation remains intact;
- runtime does not require legacy/raster fallback;
- UI framework/component state never becomes world authority;
- real-browser qualification passes at full-world scale.

---

# Agent 4.5 — ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME

Alias: `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME`

Role: implement animation as an independent runtime/presentation layer for verified environment appearances and visible factual NPC/monster overlays.

Canonical technical contract:
- `docs/agents/prompts/ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME.md`

Core behavior:

1. `animation=OFF` keeps otherwise-visible animated environment appearances, NPCs and monsters visible at a deterministic static reference phase.
2. `animation=ON` plays only verified authoritative appearance/outfit phases and timing.
3. NPC/monster visibility remains controlled by their own factual semantic layers; the animation toggle controls playback only.
4. Never synthesize walking, wandering, turning, combat, respawn, AI, pathfinding or live server state.
5. Missing authoritative animation metadata degrades only animation capability to explicit static/unsupported behavior; never guess frame order/timing and never reopen legacy runtime inputs.
6. Use a deterministic shared timeline, WebGL batching, viewport culling and hidden-tab pause/throttling rather than per-object timers.
7. Measure animation OFF versus ON in real Chrome at representative dense/sparse regions and record actual frame/render/resource impact.

Dependencies:
- stable verified full-world pixel/appearance publication from `ATLAS-FULLWORLD-COMPILER-PUBLICATION`;
- stable factual NPC and monster/spawn contracts from `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` where creature animation is enabled;
- `ATLAS-FULLWORLD-GUI-RUNTIME` integration surface.

Definition of done:
- independent animation toggle exists and is reversible at runtime;
- static mode remains deterministic and does not hide factual creatures;
- supported animations use only verified phase/timing contracts;
- unsupported animation remains explicit/static rather than fabricated;
- no live movement/state simulation is introduced;
- deterministic/negative tests and full-world real-browser qualification pass on the exact head.

---

# Agent 5 — ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT

Alias: `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT`

Role: final verification, GitHub CI, Synology delivery and lifecycle closeout.

Responsibilities:

1. Revalidate current repository state and all upstream agent hand-offs before mutation.
2. Keep heavy full-world generation off GitHub-hosted runners.
3. Configure CI to verify:
   - repository/runtime authority contract;
   - full-world manifest/root identities;
   - selected deterministic shard regeneration/reproducibility;
   - semantic/pixel corruption negatives;
   - layer/index contracts;
   - animation OFF static determinism and animation ON deterministic authoritative frame selection where the capability is proven;
   - NPC/monster visibility independence from the animation toggle;
   - real Chrome/WebGL smoke across representative floors/regions;
   - GUI unsupported-layer truthfulness.
4. If self-hosted workflows are introduced, pin and document the local runner execution contract without making successful hosted CI depend on unavailable private hardware unless explicitly approved.
5. Deploy an isolated Synology preview of the new full-world semantic Atlas.
6. Before NAS mutation live-revalidate user/device, Docker/runtime, filesystem paths and port ownership.
7. Serve correct MIME/security headers required by ES modules and fail-closed hash verification.
8. Verify preview from a separate client in real Chrome over the actual LAN path.
9. Record exact preview revision, roots, container, port/URL and smoke results.
10. Run final full-diff/path ownership review, exact-head CI, review-thread resolution, Ready/merge with expected head SHA, archive tasks and post-merge `main` inspection.
11. Ensure no temporary profiles/workdirs/debug output/secrets/raw legacy inputs/`__dummy__` remain committed.

Definition of done:
- final exact-head CI is green;
- animation layer truthfulness/static fallback is included in final qualification when the workstream is enabled;
- full-world preview is independently verified;
- all programme tasks are archived with exact evidence;
- merge is performed safely against the expected head;
- final `main` contains the intended complete-world Atlas and no temporary/runtime authority regressions.

---

# Execution order and concurrency

## Phase A — start in parallel
- `ATLAS-FULLWORLD-COORDINATOR`
- `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`
- `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` (authority audit/contracts first)
- `ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT` (CI/self-hosted/delivery planning only)

## Phase B — after census/source hand-off
- `ATLAS-FULLWORLD-COMPILER-PUBLICATION`
- `ATLAS-SEMANTIC-LAYERS-AND-INDEXES` implementation
- `ATLAS-FULLWORLD-GUI-RUNTIME` full-world runtime adaptation against stable publication contracts

## Phase B.5 — animation integration before final GUI qualification
- `ATLAS-ANIMATED-WORLD-AND-CREATURE-RUNTIME` starts implementation once stable pixel/appearance animation contracts exist;
- environment animation may proceed independently when its authoritative appearance/timing contract is proven;
- NPC/monster animation additionally waits for stable factual NPC/monster layer contracts;
- `ATLAS-FULLWORLD-GUI-RUNTIME` integrates the independent toggle and static-off behavior;
- unsupported animation capabilities remain explicit/static and do not block factual static NPC/monster layers unless the programme acceptance criteria explicitly require those capabilities.

## Phase C — integration
- coordinator reconciles publication + layers + GUI + animation capability/status;
- full local/browser qualification covers animation OFF and ON where supported;
- final CI/preview/closeout agent performs delivery lifecycle.

# Local workstation resource policy

The generation fabric must optimize for the owner's machine rather than use fixed arbitrary limits:

- benchmark worker counts before the full run;
- likely starting range: 12–14 heavy workers with spare capacity for OS/WSL/tooling, but measurement wins over the initial range;
- likely pipeline memory budget: roughly 48–56 GB maximum working set, adjusted after measuring WSL/OS needs;
- keep all heavy work/cache/checkpoints on the fast local NVMe;
- avoid swap/thrash and duplicate full-source reads;
- use shard-local resumability and content-digest reuse;
- allow CPU-bound and I/O-bound stages to use different concurrency;
- capture final measured optimum as durable evidence rather than treating these initial numbers as permanent configuration.
