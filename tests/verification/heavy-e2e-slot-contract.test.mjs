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

test('parallel slots fail closed on duplicate Compose and artifact namespaces', () => {
  assert.match(source, /oteryn-atlas-e2e-project-/);
  assert.match(source, /project.*FileShare\]::None|FileShare\]::None.*project/s);
  assert.match(source, /oteryn-atlas-e2e-artifacts-/);
  assert.match(source, /Acquire-AtlasArtifactLock/);
  assert.match(source, /ATLAS_E2E_ARTIFACTS_HOST/);
  assert.match(source, /Dispose\(\)/);
});

test('repository policy keeps the bounded isolated slot pool specialist-only', () => {
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  assert.match(agents, /Molehill[^\n]*(specialist|exception)/i);
  assert.match(agents, /bounded machine-wide slot pool/i);
  assert.match(agents, /isolat/i);
  assert.match(agents, /not an ordinary-PR concurrency policy/i);
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
  assert.match(benchmark, /X-Oteryn-Atlas-Revision/i);
  assert.match(benchmark, /publicationRevisionBefore/i);
  assert.match(benchmark, /publicationRevisionAfter/i);
  assert.match(benchmark, /ConvertTo-Json/);
});

test('slot-pool self-test cannot contend with production heavy E2E locks', () => {
  const selfTest = fs.readFileSync('e2e/test-heavy-slot-pool.ps1', 'utf8');
  assert.match(selfTest, /slot-selftest-.*legacy/i);
  assert.match(selfTest, /-LockPath/);
  assert.match(selfTest, /-SlotPrefix/);
});

test('benchmark fences legacy runners before timed slot groups', () => {
  const benchmark = fs.readFileSync('e2e/benchmark-heavy-slots.ps1', 'utf8');
  assert.match(benchmark, /heavy-slot-pool\.ps1/);
  assert.match(benchmark, /benchmarkFence\s*=\s*Acquire-AtlasLegacyFence/);
  assert.match(benchmark, /benchmarkFence\.Stream\.Dispose/);
});

test('measured safe default is two bounded heavy slots', () => {
  assert.match(run, /Resolve-AtlasHeavySlotConfig\s+-DefaultSlotCount\s+2/);
  assert.match(helper, /parsed\s+-gt\s+3/);
});

test('benchmark records child exit codes explicitly instead of relying on Start-Process ExitCode', () => {
  const benchmark = fs.readFileSync('e2e/benchmark-heavy-slots.ps1', 'utf8');
  assert.match(benchmark, /exitCodePath/i);
  assert.match(benchmark, /exit-code/i);
  assert.match(benchmark, /TryParse/i);
  assert.doesNotMatch(benchmark, /exitCode\s*=\s*\$spec\.Process\.ExitCode/);
});

test('benchmark never coerces an unavailable CPU counter to a truthful-looking zero', () => {
  const benchmark = fs.readFileSync('e2e/benchmark-heavy-slots.ps1', 'utf8');
  assert.match(benchmark, /cpuMetricAvailable/i);
  assert.doesNotMatch(benchmark, /cpuPercent\s*=\s*\[double\]\$cpu/);
});

test('benchmark launcher survives run.ps1 exit long enough to persist child exit evidence', () => {
  const benchmark = fs.readFileSync('e2e/benchmark-heavy-slots.ps1', 'utf8');
  assert.match(benchmark, /& powershell\.exe[^\n]+-File[^\n]+runScript/i);
  assert.doesNotMatch(benchmark, /& '\.\\e2e\\run\.ps1'\s*\n`\$runExitCode/);
});
