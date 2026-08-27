import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { validateShadowPlanEvidence } from '../../tools/verification/validate-shadow-plan-evidence.mjs';
import { canonicalJson } from '../../tools/verification/verification-plan-schema.mjs';

const HEAD = 'a'.repeat(40);
const IDS = Object.freeze([
  'desktop-chromium::e2e/tests/a.spec.mjs::alpha',
  'mobile-chromium::e2e/tests/b.spec.mjs::beta',
]);

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function fixture(overrides = {}) {
  const ids = [...IDS];
  const plan = {
    schemaVersion: 1,
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: HEAD,
    shadowOnly: true,
    retryPolicy: { retries: 0 },
    stableTestIds: ids,
    stableTestIdsDigest: digest(canonicalJson(ids)),
    ...overrides,
  };
  const planRaw = `${JSON.stringify(plan)}\n`;
  return { plan, planRaw, expectedPlanDigest: digest(planRaw) };
}

test('accepts exact transported plan bytes and exact stable-ID census', () => {
  const { planRaw, expectedPlanDigest } = fixture();
  const result = validateShadowPlanEvidence({
    planRaw,
    expectedPlanDigest,
    headSha: HEAD,
    stableTestIds: [...IDS],
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.headSha, HEAD);
  assert.equal(result.planDigest, expectedPlanDigest);
  assert.deepEqual(result.stableTestIds, [...IDS].sort());
});

test('rejects tampered plan bytes even when JSON remains valid', () => {
  const { planRaw, expectedPlanDigest } = fixture();
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: planRaw.replace('shadowOnly', 'shadowOnly '),
      expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [...IDS],
    }),
    /artifact digest mismatch/,
  );
});

test('rejects stale head and nonzero retries', () => {
  const stale = fixture({ headSha: 'b'.repeat(40) });
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: stale.planRaw,
      expectedPlanDigest: stale.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [...IDS],
    }),
    /headSha does not match/,
  );

  const retried = fixture({ retryPolicy: { retries: 1 } });
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: retried.planRaw,
      expectedPlanDigest: retried.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [...IDS],
    }),
    /retry policy must remain zero/,
  );
});

test('rejects missing, unexpected, duplicate, or digest-mismatched stable IDs', () => {
  const exact = fixture();
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: exact.planRaw,
      expectedPlanDigest: exact.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [IDS[0]],
    }),
    /do not exactly match/,
  );
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: exact.planRaw,
      expectedPlanDigest: exact.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [...IDS, 'desktop-chromium::e2e/tests/c.spec.mjs::gamma'],
    }),
    /do not exactly match/,
  );
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: exact.planRaw,
      expectedPlanDigest: exact.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [IDS[0], IDS[0]],
    }),
    /duplicate stable test ID/,
  );

  const wrongDigest = fixture({ stableTestIdsDigest: `sha256:${'0'.repeat(64)}` });
  assert.throws(
    () => validateShadowPlanEvidence({
      planRaw: wrongDigest.planRaw,
      expectedPlanDigest: wrongDigest.expectedPlanDigest,
      headSha: HEAD,
      stableTestIds: [...IDS],
    }),
    /stableTestIdsDigest does not match/,
  );
});
