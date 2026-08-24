[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SummaryPath,
  [Parameter(Mandatory = $true)][string]$RemoteBranch,
  [string]$Repository = 'Oteryn/Oteryn-Atlas',
  [string]$Context = 'atlas-local-e2e'
)

$ErrorActionPreference = 'Stop'
$ExpectedScenarioCount = 50
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$sha = (git rev-parse HEAD).Trim()
if (-not $sha) { throw 'Unable to resolve Atlas HEAD.' }
$dirty = @(git status --porcelain)
if ($dirty.Count -ne 0) { throw 'Refusing to publish E2E status from a dirty working tree.' }

$remoteLine = (git ls-remote --heads origin "refs/heads/$RemoteBranch").Trim()
if (-not $remoteLine) { throw "Remote branch $RemoteBranch does not exist." }
$remoteSha = ($remoteLine -split '\s+')[0]
if ($remoteSha -ne $sha) { throw "Remote branch head $remoteSha does not match tested HEAD $sha." }

$resolvedSummary = (Resolve-Path $SummaryPath).Path
$summary = Get-Content $resolvedSummary -Raw | ConvertFrom-Json
if ($summary.status -ne 'passed') { throw "Playwright summary status is $($summary.status), not passed." }
if ($summary.metadata.expectedRevision -ne $sha) { throw 'Playwright expectedRevision does not match tested HEAD.' }
if ($summary.metadata.targetMode -ne 'checkout-overlay') { throw 'Playwright summary is not checkout-overlay evidence.' }
if ([int]$summary.metadata.workers -ne 1) { throw 'Playwright summary was not produced with workers=1.' }

$scenarios = @($summary.scenarios)
if ($scenarios.Count -ne $ExpectedScenarioCount) { throw "Playwright summary contains $($scenarios.Count) scenarios; expected $ExpectedScenarioCount." }
$notPassed = @($scenarios | Where-Object { $_.status -ne 'passed' })
if ($notPassed.Count -ne 0) { throw "Playwright summary contains $($notPassed.Count) non-passed scenarios." }
$retried = @($scenarios | Where-Object { [int]$_.retry -ne 0 })
if ($retried.Count -ne 0) { throw "Playwright summary contains $($retried.Count) retried scenarios." }

$description = "Local Docker Playwright $($scenarios.Count)/$($scenarios.Count) PASS; retries=0"
$targetUrl = "https://github.com/$Repository/commit/$sha"
$payload = @{
  state = 'success'
  context = $Context
  description = $description
  target_url = $targetUrl
} | ConvertTo-Json -Compress

$payload | gh api --method POST "repos/$Repository/statuses/$sha" --input - | Out-Null
if ($LASTEXITCODE -ne 0) { throw "GitHub status publication failed with exit code $LASTEXITCODE." }
Write-Output "Published $Context=success for $sha ($description)"
