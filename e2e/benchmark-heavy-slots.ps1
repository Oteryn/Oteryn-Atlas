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
. (Join-Path $PSScriptRoot 'heavy-slot-pool.ps1')
$revision = (git rev-parse HEAD).Trim()
$runScriptPath = (Resolve-Path (Join-Path $PSScriptRoot 'run.ps1')).Path
$runScriptLiteral = $runScriptPath.Replace("'", "''")
if (-not $OutputPath) { $OutputPath = Join-Path $root "artifacts\e2e\$Prefix\benchmark.json" }
$benchmarkDir = Split-Path $OutputPath -Parent
New-Item -ItemType Directory -Force -Path $benchmarkDir | Out-Null

function Get-SystemSample {
  $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $cpuMetricAvailable = $null -ne $cpu
  $os = Get-CimInstance Win32_OperatingSystem
  [pscustomobject][ordered]@{
    atUtc = [DateTime]::UtcNow.ToString('o')
    cpuMetricAvailable = $cpuMetricAvailable
    cpuPercent = if ($cpuMetricAvailable) { [math]::Round([double]$cpu, 2) } else { $null }
    freeMemoryGiB = [math]::Round(([double]$os.FreePhysicalMemory / 1MB), 2)
  }
}

function Read-RunExitCode {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $raw = (Get-Content -LiteralPath $Path -Raw).Trim()
  $parsed = 0
  if (-not [int]::TryParse($raw, [ref]$parsed)) { return $null }
  $parsed
}

function Get-PublicationRevision {
  $url = ($PublicationOrigin.TrimEnd('/')) + '/web/fullworld.html'
  $response = Invoke-WebRequest -UseBasicParsing -Method Head -Uri $url -TimeoutSec 10
  if ([int]$response.StatusCode -ne 200) { throw "Publication revision probe returned HTTP $([int]$response.StatusCode)." }
  $served = [string]$response.Headers['X-Oteryn-Atlas-Revision']
  if ([string]::IsNullOrWhiteSpace($served)) { throw 'Publication revision probe returned no X-Oteryn-Atlas-Revision header.' }
  $served.Trim()
}

