function Resolve-AtlasHeavySlotConfig {
  param([int]$DefaultSlotCount = 1)

  $slotCount = $DefaultSlotCount
  if ($env:ATLAS_E2E_SLOT_COUNT) {
    $parsed = 0
    if (-not [int]::TryParse($env:ATLAS_E2E_SLOT_COUNT, [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt 3) {
      throw 'ATLAS_E2E_SLOT_COUNT must be an integer from 1 through 3.'
    }
    $slotCount = $parsed
  }

  $requestedSlot = $null
  if ($env:ATLAS_E2E_SLOT) {
    $parsed = 0
    if (-not [int]::TryParse($env:ATLAS_E2E_SLOT, [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt $slotCount) {
      throw "ATLAS_E2E_SLOT must be an integer from 1 through $slotCount."
    }
    $requestedSlot = $parsed
  }

  [pscustomobject]@{ SlotCount = $slotCount; RequestedSlot = $requestedSlot }
}

function Write-AtlasLeaseOwner {
  param([IO.FileStream]$Stream, [string]$Owner)
  $bytes = [Text.Encoding]::UTF8.GetBytes("$Owner`n")
  $Stream.SetLength(0)
  $Stream.Write($bytes, 0, $bytes.Length)
  $Stream.Flush()
}

function Acquire-AtlasProjectLock {
  param([string]$Project, [string]$Revision)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Project))
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
  } finally { $sha.Dispose() }

  $projectLockPath = Join-Path ([IO.Path]::GetTempPath()) "oteryn-atlas-e2e-project-$hash.lock"
  try {
    $projectStream = [IO.File]::Open($projectLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch [IO.IOException] {
    throw "Atlas E2E project identity is already active: $Project"
  }
  Write-AtlasLeaseOwner $projectStream "pid=$PID project=$Project revision=$Revision"
  [pscustomobject]@{ Stream = $projectStream; Path = $projectLockPath }
}

function Acquire-AtlasArtifactLock {
  param([string]$ArtifactPath, [string]$Project, [string]$Revision)
  $canonical = [IO.Path]::GetFullPath($ArtifactPath).ToLowerInvariant()
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
  } finally { $sha.Dispose() }

  $artifactLockPath = Join-Path ([IO.Path]::GetTempPath()) "oteryn-atlas-e2e-artifacts-$hash.lock"
  try {
    $artifactStream = [IO.File]::Open($artifactLockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch [IO.IOException] {
    throw "Atlas E2E artifact namespace is already active: $canonical"
  }
  Write-AtlasLeaseOwner $artifactStream "pid=$PID project=$Project revision=$Revision artifacts=$canonical"
  [pscustomobject]@{ Stream = $artifactStream; Path = $artifactLockPath; ArtifactPath = $canonical }
}

function Acquire-AtlasLegacyFence {
  param([int]$TimeoutSeconds, [string]$Project, [string]$Revision, [string]$LockPath = '')
  $path = if ($LockPath) { [IO.Path]::GetFullPath($LockPath) } else { Join-Path ([IO.Path]::GetTempPath()) 'oteryn-atlas-heavy-e2e.lock' }
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ($true) {
    try {
      $stream = [IO.File]::Open($path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::ReadWrite)
      return [pscustomobject]@{ Stream = $stream; Path = $path }
    } catch [IO.IOException] {
      if ([DateTime]::UtcNow -ge $deadline) { throw "Timed out waiting for legacy Atlas heavy E2E runners: $path" }
      Start-Sleep -Milliseconds 500
    }
  }
}

function Acquire-AtlasHeavySlot {
  param(
    [int]$SlotCount,
    [Nullable[int]]$RequestedSlot,
    [int]$TimeoutSeconds,
    [string]$Project,
    [string]$Revision,
    [string]$SlotPrefix = 'oteryn-atlas-heavy-e2e-slot-'
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ($true) {
    $candidates = if ($null -ne $RequestedSlot) { @([int]$RequestedSlot) } else { @(1..$SlotCount) }
    foreach ($slotId in $candidates) {
      $slotPath = Join-Path ([IO.Path]::GetTempPath()) "$SlotPrefix$slotId.lock"
      try {
        $slotStream = [IO.File]::Open($slotPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        Write-AtlasLeaseOwner $slotStream "pid=$PID slot=$slotId/$SlotCount project=$Project revision=$Revision"
        return [pscustomobject]@{ SlotId = $slotId; SlotCount = $SlotCount; Stream = $slotStream; Path = $slotPath }
      } catch [IO.IOException] { }
    }
    if ([DateTime]::UtcNow -ge $deadline) {
      $scope = if ($null -ne $RequestedSlot) { "slot $RequestedSlot" } else { "$SlotCount Atlas heavy E2E slots" }
      throw "Timed out waiting for $scope."
    }
    Start-Sleep -Milliseconds 500
  }
}
