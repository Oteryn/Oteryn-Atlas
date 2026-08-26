[CmdletBinding()]
param(
  [string]$PublicationOrigin,
  [ValidateSet(1, 2, 4, 6, 8)][int[]]$Workers = @(1, 2, 4, 6, 8),
  [ValidateSet('full', 'targeted', 'broad')][string[]]$Workloads = @('full', 'targeted', 'broad'),
  [ValidateRange(3, 5)][int]$Repetitions = 3,
  [string]$OutputPath,
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
. (Join-Path $PSScriptRoot 'heavy-slot-pool.ps1')

$workloadPath = Join-Path $PSScriptRoot 'benchmark-workloads.json'
$workloadRaw = Get-Content -LiteralPath $workloadPath -Raw
$workloadManifest = $workloadRaw | ConvertFrom-Json
if ([int]$workloadManifest.schemaVersion -ne 1) { throw 'Unsupported benchmark workload manifest.' }
$workloadDigest = 'sha256:' + (Get-FileHash $workloadPath -Algorithm SHA256).Hash.ToLowerInvariant()
foreach ($workload in $Workloads) {
  if ($null -eq $workloadManifest.workloads.$workload) { throw "Unknown benchmark workload: $workload" }
}

function Get-DockerStats {
  $raw = @(docker stats --no-stream --format '{{json .}}')
  if ($LASTEXITCODE -ne 0) { throw 'docker stats failed.' }
  @($raw | Where-Object { $_ } | ForEach-Object { $_ | ConvertFrom-Json })
}

function Get-SharedMemorySample([string]$Project) {
  if (-not $Project) { return $null }
  $id = @(docker ps --filter "label=com.docker.compose.project=$Project" --filter 'label=com.docker.compose.service=e2e' -q | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or $id.Count -ne 1 -or -not $id[0]) { return $null }
  $config = docker inspect --format '{{.HostConfig.IpcMode}}|{{.HostConfig.ShmSize}}' $id[0]
  if ($LASTEXITCODE -ne 0 -or -not $config) { return $null }
  $parts = [string]$config -split '\|', 2
  $df = docker exec $id[0] sh -c "df -B1 /dev/shm | tail -1 | awk '{print `$2,`$3,`$4}'"
  $size = $null; $used = $null; $available = $null
  if ($LASTEXITCODE -eq 0 -and $df -match '^\s*([0-9]+)\s+([0-9]+)\s+([0-9]+)') {
    $size = [double]$Matches[1]; $used = [double]$Matches[2]; $available = [double]$Matches[3]
  }
  [pscustomobject][ordered]@{
    mode = $parts[0]
    configuredBytes = if ($parts.Count -gt 1) { [double]$parts[1] } else { $null }
    sizeBytes = $size
    usedBytes = $used
    availableBytes = $available
  }
}

function Get-RequiredCounterSample([string]$Project = '') {
  $cpu = @((Get-Counter '\Processor Information(_Total)\% Processor Utility' -ErrorAction Stop).CounterSamples |
    Where-Object { $null -ne $_.CookedValue -and -not [double]::IsNaN([double]$_.CookedValue) })
  $disk = @((Get-Counter '\PhysicalDisk(_Total)\Avg. Disk Queue Length' -ErrorAction Stop).CounterSamples |
    Where-Object { $null -ne $_.CookedValue -and -not [double]::IsNaN([double]$_.CookedValue) })
  if ($cpu.Count -ne 1 -or $disk.Count -ne 1) { throw 'Required CPU/disk telemetry did not yield exactly one usable sample.' }
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $computer = Get-ComputerInfo -Property CsTotalPhysicalMemory
  $availableMemoryBytes = [double]$os.FreePhysicalMemory * 1KB
  $totalMemoryBytes = [double]$computer.CsTotalPhysicalMemory
  if ($availableMemoryBytes -lt 0 -or $totalMemoryBytes -le 0 -or $availableMemoryBytes -gt $totalMemoryBytes) { throw 'Operating-system memory telemetry is invalid.' }
  $dockerStats = @(Get-DockerStats)
  [pscustomobject][ordered]@{
    atUtc = [DateTime]::UtcNow.ToString('o')
    processorUtilityPercent = [math]::Round([double]$cpu[0].CookedValue, 3)
    diskQueueLength = [math]::Round([double]$disk[0].CookedValue, 3)
    memoryAvailableBytes = [math]::Round($availableMemoryBytes, 0)
    memoryPressurePercent = [math]::Round(100 * (1 - ($availableMemoryBytes / $totalMemoryBytes)), 3)
    dockerContainerCount = $dockerStats.Count
    dockerStats = $dockerStats
    sharedMemory = Get-SharedMemorySample $Project
  }
}

function Get-EnvironmentFingerprint {
  $computer = Get-ComputerInfo -Property WindowsProductName, WindowsVersion, OsBuildNumber, CsTotalPhysicalMemory
  $docker = docker version --format '{{json .Server}}'
  if ($LASTEXITCODE -ne 0 -or -not $docker) { throw 'docker version failed.' }
  $dockerInfo = docker info --format '{{json .}}'
  if ($LASTEXITCODE -ne 0 -or -not $dockerInfo) { throw 'docker info failed.' }
  $drive = Get-PSDrive -Name C -ErrorAction Stop
  $runner = Get-Process Runner.Listener -ErrorAction SilentlyContinue | Select-Object -First 1 | Select-Object Id, Path, StartTime
  $wslStatus = try { @(wsl.exe --status 2>&1) -join "`n" } catch { $null }
  [pscustomobject][ordered]@{
    atlasRevision = (git rev-parse HEAD).Trim()
    capturedAtUtc = [DateTime]::UtcNow.ToString('o')
    computerName = $env:COMPUTERNAME
    windows = $computer
    dockerServer = ($docker | ConvertFrom-Json)
    dockerInfo = ($dockerInfo | ConvertFrom-Json)
    wslStatus = $wslStatus
    runner = $runner
    disk = [pscustomobject]@{ name = 'C:'; freeBytes = $drive.Free; usedBytes = $drive.Used }
    workloadDigest = $workloadDigest
  }
}

function Get-RandomizedOrder([int[]]$Candidates) {
  $remaining = [System.Collections.Generic.List[int]]::new($Candidates)
  $order = [System.Collections.Generic.List[int]]::new()
  while ($remaining.Count -gt 0) {
    $index = Get-Random -Minimum 0 -Maximum $remaining.Count
    $order.Add($remaining[$index]); $remaining.RemoveAt($index)
  }
  @($order)
}

function Get-SummaryMetrics([string]$SummaryPath) {
  if (-not (Test-Path -LiteralPath $SummaryPath)) { return $null }
  $summary = Get-Content -LiteralPath $SummaryPath -Raw | ConvertFrom-Json
  $durations = @($summary.scenarios | ForEach-Object { [double]$_.durationMs } | Sort-Object)
  $p95Index = if ($durations.Count) { [math]::Min($durations.Count - 1, [math]::Ceiling($durations.Count * 0.95) - 1) } else { $null }
  $browserMs = ([DateTime]$summary.finishedAt - [DateTime]$summary.startedAt).TotalMilliseconds
  [pscustomobject][ordered]@{
    status = $summary.status
    scenarioCount = @($summary.scenarios).Count
    browserTestTimeMs = [math]::Round($browserMs, 3)
    medianScenarioDurationMs = if ($durations.Count) { $durations[[math]::Floor(($durations.Count - 1) / 2)] } else { $null }
    p95ScenarioDurationMs = if ($null -ne $p95Index) { $durations[$p95Index] } else { $null }
    retries = @($summary.scenarios | Where-Object { [int]$_.retry -ne 0 }).Count
    nonPassed = @($summary.scenarios | Where-Object { $_.status -ne 'passed' }).Count
  }
}

function Count-LogMatches([string]$Path, [string]$Pattern) {
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  @((Select-String -Path $Path -Pattern $Pattern -AllMatches -ErrorAction SilentlyContinue)).Count
}

if (-not $OutputPath) {
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
  $OutputPath = Join-Path $root "artifacts\e2e\worker-benchmark-$stamp.json"
}
$outputDirectory = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($OutputPath))
if ([string]::IsNullOrWhiteSpace($outputDirectory)) { throw 'Benchmark output path must have a parent directory.' }
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$fingerprint = Get-EnvironmentFingerprint
if ($SelfTest) {
  if ($Workers.Count -ne @($Workers | Select-Object -Unique).Count) { throw 'Worker candidates must be unique.' }
  if ($Workloads.Count -ne @($Workloads | Select-Object -Unique).Count) { throw 'Workloads must be unique.' }
  $probe = Get-RequiredCounterSample
  if ($null -eq $probe.processorUtilityPercent -or $null -eq $probe.diskQueueLength -or $null -eq $probe.memoryPressurePercent) { throw 'Benchmark telemetry self-test failed.' }
  [pscustomobject]@{ schemaVersion = 2; selfTest = 'passed'; fingerprint = $fingerprint; workloadDigest = $workloadDigest; telemetry = $probe; selectionApplied = $false } |
    ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $OutputPath -Encoding utf8
  Write-Output "benchmark-workers-self-test=PASS output=$OutputPath"
  exit 0
}

