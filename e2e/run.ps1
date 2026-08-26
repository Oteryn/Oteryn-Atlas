$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
. (Join-Path $PSScriptRoot 'heavy-slot-pool.ps1')
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
$planPath = $env:ATLAS_VERIFICATION_PLAN_PATH
if ($planPath) {
  $resolvedPlan = (Resolve-Path $planPath).Path
  $env:ATLAS_VERIFICATION_PLAN_PATH = $resolvedPlan
  $env:ATLAS_VERIFICATION_PLAN_SHA256 = 'sha256:' + (Get-FileHash $resolvedPlan -Algorithm SHA256).Hash.ToLowerInvariant()
}
if (-not $env:ATLAS_BASE_URL -and -not $env:ATLAS_EXPECTED_REVISION -and $env:ATLAS_CODE_REVISION -ne 'unknown') {
  $env:ATLAS_EXPECTED_REVISION = $env:ATLAS_CODE_REVISION
}

$project = if ($env:ATLAS_E2E_PROJECT) { $env:ATLAS_E2E_PROJECT } else { "oteryn-atlas-e2e-$PID" }
$env:ATLAS_E2E_PROJECT = $project
if (-not $env:ATLAS_E2E_ARTIFACTS_HOST) {
  $env:ATLAS_E2E_ARTIFACTS_HOST = "../artifacts/e2e/$project"
}
$artifactDir = if ([IO.Path]::IsPathRooted($env:ATLAS_E2E_ARTIFACTS_HOST)) {
  [IO.Path]::GetFullPath($env:ATLAS_E2E_ARTIFACTS_HOST)
} else {
  [IO.Path]::GetFullPath((Join-Path $PSScriptRoot $env:ATLAS_E2E_ARTIFACTS_HOST))
}

$lockTimeoutSeconds = 7200
if ($env:ATLAS_E2E_LOCK_TIMEOUT_SECONDS) {
  $parsedLockTimeout = 0
  if (-not [int]::TryParse($env:ATLAS_E2E_LOCK_TIMEOUT_SECONDS, [ref]$parsedLockTimeout) -or $parsedLockTimeout -lt 1 -or $parsedLockTimeout -gt 21600) {
    throw 'ATLAS_E2E_LOCK_TIMEOUT_SECONDS must be an integer from 1 through 21600.'
  }
  $lockTimeoutSeconds = $parsedLockTimeout
}

$slotConfig = Resolve-AtlasHeavySlotConfig -DefaultSlotCount 2
$projectLease = Acquire-AtlasProjectLock -Project $project -Revision $env:ATLAS_CODE_REVISION
$artifactLease = Acquire-AtlasArtifactLock -ArtifactPath $artifactDir -Project $project -Revision $env:ATLAS_CODE_REVISION
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$legacyFence = Acquire-AtlasLegacyFence -TimeoutSeconds $lockTimeoutSeconds -Project $project -Revision $env:ATLAS_CODE_REVISION
$slotLease = Acquire-AtlasHeavySlot -SlotCount $slotConfig.SlotCount -RequestedSlot $slotConfig.RequestedSlot -TimeoutSeconds $lockTimeoutSeconds -Project $project -Revision $env:ATLAS_CODE_REVISION
$env:ATLAS_E2E_SLOT_ID = [string]$slotLease.SlotId
$slotEvidence = [ordered]@{
  version = 1
  slotId = $slotLease.SlotId
  slotCount = $slotLease.SlotCount
  project = $project
  revision = $env:ATLAS_CODE_REVISION
  acquiredAtUtc = [DateTime]::UtcNow.ToString('o')
}
$slotEvidence | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $artifactDir 'slot-lease.json')
Write-Output "Acquired Atlas heavy E2E slot $($slotLease.SlotId)/$($slotLease.SlotCount): $($slotLease.Path)"

