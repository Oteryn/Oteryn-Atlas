import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { collectHostedBenchmarkEvidence } from '../../tools/verification/collect-hosted-benchmark.mjs';

const phaseMap = JSON.parse(fs.readFileSync(new URL('../../tools/verification/hosted-benchmark-phase-map.json', import.meta.url), 'utf8'));
const sha = (digit) => digit.repeat(40);
const digest = (digit) => `sha256:${digit.repeat(64)}`;

function notApplicable(unit, source) {
  return { status: 'NOT_APPLICABLE', value: null, unit, source };
}

test('hosted benchmark collector rejects positive-duration steps outside their GitHub job timing window', () => {
  const run = {
    id: 991,
    run_attempt: 1,
    head_sha: sha('1'),
    repository: { full_name: 'Oteryn/Oteryn-Atlas' },
    created_at: '2026-08-27T10:00:00.000Z',
    updated_at: '2026-08-27T10:00:20.000Z',
    status: 'completed',
    conclusion: 'failure',
  };
  const jobs = [{
    id: 1001,
    run_id: 991,
    run_attempt: 1,
    head_sha: sha('1'),
    name: 'hosted-browser / shard 1',
    created_at: '2026-08-27T10:00:00.000Z',
    started_at: '2026-08-27T10:00:05.000Z',
    completed_at: '2026-08-27T10:00:10.000Z',
    conclusion: 'failure',
    steps: [{
      name: 'Check out exact Atlas candidate',
      started_at: '2026-08-27T10:00:01.000Z',
      completed_at: '2026-08-27T10:00:02.000Z',
      conclusion: 'success',
    }],
  }];
  const identity = {
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
  const experiment = {
    id: 'packed-w1',
    workers: 1,
    shards: 1,
    cache: 'cold',
    imageStrategy: 'current',
    productStrategy: 'per-shard',
    dagStart: 'eager',
  };
  const supplementalMetrics = {
    supersededWasteMs: notApplicable('ms', 'synthetic:not-collected'),
    runnerLogicalCpuCount: notApplicable('count', 'synthetic:not-collected'),
    runnerMemoryTotalBytes: notApplicable('bytes', 'synthetic:not-collected'),
    peakCpuPercent: notApplicable('percent', 'synthetic:not-collected'),
    peakMemoryBytes: notApplicable('bytes', 'synthetic:not-collected'),
    varianceMs: notApplicable('ms', 'synthetic:not-collected'),
    oomCrashCount: notApplicable('count', 'synthetic:not-collected'),
    usefulPlansPerHour: notApplicable('plans/hour', 'synthetic:not-collected'),
  };

  assert.throws(() => collectHostedBenchmarkEvidence({
    run,
    jobs,
    identity,
    experiment,
    phaseMap,
    supplementalMetrics,
    failureClass: 'INFRASTRUCTURE',
  }), /step .*outside job timing window/i);
});
