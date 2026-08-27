import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { validateGithubHostedE2eSummary } from '../../tools/verification/validate-github-hosted-e2e.mjs';

const headSha = 'a'.repeat(40);
const planDigest = `sha256:${'b'.repeat(64)}`;
const publicationRoot = `sha256:${'c'.repeat(64)}`;
const treeDigest = `sha256:${'d'.repeat(64)}`;
const publicationOrigin = `https://publication.invalid/${publicationRoot.slice(7)}`;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const expectedStableTestIds = [
  'desktop-chromium::tests/a-desktop.spec.mjs::works',
  'mobile-chromium::tests/a-mobile.spec.mjs::works',
];
const expectedStableTestIdsDigest = `sha256:${crypto.createHash('sha256').update(JSON.stringify(expectedStableTestIds)).digest('hex')}`;

function publicationReadiness(overrides = {}) {
  return {
    complete: true,
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: headSha,
    planDigest,
    publicationRoot,
    treeDigest,
    fileCount: 321,
    bytes: 123456789,
    browserImage: browserContainer,
    producer: { runId: '12345', runAttempt: 1 },
    createdAt: '2026-08-27T05:00:00.000Z',
    ...overrides,
  };
}

function summary(overrides = {}) {
  return {
    status: 'passed',
    metadata: {
      expectedRevision: headSha,
      targetMode: 'checkout-overlay',
      publicationOrigin,
      verificationPlanSha256: planDigest,
      browserContainer,
      workers: 1,
    },
    scenarios: [
      { stableTestId: expectedStableTestIds[0], status: 'passed', retry: 0 },
      { stableTestId: expectedStableTestIds[1], status: 'passed', retry: 0 },
    ],
    ...overrides,
  };
}

function validate(value = summary(), options = {}) {
  return validateGithubHostedE2eSummary(value, {
    headSha,
    workers: 1,
    expectedStableTestIds,
    planDigest,
    publicationReadiness: publicationReadiness(),
    ...options,
  });
}

test('accepts exact-head all-pass zero-retry hosted evidence only with validated immutable publication readiness', () => {
  assert.deepEqual(validate(), {
    status: 'passed',
    headSha,
    workers: 1,
    scenarioCount: 2,
    stableTestIds: expectedStableTestIds,
    stableTestIdsDigest: expectedStableTestIdsDigest,
    browserContainer,
    planDigest,
    publicationRoot,
    publicationTreeDigest: treeDigest,
    publicationFileCount: 321,
    publicationBytes: 123456789,
  });
});

test('rejects stale head, wrong worker count, direct-preview mode and wrong browser identity', () => {
  assert.throws(() => validate(summary(), { headSha: 'e'.repeat(40) }), /expectedRevision/);
  assert.throws(() => validate(summary(), { workers: 2 }), /worker count/);
  assert.throws(() => validate(summary({ metadata: { ...summary().metadata, targetMode: 'direct-preview', publicationOrigin: null } })), /checkout-overlay/);
  assert.throws(() => validate(summary({ metadata: { ...summary().metadata, browserContainer: 'latest' } })), /browser container/);
});

test('rejects missing, stale or mismatched immutable publication readiness', () => {
  assert.throws(() => validate(summary(), { publicationReadiness: null }), /publication readiness/);
  assert.throws(() => validate(summary(), { planDigest: `sha256:${'f'.repeat(64)}` }), /verification plan/);
  assert.throws(() => validate(summary(), { publicationReadiness: publicationReadiness({ candidateSha: 'e'.repeat(40) }) }), /publication readiness candidate/);
  assert.throws(() => validate(summary(), { publicationReadiness: publicationReadiness({ planDigest: `sha256:${'f'.repeat(64)}` }) }), /publication readiness plan/);
  assert.throws(() => validate(summary(), { publicationReadiness: publicationReadiness({ browserImage: 'latest' }) }), /publication readiness browser/);
  assert.throws(() => validate(summary(), { publicationReadiness: publicationReadiness({ complete: false }) }), /publication readiness/);
  assert.throws(() => validate(summary({ metadata: { ...summary().metadata, publicationOrigin: null } })), /publication origin/);
});

test('rejects failures, retries, skipped scenarios and duplicate stable ids', () => {
  assert.throws(() => validate(summary({ status: 'failed' })), /not passed/);
  assert.throws(() => validate(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'failed', retry: 0 }] }), { expectedStableTestIds: ['p::s::a'] }), /not passed/);
  assert.throws(() => validate(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'passed', retry: 1 }] }), { expectedStableTestIds: ['p::s::a'] }), /retried/);
  assert.throws(() => validate(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'skipped', retry: 0 }] }), { expectedStableTestIds: ['p::s::a'] }), /not passed/);
  assert.throws(() => validate(summary({ scenarios: [
    { stableTestId: 'p::s::a', status: 'passed', retry: 0 },
    { stableTestId: 'p::s::a', status: 'passed', retry: 0 },
  ] }), { expectedStableTestIds: ['p::s::a'] }), /duplicate/);
});

test('rejects missing, unexpected, duplicate and malformed expected stable-ID evidence', () => {
  assert.throws(() => validate(summary({ scenarios: [
    { stableTestId: expectedStableTestIds[0], status: 'passed', retry: 0 },
  ] })), /missing stable test IDs/);

  assert.throws(() => validate(summary({ scenarios: [
    ...summary().scenarios,
    { stableTestId: 'desktop-chromium::tests/unexpected.spec.mjs::unexpected', status: 'passed', retry: 0 },
  ] })), /unexpected stable test IDs/);

  assert.throws(() => validate(summary(), {
    expectedStableTestIds: [expectedStableTestIds[0], expectedStableTestIds[0]],
  }), /duplicate expected stableTestId/);

  assert.throws(() => validate(summary(), { expectedStableTestIds: [] }), /expected stable test IDs/);
  assert.throws(() => validate(summary(), { expectedStableTestIds: ['malformed'] }), /expected stableTestId is invalid/);
});
