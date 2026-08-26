import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sha256Bytes,
  validateWorkerBenchmarkEvidence,
  validateWorkerPolicy,
} from '../../tools/verification/worker-policy-schema.mjs';

const profiles = ['targeted', 'broad', 'full'];
const workers = [1, 2, 4, 6, 8];

function benchmark() {
  const runs = [];
  for (const workload of profiles) {
    for (const workerCount of workers) {
      for (let repetition = 1; repetition <= 3; repetition += 1) {
        runs.push({
          workload,
          workers: workerCount,
          repetition,
          wallTimeMs: 10_000 / workerCount,
          exitCode: 0,
          firstRunFailures: 0,
          browserCrashes: 0,
          containerCrashes: 0,
          oomKilled: 0,
          resourceSamples: [{ processorUtilityPercent: 50 }],
          summary: { status: 'passed', retries: 0 },
        });
      }
    }
  }
  return {
    schemaVersion: 2,
    kind: 'atlas-e2e-worker-calibration',
    atlasRevision: 'a'.repeat(40),
    workloadDigest: `sha256:${'b'.repeat(64)}`,
    fingerprint: { computerName: 'synthetic' },
    runs,
  };
}

function policy(bytes) {
  return {
    schemaVersion: 1,
    id: 'molehill-measured-workers-v1',
    atlasRevision: 'a'.repeat(40),
    benchmarkSha256: sha256Bytes(bytes),
    profiles: Object.fromEntries(profiles.map((profile) => [profile, {
      workers: 2,
      retries: 0,
      minimumCleanRepetitions: 3,
    }])),
  };
}

test('clean 1/2/4/6/8 matrix can back an exact measured policy', () => {
  const evidence = benchmark();
  const bytes = Buffer.from(JSON.stringify(evidence));
  assert.equal(validateWorkerBenchmarkEvidence(evidence), evidence);
  assert.equal(validateWorkerPolicy(policy(bytes), evidence, bytes).profiles.full.workers, 2);
});

test('missing repetitions and first-run instability fail closed', () => {
  const missing = benchmark();
  missing.runs = missing.runs.filter((run) => !(run.workload === 'full' && run.workers === 8 && run.repetition === 3));
  assert.throws(() => validateWorkerBenchmarkEvidence(missing), /fewer than 3 repetitions/);

  const unstable = benchmark();
  unstable.runs.find((run) => run.workload === 'broad' && run.workers === 4).firstRunFailures = 1;
  assert.throws(() => validateWorkerBenchmarkEvidence(unstable), /retry\/failure evidence/);
});

test('copied benchmark bytes cannot satisfy worker policy digest binding', () => {
  const evidence = benchmark();
  const bytes = Buffer.from(JSON.stringify(evidence));
  const candidate = policy(Buffer.from('different evidence'));
  assert.throws(() => validateWorkerPolicy(candidate, evidence, bytes), /benchmark digest mismatch/);
});
