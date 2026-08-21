# Dockerized Atlas E2E

This harness runs the Atlas FullWorld browser runtime in Chromium without installing Node, Playwright or a browser on the host. The default target is the exact repository checkout served by an isolated Nginx container; the same tests can target an existing read-only LAN preview.

## Requirements

- Docker Engine / Docker Desktop with Compose v2.
- On Windows, WSL2 is recommended and the repository should live in the Linux filesystem for faster bind-mount I/O.

## Run the current checkout

```bash
./e2e/run.sh
```

The stack starts a private `atlas-web` service and a Playwright 1.62.0 Chromium runner. No service port is published to the host.

## Run against a LAN preview

```bash
ATLAS_BASE_URL=http://192.168.1.2:8097 \
ATLAS_EXPECTED_REVISION=<exact-preview-sha> \
./e2e/run.sh
```

`ATLAS_EXPECTED_REVISION` is optional. When set, the entry response must expose the same `X-Oteryn-Atlas-Revision` value or the run fails before functional assertions.

Set `ATLAS_E2E_WORKERS=1` for a low-resource host or increase it on a dedicated E2E machine.

## Coverage

- FullWorld qualification reaches `PASS` with no blocked/unknown layer enabled.
- Chromium uses WebGL2 and the authenticated detail path receives HTTP 206 range responses.
- desktop overview/zoom controls work;
- global semantic search navigates to an authenticated town deep link and inspector state;
- mobile controls/inspector drawers and semantic search navigation work.

## Artifacts

The host receives output under `artifacts/e2e/`:

- `results.json`;
- `html-report/`;
- `test-results/`, including retained trace/video/screenshot data on failures.

The E2E container does not receive the Docker socket, secrets or write access to the Atlas source checkout. The LAN target is exercised read-only.
