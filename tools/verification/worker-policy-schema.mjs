import crypto from 'node:crypto';

const WORKERS = new Set([1, 2, 4, 6, 8]);
const PROFILES = Object.freeze(['targeted', 'broad', 'full']);
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;

function fail(message) {
  throw new Error(`worker-policy: ${message}`);
}

function runsFor(evidence, profile, workers) {
  return evidence.runs.filter((run) => run.workload === profile && run.workers === workers);
}

export function sha256Bytes(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

export function validateWorkerBenchmarkEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') fail('benchmark evidence must be an object');
  if (evidence.schemaVersion !== 2 || evidence.kind !== 'atlas-e2e-worker-calibration') fail('unsupported benchmark evidence');
  if (!SHA.test(evidence.atlasRevision ?? '')) fail('invalid Atlas revision');
  if (!SHA256.test(evidence.workloadDigest ?? '')) fail('invalid workload digest');
  if (!evidence.fingerprint || typeof evidence.fingerprint !== 'object') fail('environment fingerprint is missing');
  if (!Array.isArray(evidence.runs) || evidence.runs.length === 0) fail('benchmark runs are missing');

  for (const profile of PROFILES) {
    for (const workers of WORKERS) {
      const runs = runsFor(evidence, profile, workers);
      if (runs.length < 3) fail(`${profile}/${workers} has fewer than 3 repetitions`);
      for (const run of runs) {
        if (!Number.isInteger(run.repetition) || run.repetition < 1) fail('invalid repetition');
        if (run.exitCode !== 0 || run.summary?.status !== 'passed') fail(`${profile}/${workers} contains a failed run`);
        if (run.summary?.retries !== 0 || run.firstRunFailures !== 0) fail(`${profile}/${workers} contains retry/failure evidence`);
        if (run.browserCrashes !== 0 || run.containerCrashes !== 0 || run.oomKilled !== 0) fail(`${profile}/${workers} contains crash/OOM evidence`);
        if (!Number.isFinite(run.wallTimeMs) || run.wallTimeMs <= 0) fail('invalid wall time');
        if (!Array.isArray(run.resourceSamples) || run.resourceSamples.length === 0) fail('resource telemetry is missing');
      }
    }
  }
  return evidence;
}

export function validateWorkerPolicy(policy, evidence, evidenceBytes) {
  validateWorkerBenchmarkEvidence(evidence);
  if (!policy || typeof policy !== 'object') fail('policy must be an object');
  if (policy.schemaVersion !== 1 || policy.id !== 'molehill-measured-workers-v1') fail('unsupported policy identity');
  if (!SHA256.test(policy.benchmarkSha256 ?? '')) fail('invalid benchmark digest');
  if (policy.benchmarkSha256 !== sha256Bytes(evidenceBytes)) fail('benchmark digest mismatch');
  if (policy.atlasRevision !== evidence.atlasRevision) fail('benchmark revision mismatch');
  for (const profile of PROFILES) {
    const selection = policy.profiles?.[profile];
    if (!selection || !WORKERS.has(selection.workers)) fail(`${profile} selection is invalid`);
    if (selection.retries !== 0) fail(`${profile} retries must remain zero`);
    if (!Number.isInteger(selection.minimumCleanRepetitions) || selection.minimumCleanRepetitions < 3) fail(`${profile} repetition floor is invalid`);
    const measured = runsFor(evidence, profile, selection.workers);
    if (measured.length < selection.minimumCleanRepetitions) fail(`${profile} selection is not sufficiently measured`);
  }
  return policy;
}

export const workerPolicyContract = Object.freeze({
  schemaVersion: 1,
  id: 'molehill-measured-workers-v1',
  workers: Object.freeze([...WORKERS]),
  profiles: PROFILES,
});
