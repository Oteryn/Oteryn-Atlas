# Round 4 coverage reconciliation

## Inventory basis

Current audited repository: `Oteryn/Oteryn-Atlas@5ea38a62fe1af8b8068adcb84350e9644905943c`.

Root tree: `1024b0a7c32cab87e74655fba2a8cb7463cb3d44`.

The tracked leaf denominator was reconstructed from non-truncated Git trees, not from filename search:

| Surface | Leaf paths |
|---|---:|
| root regular files | 6 |
| `.github/**` | 5 |
| `docs/**` | 151 |
| `e2e/**` | 85 |
| `src/**` | 49 |
| `tests/**` | 192 |
| `tools/**` | 96 |
| `web/**` | 556 |
| **Total** | **1140** |

All referenced inventory trees returned `truncated:false`.

## Coverage state totals

| State | Count |
|---|---:|
| `DIRECT` | 131 |
| `GROUPED` | 550 |
| `NOT_APPLICABLE` | 459 |
| `PARTIAL` | 0 |
| `UNVERIFIED` | 0 |
| `INACCESSIBLE` | 0 |
| **Total** | **1140** |

`DIRECT` includes content inspected during rounds 1–4/closure and prior direct inspection reused only where current Git blob/tree identity remained unchanged. It does not mean an executable test was rerun.

`NOT_APPLICABLE` means the path was inventoried and its current role was assessed, but its internal behavior is not current execution authority for this maintenance snapshot. It is not a PASS and does not qualify suspended code.

## Deterministic per-path classifier

Rules are evaluated in the order below. Every current tracked leaf matches exactly one resulting state. `coverage-rules.json` is the machine-readable equivalent.

### GROUPED — 550

1. `web/creature-gameplay/shards/**` — **508** generated/repetitive profile shards.
   - justification: current manifest is directly inspected and carries closed limits, descriptor path/bytes/digest/counts and a semantic digest;
   - current consumer validates the manifest digest, descriptor counts, per-shard byte count/digest, schema, profile bounds and entity-hash-prefix placement;
   - current samples inspected from both ends of both families: `monster-00`, `monster-ff`, `npc-00`, `npc-ff`.
2. `web/proof/**` — **33** bounded generated proof artifacts.
   - justification: generator/publication/runtime contracts and manifests were inspected across the audit; binary pixel payload is content-addressed and consumed through digest/root validation; representative semantic/pixel products were inspected in preserved rounds.
3. `web/semantic-search/*.json` — **2** generated search products.
   - justification: builder and browser consumer contracts were inspected and the files are derived indexes rather than authored controllers.
4. `e2e/tests/*-snapshots/*.png` — **7** generated visual baselines.
   - justification: snapshot producers/visual specs and Git blob identities are tracked; the images are reference outputs, not authored executable code. No new visual approval is inferred.

### NOT_APPLICABLE — 459

Current maintenance freezes product qualification and retains historical/restoration artifacts without making them active authority.

- `tests/**` except `tests/maintenance/maintenance-diff-policy.test.mjs`: **191**. These are suspended product/verification tests; census and applicable catalogs were inspected, but no current execution PASS is claimed.
- `docs/evidence/**`: **33** historical evidence leaves on current main.
- `docs/superpowers/**`: **23** dated historical plans/specs.
- `docs/maintenance/suspended-workflows/**`: **25** deliberately inactive workflow copies.
- `docs/agents/prompts/**` except `ATLAS-FULLWORLD-AGENT-SUITE.md` and `ATLAS-HUNT-INTELLIGENCE-IMPLEMENTATION.md`: **36** reusable/task-specific prompt contracts not selected as current mutable task authority.
- `docs/agents/tasks/archive/**`: **1** archived task evidence.
- `docs/agents/SYNOLOGY_DESKTOP_COMMANDER_ACCESS.md`: **1** host-specific access note not used as current repository execution authority.
- `docs/governance/**`: **3** historical Merge Queue canary evidence files.
- `docs/migration/**`: **1** migration provenance artifact.
- `docs/testing/**`: **12** historical/pre-maintenance verification architecture records; important current contracts were re-resolved through current root/operations/catalog sources instead.
- `tools/verification/**` except `e2e-data-capability-inventory.json` and `verification-catalog.json`: **61** suspended verification-controller/restoration implementation files. Their existence and family were inventoried; they are not active admission authority under maintenance.
- `e2e/**` authored leaves other than the six direct files listed below and the seven grouped PNG baselines: **72** suspended E2E implementation/support leaves. Test families and capability census were inspected; no product qualification is claimed.

### DIRECT — 131

All remaining paths after the closed rules above are `DIRECT`. The count reconciles as:

- root: **6**;
- `.github`: **5**;
- `docs`: **16**;
- `e2e`: **6** (`README.md`, `package.json`, `playwright.config.mjs`, `Dockerfile`, `Dockerfile.web`, `support/geometry-oracle.mjs`);
- `src`: **49**;
- `tests`: **1** (`tests/maintenance/maintenance-diff-policy.test.mjs`);
- `tools`: **35** (all 33 non-`tools/verification` authored tools plus the two current verification catalogs);
- `web`: **13** (authored web surfaces plus `web/creature-gameplay/manifest.json`).

Total: **131**.

## Materiality assessment

No accessible material current authored control/product area remains `UNVERIFIED` or `PARTIAL`. Suspended test/controller code is explicitly `NOT_APPLICABLE` to current admission/qualification, and the audit makes no assertion that those files pass. Their restoration remains a later #315 phase and requires fresh execution evidence.

Current product qualification, current deployment acceptance, a live rollback exercise and a current dependency vulnerability scan are intentionally not converted into coverage gaps: they are execution/operational evidence not required to determine repository coverage, and their absence is stated in `VERIFICATION.md` and `REPORT.md`.
