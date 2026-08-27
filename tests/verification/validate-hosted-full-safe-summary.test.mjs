import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const helperPath = fileURLToPath(new URL('../../tools/verification/validate-hosted-full-safe-summary.mjs', import.meta.url));
const head = 'a'.repeat(40);
const planDigest = `sha256:${'b'.repeat(64)}`;
const expectedStableTestIds = [
  'desktop-chromium::e2e/tests/a.spec.mjs::alpha',
  'mobile-chromium::e2e/tests/b.spec.mjs::beta',
];

async function loadHelper() {
  assert.equal(fs.existsSync(helperPath), true, 'hosted full-safety summary validator is missing');
  return import(pathToFileURL(helperPath).href);
}

function summary(overrides = {}) {
  return {
    status: 'passed',
    metadata: {
      expectedRevision: head,
      verificationPlanSha256: planDigest,
      targetMode: 'checkout-overlay',
      publicationOrigin: 'http://atlas-publication',
      workers: 1,
    },
    scenarios: expectedStableTestIds.map((stableTestId) => ({ stableTestId, status: 'passed', retry: 0 })),
    ...overrides,
  };
}

function validate(validateHostedFullSafeSummary, candidate, overrides = {}) {
  return validateHostedFullSafeSummary({
    summary: candidate,
    expectedStableTestIds,
    expectedHeadSha: head,
    expectedPlanDigest: planDigest,
    expectedWorkers: 1,
    expectedPublicationOrigin: 'http://atlas-publication',
    ...overrides,
  });
}

test('hosted full-safety summary validator accepts only exact zero-retry passed evidence', async () => {
  const { validateHostedFullSafeSummary } = await loadHelper();
  const result = validate(validateHostedFullSafeSummary, summary());
  assert.equal(result.status, 'success');
  assert.equal(result.candidateHeadSha, head);
  assert.equal(result.planDigest, planDigest);
  assert.equal(result.workers, 1);
  assert.deepEqual(result.stableTestIds, [...expectedStableTestIds].sort());
});

test('hosted full-safety summary validator rejects stale identity, mode, origin or worker evidence', async () => {
  const { validateHostedFullSafeSummary } = await loadHelper();
  const mutations = [
    (value) => { value.status = 'failed'; },
    (value) => { value.metadata.expectedRevision = 'c'.repeat(40); },
    (value) => { value.metadata.verificationPlanSha256 = `sha256:${'d'.repeat(64)}`; },
    (value) => { value.metadata.targetMode = 'direct-preview'; },
    (value) => { value.metadata.publicationOrigin = 'http://other-publication'; },
    (value) => { value.metadata.workers = 2; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(summary());
    mutate(candidate);
    assert.throws(() => validate(validateHostedFullSafeSummary, candidate), /summary|revision|plan|mode|publication|worker|status/i);
  }
});

test('hosted full-safety summary validator proves exact stable-ID equality and no retries or skips', async () => {
  const { validateHostedFullSafeSummary } = await loadHelper();

  const missing = summary({ scenarios: summary().scenarios.slice(0, 1) });
  assert.throws(() => validate(validateHostedFullSafeSummary, missing), /missing|stable/i);

  const unexpected = structuredClone(summary());
  unexpected.scenarios.push({ stableTestId: 'desktop-chromium::e2e/tests/c.spec.mjs::gamma', status: 'passed', retry: 0 });
  assert.throws(() => validate(validateHostedFullSafeSummary, unexpected), /unexpected|stable/i);

  const duplicate = structuredClone(summary());
  duplicate.scenarios.push({ ...duplicate.scenarios[0] });
  assert.throws(() => validate(validateHostedFullSafeSummary, duplicate), /duplicate/i);

  const skipped = structuredClone(summary());
  skipped.scenarios[0].status = 'skipped';
  assert.throws(() => validate(validateHostedFullSafeSummary, skipped), /status|skipped|passed/i);

  const retried = structuredClone(summary());
  retried.scenarios[0].retry = 1;
  assert.throws(() => validate(validateHostedFullSafeSummary, retried), /retry/i);
});
