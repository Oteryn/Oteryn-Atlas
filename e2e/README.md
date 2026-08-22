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
- critical accessible names and truthful disabled/hidden states.
## Network/error policy

Unexpected page exceptions, console errors, failed requests and HTTP >=400 responses fail the suite. The allowlist is intentionally narrow: a missing favicon and a 404 for the optional `/data/creatures/index.json` entry point may be classified as expected. Once a creature index is present, missing child products are not ignored.

## Artifacts

The host receives bounded output under `artifacts/e2e/`:

- `summary.json` - compact target/revision/browser/project/scenario/timing/PASS-FAIL census;
- `results.json` - Playwright JSON report;
- `html-report/` - browsable report;
- `test-results/` - retained trace, video, screenshot and error context on failures.

Generated reports remain local/CI artifacts and are not intended for source-control commits.

The source checkout is mounted read-only into the web container, no host service port is published by the harness, and the selected publication origin is exercised read-only.
