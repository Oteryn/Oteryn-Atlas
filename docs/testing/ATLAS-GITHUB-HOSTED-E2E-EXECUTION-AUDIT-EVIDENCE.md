# GitHub-hosted E2E audit evidence baseline

Lifecycle: #179

Base: `main@1c5c76c21c26a31ebc97363c2e2f604caa90db6f`

This bounded evidence note records the concrete observation used by `ATLAS-GITHUB-HOSTED-E2E-EXECUTION-ARCHITECTURE-AUDIT.md` so later implementation phases can distinguish measured baseline from architectural hypotheses.

## Observed hosted Docker harness run

Workflow: `.github/workflows/docker-e2e.yml` (`Docker E2E Harness`)

Exact candidate: `e9d70c58e7fce32b1cb8aa5d176ed5840a8174a4`

Workflow run: `33008847373`

Job: `harness` (`98309600121`)

Observed log timestamps:

- runner setup starts: `2026-08-26T20:08:22.4847054Z`
- hosted job reaches custom Playwright image build: `2026-08-26T20:08:29.1375190Z`
- pinned Playwright base image materialization step reports `DONE 25.1s` at `2026-08-26T20:08:54.5830900Z`
- final Atlas-specific image export reports `DONE 3.0s` at `2026-08-26T20:08:58.7253559Z`
- Playwright finishes **listing**, not executing, the suite around `2026-08-26T20:09:00.2598223Z`
- job cleanup follows immediately.

The log lists 71 tests in 32 files. The harness run therefore demonstrates a roughly 38-second hosted fixed-path cost while doing no functional scenario execution.

The listed Playwright base-image layers total roughly 947 MB from the layer sizes printed by Docker in that run. This is a diagnostic observation for the cold path, not a permanent assumption about future runner/image cache state.

Atlas-specific `npm ci --ignore-scripts --no-audit --no-fund` in the image took about one second; the dominant cold image cost was the pinned Playwright base pull/extraction rather than the small dependency set.

## Architectural implication

Do not multiply short targeted plans into many GitHub jobs without measuring the repeated fixed cost. Worker/shard/image/cache/build-fanout policy must be selected from end-to-end wall-clock and setup amplification, not browser execution time alone.

Re-measure this evidence on the current exact implementation SHA before final hosted cutover.