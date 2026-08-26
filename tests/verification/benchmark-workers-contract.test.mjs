import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scriptPath = new URL('../../e2e/benchmark-workers.ps1', import.meta.url);

test('worker benchmark is measurement-only, repeatable and uses non-null telemetry sources', () => {
  assert.equal(fs.existsSync(scriptPath), true, 'missing worker benchmark harness');
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');

  assert.match(script, /\[switch\]\$SelfTest/);
  assert.match(script, /ValidateSet\(1, 2, 4, 6, 8\)/);
  assert.match(script, /ValidateSet\('full', 'targeted', 'broad'\)/);
  assert.match(script, /ValidateRange\(3, 5\)/);
  assert.match(script, /Get-Counter/);
  assert.match(script, /Get-CimInstance Win32_OperatingSystem/);
  assert.match(script, /docker stats --no-stream --format/);
  assert.match(script, /docker version --format/);
  assert.match(script, /docker info --format/);
  assert.match(script, /Get-ComputerInfo/);
  assert.match(script, /memoryPressurePercent/);
  assert.match(script, /diskQueueLength/);
  assert.match(script, /sharedMemory/);
  assert.match(script, /dockerStats/);
  assert.match(script, /dockerContainerCount/);
  assert.match(script, /Start-Process/);
  assert.match(script, /resourceSamples/);
  assert.match(script, /Select-Object -First 1 \| Select-Object Id, Path, StartTime/);
  assert.doesNotMatch(script, /Select-Object -First 1 Id, Path, StartTime/);
  assert.match(script, /\[IO\.Path\]::GetDirectoryName\(\[IO\.Path\]::GetFullPath\(\$OutputPath\)\)/);
  assert.doesNotMatch(script, /Split-Path -LiteralPath \$OutputPath -Parent/);
  assert.match(script, /PhysicalDisk\(_Total\)|LogicalDisk\(C:/);
  assert.doesNotMatch(script, /\$values\['\\\\Processor Information/);
  assert.match(script, /ATLAS_E2E_WORKERS/);
  assert.match(script, /ATLAS_E2E_BENCHMARK_WORKLOAD/);
  assert.match(script, /if \(\$SelfTest\)/);
  assert.doesNotMatch(script, /LoadPercentage/);
  assert.doesNotMatch(script, /Set-Content.*playwright\.config/i);
  assert.doesNotMatch(script, /git (?:commit|push|reset)/i);
});

test('benchmark outer cleanup removes a partially started active Compose project', () => {
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');
  assert.match(script, /\$activeProject\s*=\s*\$null/);
  assert.match(script, /\$activeProject\s*=\s*\$project/);
  assert.match(script, /finally\s*\{[\s\S]*if \(\$activeProject\)[\s\S]*docker compose -p \$activeProject -f e2e\\compose\.yml down --remove-orphans/);
  assert.match(script, /docker compose -p \$project -f e2e\\compose\.yml down --remove-orphans[\s\S]*\$activeProject\s*=\s*\$null/);
});

test('worker benchmark explicitly compares host IPC with per-container private shared memory', () => {
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');
  assert.match(script, /ValidateSet\('host', 'private'\).*\$IpcModes/);
  assert.match(script, /foreach \(\$ipcMode in \$IpcModes\)/);
  assert.match(script, /\$env:ATLAS_E2E_IPC_MODE\s*=\s*\$ipcMode/);
  assert.match(script, /\$env:ATLAS_E2E_SHM_SIZE\s*=\s*\$ShmSize/);
  assert.match(script, /ipcMode\s*=\s*\$ipcMode/);
  assert.match(script, /requestedIpcModes\s*=\s*@\(\$IpcModes\)/);
  assert.match(script, /ATLAS_E2E_IPC_MODE/);
  assert.match(script, /ATLAS_E2E_SHM_SIZE/);
});
