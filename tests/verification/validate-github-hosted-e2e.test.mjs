import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGithubHostedE2eSummary } from '../../tools/verification/validate-github-hosted-e2e.mjs';

const headSha = 'a'.repeat(40);
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const expectedStableTestIds = [
  'desktop-chromium::tests/a-desktop.spec.mjs::works',
  'mobile-chromium::tests/a-mobile.spec.mjs::works',
];

function summary(overrides = {}) {
  return {
    status: 'passed',
    metadata: {
      expectedRevision: headSha,
      targetMode: 'direct-preview',
      publicationOrigin: null,
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
    ...options,
  });
}

test('accepts exact-head all-pass zero-retry GitHub-hosted direct-preview evidence with exact stable-ID equality', () => {
  assert.deepEqual(validate(), {
    status: 'passed',
    headSha,
    workers: 1,
    scenarioCount: 2,
    stableTestIds: expectedStableTestIds,
    browserContainer,
  });
});

test('rejects stale head, wrong worker count, LAN mode and wrong browser identity', () => {
  assert.throws(() => validate(summary(), { headSha: 'b'.repeat(40) }), /expectedRevision/);
  assert.throws(() => validate(summary(), { workers: 2 }), /worker count/);
  assert.throws(() => validate(summary({ metadata: { ...summary().metadata, targetMode: 'checkout-overlay', publicationOrigin: 'http://lan' } })), /direct-preview/);
  assert.throws(() => validate(summary({ metadata: { ...summary().metadata, browserContainer: 'latest' } })), /browser container/);
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
