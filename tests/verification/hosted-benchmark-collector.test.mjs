import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const collectorUrl = new URL('../../tools/verification/collect-hosted-benchmark.mjs', import.meta.url);
const phaseMap = JSON.parse(fs.readFileSync(new URL('../../tools/verification/hosted-benchmark-phase-map.json', import.meta.url), 'utf8'));

const sha = (digit) => digit.repeat(40);
const digest = (digit) => `sha256:${digit.repeat(64)}`;

function makeIdentity() {
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: sha('1'),
    integrationBaseSha: sha('2'),
    protectedPhaseDSha: null,
    planDigest: digest('3'),
    stableIdSetDigest: digest('4'),
    productDigest: digest('5'),
    browserHarnessDigest: digest('6'),
    workflowRunId: 991,
    workflowRunAttempt: 1,
    workflowSha: sha('7'),
    profile: 'broad',
    dataCapability: 'qualification_fixture',
  };
}

function step(name, startedAt, completedAt, conclusion = 'success') {
  return {
    name,
    started_at: `2026-08-27T10:${startedAt}.000Z`,
    completed_at: `2026-08-27T10:${completedAt}.000Z`,
    conclusion,
  };
}

function makeRun() {
  return {
    id: 991,
    run_attempt: 1,
    head_sha: sha('1'),
    repository: { full_name: 'Oteryn/Oteryn-Atlas' },
    created_at: '2026-08-27T10:00:00.000Z',
    run_started_at: '2026-08-27T10:00:02.000Z',
    updated_at: '2026-08-27T10:02:00.000Z',
    status: 'completed',
    conclusion: 'success',
  };
}

function makeJobs() {
  return [
    {
      id: 1001,
      name: 'hosted-browser / shard 1',
      created_at: '2026-08-27T10:00:00.000Z',
      started_at: '2026-08-27T10:00:05.000Z',
      completed_at: '2026-08-27T10:01:40.000Z',
      conclusion: 'success',
      steps: [
        step('Check out exact Atlas candidate', '00:05', '00:10'),
        step('npm ci --prefix e2e', '00:10', '00:20'),
        step('Prepare hosted qualification build verify readiness', '00:20', '00:35'),
        step('Build Playwright browser image', '00:35', '00:45'),
        step('Start preview service', '00:45', '00:50'),
        step('Run Playwright execution shard 1', '00:50', '01:30'),
        step('Upload benchmark artifact', '01:30', '01:35'),
      ],
    },
    {
      id: 1002,
      name: 'hosted-browser / shard 2 + fan-in',
      created_at: '2026-08-27T10:00:20.000Z',
      started_at: '2026-08-27T10:00:25.000Z',
      completed_at: '2026-08-27T10:02:00.000Z',
      conclusion: 'success',
      steps: [
        step('Check out exact Atlas candidate', '00:25', '00:30'),
        step('npm ci --prefix e2e', '00:30', '00:40'),
        step('Prepare hosted qualification build verify readiness', '00:40', '00:55'),
        step('Build Playwright browser image', '00:55', '01:05'),
        step('Start preview service', '01:05', '01:10'),
        step('Run Playwright execution shard 2', '01:10', '01:45'),
        step('Download benchmark artifact summaries', '01:45', '01:50'),
        step('Shard fan-in evidence', '01:50', '02:00'),
      ],
    },
  ];
}

function makeExperiment() {
  return {
    id: 'shards2-w1',
    workers: 1,
    shards: 2,
    cache: 'cold',
    imageStrategy: 'current',
    productStrategy: 'per-shard',
    dagStart: 'eager',
  };
}