if (-not $PublicationOrigin) { throw 'PublicationOrigin is required unless -SelfTest is used.' }
if ($PublicationOrigin -notmatch '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$') { throw 'PublicationOrigin must be a plain http(s) origin without a path, query or credentials.' }

$originalEnvironment = @{}
foreach ($name in @('ATLAS_PUBLICATION_ORIGIN','ATLAS_E2E_WORKERS','ATLAS_E2E_PROJECT','ATLAS_E2E_ARTIFACTS_HOST','ATLAS_E2E_LOCK_TIMEOUT_SECONDS','ATLAS_E2E_BENCHMARK_WORKLOAD','ATLAS_E2E_AUTHORITY_MODE','ATLAS_E2E_RESOURCE_CLASS','ATLAS_E2E_SLOT_COUNT','ATLAS_E2E_SLOT')) {
  $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$windowProject = "atlas-worker-benchmark-window-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$windowLegacy = $null; $windowSlot = $null; $windowHost = $null
$runs = [System.Collections.Generic.List[object]]::new()
$coldBuildMs = $null
try {
  # Reserve legacy single-run admission, one historical slot and one host token.
  # Each child is forced into the remaining slot/token, yielding one exclusive benchmark job without broad host pruning.
  $windowLegacy = Acquire-AtlasLegacyFence -TimeoutSeconds 21600 -Project $windowProject -Revision $fingerprint.atlasRevision
  $windowSlot = Acquire-AtlasHeavySlot -SlotCount 2 -RequestedSlot 2 -TimeoutSeconds 21600 -Project $windowProject -Revision $fingerprint.atlasRevision
  $windowHost = Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 21600 -Project $windowProject -Revision $fingerprint.atlasRevision -ResourceClass 'browser-full' -AuthorityMode 'diagnostic'

  $coldProject = "$windowProject-cold"
  $coldStarted = [DateTime]::UtcNow
  docker compose -p $coldProject -f e2e\compose.yml build --no-cache e2e | Out-Host
  if ($LASTEXITCODE -ne 0) { throw 'Cold no-cache E2E build failed.' }
  $coldBuildMs = [math]::Round(([DateTime]::UtcNow - $coldStarted).TotalMilliseconds, 3)
  docker compose -p $coldProject -f e2e\compose.yml down --remove-orphans *> $null

  for ($repetition = 1; $repetition -le $Repetitions; $repetition += 1) {
    foreach ($workload in $Workloads) {
      foreach ($workerCount in Get-RandomizedOrder $Workers) {
        $project = "atlas-worker-$workload-r$repetition-w$workerCount-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
        $artifactDir = Join-Path $root "artifacts\e2e\$project"
        New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
        $env:ATLAS_PUBLICATION_ORIGIN = $PublicationOrigin
        $env:ATLAS_E2E_WORKERS = "$workerCount"
        $env:ATLAS_E2E_BENCHMARK_WORKLOAD = $workload
        $env:ATLAS_E2E_PROJECT = $project
        $env:ATLAS_E2E_ARTIFACTS_HOST = "../artifacts/e2e/$project"
        $env:ATLAS_E2E_LOCK_TIMEOUT_SECONDS = '21600'
        $env:ATLAS_E2E_AUTHORITY_MODE = 'diagnostic'
        $env:ATLAS_E2E_RESOURCE_CLASS = 'browser-full'
        $env:ATLAS_E2E_SLOT_COUNT = '2'
        $env:ATLAS_E2E_SLOT = '1'

        $buildStarted = [DateTime]::UtcNow
        docker compose -p $project -f e2e\compose.yml build e2e | Out-Host
        $buildMs = [math]::Round(([DateTime]::UtcNow - $buildStarted).TotalMilliseconds, 3)
        if ($LASTEXITCODE -ne 0) { throw "Warm E2E build failed: $project" }

        $serverStarted = [DateTime]::UtcNow
        docker compose -p $project -f e2e\compose.yml up -d --no-build atlas-web | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Atlas web startup failed: $project" }
        $serverName = "$project-atlas-web-1"
        $healthy = $false
        for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
          $health = docker inspect --format '{{.State.Health.Status}}' $serverName 2>$null
          if ($LASTEXITCODE -eq 0 -and $health -eq 'healthy') { $healthy = $true; break }
          Start-Sleep -Seconds 1
        }
        if (-not $healthy) { throw "Atlas web did not become healthy: $project" }
        $serverStartupMs = [math]::Round(([DateTime]::UtcNow - $serverStarted).TotalMilliseconds, 3)

        $before = Get-RequiredCounterSample $project
        $started = [DateTime]::UtcNow
        $runLog = Join-Path $artifactDir 'benchmark-run.log'
        $runErrorLog = Join-Path $artifactDir 'benchmark-run.err.log'
        $run = Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'run.ps1')) -PassThru -RedirectStandardOutput $runLog -RedirectStandardError $runErrorLog
        $resourceSamples = [System.Collections.Generic.List[object]]::new()
        while (-not $run.HasExited) {
          $resourceSamples.Add((Get-RequiredCounterSample $project))
          Start-Sleep -Seconds 2
          $run.Refresh()
        }
        $exitCode = $run.ExitCode
        $finished = [DateTime]::UtcNow
        $after = Get-RequiredCounterSample
        $summary = Get-SummaryMetrics (Join-Path $artifactDir 'summary.json')
        $firstRunFailures = if ($summary) { [int]$summary.nonPassed } else { 1 }
        $browserCrashes = (Count-LogMatches $runLog '(?i)browser.*crash|target page, context or browser has been closed') + (Count-LogMatches $runErrorLog '(?i)browser.*crash|target page, context or browser has been closed')
        $containerCrashes = (Count-LogMatches $runLog '(?i)exited with code [1-9]|container.*failed') + (Count-LogMatches $runErrorLog '(?i)exited with code [1-9]|container.*failed')
        $oomKilled = (Count-LogMatches $runLog '(?i)oomkilled|out of memory') + (Count-LogMatches $runErrorLog '(?i)oomkilled|out of memory')
        if ($exitCode -eq 0 -and @($resourceSamples | Where-Object { $_.dockerContainerCount -gt 0 }).Count -eq 0) { throw "No active Docker telemetry: $project" }
        if ($exitCode -eq 0 -and @($resourceSamples | Where-Object { $null -ne $_.sharedMemory }).Count -eq 0) { throw "No sharedMemory telemetry: $project" }

        $runs.Add([pscustomobject][ordered]@{
          workload = $workload
          repetition = $repetition
          workers = $workerCount
          project = $project
          startedAtUtc = $started.ToString('o')
          finishedAtUtc = $finished.ToString('o')
          wallTimeMs = [math]::Round(($finished - $started).TotalMilliseconds, 3)
          buildTimeMs = $buildMs
          serverStartupMs = $serverStartupMs
          exitCode = $exitCode
          firstRunFailures = $firstRunFailures
          browserCrashes = [int]$browserCrashes
          containerCrashes = [int]$containerCrashes
          oomKilled = [int]$oomKilled
          telemetryBefore = $before
          telemetryAfter = $after
          resourceSamples = @($resourceSamples)
          summary = $summary
        })
        Write-Output "benchmark workload=$workload repetition=$repetition workers=$workerCount exit=$exitCode wall=$([math]::Round(($finished-$started).TotalSeconds,1))s"
      }
    }
  }
} finally {
  if ($windowHost) { Release-AtlasHostAdmission $windowHost }
  if ($windowSlot -and $windowSlot.Stream) { $windowSlot.Stream.Dispose() }
  if ($windowLegacy -and $windowLegacy.Stream) { $windowLegacy.Stream.Dispose() }
  foreach ($entry in $originalEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
}

$result = [pscustomobject][ordered]@{
  schemaVersion = 2
  kind = 'atlas-e2e-worker-calibration'
  selectionApplied = $false
  atlasRevision = $fingerprint.atlasRevision
  workloadDigest = $workloadDigest
  requestedWorkers = @($Workers)
  requestedWorkloads = @($Workloads)
  repetitions = $Repetitions
  coldBuildTimeMs = $coldBuildMs
  fingerprint = $fingerprint
  runs = @($runs)
}
$result | ConvertTo-Json -Depth 24 | Set-Content -LiteralPath $OutputPath -Encoding utf8
Write-Output "benchmark-workers=CAPTURED output=$OutputPath"
if (@($runs | Where-Object { $_.exitCode -ne 0 -or -not $_.summary -or $_.summary.status -ne 'passed' -or $_.summary.retries -ne 0 -or $_.firstRunFailures -ne 0 -or $_.browserCrashes -ne 0 -or $_.containerCrashes -ne 0 -or $_.oomKilled -ne 0 }).Count -gt 0) { exit 2 }
