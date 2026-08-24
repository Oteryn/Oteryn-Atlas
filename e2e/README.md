# Dockerized Atlas E2E

This harness runs the Atlas FullWorld portal in digest-pinned Playwright Chromium without requiring host-installed Node, Playwright or a browser.

The full-world publication is intentionally not committed to the Atlas source repository. In checkout-overlay mode, the local unprivileged Nginx container serves the exact `web/` and `src/` checkout while proxying only `/fullworld/**` and `/data/creatures/**` from an explicitly selected publication origin. Browser trust validation still fails closed on product identity mismatches.

## Requirements

- Docker Engine / Docker Desktop with Compose v2.
- Access from the Docker host to a FullWorld publication origin.
- No Docker socket, privileged container or source write mount is required.

## Test the current checkout

Linux / WSL / Git Bash:

```bash
ATLAS_PUBLICATION_ORIGIN=http://192.168.1.2:8097 ./e2e/run.sh
```

Native Windows PowerShell:

```powershell
$env:ATLAS_PUBLICATION_ORIGIN = 'http://192.168.1.2:8097'
$env:ATLAS_E2E_WORKERS = '1'
.\e2e\run.ps1
```

The harness exposes and asserts the exact checkout SHA through `X-Oteryn-Atlas-Code-Revision`. Publication products are accepted only when they match the trust pins embedded in that checkout.
On native Windows, `run.ps1` starts a bounded user-space TCP forwarder and routes Docker Desktop publication traffic through `host.docker.internal` while preserving the original publication Host identity. This avoids Docker bridge-to-LAN reachability failures without changing the NAS or the Atlas runtime, and the forwarder is stopped during runner cleanup.

After the exact tested commit has been pushed to the PR branch, publish the verified local result from the generated `summary.json`:

```powershell
.\e2e\publish-local-e2e-status.ps1 `
  -SummaryPath .\artifacts\e2e\<project>\summary.json `
  -RemoteBranch agent/atlas-verify-ci-nightly-01
```

Trusted local `run.ps1`/`run.sh` invocations enable successful full-frame user evidence. The authoritative required-frame census and primary browser profile are versioned in `e2e/user-visual-scenarios.json`. These frames remain in the local artifact directory and are not source baselines. Before publishing `atlas-local-e2e`, open and review every required full-frame screenshot under `user-visual-evidence/`, then create the exact-revision review manifest:

```powershell
.\e2e\approve-visual-user-acceptance.ps1 `
  -SummaryPath .\artifacts\e2e\<project>\summary.json `
  -Reviewer '<reviewer-or-agent-id>' `
  -ConfirmReviewedAllScreenshots
