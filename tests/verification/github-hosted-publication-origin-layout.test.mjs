import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGithubHostedE2eSummary } from '../../tools/verification/validate-github-hosted-e2e.mjs';

const headSha = 'a'.repeat(40);
const planDigest = `sha256:${'b'.repeat(64)}`;
const publicationRoot = `sha256:${'c'.repeat(64)}`;
const treeDigest = `sha256:${'d'.repeat(64)}`;
const publicationOrigin = 'https://immutable-publication.example.invalid/releases/fullworld-v2';
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const stableTestId = 'desktop-chromium::tests/fullworld.spec.mjs::renders';

test('hosted fan-in accepts a provider-opaque HTTPS origin when readiness binds its exact digest identity', () => {
  const result = validateGithubHostedE2eSummary({
    status: 'passed',
    metadata: {
      expectedRevision: headSha,
      targetMode: 'checkout-overlay',
      publicationOrigin,
      verificationPlanSha256: planDigest,
      browserContainer,
      workers: 1,
    },
    scenarios: [{ stableTestId, status: 'passed', retry: 0 }],
  }, {
    headSha,
    workers: 1,
    expectedStableTestIds: [stableTestId],
    planDigest,
    publicationReadiness: {
      complete: true,
      repository: 'Oteryn/Oteryn-Atlas',
      candidateSha: headSha,
      planDigest,
      publicationOrigin,
      publicationRoot,
      treeDigest,
      fileCount: 321,
      bytes: 123456789,
      browserImage: browserContainer,
      producer: { runId: '12345', runAttempt: 1 },
      createdAt: '2026-08-27T05:00:00.000Z',
    },
  });
  assert.equal(result.publicationOrigin, publicationOrigin);
  assert.equal(result.publicationRoot, publicationRoot);
});
