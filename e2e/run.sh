#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
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

if [[ -z "${ATLAS_CODE_REVISION:-}" ]]; then
  if command -v git >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
    ATLAS_CODE_REVISION="$(git rev-parse HEAD)"
  else
    ATLAS_CODE_REVISION="unknown"
  fi
fi
export ATLAS_CODE_REVISION

# In checkout-overlay mode the entry document is served by atlas-web, so bind
# the browser proof to the exact checkout revision automatically. A direct
# ATLAS_BASE_URL target can supply its own ATLAS_EXPECTED_REVISION explicitly.

if [[ -z "${ATLAS_BASE_URL:-}" && -z "${ATLAS_EXPECTED_REVISION:-}" && "$ATLAS_CODE_REVISION" != "unknown" ]]; then
  ATLAS_EXPECTED_REVISION="$ATLAS_CODE_REVISION"
  export ATLAS_EXPECTED_REVISION
fi

compose=(docker compose -f e2e/compose.yml)
cleanup() {
  "${compose[@]}" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" up --build --abort-on-container-exit --exit-code-from e2e e2e
