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

if ($env:ATLAS_PUBLICATION_ORIGIN) {
  $origin = [Uri]$env:ATLAS_PUBLICATION_ORIGIN
  $env:ATLAS_PUBLICATION_SCHEME = $origin.Scheme
  $env:ATLAS_PUBLICATION_HOST = $origin.Host
  $port = if ($origin.IsDefaultPort) { if ($origin.Scheme -eq 'https') { 443 } else { 80 } } else { $origin.Port }
  $env:ATLAS_PUBLICATION_UPSTREAM = "$($origin.Host):$port"
  $env:ATLAS_PUBLICATION_HOST_HEADER = $origin.Authority
} else {
  $env:ATLAS_PUBLICATION_SCHEME = 'http'
  $env:ATLAS_PUBLICATION_HOST = '127.0.0.1'
  $env:ATLAS_PUBLICATION_UPSTREAM = '127.0.0.1:9'
  $env:ATLAS_PUBLICATION_HOST_HEADER = '127.0.0.1:9'
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

$project = if ($env:ATLAS_E2E_PROJECT) { $env:ATLAS_E2E_PROJECT } else { "oteryn-atlas-e2e-$PID" }
$env:ATLAS_E2E_PROJECT = $project
if (-not $env:ATLAS_E2E_ARTIFACTS_HOST) {
  $env:ATLAS_E2E_ARTIFACTS_HOST = "../artifacts/e2e/$project"
  New-Item -ItemType Directory -Force -Path (Join-Path $root "artifacts\e2e\$project") | Out-Null
}

$testExitCode = 1
try {
  docker compose -p $project -f e2e\compose.yml up --build --abort-on-container-exit --exit-code-from e2e e2e
  $testExitCode = $LASTEXITCODE
} finally {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  docker compose -p $project -f e2e\compose.yml down --remove-orphans *> $null
  $ErrorActionPreference = $previousPreference
}
exit $testExitCode
