$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$env:ATLAS_USER_VISUAL_EVIDENCE = '1'
New-Item -ItemType Directory -Force -Path 'artifacts\e2e' | Out-Null

if (-not $env:ATLAS_BASE_URL -and -not $env:ATLAS_PUBLICATION_ORIGIN) {
  throw 'ATLAS_PUBLICATION_ORIGIN is required when testing the current checkout.'
}
if ($env:ATLAS_PUBLICATION_ORIGIN -and $env:ATLAS_PUBLICATION_ORIGIN -notmatch '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$') {
  throw 'ATLAS_PUBLICATION_ORIGIN must be a plain http(s) origin without a path, query or credentials.'
}

if (-not $env:ATLAS_CODE_REVISION) {
  try { $env:ATLAS_CODE_REVISION = (git rev-parse HEAD).Trim() } catch { $env:ATLAS_CODE_REVISION = 'unknown' }
}
if (-not $env:ATLAS_BASE_URL -and -not $env:ATLAS_EXPECTED_REVISION -and $env:ATLAS_CODE_REVISION -ne 'unknown') {
  $env:ATLAS_EXPECTED_REVISION = $env:ATLAS_CODE_REVISION
}

$project = if ($env:ATLAS_E2E_PROJECT) { $env:ATLAS_E2E_PROJECT } else { "oteryn-atlas-e2e-$PID" }
$env:ATLAS_E2E_PROJECT = $project
if (-not $env:ATLAS_E2E_ARTIFACTS_HOST) {
  $env:ATLAS_E2E_ARTIFACTS_HOST = "../artifacts/e2e/$project"
}
$artifactDir = Join-Path $root "artifacts\e2e\$project"
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

$publicationForwarder = $null
if ($env:ATLAS_PUBLICATION_ORIGIN) {
  $origin = [Uri]$env:ATLAS_PUBLICATION_ORIGIN
  $originPort = if ($origin.IsDefaultPort) { if ($origin.Scheme -eq 'https') { 443 } else { 80 } } else { $origin.Port }
  $env:ATLAS_PUBLICATION_SCHEME = $origin.Scheme
  $env:ATLAS_PUBLICATION_HOST = $origin.Host
  $env:ATLAS_PUBLICATION_HOST_HEADER = $origin.Authority

  if (-not $env:ATLAS_BASE_URL) {
    $python = (Get-Command python -ErrorAction Stop).Source
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $probe.Start()
    $forwardPort = ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port
    $probe.Stop()
    $forwarderScript = Join-Path $PSScriptRoot 'local-publication-forwarder.py'
    $forwarderOut = Join-Path $artifactDir 'publication-forwarder.log'
    $forwarderErr = Join-Path $artifactDir 'publication-forwarder.err.log'
    $publicationForwarder = Start-Process -FilePath $python -ArgumentList @(
      $forwarderScript, '--listen-host', '0.0.0.0', '--listen-port', "$forwardPort",
      '--upstream-host', $origin.Host, '--upstream-port', "$originPort"
    ) -WindowStyle Hidden -PassThru -RedirectStandardOutput $forwarderOut -RedirectStandardError $forwarderErr

    $forwarderReady = $false
    for ($attempt = 0; $attempt -lt 50; $attempt += 1) {
      if ($publicationForwarder.HasExited) { break }
      $client = [System.Net.Sockets.TcpClient]::new()
      try {
        $connect = $client.ConnectAsync('127.0.0.1', $forwardPort)
        if ($connect.Wait(200) -and $client.Connected) { $forwarderReady = $true; break }
      } catch { } finally { $client.Dispose() }
      Start-Sleep -Milliseconds 100
    }
    if (-not $forwarderReady) {
      throw "Local publication forwarder failed to listen; see $forwarderErr"
    }
    $env:ATLAS_PUBLICATION_UPSTREAM = "host.docker.internal:$forwardPort"
  } else {
    $env:ATLAS_PUBLICATION_UPSTREAM = "$($origin.Host):$originPort"
  }
} else {
  $env:ATLAS_PUBLICATION_SCHEME = 'http'
  $env:ATLAS_PUBLICATION_HOST = '127.0.0.1'
  $env:ATLAS_PUBLICATION_UPSTREAM = '127.0.0.1:9'
  $env:ATLAS_PUBLICATION_HOST_HEADER = '127.0.0.1:9'
}

$testExitCode = 1
try {
  docker compose -p $project -f e2e\compose.yml up --build --abort-on-container-exit --exit-code-from e2e e2e
  $testExitCode = $LASTEXITCODE
} finally {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  docker compose -p $project -f e2e\compose.yml down --remove-orphans *> $null
  if ($publicationForwarder -and -not $publicationForwarder.HasExited) {
    Stop-Process -Id $publicationForwarder.Id -Force
  }
  $ErrorActionPreference = $previousPreference
}
exit $testExitCode
