import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const run = fs.readFileSync('e2e/run.ps1', 'utf8');
const helperPath = 'e2e/heavy-slot-pool.ps1';
const helper = fs.existsSync(helperPath) ? fs.readFileSync(helperPath, 'utf8') : '';
const source = `${run}\n${helper}`;

test('Molehill heavy E2E uses a bounded machine-wide slot pool', () => {
  assert.match(source, /ATLAS_E2E_SLOT_COUNT/);
  assert.match(source, /ATLAS_E2E_SLOT_ID/);
  assert.match(source, /ATLAS_E2E_SLOT/);
  assert.match(source, /oteryn-atlas-heavy-e2e-slot-/);
  assert.match(source, /slotCount.*1.*3|1.*3.*slotCount/s);
});

test('new slot runners coexist but fence legacy single-lock runners', () => {
  assert.match(source, /oteryn-atlas-heavy-e2e\.lock/);
  assert.match(source, /FileShare\]::ReadWrite/);
  assert.match(source, /oteryn-atlas-heavy-e2e-slot-.*?FileShare\]::None/s);
});

test('parallel slots still fail closed on duplicate Compose project identity', () => {
  assert.match(source, /oteryn-atlas-e2e-project-/);
  assert.match(source, /project.*FileShare\]::None|FileShare\]::None.*project/s);
  assert.match(source, /Dispose\(\)/);
});

test('repository policy permits only bounded isolated concurrent full gates', () => {
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  assert.match(agents, /bounded.*concurrent|concurrent.*bounded/i);
  assert.match(agents, /isolat/i);
  assert.doesNotMatch(agents, /never launch concurrent 64-scenario local gates/i);
});

test('parallel slot benchmark is reproducible and keeps each full gate single-worker', () => {
  const path = 'e2e/benchmark-heavy-slots.ps1';
  assert.equal(fs.existsSync(path), true, `${path} is missing`);
  if (!fs.existsSync(path)) return;
  const benchmark = fs.readFileSync(path, 'utf8');
  assert.match(benchmark, /ATLAS_E2E_SLOT_COUNT/);
  assert.match(benchmark, /ATLAS_E2E_SLOT/);
  assert.match(benchmark, /ATLAS_E2E_WORKERS[^\n]*['"]1['"]/);
  assert.match(benchmark, /summary\.json/);
  assert.match(benchmark, /Win32_Processor|LoadPercentage/);
  assert.match(benchmark, /FreePhysicalMemory/);
  assert.match(benchmark, /\[pscustomobject\]/i);
  assert.match(benchmark, /SelfTest/);
  assert.match(benchmark, /Measure-Object[^\n]*cpuPercent/i);
  assert.match(benchmark, /ConvertTo-Json/);
});
