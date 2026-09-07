# Build and source-contract obligations

Baseline `f00815858bb5b031c502ad19fb96a05ff66b4d84`. Proposed ownership only;
these are inspected command sources, not executed builds or active group IDs.
The 25-workflow disposition is in `workflow-obligations.md`.

| Proposed obligation | Actual input/command source | Minimum proof and allocation boundary |
| --- | --- | --- |
| `build.semantic-search` | `tools/build-semantic-search-index.py`, `tools/build-creature-index.py`; archived `semantic-search.yml` compile/test/export/build steps | Deterministic builder/consumer fixtures first; bounded immutable Game export for source compatibility. Separate full-catalog census when completeness is the oracle. |
| `build.creature-overlay` | `tools/build-creature-index.py`, `tests/creature-index-roles.py`; archived `creature-overlays.yml` producer/consumer and browser proof | Fixture role/layout/LOD contracts plus functional browser proof; selected real records only for source semantics. |
| `build.creature-gameplay` | Archived `creature-gameplay-profiles.yml` pinned Game exporter, product/census, five Node entrypoints | Functional fixture and independent bounded real source contract. Exact #376 routing still needs implementation. |
| `build.farm-products` | `tools/build-farm-bundle.py`, `tools/build-farm-spatial-index.py`, `tools/build-farm-intelligence.py`; corresponding tests in ownership ledger | Preserve deterministic producer/consumer semantics separately from farm explorer UI. A product-wide census is a separate oracle, not implied by all builder edits. |
| `build.e2e-harness` | `e2e/Dockerfile`, `e2e/compose.yml`, `e2e/package*.json`; archived `docker-e2e.yml` Compose config/server readiness, image build/test enumeration | Run only for affected harness/dependency changes; plan before runner allocation. Enumeration/image health does not prove browser behavior. |
| `build.fullworld-*` | `tools/fullworld-{generation,publication,runtime,layers,minimap}/`; builder-specific oracle analysis | Deterministic bounded format/output safety and complete-product census/root/scale are distinct obligations. No blanket directory escalation. |
| `build.provenance` | `tools/governance/verify_extraction_provenance.py`, corresponding Python tests, publication schema/root code | Preserve pinned provenance and rights boundaries. No inference that an artifact's availability grants publication rights. |
| `deployment.live` | Archived `synology-live-acceptance.yml`, `tools/fullworld-closeout/`, deployment/live tests | Separate merged-main deployment and live acceptance; unavailable under current authority. Never ordinary CI capacity. |

The root has no `package.json`; `e2e/package.json` defines a Playwright `test`
script, not a root application build. Retire the archived aggregate `project`
job's runner allocation followed by a conditional discovery that nothing builds.

The archived search/gameplay workflows explicitly pin `Oteryn/Oteryn-Game` and
the legacy migration source. Preserve exact cross-repository input identities
and immutable manifests in a future plan. Legacy inputs are migration evidence;
they do not become browser runtime authority. Changing a pinned source is a
source-contract change even when no Atlas runtime file changed.

The test-tree ledger excludes helper tests outside `tests/**`, including
`tools/dyn-atlas-semantic/self_test.py`, publication negative tests and governance
self-tests. They remain builder/governance obligations, not untracked substitutes
for product entrypoint ownership. The future execution closure must enumerate
these commands and their dependency inputs explicitly. No build/source pipeline
or pinned cross-repository export was executed in this maintenance candidate.
