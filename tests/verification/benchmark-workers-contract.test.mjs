import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const scriptPath = new URL('../../e2e/benchmark-workers.ps1', import.meta.url);

test('worker benchmark is measurement-only, repeatable and uses non-null telemetry sources', () => {
  assert.equal(fs.existsSync(scriptPath), true, 'missing worker benchmark harness');
  const script = fs.readFileSync(scriptPath, 'utf8').replace(/\r\n/g, '\n');

  assert.match(script, /\[ValidateSet\('Benchmark', 'SelfTest'\)\]\[string\]\$Mode = 'Benchmark'/);
  assert.match(script, /ValidateSet\(1, 2, 4, 6, 8\)/);
  assert.match(script, /ValidateRange\(3, 5\)/);
  assert.match(script, /Get-Counter/);
  assert.match(script, /Get-CimInstance Win32_OperatingSystem/);
  assert.match(script, /docker stats --no-stream --format/);
  assert.match(script, /docker version --format/);
  assert.match(script, /Get-ComputerInfo/);
  assert.match(script, /memoryPressurePercent/);
  assert.match(script, /dockerBlockIo/);
  assert.match(script, /dockerContainerCount/);
  assert.match(script, /Start-Process/);
  assert.match(script, /resourceSamples/);
  assert.match(script, /New-Item -ItemType Directory -Force -Path \(Split-Path -LiteralPath \$OutputPath -Parent\)/);
  assert.doesNotMatch(script, /PhysicalDisk\(_Total\)/);
  assert.doesNotMatch(script, /\$values\['\\\\Processor Information/);
  assert.match(script, /ATLAS_E2E_WORKERS/);
  assert.match(script, /\$Mode -eq 'SelfTest'/);
  assert.doesNotMatch(script, /LoadPercentage/);
  assert.doesNotMatch(script, /Set-Content.*playwright\.config/i);
  assert.doesNotMatch(script, /git (?:commit|push|reset)/i);
});
