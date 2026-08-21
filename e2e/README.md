# Dockerized Atlas E2E

This harness runs the current Atlas FullWorld browser code in Chromium without installing Node, Playwright or a browser on the host.

The full-world publication is intentionally not committed to the Atlas source repository. In the default checkout-overlay mode, the local Nginx container serves the exact checkout while proxying only `/fullworld/**` and the optional `/data/creatures/**` publication families from an explicitly selected preview origin. The browser still verifies those products against the trusted roots embedded in the checkout and fails closed on any identity mismatch.

## Requirements

- Docker Engine / Docker Desktop with Compose v2.
- Access from the Docker host to a FullWorld preview/publication origin.
- On Windows, WSL2 is recommended and the repository should live in the Linux filesystem for faster bind-mount I/O.

## Test the current checkout

On the Oteryn LAN:

```bash
ATLAS_PUBLICATION_ORIGIN=http://192.168.1.2:8097 ./e2e/run.sh
```

The entry HTML/modules come from the current checkout. The harness automatically exposes and asserts the exact Git revision through `X-Oteryn-Atlas-Code-Revision`; the upstream FullWorld data is accepted only if the current browser trust pins validate it.

## Test a deployed preview directly

```bash
ATLAS_BASE_URL=http://192.168.1.2:8097 \
ATLAS_EXPECTED_REVISION=<exact-preview-sha> \
./e2e/run.sh
```

Direct mode exercises the deployed code and data together. `ATLAS_EXPECTED_REVISION` is optional but recommended for any qualification claim.

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

The E2E container does not receive the Docker socket or secrets. The source checkout is mounted read-only into the web container, no host service port is published, and the publication origin is exercised read-only.
