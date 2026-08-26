$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'heavy-slot-pool.ps1')

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

$oldCount = $env:ATLAS_E2E_SLOT_COUNT
$oldSlot = $env:ATLAS_E2E_SLOT
$projectA = "slot-selftest-a-$PID"
$projectB = "slot-selftest-b-$PID"
$legacyLockPath = Join-Path ([IO.Path]::GetTempPath()) "slot-selftest-$PID-legacy.lock"
$slotPrefix = "slot-selftest-$PID-slot-"
$hostPrefix = "host-selftest-$PID-admission-"
$diagnosticFencePath = Join-Path ([IO.Path]::GetTempPath()) "host-selftest-$PID-diagnostic-slot3-migration-fence.lock"
$projectLease = $null
$artifactLease = $null
$fence1 = $null
$fence2 = $null
$slot1 = $null
$slot2 = $null
$slot3 = $null
$host1 = $null
$host2 = $null
$host3 = $null
try {
  Remove-Item Env:ATLAS_E2E_SLOT_COUNT -ErrorAction SilentlyContinue
  Remove-Item Env:ATLAS_E2E_SLOT -ErrorAction SilentlyContinue
  $config = Resolve-AtlasHeavySlotConfig -DefaultSlotCount 2
  Assert-True ($config.SlotCount -eq 2) 'default slot count did not round-trip'

  $env:ATLAS_E2E_SLOT_COUNT = '4'
  try { Resolve-AtlasHeavySlotConfig | Out-Null; throw 'invalid slot count accepted' } catch { Assert-True ($_.Exception.Message -match '1 through 3') 'wrong invalid-count failure' }
  $env:ATLAS_E2E_SLOT_COUNT = '2'
  $env:ATLAS_E2E_SLOT = '3'
  try { Resolve-AtlasHeavySlotConfig | Out-Null; throw 'out-of-range requested slot accepted' } catch { Assert-True ($_.Exception.Message -match '1 through 2') 'wrong requested-slot failure' }
  Remove-Item Env:ATLAS_E2E_SLOT -ErrorAction SilentlyContinue
  $projectLease = Acquire-AtlasProjectLock -Project $projectA -Revision 'selftest'
  try {
    Acquire-AtlasProjectLock -Project $projectA -Revision 'duplicate' | Out-Null
    throw 'duplicate project lock accepted'
  } catch {
    Assert-True ($_.Exception.Message -match 'already active') 'wrong duplicate-project failure'
  }

  $artifactPath = Join-Path ([IO.Path]::GetTempPath()) "slot-selftest-artifacts-$PID"
  $artifactLease = Acquire-AtlasArtifactLock -ArtifactPath $artifactPath -Project $projectA -Revision 'selftest'
  try {
    Acquire-AtlasArtifactLock -ArtifactPath $artifactPath -Project $projectB -Revision 'duplicate' | Out-Null
    throw 'duplicate artifact namespace accepted'
  } catch {
    Assert-True ($_.Exception.Message -match 'artifact namespace is already active') 'wrong duplicate-artifact failure'
  }

  $fence1 = Acquire-AtlasLegacyFence -TimeoutSeconds 2 -Project $projectA -Revision 'selftest' -LockPath $legacyLockPath
  $fence2 = Acquire-AtlasLegacyFence -TimeoutSeconds 2 -Project $projectB -Revision 'selftest' -LockPath $legacyLockPath
  try {
    $legacyExclusive = [IO.File]::Open($fence1.Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $legacyExclusive.Dispose()
    throw 'legacy exclusive runner entered while shared slot fences were active'
  } catch [IO.IOException] { }

  $slot1 = Acquire-AtlasHeavySlot -SlotCount 2 -RequestedSlot $null -TimeoutSeconds 2 -Project $projectA -Revision 'selftest' -SlotPrefix $slotPrefix
  $slot2 = Acquire-AtlasHeavySlot -SlotCount 2 -RequestedSlot $null -TimeoutSeconds 2 -Project $projectB -Revision 'selftest' -SlotPrefix $slotPrefix
  Assert-True ($slot1.SlotId -ne $slot2.SlotId) 'two active leases received the same slot'
  Assert-True (@($slot1.SlotId, $slot2.SlotId).Contains(1)) 'slot 1 was not allocated'
  Assert-True (@($slot1.SlotId, $slot2.SlotId).Contains(2)) 'slot 2 was not allocated'

  try {
    Acquire-AtlasHeavySlot -SlotCount 2 -RequestedSlot $null -TimeoutSeconds 1 -Project 'slot-selftest-c' -Revision 'selftest' -SlotPrefix $slotPrefix | Out-Null
    throw 'third lease entered a two-slot pool'
  } catch {
    Assert-True ($_.Exception.Message -match 'Timed out') 'wrong exhausted-pool failure'
  }
  $releasedId = $slot1.SlotId
  $slot1.Stream.Dispose()
  $slot1 = $null
  $slot3 = Acquire-AtlasHeavySlot -SlotCount 2 -RequestedSlot $releasedId -TimeoutSeconds 2 -Project 'slot-selftest-c' -Revision 'selftest' -SlotPrefix $slotPrefix
  Assert-True ($slot3.SlotId -eq $releasedId) 'released slot was not reusable'

  $host1 = Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 2 -Project $projectA -Revision 'selftest' -HostPrefix $hostPrefix
  $host2 = Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 2 -Project $projectB -Revision 'selftest' -HostPrefix $hostPrefix
  Assert-True ($host1.TokenId -ne $host2.TokenId) 'host admissions reused the same token'
  try {
    Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 1 -Project 'host-selftest-c' -Revision 'selftest' -HostPrefix $hostPrefix -DiagnosticSlotFencePath $diagnosticFencePath | Out-Null
    throw 'third host admission entered measured two-job capacity'
  } catch {
    Assert-True ($_.Exception.Message -match 'Timed out') 'wrong third host admission failure'
  }
  $releasedHostId = $host1.TokenId
  Release-AtlasHostAdmission $host1
  $host1 = $null
  $host3 = Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 2 -Project 'host-selftest-c' -Revision 'selftest' -HostPrefix $hostPrefix -DiagnosticSlotFencePath $diagnosticFencePath
  Assert-True ($host3.TokenId -eq $releasedHostId) 'released host admission token was not reusable'
  try {
    $legacyDiagnostic = [IO.File]::Open($diagnosticFencePath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $legacyDiagnostic.Dispose()
    throw 'legacy diagnostic slot three entered while host admissions held migration fence'
  } catch [IO.IOException] { }

  Release-AtlasHostAdmission $host2
  $host2 = $null
  Release-AtlasHostAdmission $host3
  $host3 = $null
  $legacyDiagnostic = [IO.File]::Open($diagnosticFencePath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  try {
    try {
      Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 1 -Project 'host-selftest-legacy-block' -Revision 'selftest' -HostPrefix $hostPrefix -DiagnosticSlotFencePath $diagnosticFencePath | Out-Null
      throw 'host admission entered while legacy diagnostic slot three was active'
    } catch {
      Assert-True ($_.Exception.Message -match 'migration fence') 'wrong legacy diagnostic migration-fence failure'
    }
  } finally {
    $legacyDiagnostic.Dispose()
  }
  $host3 = Acquire-AtlasHostAdmission -HostCapacity 2 -TimeoutSeconds 2 -Project 'host-selftest-after-legacy' -Revision 'selftest' -HostPrefix $hostPrefix -DiagnosticSlotFencePath $diagnosticFencePath
  Assert-True ($host3.TokenId -ge 1) 'host admission did not recover after legacy diagnostic slot three released'

  Write-Output 'heavy-e2e-slot-pool-self-test=PASS'
} finally {
  foreach ($hostLease in @($host3, $host2, $host1)) { Release-AtlasHostAdmission $hostLease }
  foreach ($lease in @($slot3, $slot2, $slot1, $fence2, $fence1, $artifactLease, $projectLease)) {
    if ($lease -and $lease.Stream) { $lease.Stream.Dispose() }
  }
  if ($null -eq $oldCount) { Remove-Item Env:ATLAS_E2E_SLOT_COUNT -ErrorAction SilentlyContinue } else { $env:ATLAS_E2E_SLOT_COUNT = $oldCount }
  if ($null -eq $oldSlot) { Remove-Item Env:ATLAS_E2E_SLOT -ErrorAction SilentlyContinue } else { $env:ATLAS_E2E_SLOT = $oldSlot }
}