```

`publish-local-e2e-status.ps1` now requires the resulting `visual-review.json`, verifies the exact summary digest and re-hashes every reviewed screenshot before it can publish success. The publisher writes only the `atlas-local-e2e` commit status; it does not merge, deploy or modify the publication.

## Test a deployed preview directly

Linux / WSL / Git Bash:

```bash
ATLAS_BASE_URL=http://192.168.1.2:8097 \
ATLAS_EXPECTED_REVISION=<exact-preview-sha> \
./e2e/run.sh
```

PowerShell uses the same environment variable names with `.\e2e\run.ps1`.

Direct mode exercises deployed code and data together. `ATLAS_EXPECTED_REVISION` is optional for exploratory runs but required for a revision-qualified acceptance claim.

Set `ATLAS_E2E_WORKERS=1` for a low-resource machine. The suite has no retries, so first-run failures remain visible.

## Coverage

The deterministic suite covers:

- FullWorld qualification, WebGL2, verified HTTP 206 range streaming and strict browser/runtime error capture;
- desktop zoom buttons, wheel zoom, pan, floor controls, AUTO/MINIMAP/MAP transitions and overview state;
- coordinate navigation, safe invalid/out-of-bounds handling, replace-state/reload behavior and browser back/forward deep links;
- semantic named search, result selection, deep-link state and inspector consistency;
- shipped static NPC/monster toggles, search, deep links, inspector state and bounded creature diagnostics;
- mobile drawers, backdrop/Escape behavior, search/floor controls and 390x844 plus 844x390 responsive transitions;
- bounded failure injection for required publication failure, malformed semantic search data and unavailable optional creature index;
- critical accessible names and truthful disabled/hidden states;
- user-facing visual acceptance across desktop/mobile initial state, search/inspector, layer presentation, animation playback, MINIMAP/CLASSIC/floor transitions, coordinate/zoom/pan navigation, degraded-search and fail-closed presentation, mobile drawers and responsive landscape-like resize, with deterministic clipping/occlusion/hit-target checks plus reviewed exact-revision full-frame evidence.

Cross-browser depth uses the same pinned Playwright container but does not change the primary Chromium PR/pixel-baseline contract. `e2e/browser-matrix.json` defines Firefox desktop/mobile-like and WebKit desktop/mobile-like profiles. Nightly/manual Molehill runs first execute a real launch/touch probe, then run the four profiles sequentially with `workers=1` and `retries=0`. Firefox/WebKit acceptance is behavioral/user-facing and includes strict runtime/network failures, WebGL2 qualification, navigation, semantic inspector/history, playback and mobile-like touch/layout assertions; it never commits Game-derived cross-engine raster baselines.

The pinned Linux Firefox profile is deliberately headed under Xvfb because the same Firefox 153 build exposes no WebGL in headless mode; the browser probe must prove WebGL2 under that exact mode. WebKit remains headless. Mobile-like secondary profiles use viewport plus Playwright-supported `hasTouch` and intentionally omit `isMobile`. Failure artifacts retain the exact Atlas revision, browser project/profile and engine. Unsupported or broken engine behavior fails the compatibility claim rather than being silently skipped.

## Network/error policy

Unexpected page exceptions, console errors, failed requests and HTTP >=400 responses fail the suite. The allowlist is intentionally narrow: a missing favicon and a 404 for the optional `/data/creatures/index.json` entry point may be classified as expected. Once a creature index is present, missing child products are not ignored.

## Artifacts

Each runner invocation uses an isolated Compose project and, by default, an isolated `artifacts/e2e/<project>/` directory. Set `ATLAS_E2E_PROJECT` and `ATLAS_E2E_ARTIFACTS_HOST` only when a stable external name/path is required.

Each run directory contains:

- `summary.json` - compact target/revision/browser/project/scenario/timing/PASS-FAIL census;
- `failure.json` - bounded machine-readable failing-scenario manifest when the run fails;
- `results.json` - Playwright JSON report;
- `html-report/` - browsable report;
- `test-results/` - retained trace, video, screenshot and error context on failures;
- `user-visual-evidence/<project>/<scenario>/` - successful exact-revision viewport PNG plus machine-readable manifest for required user-facing states;
- `visual-review.json` - explicit approved review bound to the exact `summary.json` and reviewed screenshot digests.

Generated reports remain local/CI artifacts and are not intended for source-control commits.

The source checkout is mounted read-only into the web container, no host service port is published by the harness, and the selected publication origin is exercised read-only.
## CI tiers

Required pull-request qualification is wired into `atlas-gate`: deterministic Node verification and authenticated exact-head local Docker Playwright evidence must both succeed. The heavy Playwright run is executed on Molehill-PC with Docker; GitHub CI only verifies the `atlas-local-e2e=success` status on the exact pull-request SHA. The publisher refuses dirty, stale-SHA, skipped/failed or retried evidence. Fork candidates cannot satisfy this trusted same-repository gate and must be reproduced on an authorized branch. `main` CI does not repeat the heavy PR workload; merged-main/live acceptance remains separately revision-qualified.

Scheduled depth is defined by `.github/workflows/verification-depth.yml` and runs its heavy browser work on the dedicated Molehill-PC runner. It is additive to the 64-scenario exact-head PR gate rather than a second copy of that gate: it runs repeated critical geometry/render probes, fixed replayable stress seeds, extra DPR/tablet projects, and stable worker-delivered performance/visual/accessibility/race/soak depth. Missing optional depth categories are recorded with explicit reasons in `optional-depth-skips.json`. Synology remains the merged-main deployment/live-acceptance target and is not a general-purpose heavy CI runner.