function Invoke-AtlasOverviewBurstPreflight {
  param(
    [Parameter(Mandatory = $true)][Uri]$OverviewBaseUri,
    [Parameter(Mandatory = $true)][string]$HostHeader,
    [Parameter(Mandatory = $true)][datetime]$Deadline
  )

  # The reference profile loads up to eight overview chunks concurrently before
  # its first renderer commit.  Probe that same fan-out through the exact
  # bridge used by Docker, so a merely readable manifest cannot mask a broken
  # publication path.
  $overviewConcurrency = 8
  [System.Net.ServicePointManager]::DefaultConnectionLimit = [Math]::Max([System.Net.ServicePointManager]::DefaultConnectionLimit, $overviewConcurrency)
  $failures = @()
  do {
    $failures = @()
    try {
      $worldResponse = Invoke-WebRequest -UseBasicParsing -Uri ([Uri]::new($OverviewBaseUri, 'world.json')) -Headers @{ Host = $HostHeader } -TimeoutSec 10
      if ($worldResponse.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($worldResponse.Content)) { throw "overview world status=$($worldResponse.StatusCode)" }
      $world = $worldResponse.Content | ConvertFrom-Json
      $floor = @($world.floors | Where-Object { $_.floor -eq -7 }) | Select-Object -First 1
      if (-not $floor) { throw 'overview floor -7 is missing from the published world' }
      if ($floor.path -notmatch '^[A-Za-z0-9._/-]+$' -or $floor.path.Contains('..')) { throw 'overview floor path is unsafe' }
      $floorResponse = Invoke-WebRequest -UseBasicParsing -Uri ([Uri]::new($OverviewBaseUri, [string]$floor.path)) -Headers @{ Host = $HostHeader } -TimeoutSec 10
      if ($floorResponse.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($floorResponse.Content)) { throw "overview floor status=$($floorResponse.StatusCode)" }
      $floorIndex = $floorResponse.Content | ConvertFrom-Json
      $chunks = @($floorIndex.chunks | Select-Object -First $overviewConcurrency)
      if ($chunks.Count -ne $overviewConcurrency) { throw "overview floor -7 exposes only $($chunks.Count) chunks; expected $overviewConcurrency" }

      $pending = @()
      foreach ($chunk in $chunks) {
        if ($chunk.path -notmatch '^[A-Za-z0-9._/-]+$' -or $chunk.path.Contains('..')) { throw 'overview chunk path is unsafe' }
        $path = [string]$chunk.path
        $request = [System.Net.HttpWebRequest]::Create([Uri]::new($OverviewBaseUri, $path))
        $request.Method = 'GET'
        $request.Host = $HostHeader
        $request.Proxy = $null
        $request.Timeout = 10000
        $request.ReadWriteTimeout = 10000
        $request.ConnectionGroupName = "atlas-overview-preflight-$([Guid]::NewGuid().ToString('n'))"
        $pending += [pscustomobject]@{ Path = $path; Request = $request; Task = $request.GetResponseAsync() }
      }
      foreach ($item in $pending) {
        $response = $null
        try {
          $response = $item.Task.GetAwaiter().GetResult()
          $stream = $response.GetResponseStream()
          $body = [IO.MemoryStream]::new()
          try {
            $stream.CopyTo($body)
            $bodyBytes = $body.Length
          } finally {
            $stream.Dispose()
            $body.Dispose()
          }
          if ([int]$response.StatusCode -ne 200 -or $bodyBytes -le 0) { $failures += "$($item.Path) status=$([int]$response.StatusCode) bytes=$bodyBytes" }
        } catch {
          $failures += "$($item.Path) error=$($_.Exception.Message)"
        } finally {
          if ($response) { $response.Dispose() }
        }
      }
    } catch {
      $failures += "overview index error=$($_.Exception.Message)"
    }
    if ($failures.Count -eq 0) { return }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $Deadline)
  throw "Publication overview burst preflight did not become healthy: $($failures -join '; ')"
}

$publicationForwarder = $null
if ($env:ATLAS_PUBLICATION_ORIGIN) {
  $origin = [Uri]$env:ATLAS_PUBLICATION_ORIGIN
  $originPort = if ($origin.IsDefaultPort) { if ($origin.Scheme -eq 'https') { 443 } else { 80 } } else { $origin.Port }
  $env:ATLAS_PUBLICATION_SCHEME = $origin.Scheme
  $env:ATLAS_PUBLICATION_HOST = $origin.Host
  $env:ATLAS_PUBLICATION_HOST_HEADER = $origin.Authority
  $publicationPreflightPaths = @(
    '/fullworld/publication/publication.json',
    '/fullworld/animation/manifest.json',
    '/fullworld/minimap/world.json',
    '/fullworld/overview/world.json'
  )
  $publicationPreflightDeadline = [DateTime]::UtcNow.AddSeconds(60)
  $publicationPreflightFailures = @()
  do {
    $publicationPreflightFailures = @()
    foreach ($path in $publicationPreflightPaths) {
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "$($origin.AbsoluteUri.TrimEnd('/'))$path" -TimeoutSec 10
        if ($response.StatusCode -ne 200 -or [string]::IsNullOrWhiteSpace($response.Content)) {
          $publicationPreflightFailures += "$path status=$($response.StatusCode)"
        }
      } catch {
        $publicationPreflightFailures += "$path error=$($_.Exception.Message)"
      }
    }
    if ($publicationPreflightFailures.Count -eq 0) { break }
    Start-Sleep -Seconds 2
  } while ([DateTime]::UtcNow -lt $publicationPreflightDeadline)
  if ($publicationPreflightFailures.Count -ne 0) {
    throw "Publication origin preflight did not become healthy: $($publicationPreflightFailures -join '; ')"
  }

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
    Invoke-AtlasOverviewBurstPreflight -OverviewBaseUri ([Uri]"http://127.0.0.1:$forwardPort/fullworld/overview/") -HostHeader $origin.Authority -Deadline $publicationPreflightDeadline
  } else {
    $env:ATLAS_PUBLICATION_UPSTREAM = "$($origin.Host):$originPort"
    Invoke-AtlasOverviewBurstPreflight -OverviewBaseUri ([Uri]"$($origin.AbsoluteUri.TrimEnd('/'))/fullworld/overview/") -HostHeader $origin.Authority -Deadline $publicationPreflightDeadline
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
  if ($slotLease -and $slotLease.Stream) { $slotLease.Stream.Dispose() }
  if ($legacyFence -and $legacyFence.Stream) { $legacyFence.Stream.Dispose() }
  if ($artifactLease -and $artifactLease.Stream) { $artifactLease.Stream.Dispose() }
  if ($projectLease -and $projectLease.Stream) { $projectLease.Stream.Dispose() }
  $ErrorActionPreference = $previousPreference
}
exit $testExitCode
