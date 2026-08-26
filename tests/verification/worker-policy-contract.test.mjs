import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const benchmark = fs.existsSync('e2e/benchmark-workers.ps1')
  ? fs.readFileSync('e2e/benchmark-workers.ps1', 'utf8').replace(/\r\n/g, '\n') : '';
const policyPath = 'tools/verification/worker-policy.json';
const schemaPath = 'tools/verification/worker-policy-schema.mjs';
const workloadsPath = 'e2e/benchmark-workloads.json';

test('worker calibration covers 1/2/4/6/8 across full targeted and broad workloads', () => {
  assert.equal(fs.existsSync(workloadsPath), true, `${workloadsPath} is missing`);
  const workloads = JSON.parse(fs.readFileSync(workloadsPath, 'utf8'));
  assert.equal(workloads.schemaVersion, 1);
  assert.deepEqual(Object.keys(workloads.workloads).sort(), ['broad', 'full', 'targeted']);
  assert.equal(workloads.workloads.full.fullSuite, true);
  for (const name of ['targeted', 'broad']) {
    const entry = workloads.workloads[name];
    assert.equal(entry.profile, name);
    assert.equal(entry.fullSuite, false);
    assert.ok(Array.isArray(entry.specs) && entry.specs.length >= 4);
    for (const spec of entry.specs) assert.match(spec, /^tests\/[a-z0-9-]+\.spec\.mjs$/);
  }
  assert.match(benchmark, /ValidateSet\(1, 2, 4, 6, 8\)/);
  assert.match(benchmark, /ValidateSet\('full', 'targeted', 'broad'\)/);
  assert.match(benchmark, /workloadDigest/);
  assert.match(benchmark, /firstRunFailures/);
  assert.match(benchmark, /browserCrashes|containerCrashes/);
  assert.match(benchmark, /sharedMemory/);
});

test('authoritative worker policy cannot exist without committed measured evidence', () => {
  assert.equal(fs.existsSync(schemaPath), true, `${schemaPath} is missing`);
  if (!fs.existsSync(policyPath)) return;
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.id, 'molehill-measured-workers-v1');
  assert.match(policy.benchmarkSha256, /^sha256:[a-f0-9]{64}$/);
  assert.match(policy.benchmarkEvidencePath, /^docs\/evidence\/atlas-e2e-worker-benchmark\/[a-zA-Z0-9._/-]+\.json$/);
  assert.equal(fs.existsSync(policy.benchmarkEvidencePath), true, 'worker policy benchmark evidence is missing');
  const raw = fs.readFileSync(policy.benchmarkEvidencePath);
  const digest = `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
  assert.equal(policy.benchmarkSha256, digest);
  for (const profile of ['targeted', 'broad', 'full']) {
    assert.ok([1, 2, 4, 6, 8].includes(policy.profiles?.[profile]?.workers));
    assert.equal(policy.profiles?.[profile]?.retries, 0);
    assert.ok(policy.profiles?.[profile]?.minimumCleanRepetitions >= 3);
  }
});

test('benchmark remains measurement-only until measured policy evidence is committed', () => {
  assert.doesNotMatch(benchmark, /git (?:commit|push|reset)/i);
  assert.match(benchmark, /selectionApplied\s*=\s*\$false/);
  assert.match(benchmark, /atlasRevision/);
  assert.match(benchmark, /dockerServer/);
  assert.match(benchmark, /runner/);
});