function makeSupplementalMetrics() {
  return {
    supersededWasteMs: {
      status: 'MEASURED',
      value: 0,
      unit: 'ms',
      source: 'synthetic:supersession-observer:no-superseding-head',
    },
    runnerLogicalCpuCount: {
      status: 'MEASURED',
      value: 4,
      unit: 'count',
      source: 'synthetic:runner-resource-sampler:logical-cpu',
    },
    runnerMemoryTotalBytes: {
      status: 'MEASURED',
      value: 17179869184,
      unit: 'bytes',
      source: 'synthetic:runner-resource-sampler:mem-total',
    },
    peakCpuPercent: {
      status: 'MEASURED',
      value: 82.5,
      unit: 'percent',
      source: 'synthetic:runner-resource-sampler:peak-total-capacity',
    },
    peakMemoryBytes: {
      status: 'MEASURED',
      value: 8589934592,
      unit: 'bytes',
      source: 'synthetic:runner-resource-sampler:peak-used',
    },
    varianceMs: {
      status: 'NOT_APPLICABLE',
      value: null,
      unit: 'ms',
      source: 'single-run-evidence:aggregate-required',
    },
    oomCrashCount: {
      status: 'MEASURED',
      value: 0,
      unit: 'count',
      source: 'synthetic:infra-outcome-classifier',
    },
    usefulPlansPerHour: {
      status: 'NOT_APPLICABLE',
      value: null,
      unit: 'plans/hour',
      source: 'single-run-evidence:concurrent-aggregate-required',
    },
  };
}

function makeUnreachedSupplementalMetrics() {
  const metrics = makeSupplementalMetrics();
  for (const metricId of ['runnerLogicalCpuCount', 'runnerMemoryTotalBytes', 'peakCpuPercent', 'peakMemoryBytes']) {
    metrics[metricId] = {
      status: 'NOT_APPLICABLE',
      value: null,
      unit: metrics[metricId].unit,
      source: 'synthetic:run-cancelled-before-resource-sampling',
    };
  }
  return metrics;
}

async function loadCollector() {
  assert.equal(fs.existsSync(collectorUrl), true, 'missing hosted benchmark collector');
  return import(collectorUrl.href);
}

test('hosted benchmark collector derives whole-DAG timings and preserves explicit resource/non-applicable metrics', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const evidence = collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: makeJobs(),
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  });

  assert.equal(evidence.authority, 'NON_AUTHORITATIVE_PRE_PHASE_D');
  assert.equal(evidence.phaseDState, 'PRE_FINAL_PHASE_D');
  assert.equal(evidence.measurementOnly, true);
  assert.equal(evidence.selectionApplied, false);
  assert.deepEqual(evidence.retryPolicy, { retries: 0 });
  assert.equal(evidence.identity.candidateSha, sha('1'));
  assert.equal(evidence.identity.profile, 'broad');
  assert.equal(evidence.identity.dataCapability, 'qualification_fixture');

  assert.deepEqual(evidence.metrics.queueProvisioningMs, {
    status: 'MEASURED',
    value: 5000,
    unit: 'ms',
    source: 'github-jobs:max(created_at->started_at)',
  });
  assert.equal(evidence.metrics.checkoutFetchMs.value, 10000);
  assert.equal(evidence.metrics.dependencyRestoreInstallMs.value, 20000);
  assert.equal(evidence.metrics.qualificationBuildVerifyReadinessMs.value, 30000);
  assert.equal(evidence.metrics.browserImageMs.value, 20000);
  assert.equal(evidence.metrics.previewStartupMs.value, 10000);
  assert.equal(evidence.metrics.playwrightExecutionMs.value, 75000);
  assert.equal(evidence.metrics.shardFanoutFaninMs.value, 10000);
  assert.equal(evidence.metrics.artifactUploadMs.value, 5000);
  assert.equal(evidence.metrics.artifactDownloadMs.value, 5000);
  assert.deepEqual(evidence.metrics.cacheRestoreMs, {
    status: 'NOT_APPLICABLE',
    value: null,
    unit: 'ms',
    source: 'phase-map:cache-restore:not-present',
  });
  assert.deepEqual(evidence.metrics.cacheSaveMs, {
    status: 'NOT_APPLICABLE',
    value: null,
    unit: 'ms',
    source: 'phase-map:cache-save:not-present',
  });
  assert.equal(evidence.metrics.duplicateSetupMs.value, 45000);
  assert.equal(evidence.metrics.verdictWallClockMs.value, 120000);
  assert.equal(evidence.metrics.jobMinutes.value, 3.166667);
  assert.equal(evidence.metrics.supersededWasteMs.value, 0);
  assert.equal(evidence.metrics.runnerLogicalCpuCount.value, 4);
  assert.equal(evidence.metrics.runnerMemoryTotalBytes.value, 17179869184);
  assert.equal(evidence.metrics.peakCpuPercent.value, 82.5);
  assert.equal(evidence.metrics.peakMemoryBytes.value, 8589934592);
  assert.equal(evidence.metrics.varianceMs.status, 'NOT_APPLICABLE');
  assert.equal(evidence.metrics.oomCrashCount.value, 0);
  assert.equal(evidence.metrics.usefulPlansPerHour.status, 'NOT_APPLICABLE');
  assert.equal(evidence.source.jobs.length, 2);
});

