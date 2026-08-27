import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const contractUrl = new URL('../../tools/verification/hosted-benchmark-contract.json', import.meta.url);
const phaseMapUrl = new URL('../../tools/verification/hosted-benchmark-phase-map.json', import.meta.url);
const experimentsUrl = new URL('../../tools/verification/hosted-benchmark-experiments.json', import.meta.url);

function readJson(url, label) {
  assert.equal(fs.existsSync(url), true, `missing ${label}`);
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

const requiredMetricIds = [
  'queueProvisioningMs',
  'checkoutFetchMs',
  'dependencyRestoreInstallMs',
  'qualificationBuildVerifyReadinessMs',
  'browserImageMs',
  'previewStartupMs',
  'playwrightExecutionMs',
  'shardFanoutFaninMs',
  'cacheRestoreMs',
  'cacheSaveMs',
  'artifactUploadMs',
  'artifactDownloadMs',
  'supersededWasteMs',
  'duplicateSetupMs',
  'verdictWallClockMs',
  'jobMinutes',
  'varianceMs',
  'oomCrashCount',
  'usefulPlansPerHour',
];

test('hosted Phase E benchmark contract binds exact identity and complete measurement surface', () => {
  const contract = readJson(contractUrl, 'hosted benchmark contract');
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.kind, 'atlas-hosted-e2e-phase-e-benchmark');
  assert.equal(contract.measurementOnly, true);
  assert.equal(contract.selectionApplied, false);
  assert.deepEqual(contract.allowedAuthority, [
    'NON_AUTHORITATIVE_PRE_PHASE_D',
    'AUTHORITATIVE_POST_PHASE_D',
  ]);
  assert.deepEqual(contract.retryPolicy, { retries: 0 });

  const requiredIdentity = new Set(contract.requiredIdentityFields);
  for (const field of [
    'repository',
    'candidateSha',
    'integrationBaseSha',
    'protectedPhaseDSha',
    'planDigest',
    'stableIdSetDigest',
    'productDigest',
    'browserHarnessDigest',
    'workflowRunId',
    'workflowRunAttempt',
    'workflowSha',
    'profile',
    'dataCapability',
  ]) {
    assert.equal(requiredIdentity.has(field), true, `missing identity field ${field}`);
  }

  assert.deepEqual(contract.requiredMetricIds, requiredMetricIds);
  assert.deepEqual(contract.observationStates, ['MEASURED', 'NOT_APPLICABLE']);
  assert.equal(contract.missingMetricPolicy, 'FAIL_CLOSED');
  assert.equal(contract.zeroDefaultPolicy, 'FORBIDDEN');
});

test('hosted benchmark experiments prepare a packed baseline and guarded worker/shard candidates only', () => {
  const experiments = readJson(experimentsUrl, 'hosted benchmark experiments');
  assert.equal(experiments.schemaVersion, 1);
  assert.equal(experiments.measurementOnly, true);
  assert.equal(experiments.finalPolicySelected, false);
  assert.equal(experiments.doNotCartesianProductAxes, true);

  const candidates = experiments.executionShapeCandidates;
  assert.deepEqual(candidates[0], {
    id: 'packed-w1',
    workers: 1,
    shards: 1,
    profiles: ['targeted', 'broad', 'full'],
    gate: 'BASELINE',
  });
  assert.equal(candidates.some((candidate) => candidate.workers === 6 || candidate.workers === 8), false);
  assert.equal(candidates.some((candidate) => candidate.workers > 1 && candidate.shards > 1), false);

  const twoWorkers = candidates.find((candidate) => candidate.id === 'packed-w2');
  const fourWorkers = candidates.find((candidate) => candidate.id === 'packed-w4');
  const twoShards = candidates.find((candidate) => candidate.id === 'shards2-w1');
  const fourShards = candidates.find((candidate) => candidate.id === 'shards4-w1');
  assert.equal(twoWorkers?.gate, 'RUNNER_RESOURCES_MEASURED');
  assert.equal(fourWorkers?.gate, 'W2_STABLE_WITH_RESOURCE_HEADROOM');
  assert.deepEqual(twoShards?.profiles, ['broad', 'full']);
  assert.deepEqual(fourShards?.profiles, ['broad', 'full']);
  assert.equal(twoShards?.gate, 'BROAD_OR_FULL_SETUP_AMORTIZATION_PLAUSIBLE');
  assert.equal(fourShards?.gate, 'SHARDS2_MATERIAL_WALL_CLOCK_WIN');

  assert.deepEqual(experiments.comparisonAxes.cache, ['cold', 'restored']);
  assert.deepEqual(experiments.comparisonAxes.imageStrategy, ['current', 'thin-immutable']);
  assert.deepEqual(experiments.comparisonAxes.productStrategy, ['per-shard', 'build-once-content-addressed']);
  assert.deepEqual(experiments.comparisonAxes.dagStart, ['eager', 'gated']);
});

test('hosted benchmark phase map covers every required whole-DAG phase without policy selection', () => {
  const phaseMap = readJson(phaseMapUrl, 'hosted benchmark phase map');
  assert.equal(phaseMap.schemaVersion, 1);
  assert.equal(phaseMap.measurementOnly, true);
  assert.equal(phaseMap.selectionApplied, false);

  const phaseMetricIds = new Set(phaseMap.phases.map((phase) => phase.metricId));
  for (const metricId of [
    'checkoutFetchMs',
    'dependencyRestoreInstallMs',
    'qualificationBuildVerifyReadinessMs',
    'browserImageMs',
    'previewStartupMs',
    'playwrightExecutionMs',
    'shardFanoutFaninMs',
    'cacheRestoreMs',
    'cacheSaveMs',
    'artifactUploadMs',
    'artifactDownloadMs',
  ]) {
    assert.equal(phaseMetricIds.has(metricId), true, `missing phase mapping for ${metricId}`);
  }

  for (const phase of phaseMap.phases) {
    assert.equal(typeof phase.id, 'string');
    assert.equal(typeof phase.metricId, 'string');
    assert.equal(['REQUIRED', 'OPTIONAL_EXPLICIT_NA'].includes(phase.requirement), true);
    assert.equal(Array.isArray(phase.stepNamePatterns), true);
    assert.equal(phase.stepNamePatterns.length > 0, true);
  }
});
