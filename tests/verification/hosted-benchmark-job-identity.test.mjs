import assert from 'node:assert/strict';
import test from 'node:test';

import { collectHostedBenchmarkEvidence } from '../../tools/verification/collect-hosted-benchmark.mjs';

const sha = (digit) => digit.repeat(40);
const digest = (digit) => `sha256:${digit.repeat(64)}`;

function makeRun() {
  return {
    id: 991,
    run_attempt: 1,
    head_sha: sha('1'),
    repository: { full_name: 'Oteryn/Oteryn-Atlas' },
    created_at: '2026-08-27T10:00:00.000Z',
    run_started_at: '2026-08-27T10:00:02.000Z',
    updated_at: '2026-08-27T10:00:20.000Z',
    status: 'completed',
    conclusion: 'failure',
  };
}

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

function makeJob() {
  return {
    id: 1001,
    run_id: 991,
    run_attempt: 1,
    head_sha: sha('1'),
    name: 'hosted-browser / failed before timed phases',
    created_at: '2026-08-27T10:00:01.000Z',
    started_at: '2026-08-27T10:00:05.000Z',
    completed_at: '2026-08-27T10:00:15.000Z',
    conclusion: 'failure',
    steps: [],
  };
}

function makeExperiment() {
  return {
    id: 'packed-w1',
    workers: 1,
    shards: 1,
    cache: 'cold',
    imageStrategy: 'current',
    productStrategy: 'per-shard',
    dagStart: 'eager',
  };
}

function na(unit, source) {
  return { status: 'NOT_APPLICABLE', value: null, unit, source };
}

function measured(value, unit, source) {
  return { status: 'MEASURED', value, unit, source };
}

function makeSupplementalMetrics() {
  return {
    supersededWasteMs: measured(0, 'ms', 'synthetic:no-superseding-head'),
    runnerLogicalCpuCount: na('count', 'synthetic:failed-before-resource-sampling'),
    runnerMemoryTotalBytes: na('bytes', 'synthetic:failed-before-resource-sampling'),
    peakCpuPercent: na('percent', 'synthetic:failed-before-resource-sampling'),
    peakMemoryBytes: na('bytes', 'synthetic:failed-before-resource-sampling'),
    varianceMs: na('ms', 'single-run-evidence:aggregate-required'),
    oomCrashCount: measured(0, 'count', 'synthetic:infra-outcome-classifier'),
    usefulPlansPerHour: na('plans/hour', 'single-run-evidence:aggregate-required'),
  };
}

function collectWith(job) {
  return collectHostedBenchmarkEvidence({
    run: makeRun(),
    jobs: [job],
    identity: makeIdentity(),
    experiment: makeExperiment(),
    supplementalMetrics: makeSupplementalMetrics(),
    failureClass: 'INFRASTRUCTURE',
  });
}

test('hosted benchmark collector binds every job to the exact workflow run, attempt, and candidate head', () => {
  const wrongRun = makeJob();
  wrongRun.run_id = 992;
  assert.throws(() => collectWith(wrongRun), /job 1001.*run_id.*workflow run/i);

  const wrongAttempt = makeJob();
  wrongAttempt.run_attempt = 2;
  assert.throws(() => collectWith(wrongAttempt), /job 1001.*run_attempt.*workflow run/i);

  const wrongHead = makeJob();
  wrongHead.head_sha = sha('9');
  assert.throws(() => collectWith(wrongHead), /job 1001.*head_sha.*candidate/i);
});