test('hosted benchmark collector fails closed when required telemetry is absent', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const supplemental = makeSupplementalMetrics();
  delete supplemental.peakMemoryBytes;
  assert.throws(() => collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: makeJobs(),
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: supplemental,
  }), /missing explicit supplemental metric peakMemoryBytes/i);
});

test('hosted benchmark collector fails closed when a required timed phase is absent', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const jobs = makeJobs().map((job) => ({
    ...job,
    steps: job.steps.filter((candidate) => !candidate.name.includes('Playwright browser image')),
  }));
  assert.throws(() => collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs,
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  }), /missing required benchmark phase browser-image/i);
});

test('hosted benchmark collector rejects repository/candidate run identity drift and malformed timing', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();

  const wrongRepository = makeIdentity();
  wrongRepository.repository = 'Other/Repository';
  assert.throws(() => collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: makeJobs(),
    identity: wrongRepository,
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  }), /repository.*full_name/i);

  const wrongIdentity = makeIdentity();
  wrongIdentity.candidateSha = sha('9');
  assert.throws(() => collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: makeJobs(),
    identity: wrongIdentity,
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  }), /candidateSha.*head_sha/i);

  const badJobs = makeJobs();
  badJobs[0].steps[0].completed_at = '2026-08-27T09:59:59.000Z';
  assert.throws(() => collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: badJobs,
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  }), /negative.*duration/i);
});

test('duplicate setup measurement is chronological and independent of GitHub jobs array ordering', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const jobs = makeJobs();
  jobs[0].steps[1].completed_at = '2026-08-27T10:00:19.000Z';
  const evidence = collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: [...jobs].reverse(),
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
  });
  assert.equal(evidence.metrics.duplicateSetupMs.value, 45000);
});

test('hosted benchmark collector records failed and infrastructure runs instead of hiding them', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const run = makeRun();
  run.conclusion = 'failure';
  const evidence = collectHostedBenchmarkEvidence({
    run,
    jobs: makeJobs(),
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeSupplementalMetrics(),
    failureClass: 'INFRASTRUCTURE',
  });
  assert.deepEqual(evidence.outcome, {
    conclusion: 'failure',
    failureClass: 'INFRASTRUCTURE',
  });
});

test('hosted benchmark collector preserves a cancelled failure even when no job ever starts', async () => {
  const { collectHostedBenchmarkEvidence } = await loadCollector();
  const run = makeRun();
  run.conclusion = 'cancelled';
  run.updated_at = '2026-08-27T10:00:15.000Z';
  const jobs = [{
    id: 1003,
    name: 'hosted-browser / cancelled before runner assignment',
    created_at: '2026-08-27T10:00:01.000Z',
    started_at: null,
    completed_at: null,
    conclusion: 'cancelled',
    steps: [],
  }];
  const evidence = collectHostedBenchmarkEvidence({
    run,
    jobs,
    identity: makeIdentity(),
    experiment: makeExperiment(),
    phaseMap,
    supplementalMetrics: makeUnreachedSupplementalMetrics(),
    failureClass: 'CANCELLED',
  });

  assert.deepEqual(evidence.outcome, { conclusion: 'cancelled', failureClass: 'CANCELLED' });
  assert.deepEqual(evidence.metrics.queueProvisioningMs, {
    status: 'NOT_APPLICABLE',
    value: null,
    unit: 'ms',
    source: 'github-jobs:no-started-jobs:cancelled',
  });
  assert.equal(evidence.metrics.jobMinutes.value, 0);
  assert.equal(evidence.metrics.playwrightExecutionMs.status, 'NOT_APPLICABLE');
  assert.equal(evidence.source.jobs[0].timingStatus, 'NOT_STARTED');
});
