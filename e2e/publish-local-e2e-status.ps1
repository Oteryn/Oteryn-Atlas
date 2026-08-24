[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SummaryPath,
  [Parameter(Mandatory = $true)][string]$RemoteBranch,
  [string]$Repository = 'Oteryn/Oteryn-Atlas',
  [string]$Context = 'atlas-local-e2e',
  [string]$VisualReviewPath
)

$ErrorActionPreference = 'Stop'
$ExpectedScenarioCount = 58
$VisualContractPath = Join-Path $PSScriptRoot 'user-visual-scenarios.json'
$VisualContract = Get-Content $VisualContractPath -Raw | ConvertFrom-Json
if ([int]$VisualContract.version -ne 1) { throw 'Unsupported visual user acceptance contract version.' }
$RequiredVisualScenarios = @($VisualContract.scenarios)
if ($RequiredVisualScenarios.Count -eq 0) { throw 'Visual user acceptance contract contains no scenarios.' }
$visualContractSha256 = 'sha256:' + (Get-FileHash $VisualContractPath -Algorithm SHA256).Hash.ToLowerInvariant()
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

if (-not $VisualReviewPath) { $VisualReviewPath = Join-Path (Split-Path $resolvedSummary -Parent) 'visual-review.json' }
$resolvedReview = (Resolve-Path $VisualReviewPath).Path
$review = Get-Content $resolvedReview -Raw | ConvertFrom-Json
if ($review.status -ne 'approved') { throw "Visual review status is $($review.status), not approved." }
if ($review.atlasRevision -ne $sha) { throw 'Visual review revision does not match tested HEAD.' }
if ([string]::IsNullOrWhiteSpace([string]$review.reviewedBy)) { throw 'Visual review has no reviewer identity.' }
$summaryDigest = 'sha256:' + (Get-FileHash $resolvedSummary -Algorithm SHA256).Hash.ToLowerInvariant()
if ($review.summarySha256 -ne $summaryDigest) { throw 'Visual review is not bound to this exact Playwright summary.' }
if ([int]$review.visualContractVersion -ne [int]$VisualContract.version) { throw 'Visual review contract version mismatch.' }
if ($review.visualContractSha256 -ne $visualContractSha256) { throw 'Visual review is not bound to the current visual scenario contract.' }
$reviewScenarios = @($review.requiredScenarios)
if ($reviewScenarios.Count -ne $RequiredVisualScenarios.Count) { throw 'Visual review required-scenario census mismatch.' }
foreach ($required in $RequiredVisualScenarios) {
  $scenarioId = [string]$required.id
  $requiredProject = [string]$required.project
  if ($reviewScenarios -notcontains $scenarioId) { throw "Visual review is missing required scenario $scenarioId." }
  $entries = @($review.evidence | Where-Object { $_.scenarioId -eq $scenarioId })
  if ($entries.Count -ne 1) { throw "Visual review evidence census for $scenarioId is $($entries.Count), expected 1." }
  if ([string]$entries[0].browserProfile -ne $requiredProject) { throw "Visual review browser profile mismatch for $scenarioId." }
  $reviewRoot = (Resolve-Path (Split-Path $resolvedReview -Parent)).Path.TrimEnd('\', '/')
  $reviewRootPrefix = $reviewRoot + [IO.Path]::DirectorySeparatorChar
  $relativeScreenshot = ([string]$entries[0].screenshotPath).Replace('/', '\')
  $resolvedScreenshot = (Resolve-Path (Join-Path $reviewRoot $relativeScreenshot)).Path
  if (-not $resolvedScreenshot.StartsWith($reviewRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Visual review screenshot escaped review root.' }
  $digest = 'sha256:' + (Get-FileHash $resolvedScreenshot -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($digest -ne $entries[0].screenshotSha256) { throw "Visual review screenshot changed after approval for $scenarioId." }
}

$description = "Local Docker Playwright $($scenarios.Count)/$($scenarios.Count) PASS; visual review approved"
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
