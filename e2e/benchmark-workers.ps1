[CmdletBinding()]
param(
  [string]$PublicationOrigin,
  [ValidateSet(1, 2, 4, 6, 8)][int[]]$Workers = @(1, 2, 4, 6, 8),
  [ValidateRange(3, 5)][int]$Repetitions = 3,
  [string]$OutputPath,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Get-RequiredCounterSample {
  $processorSamples = @(
    (Get-Counter -Counter '\Processor Information(_Total)\% Processor Utility' -ErrorAction Stop).CounterSamples |
      Where-Object { $null -ne $_.CookedValue -and -not [double]::IsNaN([double]$_.CookedValue) }
  )
  if ($processorSamples.Count -ne 1) { throw 'Processor telemetry did not yield exactly one usable total sample.' }
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $computer = Get-ComputerInfo -Property CsTotalPhysicalMemory
  $availableMemoryBytes = [double]$os.FreePhysicalMemory * 1KB
  $totalMemoryBytes = [double]$computer.CsTotalPhysicalMemory
  if ($availableMemoryBytes -lt 0 -or $totalMemoryBytes -le 0 -or $availableMemoryBytes -gt $totalMemoryBytes) {
    throw 'Operating-system memory telemetry is invalid.'
  }
  $dockerStats = @(Get-DockerStats)
  $dockerBlockIo = @($dockerStats | ForEach-Object {
    [pscustomobject][ordered]@{ name = $_.Name; blockIo = $_.BlockIO }
  })
  return [pscustomobject][ordered]@{
    atUtc = [DateTime]::UtcNow.ToString('o')
    processorUtilityPercent = [math]::Round([double]$processorSamples[0].CookedValue, 3)
    memoryAvailableBytes = [math]::Round($availableMemoryBytes, 0)
    memoryPressurePercent = [math]::Round(100 * (1 - ($availableMemoryBytes / $totalMemoryBytes)), 3)
    dockerContainerCount = $dockerStats.Count
    dockerBlockIo = $dockerBlockIo
  }
}

function Get-DockerStats {
  $raw = @(docker stats --no-stream --format '{{json .}}')
  if ($LASTEXITCODE -ne 0) { throw 'docker stats failed.' }
  return @($raw | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
}

function Get-EnvironmentFingerprint {
  $computer = Get-ComputerInfo -Property WindowsProductName, WindowsVersion, OsBuildNumber, CsTotalPhysicalMemory
  $docker = docker version --format '{{json .Server}}'
  if ($LASTEXITCODE -ne 0 -or -not $docker) { throw 'docker version failed.' }
  $drive = Get-PSDrive -Name C -ErrorAction Stop
  $runner = Get-Process Runner.Listener -ErrorAction SilentlyContinue | Select-Object -First 1 Id, Path, StartTime
  return [pscustomobject][ordered]@{
    atlasRevision = (git rev-parse HEAD).Trim()
    capturedAtUtc = [DateTime]::UtcNow.ToString('o')
    computerName = $env:COMPUTERNAME
    windows = $computer
    dockerServer = ($docker | ConvertFrom-Json)
    runner = $runner
    disk = [pscustomobject]@{ name = 'C:'; freeBytes = $drive.Free; usedBytes = $drive.Used }
    dockerStatsAtCapture = @(Get-DockerStats)
  }
}

function Get-RandomizedOrder([int[]]$Candidates) {
  $remaining = [System.Collections.Generic.List[int]]::new($Candidates)
  $order = [System.Collections.Generic.List[int]]::new()
  while ($remaining.Count -gt 0) {
    $index = Get-Random -Minimum 0 -Maximum $remaining.Count
    $order.Add($remaining[$index])
    $remaining.RemoveAt($index)
  }
  return @($order)
}

function Get-SummaryMetrics([string]$SummaryPath) {
  if (-not (Test-Path -LiteralPath $SummaryPath)) { return $null }
  $summary = Get-Content -LiteralPath $SummaryPath -Raw | ConvertFrom-Json
  $durations = @($summary.scenarios | ForEach-Object { [double]$_.durationMs } | Sort-Object)
  $p95Index = if ($durations.Count) { [math]::Min($durations.Count - 1, [math]::Ceiling($durations.Count * 0.95) - 1) } else { $null }
  return [pscustomobject][ordered]@{
    status = $summary.status
    scenarioCount = @($summary.scenarios).Count
    medianScenarioDurationMs = if ($durations.Count) { $durations[[math]::Floor(($durations.Count - 1) / 2)] } else { $null }
    p95ScenarioDurationMs = if ($null -ne $p95Index) { $durations[$p95Index] } else { $null }
    retries = @($summary.scenarios | Where-Object { $_.retry -ne 0 }).Count
  }
}

if (-not $OutputPath) {
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
  $OutputPath = Join-Path $root "artifacts\e2e\worker-benchmark-$stamp.json"
}

$fingerprint = Get-EnvironmentFingerprint
if ($SelfTest) {
  if ($Workers.Count -ne @($Workers | Select-Object -Unique).Count) { throw 'Worker candidates must be unique.' }
  $probe = Get-RequiredCounterSample
  if ($null -eq $probe.processorUtilityPercent -or $null -eq $probe.memoryPressurePercent -or $null -eq $probe.dockerBlockIo) {
    throw 'Benchmark telemetry self-test failed.'
  }
  [pscustomobject]@{ version = 1; selfTest = 'passed'; fingerprint = $fingerprint; telemetry = $probe } |
    ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding utf8
  Write-Output "benchmark-workers-self-test=PASS output=$OutputPath"
  exit 0
}

if (-not $PublicationOrigin) { throw 'PublicationOrigin is required unless -SelfTest is used.' }
if ($PublicationOrigin -notmatch '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$') {
  throw 'PublicationOrigin must be a plain http(s) origin without a path, query or credentials.'
}

$originalEnvironment = @{}
foreach ($name in @('ATLAS_PUBLICATION_ORIGIN', 'ATLAS_E2E_WORKERS', 'ATLAS_E2E_PROJECT', 'ATLAS_E2E_ARTIFACTS_HOST', 'ATLAS_E2E_LOCK_TIMEOUT_SECONDS')) {
  $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
  $runs = [System.Collections.Generic.List[object]]::new()
  for ($repetition = 1; $repetition -le $Repetitions; $repetition += 1) {
    foreach ($workerCount in Get-RandomizedOrder $Workers) {
      $project = "atlas-worker-benchmark-r$repetition-w$workerCount-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
      $artifactDir = Join-Path $root "artifacts\e2e\$project"
      $env:ATLAS_PUBLICATION_ORIGIN = $PublicationOrigin
      $env:ATLAS_E2E_WORKERS = "$workerCount"
      $env:ATLAS_E2E_PROJECT = $project
      $env:ATLAS_E2E_ARTIFACTS_HOST = "../artifacts/e2e/$project"
      $env:ATLAS_E2E_LOCK_TIMEOUT_SECONDS = '7200'
      $before = Get-RequiredCounterSample
      $started = [DateTime]::UtcNow
      $runLog = Join-Path $artifactDir 'benchmark-run.log'
      $runErrorLog = Join-Path $artifactDir 'benchmark-run.err.log'
      New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
      $run = Start-Process -FilePath powershell.exe -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'run.ps1')
      ) -PassThru -RedirectStandardOutput $runLog -RedirectStandardError $runErrorLog
      $resourceSamples = [System.Collections.Generic.List[object]]::new()
      while (-not $run.HasExited) {
        $resourceSamples.Add((Get-RequiredCounterSample))
        Start-Sleep -Seconds 2
        $run.Refresh()
      }
      $exitCode = $run.ExitCode
      $finished = [DateTime]::UtcNow
      $after = Get-RequiredCounterSample
      if ($exitCode -eq 0 -and @($resourceSamples | Where-Object { $_.dockerContainerCount -gt 0 }).Count -eq 0) {
        throw "Benchmark run emitted no active Docker container telemetry: repetition=$repetition workers=$workerCount project=$project"
      }
      $runs.Add([pscustomobject][ordered]@{
        repetition = $repetition
        workers = $workerCount
        project = $project
        startedAtUtc = $started.ToString('o')
        finishedAtUtc = $finished.ToString('o')
        wallTimeMs = [math]::Round(($finished - $started).TotalMilliseconds, 3)
        exitCode = $exitCode
        telemetryBefore = $before
        telemetryAfter = $after
        resourceSamples = @($resourceSamples)
        summary = Get-SummaryMetrics (Join-Path $artifactDir 'summary.json')
      })
      if ($exitCode -ne 0) { throw "Benchmark run failed: repetition=$repetition workers=$workerCount project=$project exit=$exitCode" }
    }
  }
  [pscustomobject]@{
    version = 1
    kind = 'atlas-e2e-worker-calibration'
    selectionApplied = $false
    fingerprint = $fingerprint
    requestedWorkers = $Workers
    repetitions = $Repetitions
    runs = @($runs)
  } | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $OutputPath -Encoding utf8
  Write-Output "benchmark-workers=CAPTURED output=$OutputPath"
} finally {
  foreach ($entry in $originalEnvironment.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
}
