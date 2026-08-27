import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const schemaUrl = new URL('../../tools/verification/hosted-benchmark-schema.mjs', import.meta.url);
const contract = JSON.parse(fs.readFileSync(new URL('../../tools/verification/hosted-benchmark-contract.json', import.meta.url), 'utf8'));

const sha = (digit) => digit.repeat(40);
const digest = (digit) => `sha256:${digit.repeat(64)}`;

function makeMetrics() {
  return Object.fromEntries(contract.requiredMetricIds.map((metricId) => [
    metricId,
    {
      status: 'MEASURED',
      value: metricId === 'jobMinutes' || metricId === 'usefulPlansPerHour' ? 1.25 : 1,
      unit: contract.metricUnits[metricId],
      source: `synthetic:${metricId}`,
    },
  ]));
}

function makeEvidence() {
  return {
    schemaVersion: 1,
    kind: 'atlas-hosted-e2e-phase-e-benchmark',
    authority: 'NON_AUTHORITATIVE_PRE_PHASE_D',
    phaseDState: 'PRE_FINAL_PHASE_D',
    measurementOnly: true,
    selectionApplied: false,
    retryPolicy: { retries: 0 },
    identity: {
      repository: 'Oteryn/Oteryn-Atlas',
      candidateSha: sha('1'),
      integrationBaseSha: sha('2'),
      protectedPhaseDSha: null,
      planDigest: digest('3'),
      stableIdSetDigest: digest('4'),
      productDigest: digest('5'),
      browserHarnessDigest: digest('6'),
      workflowRunId: 12345,
      workflowRunAttempt: 1,
      workflowSha: sha('7'),
      profile: 'full',
      dataCapability: 'qualification_fixture',
    },
    experiment: {
      id: 'packed-w1',
      workers: 1,
      shards: 1,
      cache: 'cold',
      imageStrategy: 'current',
      productStrategy: 'per-shard',
      dagStart: 'eager',
    },
    outcome: {
      conclusion: 'success',
      failureClass: 'NONE',
    },
    metrics: makeMetrics(),
    source: {
      collector: 'hosted-benchmark-collector-v1',
      runCreatedAt: '2026-08-27T10:00:00.000Z',
      runCompletedAt: '2026-08-27T10:01:00.000Z',
      jobs: [],
    },
  };
}

async function loadValidator() {
  assert.equal(fs.existsSync(schemaUrl), true, 'missing hosted benchmark schema validator');
  return import(schemaUrl.href);
}

test('hosted benchmark schema accepts complete non-authoritative measurement evidence', async () => {
  const { validateHostedBenchmarkEvidence } = await loadValidator();
  const evidence = makeEvidence();
  assert.equal(validateHostedBenchmarkEvidence(evidence), evidence);
});

test('hosted benchmark schema fails closed on missing metrics and invalid observation values', async () => {
  const { validateHostedBenchmarkEvidence } = await loadValidator();

  const missing = makeEvidence();
  delete missing.metrics.previewStartupMs;
  assert.throws(() => validateHostedBenchmarkEvidence(missing), /missing metric previewStartupMs/i);

  const implicitMissing = makeEvidence();
  implicitMissing.metrics.cacheRestoreMs.value = null;
  assert.throws(() => validateHostedBenchmarkEvidence(implicitMissing), /MEASURED.*finite non-negative/i);

  const invalidNa = makeEvidence();
  invalidNa.metrics.cacheRestoreMs = {
    status: 'NOT_APPLICABLE',
    value: 0,
    unit: 'ms',
    source: 'synthetic:no-cache',
  };
  assert.throws(() => validateHostedBenchmarkEvidence(invalidNa), /NOT_APPLICABLE.*null/i);

  const wrongUnit = makeEvidence();
  wrongUnit.metrics.jobMinutes.unit = 'ms';
  assert.throws(() => validateHostedBenchmarkEvidence(wrongUnit), /unit/i);
});

test('hosted benchmark schema rejects identity drift, retries and policy mutation', async () => {
  const { validateHostedBenchmarkEvidence } = await loadValidator();

  const badSha = makeEvidence();
  badSha.identity.candidateSha = 'main';
  assert.throws(() => validateHostedBenchmarkEvidence(badSha), /candidateSha/i);

  const badDigest = makeEvidence();
  badDigest.identity.planDigest = 'sha256:1234';
  assert.throws(() => validateHostedBenchmarkEvidence(badDigest), /planDigest/i);

  const retry = makeEvidence();
  retry.retryPolicy.retries = 1;
  assert.throws(() => validateHostedBenchmarkEvidence(retry), /retries.*zero/i);

  const selection = makeEvidence();
  selection.selectionApplied = true;
  assert.throws(() => validateHostedBenchmarkEvidence(selection), /selectionApplied/i);

  const mutated = makeEvidence();
  mutated.measurementOnly = false;
  assert.throws(() => validateHostedBenchmarkEvidence(mutated), /measurementOnly/i);
});

test('hosted benchmark schema cannot claim authoritative post-Phase-D evidence without protected merged Phase D identity', async () => {
  const { validateHostedBenchmarkEvidence } = await loadValidator();

  const falseAuthority = makeEvidence();
  falseAuthority.authority = 'AUTHORITATIVE_POST_PHASE_D';
  assert.throws(() => validateHostedBenchmarkEvidence(falseAuthority), /protected Phase D/i);

  const authoritative = makeEvidence();
  authoritative.authority = 'AUTHORITATIVE_POST_PHASE_D';
  authoritative.phaseDState = 'FINAL_PROTECTED_MERGED';
  authoritative.identity.protectedPhaseDSha = sha('8');
  assert.equal(validateHostedBenchmarkEvidence(authoritative), authoritative);
});

test('hosted benchmark schema keeps profile and data capability independent', async () => {
  const { validateHostedBenchmarkEvidence } = await loadValidator();
  const evidence = makeEvidence();
  evidence.identity.profile = 'full';
  evidence.identity.dataCapability = 'qualification_fixture';
  assert.equal(validateHostedBenchmarkEvidence(evidence), evidence);
});
