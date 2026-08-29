import fs from 'node:fs';
import { validateHostedBenchmarkEvidence, HOSTED_BENCHMARK_CONTRACT } from './hosted-benchmark-schema.mjs';

const defaultPhaseMap = JSON.parse(fs.readFileSync(new URL('./hosted-benchmark-phase-map.json', import.meta.url), 'utf8'));
const SUPPLEMENTAL_METRICS = Object.freeze([
  'supersededWasteMs',
  'runnerLogicalCpuCount',
  'runnerMemoryTotalBytes',
  'peakCpuPercent',
  'peakMemoryBytes',
  'varianceMs',
  'oomCrashCount',
  'usefulPlansPerHour',
]);
const DUPLICATED_SETUP_METRICS = new Set([
  'checkoutFetchMs',
  'dependencyRestoreInstallMs',
  'qualificationBuildVerifyReadinessMs',
  'browserImageMs',
  'previewStartupMs',
]);

function invalid(detail) {
  throw new TypeError(`hosted benchmark collection invalid: ${detail}`);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseTimestamp(value, field) {
  if (typeof value !== 'string' || value.length === 0) invalid(`${field} timestamp is missing`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) invalid(`${field} timestamp is malformed`);
  return parsed;
}

function durationMs(start, end, field) {
  const startMs = parseTimestamp(start, `${field}.started_at`);
  const endMs = parseTimestamp(end, `${field}.completed_at`);
  const value = endMs - startMs;
  if (value < 0) invalid(`negative duration for ${field}`);
  return value;
}

function measured(metricId, value, source) {
  if (!Number.isFinite(value) || value < 0) invalid(`${metricId} measurement must be finite and non-negative`);
  return {
    status: 'MEASURED',
    value,
    unit: HOSTED_BENCHMARK_CONTRACT.metricUnits[metricId],
    source,
  };
}

function notApplicable(metricId, source) {
  return {
    status: 'NOT_APPLICABLE',
    value: null,
    unit: HOSTED_BENCHMARK_CONTRACT.metricUnits[metricId],
    source,
  };
}

function validatePhaseMap(phaseMap) {
  if (!isPlainObject(phaseMap) || phaseMap.schemaVersion !== 1 || phaseMap.measurementOnly !== true || !Array.isArray(phaseMap.phases)) {
    invalid('phase map must be measurement-only schemaVersion 1');
  }
  const metricIds = new Set();
  const phaseIds = new Set();
  return phaseMap.phases.map((phase) => {
    if (!isPlainObject(phase) || typeof phase.id !== 'string' || typeof phase.metricId !== 'string') invalid('phase map entry is malformed');
    if (phaseIds.has(phase.id)) invalid(`duplicate phase id ${phase.id}`);
    if (metricIds.has(phase.metricId)) invalid(`duplicate phase metric ${phase.metricId}`);
    phaseIds.add(phase.id);
    metricIds.add(phase.metricId);
    if (!['REQUIRED', 'OPTIONAL_EXPLICIT_NA'].includes(phase.requirement)) invalid(`phase ${phase.id} requirement is unsupported`);
    if (!Array.isArray(phase.stepNamePatterns) || phase.stepNamePatterns.length === 0) invalid(`phase ${phase.id} has no step patterns`);
    const patterns = phase.stepNamePatterns.map((pattern) => {
      try {
        return new RegExp(pattern, 'i');
      } catch {
        invalid(`phase ${phase.id} has invalid regexp ${pattern}`);
      }
    });
    return { ...phase, patterns };
  });
}

function normalizeJobs(jobs, run, identity) {
  if (!Array.isArray(jobs) || jobs.length === 0) invalid('jobs must contain at least one GitHub Actions job');
  return jobs.map((job, jobIndex) => {
    if (!isPlainObject(job) || !Number.isInteger(job.id) || typeof job.name !== 'string' || job.name.length === 0) {
      invalid(`job ${jobIndex} identity is malformed`);
    }
    if (job.run_id !== run.id) invalid(`job ${job.id} run_id does not match GitHub workflow run`);
    if (job.run_attempt !== run.run_attempt) invalid(`job ${job.id} run_attempt does not match GitHub workflow run`);
    if (job.head_sha !== identity.candidateSha) invalid(`job ${job.id} head_sha does not match candidateSha`);
    const createdMs = parseTimestamp(job.created_at, `job ${job.id}.created_at`);
    if (!Array.isArray(job.steps)) invalid(`job ${job.id} steps are missing`);

    const startedMissing = job.started_at == null;
    const completedMissing = job.completed_at == null;
    if (startedMissing !== completedMissing) {
      invalid(`job ${job.id} has partial started/completed timing`);
    }
    if (startedMissing) {
      return {
        raw: job,
        createdMs,
        startedMs: null,
        completedMs: null,
        queueProvisioningMs: null,
        wallTimeMs: null,
        timingStatus: 'NOT_STARTED',
        order: jobIndex,
      };
    }

    const startedMs = parseTimestamp(job.started_at, `job ${job.id}.started_at`);
    const completedMs = parseTimestamp(job.completed_at, `job ${job.id}.completed_at`);
    if (startedMs < createdMs) invalid(`negative queue/provisioning duration for job ${job.id}`);
    if (completedMs < startedMs) invalid(`negative duration for job ${job.id}`);
    return {
      raw: job,
      createdMs,
      startedMs,
      completedMs,
      queueProvisioningMs: startedMs - createdMs,
      wallTimeMs: completedMs - startedMs,
      timingStatus: 'STARTED',
      order: jobIndex,
    };
  });
}

function collectPhaseObservations(normalizedJobs, phaseMap, runConclusion) {
  const phases = validatePhaseMap(phaseMap);
  const matchesByMetric = new Map(phases.map((phase) => [phase.metricId, []]));
  const phaseByMetric = new Map(phases.map((phase) => [phase.metricId, phase]));
  const sourceJobs = [];

  for (const job of normalizedJobs) {
    const matchedPhaseIds = [];
    for (let stepIndex = 0; stepIndex < job.raw.steps.length; stepIndex += 1) {
      const step = job.raw.steps[stepIndex];
      if (!isPlainObject(step) || typeof step.name !== 'string' || step.name.length === 0) invalid(`job ${job.raw.id} step ${stepIndex} is malformed`);
      if (step.started_at == null || step.completed_at == null) continue;
      const stepStartedMs = parseTimestamp(step.started_at, `job ${job.raw.id} step ${stepIndex}.started_at`);
      const stepDuration = durationMs(step.started_at, step.completed_at, `job ${job.raw.id} step ${stepIndex}`);
      const matching = phases.filter((phase) => phase.patterns.some((pattern) => pattern.test(step.name)));
      if (matching.length > 1) invalid(`step ${JSON.stringify(step.name)} matches multiple benchmark phases`);
      if (matching.length === 1) {
        const phase = matching[0];
        matchesByMetric.get(phase.metricId).push({
          jobOrder: job.order,
          stepIndex,
          jobId: job.raw.id,
          stepName: step.name,
          startedMs: stepStartedMs,
          durationMs: stepDuration,
        });
        matchedPhaseIds.push(phase.id);
      }
    }
    sourceJobs.push({
      id: job.raw.id,
      name: job.raw.name,
      createdAt: job.raw.created_at,
      startedAt: job.raw.started_at,
      completedAt: job.raw.completed_at,
      conclusion: job.raw.conclusion ?? null,
      timingStatus: job.timingStatus,
      queueProvisioningMs: job.queueProvisioningMs,
      wallTimeMs: job.wallTimeMs,
      matchedPhaseIds,
    });
  }

  const observations = {};
  for (const [metricId, matches] of matchesByMetric) {
    const phase = phaseByMetric.get(metricId);
    if (matches.length === 0) {
      if (phase.requirement === 'REQUIRED' && runConclusion === 'success') {
        invalid(`missing required benchmark phase ${phase.id}`);
      }
      const suffix = phase.requirement === 'REQUIRED'
        ? `unreached:${runConclusion}`
        : 'not-present';
      observations[metricId] = notApplicable(metricId, `phase-map:${phase.id}:${suffix}`);
      continue;
    }
    const total = matches.reduce((sum, match) => sum + match.durationMs, 0);
    observations[metricId] = measured(metricId, total, `phase-map:${phase.id}:${matches.length}-step(s)`);
  }

  let duplicateSetupMs = 0;
  for (const metricId of DUPLICATED_SETUP_METRICS) {
    const matches = [...(matchesByMetric.get(metricId) ?? [])].sort((left, right) => (
      left.startedMs - right.startedMs
      || left.jobId - right.jobId
      || left.stepIndex - right.stepIndex
    ));
    for (const match of matches.slice(1)) duplicateSetupMs += match.durationMs;
  }

  return { observations, duplicateSetupMs, sourceJobs };
}

function copySupplementalMetrics(supplementalMetrics) {
  if (!isPlainObject(supplementalMetrics)) invalid('supplementalMetrics must be an object');
  const copied = {};
  for (const metricId of SUPPLEMENTAL_METRICS) {
    if (!Object.hasOwn(supplementalMetrics, metricId)) invalid(`missing explicit supplemental metric ${metricId}`);
    const value = supplementalMetrics[metricId];
    if (!isPlainObject(value)) invalid(`supplemental metric ${metricId} must be an observation object`);
    copied[metricId] = { ...value };
  }
  return copied;
}

function validateRunIdentity(run, identity) {
  if (!isPlainObject(run) || !isPlainObject(identity)) invalid('run and identity are required objects');
  if (!isPlainObject(run.repository) || typeof run.repository.full_name !== 'string' || run.repository.full_name.length === 0) {
    invalid('GitHub run repository.full_name is missing');
  }
  if (identity.repository !== run.repository.full_name) invalid('repository does not match GitHub run repository.full_name');
  if (identity.workflowRunId !== run.id) invalid('workflowRunId does not match GitHub run id');
  if (identity.workflowRunAttempt !== run.run_attempt) invalid('workflowRunAttempt does not match GitHub run_attempt');
  if (identity.candidateSha !== run.head_sha) invalid('candidateSha does not match GitHub run head_sha');
}

export function collectHostedBenchmarkEvidence({
  run,
  jobs,
  identity,
  experiment,
  phaseMap = defaultPhaseMap,
  supplementalMetrics,
  failureClass,
  authority = 'NON_AUTHORITATIVE_PRE_PHASE_D',
  phaseDState = 'PRE_FINAL_PHASE_D',
}) {
  validateRunIdentity(run, identity);
  if (typeof run.conclusion !== 'string' || run.conclusion.length === 0) invalid('GitHub run conclusion is missing');
  const runCreatedMs = parseTimestamp(run.created_at, 'run.created_at');
  const runCompletedMs = parseTimestamp(run.updated_at, 'run.updated_at');
  if (runCompletedMs < runCreatedMs) invalid('negative duration for GitHub workflow run');

  const normalizedJobs = normalizeJobs(jobs, run, identity);
  const { observations, duplicateSetupMs, sourceJobs } = collectPhaseObservations(normalizedJobs, phaseMap, run.conclusion);
  const startedJobs = normalizedJobs.filter((job) => job.timingStatus === 'STARTED');
  const queueProvisioning = startedJobs.length > 0
    ? measured('queueProvisioningMs', Math.max(...startedJobs.map((job) => job.queueProvisioningMs)), 'github-jobs:max(created_at->started_at)')
    : notApplicable('queueProvisioningMs', `github-jobs:no-started-jobs:${run.conclusion}`);
  const totalJobMs = startedJobs.reduce((sum, job) => sum + job.wallTimeMs, 0);
  const supplemental = copySupplementalMetrics(supplementalMetrics);

  const metrics = {
    queueProvisioningMs: queueProvisioning,
    ...observations,
    ...supplemental,
    duplicateSetupMs: measured('duplicateSetupMs', duplicateSetupMs, 'phase-map:chronological-repeated-setup-step-time'),
    verdictWallClockMs: measured('verdictWallClockMs', runCompletedMs - runCreatedMs, 'github-run:created_at->updated_at'),
    jobMinutes: measured('jobMinutes', Math.round((totalJobMs / 60000) * 1_000_000) / 1_000_000, startedJobs.length > 0 ? 'github-jobs:sum(started_at->completed_at)' : 'github-jobs:no-executed-jobs'),
  };

  const resolvedFailureClass = run.conclusion === 'success'
    ? 'NONE'
    : (failureClass ?? 'UNCLASSIFIED_FAILURE');

  const evidence = {
    schemaVersion: HOSTED_BENCHMARK_CONTRACT.schemaVersion,
    kind: HOSTED_BENCHMARK_CONTRACT.kind,
    authority,
    phaseDState,
    measurementOnly: true,
    selectionApplied: false,
    retryPolicy: { retries: 0 },
    identity: { ...identity },
    experiment: { ...experiment },
    outcome: {
      conclusion: run.conclusion,
      failureClass: resolvedFailureClass,
    },
    metrics,
    source: {
      collector: 'hosted-benchmark-collector-v1',
      runCreatedAt: run.created_at,
      runCompletedAt: run.updated_at,
      jobs: sourceJobs,
    },
  };

  validateHostedBenchmarkEvidence(evidence);
  return evidence;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith('--')) invalid(`unexpected argument ${name}`);
    const value = argv[index + 1];
    if (value == null || value.startsWith('--')) invalid(`missing value for ${name}`);
    args[name.slice(2)] = value;
    index += 1;
  }
  for (const required of ['run', 'jobs', 'identity', 'experiment', 'supplemental']) {
    if (!args[required]) invalid(`CLI requires --${required}`);
  }
  return args;
}

function readJson(path, field) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    invalid(`cannot read ${field} JSON: ${error.message}`);
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const run = readJson(args.run, 'run');
  const jobsRaw = readJson(args.jobs, 'jobs');
  const identity = readJson(args.identity, 'identity');
  const experiment = readJson(args.experiment, 'experiment');
  const supplementalMetrics = readJson(args.supplemental, 'supplemental');
  const phaseMap = args['phase-map'] ? readJson(args['phase-map'], 'phase-map') : defaultPhaseMap;
  const evidence = collectHostedBenchmarkEvidence({
    run,
    jobs: Array.isArray(jobsRaw) ? jobsRaw : jobsRaw.jobs,
    identity,
    experiment,
    phaseMap,
    supplementalMetrics,
    failureClass: args['failure-class'],
    authority: args.authority ?? 'NON_AUTHORITATIVE_PRE_PHASE_D',
    phaseDState: args['phase-d-state'] ?? 'PRE_FINAL_PHASE_D',
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (args.output) fs.writeFileSync(args.output, serialized, 'utf8');
  else process.stdout.write(serialized);
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  runCli();
}
