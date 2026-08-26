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


function Acquire-AtlasHostAdmission {
  param(
    [int]$HostCapacity = 2,
    [int]$TimeoutSeconds,
    [string]$Project,
    [string]$Revision,
    [string]$ResourceClass = 'browser-full',
    [string]$AuthorityMode = 'authoritative',
    [string]$HostPrefix = 'oteryn-atlas-host-admission-',
    [string]$DiagnosticSlotFencePath = ''
  )
  if ($HostCapacity -ne 2) {
    throw 'Bootstrap Molehill host capacity must remain at the measured value 2 until a versioned measured policy replaces it.'
  }
  if ($AuthorityMode -notin @('authoritative', 'diagnostic')) {
    throw 'AuthorityMode must be authoritative or diagnostic.'
  }

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $diagnosticFencePath = if ($DiagnosticSlotFencePath) {
    [IO.Path]::GetFullPath($DiagnosticSlotFencePath)
  } else {
    Join-Path ([IO.Path]::GetTempPath()) 'oteryn-atlas-heavy-e2e-slot-3.lock'
  }
  $diagnosticFenceStream = $null
  while ($null -eq $diagnosticFenceStream) {
    try {
      # New Phase-D runners share this handle with each other, while historical slot-3
      # runners use FileShare.None and therefore cannot enter during migration.
      $diagnosticFenceStream = [IO.File]::Open(
        $diagnosticFencePath,
        [IO.FileMode]::OpenOrCreate,
        [IO.FileAccess]::ReadWrite,
        [IO.FileShare]::ReadWrite
      )
    } catch [IO.IOException] {
      if ([DateTime]::UtcNow -ge $deadline) {
        throw "Timed out waiting for historical diagnostic slot-3 migration fence: $diagnosticFencePath"
      }
      Start-Sleep -Milliseconds 500
    }
  }

  try {
    while ($true) {
      foreach ($tokenId in 1..$HostCapacity) {
        $tokenPath = Join-Path ([IO.Path]::GetTempPath()) "$HostPrefix$tokenId.lock"
        try {
          $stream = [IO.File]::Open($tokenPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
          Write-AtlasLeaseOwner $stream "pid=$PID token=$tokenId/$HostCapacity class=$ResourceClass authority=$AuthorityMode project=$Project revision=$Revision"
          return [pscustomobject]@{
            TokenId = $tokenId
            HostCapacity = $HostCapacity
            ResourceClass = $ResourceClass
            AuthorityMode = $AuthorityMode
            Stream = $stream
            Path = $tokenPath
            DiagnosticFenceStream = $diagnosticFenceStream
            DiagnosticFencePath = $diagnosticFencePath
          }
        } catch [IO.IOException] { }
      }
      if ([DateTime]::UtcNow -ge $deadline) {
        throw "Timed out waiting for $HostCapacity shared Molehill host-admission tokens."
      }
      Start-Sleep -Milliseconds 500
    }
  } catch {
    if ($diagnosticFenceStream) { $diagnosticFenceStream.Dispose() }
    throw
  }
}

function Release-AtlasHostAdmission {
  param($Lease)
  if (-not $Lease) { return }
  if ($Lease.Stream) { $Lease.Stream.Dispose() }
  if ($Lease.DiagnosticFenceStream) { $Lease.DiagnosticFenceStream.Dispose() }
}
