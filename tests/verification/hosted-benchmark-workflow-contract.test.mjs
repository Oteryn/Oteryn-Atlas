import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const docUrl = new URL('../../docs/testing/ATLAS-PHASE-E-HOSTED-BENCHMARK-HARNESS.md', import.meta.url);
const collectorUrl = new URL('../../tools/verification/collect-hosted-benchmark.mjs', import.meta.url);
const experimentsUrl = new URL('../../tools/verification/hosted-benchmark-experiments.json', import.meta.url);

function readRequired(url, label) {
  assert.equal(fs.existsSync(url), true, `missing ${label}`);
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

test('Phase E hosted benchmark runbook keeps pre-Phase-D evidence non-authoritative and binds exact identities', () => {
  const doc = readRequired(docUrl, 'Phase E hosted benchmark runbook');
  assert.match(doc, /NON_AUTHORITATIVE_PRE_PHASE_D/);
  assert.match(doc, /final protected Phase D/i);
  assert.match(doc, /at least 3 clean repetitions/i);
  assert.match(doc, /retries\s*=\s*0/i);
  assert.match(doc, /workflowRunAttempt\s*=\s*1/i);
  assert.match(doc, /Molehill.*specialist-only/i);
  assert.match(doc, /must not define ordinary.*defaults/i);
  assert.match(doc, /full.*does not imply.*real_fullworld/i);

  for (const field of [
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
    assert.match(doc, new RegExp(`\\b${field}\\b`), `runbook must require ${field}`);
  }
});

test('Phase E hosted benchmark runbook covers the whole Actions DAG, runner resources and decision metrics', () => {
  const doc = readRequired(docUrl, 'Phase E hosted benchmark runbook');
  for (const phrase of [
    'queue/provisioning',
    'checkout/fetch',
    'dependency restore/install',
    'qualification build + verification + readiness',
    'browser image pull/build/extract',
    'preview startup',
    'Playwright execution',
    'shard fan-out/fan-in',
    'cache restore/save',
    'artifact upload/download',
    'cancellation/superseded waste',
    'duplicate setup/work',
    'verdict wall-clock',
    'job-minutes',
    'runner logical CPU count',
    'runner total memory',
    'peak CPU percent',
    'peak memory bytes',
    'variance',
    'OOM/crash',
    'useful plans/hour',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `missing runbook metric ${phrase}`);
  }
});

test('Phase E hosted experiment sequence starts packed and keeps worker/shard axes conditional', () => {
  const doc = readRequired(docUrl, 'Phase E hosted benchmark runbook');
  const experiments = JSON.parse(readRequired(experimentsUrl, 'hosted benchmark experiments'));
  assert.match(doc, /packed-w1/);
  assert.match(doc, /workers\s*=\s*2.*conditional/i);
  assert.match(doc, /workers\s*=\s*4.*conditional/i);
  assert.match(doc, /2 shards.*broad.*full/i);
  assert.match(doc, /4 shards.*broad.*full/i);
  assert.match(doc, /cold.*restored cache/i);
  assert.match(doc, /current.*thin immutable.*image/i);
  assert.match(doc, /per-shard.*build-once.*content-addressed/i);
  assert.match(doc, /eager.*gated.*DAG/i);
  assert.equal(experiments.executionShapeCandidates.some((candidate) => candidate.workers > 1 && candidate.shards > 1), false);
  assert.equal(experiments.doNotCartesianProductAxes, true);
});

test('hosted benchmark collection remains offline measurement-only tooling', () => {
  const collector = readRequired(collectorUrl, 'hosted benchmark collector');
  assert.match(collector, /measurementOnly:\s*true/);
  assert.match(collector, /selectionApplied:\s*false/);
  assert.match(collector, /retryPolicy:\s*\{\s*retries:\s*0\s*\}/);
  assert.doesNotMatch(collector, /node:child_process|execSync|spawnSync|fork\(/);
  assert.doesNotMatch(collector, /worker-policy|build-verification-plan|selective.*enabled/i);
  assert.doesNotMatch(collector, /https:\/\/api\.github\.com|fetch\s*\(/);
});

test('Phase E runbook exports GitHub run/jobs metadata then invokes the fail-closed collector', () => {
  const doc = readRequired(docUrl, 'Phase E hosted benchmark runbook');
  assert.match(doc, /gh api .*actions\/runs\/\$RUN_ID/);
  assert.match(doc, /gh api .*actions\/runs\/\$RUN_ID\/jobs/);
  assert.match(doc, /collect-hosted-benchmark\.mjs/);
  assert.match(doc, /--supplemental/);
  assert.match(doc, /failureClass|failure-class/);
  assert.match(doc, /measurement.*failure.*record/i);
});
