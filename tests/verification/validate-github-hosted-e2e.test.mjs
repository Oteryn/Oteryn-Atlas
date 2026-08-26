import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGithubHostedE2eSummary } from '../../tools/verification/validate-github-hosted-e2e.mjs';

const headSha = 'a'.repeat(40);
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';

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
      { stableTestId: 'desktop-chromium::tests/a-desktop.spec.mjs::works', status: 'passed', retry: 0 },
      { stableTestId: 'mobile-chromium::tests/a-mobile.spec.mjs::works', status: 'passed', retry: 0 },
    ],
    ...overrides,
  };
}

test('accepts exact-head all-pass zero-retry GitHub-hosted direct-preview evidence', () => {
  assert.deepEqual(validateGithubHostedE2eSummary(summary(), { headSha, workers: 1 }), {
    status: 'passed',
    headSha,
    workers: 1,
    scenarioCount: 2,
    browserContainer,
  });
});

test('rejects stale head, wrong worker count, LAN mode and wrong browser identity', () => {
  assert.throws(() => validateGithubHostedE2eSummary(summary(), { headSha: 'b'.repeat(40), workers: 1 }), /expectedRevision/);
  assert.throws(() => validateGithubHostedE2eSummary(summary(), { headSha, workers: 2 }), /worker count/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ metadata: { ...summary().metadata, targetMode: 'checkout-overlay', publicationOrigin: 'http://lan' } }), { headSha, workers: 1 }), /direct-preview/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ metadata: { ...summary().metadata, browserContainer: 'latest' } }), { headSha, workers: 1 }), /browser container/);
});

test('rejects failures, retries, skipped scenarios and duplicate stable ids', () => {
  assert.throws(() => validateGithubHostedE2eSummary(summary({ status: 'failed' }), { headSha, workers: 1 }), /not passed/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'failed', retry: 0 }] }), { headSha, workers: 1 }), /not passed/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'passed', retry: 1 }] }), { headSha, workers: 1 }), /retried/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ scenarios: [{ stableTestId: 'p::s::a', status: 'skipped', retry: 0 }] }), { headSha, workers: 1 }), /not passed/);
  assert.throws(() => validateGithubHostedE2eSummary(summary({ scenarios: [
    { stableTestId: 'p::s::a', status: 'passed', retry: 0 },
    { stableTestId: 'p::s::a', status: 'passed', retry: 0 },
  ] }), { headSha, workers: 1 }), /duplicate/);
});
