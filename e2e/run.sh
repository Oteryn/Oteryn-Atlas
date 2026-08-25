#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export ATLAS_USER_VISUAL_EVIDENCE=1
mkdir -p artifacts/e2e

if [[ -z "${ATLAS_BASE_URL:-}" && -z "${ATLAS_PUBLICATION_ORIGIN:-}" ]]; then
  echo "ATLAS_PUBLICATION_ORIGIN is required when testing the current checkout." >&2
  echo "Example: ATLAS_PUBLICATION_ORIGIN=http://192.168.1.2:8097 ./e2e/run.sh" >&2
  exit 2
fi

if [[ -n "${ATLAS_PUBLICATION_ORIGIN:-}" && ! "$ATLAS_PUBLICATION_ORIGIN" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ ]]; then
  echo "ATLAS_PUBLICATION_ORIGIN must be a plain http(s) origin without a path, query or credentials." >&2
  exit 2
fi

if [[ -n "${ATLAS_PUBLICATION_ORIGIN:-}" ]]; then
  ATLAS_PUBLICATION_SCHEME="${ATLAS_PUBLICATION_ORIGIN%%://*}"
  authority="${ATLAS_PUBLICATION_ORIGIN#*://}"
  ATLAS_PUBLICATION_HOST="${authority%%:*}"
  if [[ "$authority" == *:* ]]; then
    port="${authority##*:}"
  elif [[ "$ATLAS_PUBLICATION_SCHEME" == https ]]; then
    port=443
  else
    port=80
  fi
  ATLAS_PUBLICATION_UPSTREAM="$ATLAS_PUBLICATION_HOST:$port"
  ATLAS_PUBLICATION_HOST_HEADER="$authority"
else
  ATLAS_PUBLICATION_SCHEME=http
  ATLAS_PUBLICATION_HOST=127.0.0.1
  ATLAS_PUBLICATION_UPSTREAM=127.0.0.1:9
  ATLAS_PUBLICATION_HOST_HEADER=127.0.0.1:9
fi
export ATLAS_PUBLICATION_SCHEME ATLAS_PUBLICATION_HOST ATLAS_PUBLICATION_UPSTREAM ATLAS_PUBLICATION_HOST_HEADER

if [[ -z "${ATLAS_CODE_REVISION:-}" ]]; then
  if command -v git >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
    ATLAS_CODE_REVISION="$(git rev-parse HEAD)"
  else
    ATLAS_CODE_REVISION="unknown"
  fi
fi
export ATLAS_CODE_REVISION

if [[ -n "${ATLAS_VERIFICATION_PLAN_PATH:-}" ]]; then
  ATLAS_VERIFICATION_PLAN_PATH="$(realpath "$ATLAS_VERIFICATION_PLAN_PATH")"
  ATLAS_VERIFICATION_PLAN_SHA256="sha256:$(sha256sum "$ATLAS_VERIFICATION_PLAN_PATH" | awk '{print $1}')"
  export ATLAS_VERIFICATION_PLAN_PATH ATLAS_VERIFICATION_PLAN_SHA256
fi

# In checkout-overlay mode the entry document is served by atlas-web, so bind
# the browser proof to the exact checkout revision automatically. A direct
# ATLAS_BASE_URL target can supply its own ATLAS_EXPECTED_REVISION explicitly.
if [[ -z "${ATLAS_BASE_URL:-}" && -z "${ATLAS_EXPECTED_REVISION:-}" && "$ATLAS_CODE_REVISION" != "unknown" ]]; then
  ATLAS_EXPECTED_REVISION="$ATLAS_CODE_REVISION"
  export ATLAS_EXPECTED_REVISION
fi

ATLAS_E2E_PROJECT="${ATLAS_E2E_PROJECT:-oteryn-atlas-e2e-$$}"
ATLAS_E2E_ARTIFACTS_HOST="${ATLAS_E2E_ARTIFACTS_HOST:-../artifacts/e2e/$ATLAS_E2E_PROJECT}"
export ATLAS_E2E_PROJECT ATLAS_E2E_ARTIFACTS_HOST
mkdir -p "artifacts/e2e/$ATLAS_E2E_PROJECT"

compose=(docker compose -p "$ATLAS_E2E_PROJECT" -f e2e/compose.yml)
cleanup() {
  "${compose[@]}" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" up --build --abort-on-container-exit --exit-code-from e2e e2e
