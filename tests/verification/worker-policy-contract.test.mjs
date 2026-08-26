import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const benchmark = fs.existsSync('e2e/benchmark-workers.ps1')
  ? fs.readFileSync('e2e/benchmark-workers.ps1', 'utf8').replace(/\r\n/g, '\n') : '';
const policyPath = 'tools/verification/worker-policy.json';
const workloadsPath = 'e2e/benchmark-workloads.json';

test('worker calibration covers 1/2/4/6/8 across full targeted and broad workloads', () => {
  assert.equal(fs.existsSync(workloadsPath), true, `${workloadsPath} is missing`);
  assert.match(benchmark, /ValidateSet\(1, 2, 4, 6, 8\)/);
  assert.match(benchmark, /Repetitions/);
  assert.match(benchmark, /full/);
  assert.match(benchmark, /targeted/);
  assert.match(benchmark, /broad/);
  assert.match(benchmark, /workloadDigest/);
  assert.match(benchmark, /firstRunFailures/);
  assert.match(benchmark, /browserCrashes|containerCrashes/);
  assert.match(benchmark, /sharedMemory/);
});

test('authoritative worker policy is versioned and measurement-bound', () => {
  assert.equal(fs.existsSync(policyPath), true, `${policyPath} is missing`);
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.id, 'molehill-measured-workers-v1');
  assert.match(policy.benchmarkSha256, /^sha256:[a-f0-9]{64}$/);
  for (const profile of ['targeted', 'broad', 'full']) {
    assert.ok([1, 2, 4, 6, 8].includes(policy.profiles?.[profile]?.workers));
    assert.equal(policy.profiles?.[profile]?.retries, 0);
    assert.ok(Number.isInteger(policy.profiles?.[profile]?.minimumCleanRepetitions));
    assert.ok(policy.profiles[profile].minimumCleanRepetitions >= 3);
  }
});

test('benchmark remains measurement-only until measured policy evidence is committed', () => {
  assert.doesNotMatch(benchmark, /git (?:commit|push|reset)/i);
  assert.match(benchmark, /selectionApplied\s*=\s*\$false/);
  assert.match(benchmark, /atlasRevision/);
  assert.match(benchmark, /dockerServer/);
  assert.match(benchmark, /runner/);
});