if ($SelfTest) {
  $samples = @(Get-SystemSample; Get-SystemSample)
  $cpuSamples = @($samples | Where-Object { $_.cpuMetricAvailable -and $null -ne $_.cpuPercent })
  $minFree = ($samples | Measure-Object -Property freeMemoryGiB -Minimum).Minimum
  if ($samples.Count -ne 2 -or $null -eq $minFree) {
    throw 'Benchmark system-sample aggregation self-test failed.'
  }
  $exitSelfTest = Join-Path $benchmarkDir 'benchmark-exit-code-selftest.txt'
  $exitChild = Join-Path $benchmarkDir 'benchmark-exit-child-selftest.ps1'
  $exitWrapper = Join-Path $benchmarkDir 'benchmark-exit-wrapper-selftest.ps1'
  $exitChildLiteral = $exitChild.Replace("'", "''")
  $exitSelfTestLiteral = $exitSelfTest.Replace("'", "''")
  [IO.File]::WriteAllText($exitChild, 'exit 7' + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
  $exitWrapperText = @"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$exitChildLiteral'
`$runExitCode = `$LASTEXITCODE
[IO.File]::WriteAllText('$exitSelfTestLiteral', [string]`$runExitCode, (New-Object Text.UTF8Encoding(`$false)))
exit `$runExitCode
"@
  [IO.File]::WriteAllText($exitWrapper, $exitWrapperText, (New-Object Text.UTF8Encoding($false)))
  $exitWrapperProcess = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$exitWrapper) -PassThru -Wait
  if ((Read-RunExitCode -Path $exitSelfTest) -ne 7) { throw 'Benchmark launcher did not persist a child exit code across a PowerShell exit boundary.' }
  [IO.File]::WriteAllText($exitSelfTest, 'invalid', (New-Object Text.UTF8Encoding($false)))
  if ($null -ne (Read-RunExitCode -Path $exitSelfTest)) { throw 'Benchmark exit-code parser accepted malformed evidence.' }
  Remove-Item -LiteralPath $exitSelfTest,$exitChild,$exitWrapper -Force
  Write-Output "benchmark-heavy-slots-self-test=PASS samples=$($samples.Count) cpuMetricAvailable=$($cpuSamples.Count -gt 0)"
  exit 0
}

$benchmarkFence = Acquire-AtlasLegacyFence -TimeoutSeconds 21600 -Project $Prefix -Revision $revision
Write-Output "benchmark legacy fence acquired: $($benchmarkFence.Path)"

$cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
$osInfo = Get-CimInstance Win32_OperatingSystem
$groups = @()
$benchmarkPublicationRevision = Get-PublicationRevision
$warmProject = "$Prefix-warm"
docker compose -p $warmProject -f e2e\compose.yml build e2e atlas-web | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Docker warm build failed with exit code $LASTEXITCODE." }

docker compose -p $warmProject -f e2e\compose.yml down --remove-orphans *> $null

for ($slotCount = 1; $slotCount -le $MaxSlots; $slotCount += 1) {
  $publicationRevisionBefore = Get-PublicationRevision
  $started = [DateTime]::UtcNow
  $processes = @()
  $runSpecs = @()
  for ($slot = 1; $slot -le $slotCount; $slot += 1) {
    $project = "$Prefix-c$slotCount-s$slot"
    $launcher = Join-Path $benchmarkDir "$project.launch.ps1"
    $stdout = Join-Path $benchmarkDir "$project.stdout.log"
    $stderr = Join-Path $benchmarkDir "$project.stderr.log"
    $exitCodePath = Join-Path $benchmarkDir "$project.exit-code.txt"
    Remove-Item -LiteralPath $exitCodePath -Force -ErrorAction SilentlyContinue
    $exitCodeLiteral = $exitCodePath.Replace("'", "''")
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
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$runScriptLiteral'
`$runExitCode = `$LASTEXITCODE
[IO.File]::WriteAllText('$exitCodeLiteral', [string]`$runExitCode, (New-Object Text.UTF8Encoding(`$false)))
exit `$runExitCode
"@
    [IO.File]::WriteAllText($launcher, $launcherText, (New-Object Text.UTF8Encoding($false)))
    $process = Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$launcher) -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $processes += $process
    $runSpecs += [pscustomobject]@{ Slot = $slot; Project = $project; Stdout = $stdout; Stderr = $stderr; ExitCodePath = $exitCodePath; Process = $process }
  }

  $samples = @()
  while (@($processes | Where-Object { -not $_.HasExited }).Count -gt 0) {
    $samples += Get-SystemSample
    Start-Sleep -Seconds 5
  }
  foreach ($process in $processes) { $process.WaitForExit() }
  $completed = [DateTime]::UtcNow
  $publicationRevisionAfter = Get-PublicationRevision
  $revisionStable = $publicationRevisionBefore -eq $benchmarkPublicationRevision -and $publicationRevisionAfter -eq $benchmarkPublicationRevision
  $wallSeconds = ($completed - $started).TotalSeconds

  $runs = @()
  foreach ($spec in $runSpecs) {
    $summaryPath = Join-Path $root "artifacts\e2e\$($spec.Project)\summary.json"
    $summary = if (Test-Path $summaryPath) { Get-Content $summaryPath -Raw | ConvertFrom-Json } else { $null }
    $scenarios = if ($summary) { @($summary.scenarios) } else { @() }
    $exitCode = Read-RunExitCode -Path $spec.ExitCodePath
    $runs += [ordered]@{
      slot = $spec.Slot
      project = $spec.Project
      exitCode = $exitCode
      exitCodeEvidencePath = $spec.ExitCodePath
      summaryPath = $summaryPath
      summaryStatus = if ($summary) { [string]$summary.status } else { 'missing' }
      scenarioCount = $scenarios.Count
      nonPassed = @($scenarios | Where-Object { $_.status -ne 'passed' }).Count
      retried = @($scenarios | Where-Object { [int]$_.retry -ne 0 }).Count
      workers = if ($summary) { [int]$summary.metadata.workers } else { $null }
    }
  }
  if ($samples.Count -eq 0) { $samples += Get-SystemSample }
  $cpuSamples = @($samples | Where-Object { $_.cpuMetricAvailable -and $null -ne $_.cpuPercent })
  $maxCpu = if ($cpuSamples.Count -gt 0) { ($cpuSamples | Measure-Object -Property cpuPercent -Maximum).Maximum } else { $null }
  $minFree = ($samples | Measure-Object -Property freeMemoryGiB -Minimum).Minimum
  $allPassed = @($runs | Where-Object {
    $null -eq $_.exitCode -or $_.exitCode -ne 0 -or $_.summaryStatus -ne 'passed' -or $_.nonPassed -ne 0 -or $_.retried -ne 0 -or $_.workers -ne 1
  }).Count -eq 0 -and $revisionStable
  $groups += [ordered]@{
    slotCount = $slotCount
    status = if ($allPassed) { 'passed' } else { 'failed' }
    startedAtUtc = $started.ToString('o')
    completedAtUtc = $completed.ToString('o')
    wallSeconds = [math]::Round($wallSeconds, 3)
    gatesPerHour = [math]::Round(($slotCount * 3600.0 / $wallSeconds), 3)
    cpuMetricAvailable = $cpuSamples.Count -gt 0
    maxCpuPercent = if ($null -ne $maxCpu) { [double]$maxCpu } else { $null }
    minFreeMemoryGiB = [double]$minFree
    publicationRevisionBefore = $publicationRevisionBefore
    publicationRevisionAfter = $publicationRevisionAfter
    publicationRevisionStable = $revisionStable
    samples = $samples
    runs = $runs
  }
  Write-Output "benchmark slots=$slotCount status=$(if ($allPassed) {'passed'} else {'failed'}) wall=$([math]::Round($wallSeconds,1))s throughput=$([math]::Round(($slotCount*3600/$wallSeconds),2))/h"
}

$result = [ordered]@{
  version = 1
  atlasRevision = $revision
  publicationOrigin = $PublicationOrigin
  publicationRevision = $benchmarkPublicationRevision
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
$benchmarkFailed = @($groups | Where-Object { $_.status -ne 'passed' }).Count -gt 0
if ($benchmarkFence -and $benchmarkFence.Stream) { $benchmarkFence.Stream.Dispose() }
if ($benchmarkFailed) { exit 2 }
