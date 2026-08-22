$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
New-Item -ItemType Directory -Force -Path 'artifacts\e2e' | Out-Null

if (-not $env:ATLAS_BASE_URL -and -not $env:ATLAS_PUBLICATION_ORIGIN) {
  throw 'ATLAS_PUBLICATION_ORIGIN is required when testing the current checkout.'
}

if ($env:ATLAS_PUBLICATION_ORIGIN -and $env:ATLAS_PUBLICATION_ORIGIN -notmatch '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$') {
  throw 'ATLAS_PUBLICATION_ORIGIN must be a plain http(s) origin without a path, query or credentials.'
}

if (-not $env:ATLAS_CODE_REVISION) {
  try {
    $env:ATLAS_CODE_REVISION = (git rev-parse HEAD).Trim()
  } catch {
    $env:ATLAS_CODE_REVISION = 'unknown'
  }
}

if (-not $env:ATLAS_BASE_URL -and -not $env:ATLAS_EXPECTED_REVISION -and $env:ATLAS_CODE_REVISION -ne 'unknown') {
  $env:ATLAS_EXPECTED_REVISION = $env:ATLAS_CODE_REVISION
}

$testExitCode = 1
try {
  docker compose -f e2e\compose.yml up --build --abort-on-container-exit --exit-code-from e2e e2e
  $testExitCode = $LASTEXITCODE
} finally {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  docker compose -f e2e\compose.yml down --remove-orphans *> $null
  $ErrorActionPreference = $previousPreference
}

exit $testExitCode
