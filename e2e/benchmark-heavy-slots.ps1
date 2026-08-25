[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PublicationOrigin,
  [ValidateRange(1, 3)][int]$MaxSlots = 3,
  [string]$OutputPath,
  [string]$Prefix = "atlas-slot-benchmark-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))",
  [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$revision = (git rev-parse HEAD).Trim()
if (-not $OutputPath) { $OutputPath = Join-Path $root "artifacts\e2e\$Prefix\benchmark.json" }
$benchmarkDir = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Force -Path $benchmarkDir | Out-Null

function Get-SystemSample {
  $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $os = Get-CimInstance Win32_OperatingSystem
  [pscustomobject][ordered]@{
    atUtc = [DateTime]::UtcNow.ToString('o')
    cpuPercent = [double]$cpu
    freeMemoryGiB = [math]::Round(([double]$os.FreePhysicalMemory / 1MB), 2)
  }
}

if ($SelfTest) {
  $samples = @(Get-SystemSample; Get-SystemSample)
  $maxCpu = ($samples | Measure-Object -Property cpuPercent -Maximum).Maximum
  $minFree = ($samples | Measure-Object -Property freeMemoryGiB -Minimum).Minimum
  if ($samples.Count -ne 2 -or $null -eq $maxCpu -or $null -eq $minFree) {
    throw 'Benchmark system-sample aggregation self-test failed.'
  }
  Write-Output "benchmark-heavy-slots-self-test=PASS samples=$($samples.Count)"
  exit 0
}

$cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
$osInfo = Get-CimInstance Win32_OperatingSystem
$groups = @()
$warmProject = "$Prefix-warm"
docker compose -p $warmProject -f e2e\compose.yml build e2e atlas-web | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Docker warm build failed with exit code $LASTEXITCODE." }

docker compose -p $warmProject -f e2e\compose.yml down --remove-orphans *> $null

for ($slotCount = 1; $slotCount -le $MaxSlots; $slotCount += 1) {
  $started = [DateTime]::UtcNow
  $processes = @()
  $runSpecs = @()
  for ($slot = 1; $slot -le $slotCount; $slot += 1) {
    $project = "$Prefix-c$slotCount-s$slot"
    $launcher = Join-Path $benchmarkDir "$project.launch.ps1"
    $stdout = Join-Path $benchmarkDir "$project.stdout.log"
    $stderr = Join-Path $benchmarkDir "$project.stderr.log"
    $launcherText = @"
`$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath '$root'
Remove-Item Env:ATLAS_BASE_URL -ErrorAction SilentlyContinue
`$env:ATLAS_PUBLICATION_ORIGIN = '$PublicationOrigin'
`$env:ATLAS_CODE_REVISION = '$revision'
`$env:ATLAS_E2E_SLOT_COUNT = '$slotCount'
`$env:ATLAS_E2E_SLOT = '$slot'
`$env:ATLAS_E2E_WORKERS = '1'
`$env:ATLAS_E2E_PROJECT = '$project'
`$env:ATLAS_E2E_LOCK_TIMEOUT_SECONDS = '7200'
& '.\e2e\run.ps1'
exit `$LASTEXITCODE
"@
    [IO.File]::WriteAllText($launcher, $launcherText, (New-Object Text.UTF8Encoding($false)))
    $process = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$launcher) -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $processes += $process
    $runSpecs += [pscustomobject]@{ Slot = $slot; Project = $project; Stdout = $stdout; Stderr = $stderr; Process = $process }
  }

  $samples = @()
  while (@($processes | Where-Object { -not $_.HasExited }).Count -gt 0) {
    $samples += Get-SystemSample
    Start-Sleep -Seconds 5
  }
  foreach ($process in $processes) { $process.WaitForExit() }
  $completed = [DateTime]::UtcNow
  $wallSeconds = ($completed - $started).TotalSeconds

  $runs = @()
  foreach ($spec in $runSpecs) {
    $summaryPath = Join-Path $root "artifacts\e2e\$($spec.Project)\summary.json"
    $summary = if (Test-Path $summaryPath) { Get-Content $summaryPath -Raw | ConvertFrom-Json } else { $null }
    $scenarios = if ($summary) { @($summary.scenarios) } else { @() }
    $runs += [ordered]@{
      slot = $spec.Slot
      project = $spec.Project
      exitCode = $spec.Process.ExitCode
      summaryPath = $summaryPath
      summaryStatus = if ($summary) { [string]$summary.status } else { 'missing' }
      scenarioCount = $scenarios.Count
      nonPassed = @($scenarios | Where-Object { $_.status -ne 'passed' }).Count
      retried = @($scenarios | Where-Object { [int]$_.retry -ne 0 }).Count
      workers = if ($summary) { [int]$summary.metadata.workers } else { $null }
    }
  }
  if ($samples.Count -eq 0) { $samples += Get-SystemSample }
  $maxCpu = ($samples | Measure-Object -Property cpuPercent -Maximum).Maximum
  $minFree = ($samples | Measure-Object -Property freeMemoryGiB -Minimum).Minimum
  $allPassed = @($runs | Where-Object {
    $_.exitCode -ne 0 -or $_.summaryStatus -ne 'passed' -or $_.nonPassed -ne 0 -or $_.retried -ne 0 -or $_.workers -ne 1
  }).Count -eq 0
  $groups += [ordered]@{
    slotCount = $slotCount
    status = if ($allPassed) { 'passed' } else { 'failed' }
    startedAtUtc = $started.ToString('o')
    completedAtUtc = $completed.ToString('o')
    wallSeconds = [math]::Round($wallSeconds, 3)
    gatesPerHour = [math]::Round(($slotCount * 3600.0 / $wallSeconds), 3)
    maxCpuPercent = [double]$maxCpu
    minFreeMemoryGiB = [double]$minFree
    samples = $samples
    runs = $runs
  }
  Write-Output "benchmark slots=$slotCount status=$(if ($allPassed) {'passed'} else {'failed'}) wall=$([math]::Round($wallSeconds,1))s throughput=$([math]::Round(($slotCount*3600/$wallSeconds),2))/h"
}

$result = [ordered]@{
  version = 1
  atlasRevision = $revision
  publicationOrigin = $PublicationOrigin
  hardware = [ordered]@{
    cpu = [string]$cpuInfo.Name
    physicalCores = [int]$cpuInfo.NumberOfCores
    logicalProcessors = [int]$cpuInfo.NumberOfLogicalProcessors
    totalMemoryGiB = [math]::Round(([double]$osInfo.TotalVisibleMemorySize / 1MB), 2)
  }
  groups = $groups
}
$json = $result | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($OutputPath, $json + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
Write-Output "benchmark-evidence=$OutputPath"
if (@($groups | Where-Object { $_.status -ne 'passed' }).Count -gt 0) { exit 2 }
