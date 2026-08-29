import fs from 'node:fs';

const contract = JSON.parse(fs.readFileSync(new URL('./hosted-benchmark-contract.json', import.meta.url), 'utf8'));
const experiments = JSON.parse(fs.readFileSync(new URL('./hosted-benchmark-experiments.json', import.meta.url), 'utf8'));

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const FAILURE_CLASSES = new Set([
  'NONE',
  'ASSERTION',
  'INFRASTRUCTURE',
  'OOM_CRASH',
  'CANCELLED',
  'SUPERSEDED',
  'UNCLASSIFIED_FAILURE',
]);
const CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'timed_out', 'neutral', 'skipped', 'stale']);
const EXPERIMENT_AXES = Object.freeze({
  cache: new Set(experiments.comparisonAxes.cache),
  imageStrategy: new Set(experiments.comparisonAxes.imageStrategy),
  productStrategy: new Set(experiments.comparisonAxes.productStrategy),
  dagStart: new Set(experiments.comparisonAxes.dagStart),
});

function invalid(detail) {
  throw new TypeError(`hosted benchmark evidence invalid: ${detail}`);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expected, field) {
  if (!isPlainObject(value)) invalid(`${field} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    invalid(`${field} fields must be exactly ${wanted.join(', ')}`);
  }
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) invalid(`${field} must be a non-empty string`);
}

function requireSha(value, field) {
  if (typeof value !== 'string' || !SHA.test(value)) invalid(`${field} must be an exact lowercase 40-hex SHA`);
}

function requireDigest(value, field) {
  if (typeof value !== 'string' || !DIGEST.test(value)) invalid(`${field} must be an exact sha256 digest`);
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) invalid(`${field} must be a positive integer`);
}

function requireTimestamp(value, field) {
  requireString(value, field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalid(`${field} must be a valid timestamp`);
  return parsed;
}

function validateIdentity(identity, authority, phaseDState) {
  exactKeys(identity, contract.requiredIdentityFields, 'identity');
  if (!REPOSITORY.test(identity.repository)) invalid('repository must be owner/name');
  requireSha(identity.candidateSha, 'candidateSha');
  requireSha(identity.integrationBaseSha, 'integrationBaseSha');
  requireSha(identity.workflowSha, 'workflowSha');
  requireDigest(identity.planDigest, 'planDigest');
  requireDigest(identity.stableIdSetDigest, 'stableIdSetDigest');
  requireDigest(identity.productDigest, 'productDigest');
  requireDigest(identity.browserHarnessDigest, 'browserHarnessDigest');
  requirePositiveInteger(identity.workflowRunId, 'workflowRunId');
  requirePositiveInteger(identity.workflowRunAttempt, 'workflowRunAttempt');
  if (!contract.allowedWorkflowRunAttempts.includes(identity.workflowRunAttempt)) {
    invalid(`workflowRunAttempt must be ${contract.allowedWorkflowRunAttempts.join(' or ')} so benchmark retries remain zero`);
  }
  if (!contract.allowedProfiles.includes(identity.profile)) invalid('profile is not allowlisted');
  if (!contract.allowedDataCapabilities.includes(identity.dataCapability)) invalid('dataCapability is not allowlisted');

  if (authority === 'NON_AUTHORITATIVE_PRE_PHASE_D') {
    if (phaseDState !== 'PRE_FINAL_PHASE_D' || identity.protectedPhaseDSha !== null) {
      invalid('non-authoritative evidence must remain pre-final protected Phase D with protectedPhaseDSha=null');
    }
  } else if (authority === 'AUTHORITATIVE_POST_PHASE_D') {
    if (phaseDState !== 'FINAL_PROTECTED_MERGED') {
      invalid('authoritative evidence requires final protected Phase D merged state');
    }
    if (typeof identity.protectedPhaseDSha !== 'string' || !SHA.test(identity.protectedPhaseDSha)) {
      invalid('authoritative evidence requires exact protected Phase D SHA');
    }
    if (identity.integrationBaseSha !== identity.protectedPhaseDSha) {
      invalid('authoritative evidence requires integrationBaseSha to equal protectedPhaseDSha');
    }
  } else {
    invalid('authority is not allowlisted');
  }
}

function validateExperiment(experiment, profile) {
  exactKeys(experiment, ['id', 'workers', 'shards', 'cache', 'imageStrategy', 'productStrategy', 'dagStart'], 'experiment');
  requireString(experiment.id, 'experiment.id');
  requirePositiveInteger(experiment.workers, 'experiment.workers');
  requirePositiveInteger(experiment.shards, 'experiment.shards');
  const candidate = experiments.executionShapeCandidates.find((value) => value.id === experiment.id);
  if (!candidate) invalid('experiment.id is not a prepared candidate');
  if (candidate.workers !== experiment.workers || candidate.shards !== experiment.shards) {
    invalid('experiment worker/shard shape does not match the prepared candidate');
  }
  if (!candidate.profiles.includes(profile)) invalid('experiment candidate is not eligible for the measured profile');
  for (const [field, allowed] of Object.entries(EXPERIMENT_AXES)) {
    if (!allowed.has(experiment[field])) invalid(`experiment.${field} is not allowlisted`);
  }
}

function validateOutcome(outcome) {
  exactKeys(outcome, ['conclusion', 'failureClass'], 'outcome');
  if (!CONCLUSIONS.has(outcome.conclusion)) invalid('outcome.conclusion is not allowlisted');
  if (!FAILURE_CLASSES.has(outcome.failureClass)) invalid('outcome.failureClass is not allowlisted');
  if (outcome.conclusion === 'success' && outcome.failureClass !== 'NONE') {
    invalid('successful outcome must use failureClass=NONE');
  }
  if (outcome.conclusion !== 'success' && outcome.failureClass === 'NONE') {
    invalid('non-success outcome must record a failure class');
  }
}

function validateMetrics(metrics) {
  if (!isPlainObject(metrics)) invalid('metrics must be an object');
  for (const metricId of contract.requiredMetricIds) {
    if (!Object.hasOwn(metrics, metricId)) invalid(`missing metric ${metricId}`);
  }
  const unexpected = Object.keys(metrics).filter((metricId) => !contract.requiredMetricIds.includes(metricId));
  if (unexpected.length > 0) invalid(`unexpected metric ${unexpected.sort()[0]}`);
  for (const metricId of contract.requiredMetricIds) {
    const observation = metrics[metricId];
    exactKeys(observation, ['status', 'value', 'unit', 'source'], `metrics.${metricId}`);
    if (!contract.observationStates.includes(observation.status)) invalid(`${metricId} status is not allowlisted`);
    if (observation.unit !== contract.metricUnits[metricId]) invalid(`${metricId} unit must be ${contract.metricUnits[metricId]}`);
    requireString(observation.source, `${metricId}.source`);
    if (observation.status === 'MEASURED') {
      if (!Number.isFinite(observation.value) || observation.value < 0) {
        invalid(`${metricId} MEASURED value must be a finite non-negative number`);
      }
    } else if (observation.value !== null) {
      invalid(`${metricId} NOT_APPLICABLE value must be null`);
    }
  }
}

function validateResourceMetrics(metrics, outcome) {
  if (outcome.conclusion === 'success') {
    for (const metricId of contract.requiredSuccessMeasuredMetricIds) {
      if (metrics[metricId].status !== 'MEASURED') {
        invalid(`${metricId} must be MEASURED for successful hosted benchmark evidence`);
      }
    }
  }

  if (metrics.runnerLogicalCpuCount.status === 'MEASURED') {
    requirePositiveInteger(metrics.runnerLogicalCpuCount.value, 'runnerLogicalCpuCount');
  }
  if (metrics.runnerMemoryTotalBytes.status === 'MEASURED') {
    requirePositiveInteger(metrics.runnerMemoryTotalBytes.value, 'runnerMemoryTotalBytes');
  }
  if (metrics.peakCpuPercent.status === 'MEASURED' && metrics.peakCpuPercent.value > 100) {
    invalid('peakCpuPercent must remain between 0 and 100 percent of total hosted-runner CPU capacity');
  }
  if (metrics.peakMemoryBytes.status === 'MEASURED') {
    if (!Number.isInteger(metrics.peakMemoryBytes.value) || metrics.peakMemoryBytes.value < 0) {
      invalid('peakMemoryBytes must be a non-negative integer byte count');
    }
  }
  if (
    metrics.runnerMemoryTotalBytes.status === 'MEASURED'
    && metrics.peakMemoryBytes.status === 'MEASURED'
    && metrics.peakMemoryBytes.value > metrics.runnerMemoryTotalBytes.value
  ) {
    invalid('peakMemoryBytes cannot exceed runnerMemoryTotalBytes');
  }
}

function validateSource(source) {
  exactKeys(source, ['collector', 'runCreatedAt', 'runCompletedAt', 'jobs'], 'source');
  if (source.collector !== 'hosted-benchmark-collector-v1') invalid('source.collector is not supported');
  const created = requireTimestamp(source.runCreatedAt, 'source.runCreatedAt');
  const completed = requireTimestamp(source.runCompletedAt, 'source.runCompletedAt');
  if (completed < created) invalid('source run timing is negative');
  if (!Array.isArray(source.jobs) || source.jobs.some((job) => !isPlainObject(job))) invalid('source.jobs must be an array of objects');
}

export function validateHostedBenchmarkEvidence(evidence) {
  exactKeys(evidence, [
    'schemaVersion',
    'kind',
    'authority',
    'phaseDState',
    'measurementOnly',
    'selectionApplied',
    'retryPolicy',
    'identity',
    'experiment',
    'outcome',
    'metrics',
    'source',
  ], 'evidence');
  if (evidence.schemaVersion !== contract.schemaVersion) invalid('schemaVersion is unsupported');
  if (evidence.kind !== contract.kind) invalid('kind is unsupported');
  if (evidence.measurementOnly !== true) invalid('measurementOnly must remain true');
  if (evidence.selectionApplied !== false) invalid('selectionApplied must remain false');
  exactKeys(evidence.retryPolicy, ['retries'], 'retryPolicy');
  if (evidence.retryPolicy.retries !== 0) invalid('retries must remain zero');
  if (!contract.allowedAuthority.includes(evidence.authority)) invalid('authority is not allowlisted');
  validateIdentity(evidence.identity, evidence.authority, evidence.phaseDState);
  validateExperiment(evidence.experiment, evidence.identity.profile);
  validateOutcome(evidence.outcome);
  validateMetrics(evidence.metrics);
  validateResourceMetrics(evidence.metrics, evidence.outcome);
  validateSource(evidence.source);
  return evidence;
}

export const HOSTED_BENCHMARK_CONTRACT = Object.freeze(contract);
