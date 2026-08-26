[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SummaryPath,
  [Parameter(Mandatory = $true)][string]$Reviewer,
  [switch]$ConfirmReviewedAllScreenshots,
  [string]$OutputPath,
  [string]$ReviewedHeadSha
)

$ErrorActionPreference = 'Stop'
$VisualContractPath = Join-Path $PSScriptRoot 'user-visual-scenarios.json'
$VisualContract = Get-Content $VisualContractPath -Raw | ConvertFrom-Json
if ([int]$VisualContract.version -ne 1) { throw 'Unsupported visual user acceptance contract version.' }
$RequiredScenarios = @($VisualContract.scenarios)
if ($RequiredScenarios.Count -eq 0) { throw 'Visual user acceptance contract contains no scenarios.' }
$visualContractSha256 = 'sha256:' + (Get-FileHash $VisualContractPath -Algorithm SHA256).Hash.ToLowerInvariant()

if (-not $ConfirmReviewedAllScreenshots) {
  throw 'Visual approval requires -ConfirmReviewedAllScreenshots after opening and reviewing every required screenshot.'
}
if ([string]::IsNullOrWhiteSpace($Reviewer)) { throw 'Reviewer is required.' }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$policySha = (git rev-parse HEAD).Trim()
if (-not $policySha) { throw 'Unable to resolve Atlas policy HEAD.' }
$sha = if ($ReviewedHeadSha) { $ReviewedHeadSha.Trim().ToLowerInvariant() } else { $policySha }
if ($sha -notmatch '^[a-f0-9]{40}$') { throw 'ReviewedHeadSha must be an exact 40-character lowercase commit SHA.' }
if (@(git status --porcelain).Count -ne 0) { throw 'Refusing visual approval from a dirty working tree.' }

$resolvedSummary = (Resolve-Path $SummaryPath).Path
$summary = Get-Content $resolvedSummary -Raw | ConvertFrom-Json
if ($summary.status -ne 'passed') { throw "Playwright summary status is $($summary.status), not passed." }
if ($summary.metadata.expectedRevision -ne $sha) { throw 'Playwright expectedRevision does not match reviewed HEAD.' }
if ($summary.metadata.targetMode -ne 'checkout-overlay') { throw 'Visual review requires checkout-overlay evidence.' }
if (@($summary.scenarios | Where-Object { $_.status -ne 'passed' }).Count -ne 0) { throw 'Playwright summary contains non-passed scenarios.' }
if (@($summary.scenarios | Where-Object { [int]$_.retry -ne 0 }).Count -ne 0) { throw 'Playwright summary contains retried scenarios.' }

$artifactRoot = Split-Path $resolvedSummary -Parent
$evidenceRoot = Join-Path $artifactRoot 'user-visual-evidence'
if (-not (Test-Path $evidenceRoot)) { throw "Visual evidence root not found: $evidenceRoot" }
$manifestFiles = @(Get-ChildItem $evidenceRoot -Recurse -Filter manifest.json -File)
$manifests = @($manifestFiles | ForEach-Object {
  [pscustomobject]@{ Path = $_.FullName; Data = (Get-Content $_.FullName -Raw | ConvertFrom-Json) }
})

$reviewed = @()
foreach ($required in $RequiredScenarios) {
  $scenarioId = [string]$required.id
  $requiredProject = [string]$required.project
  $matches = @($manifests | Where-Object { $_.Data.scenarioId -eq $scenarioId })
  if ($matches.Count -ne 1) { throw "Expected exactly one visual evidence manifest for $scenarioId; found $($matches.Count)." }
  $entry = $matches[0]
  if ($entry.Data.atlasRevision -ne $sha) { throw "Visual evidence $scenarioId revision mismatch." }
  if ($entry.Data.browserProfile -ne $requiredProject) { throw "Visual evidence $scenarioId browser profile $($entry.Data.browserProfile) does not match required $requiredProject." }
  $manifestDir = Split-Path $entry.Path -Parent
  $screenshot = (Resolve-Path (Join-Path $manifestDir $entry.Data.screenshot)).Path
  $digest = 'sha256:' + (Get-FileHash $screenshot -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($digest -ne $entry.Data.screenshotSha256) { throw "Visual evidence $scenarioId screenshot digest mismatch." }
  $artifactRootFull = (Resolve-Path $artifactRoot).Path.TrimEnd('\', '/')
  $artifactRootPrefix = $artifactRootFull + [IO.Path]::DirectorySeparatorChar
  if (-not $entry.Path.StartsWith($artifactRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest escaped artifact root.' }
  if (-not $screenshot.StartsWith($artifactRootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Screenshot escaped artifact root.' }
  $reviewed += [ordered]@{
    scenarioId = $scenarioId
    browserProfile = [string]$entry.Data.browserProfile
    manifestPath = $entry.Path.Substring($artifactRootPrefix.Length).Replace('\', '/')
    screenshotPath = $screenshot.Substring($artifactRootPrefix.Length).Replace('\', '/')
    screenshotSha256 = $digest
  }
}

$summaryDigest = 'sha256:' + (Get-FileHash $resolvedSummary -Algorithm SHA256).Hash.ToLowerInvariant()
$review = [ordered]@{
  version = 1
  status = 'approved'
  atlasRevision = $sha
  reviewedBy = $Reviewer
  reviewedAtUtc = [DateTime]::UtcNow.ToString('o')
  summarySha256 = $summaryDigest
  visualContractVersion = [int]$VisualContract.version
  visualContractSha256 = $visualContractSha256
  requiredScenarios = @($RequiredScenarios | ForEach-Object { [string]$_.id })
  evidence = $reviewed
}

if (-not $OutputPath) { $OutputPath = Join-Path $artifactRoot 'visual-review.json' }
$resolvedOutputDir = (Resolve-Path (Split-Path $OutputPath -Parent)).Path
$resolvedOutput = Join-Path $resolvedOutputDir (Split-Path $OutputPath -Leaf)
$review | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 $resolvedOutput
Write-Output "Approved user-facing visual evidence for ${sha}: $resolvedOutput (policyHead=$policySha)"