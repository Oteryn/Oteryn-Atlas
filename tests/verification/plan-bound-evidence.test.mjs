import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { validatePlanBoundE2eEvidence } from '../../tools/verification/validate-e2e-evidence.mjs';

const ids = [
  'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop fullworld',
  'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile fullworld',
];

function input(overrides = {}) {
  return {
    plan: { repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), stableTestIds: ids },
    summary: {
      metadata: { verificationPlanSha256: 'sha256:plan' },
      scenarios: ids.map((stableTestId) => ({ stableTestId, status: 'passed', retry: 0 })),
    },
    planSha256: 'sha256:plan',
    headSha: 'a'.repeat(40),
    ...overrides,
  };
}

test('plan-bound evidence accepts one clean passing scenario for every stable planned ID', () => {
  assert.deepEqual(validatePlanBoundE2eEvidence(input()), { expectedScenarioCount: 2, planSha256: 'sha256:plan' });
});

test('plan-bound evidence rejects stale plans, duplicate IDs and matching-count substitutions', () => {
  assert.throws(() => validatePlanBoundE2eEvidence(input({ planSha256: 'sha256:other' })), /not bound/);
  assert.throws(() => validatePlanBoundE2eEvidence(input({ summary: {
    metadata: { verificationPlanSha256: 'sha256:plan' },
    scenarios: [
      { stableTestId: ids[0], status: 'passed', retry: 0 },
      { stableTestId: ids[0], status: 'passed', retry: 0 },
    ],
  } })), /duplicate/);
  assert.throws(() => validatePlanBoundE2eEvidence(input({ summary: {
    metadata: { verificationPlanSha256: 'sha256:plan' },
    scenarios: [
      { stableTestId: ids[0], status: 'passed', retry: 0 },
      { stableTestId: 'mobile-chromium::e2e/tests/mobile.spec.mjs::substitution', status: 'passed', retry: 0 },
    ],
  } })), /census does not match/);
});

test('plan-bound evidence CLI has a platform-safe entrypoint for Windows publication', () => {
  const source = fs.readFileSync(new URL('../../tools/verification/validate-e2e-evidence.mjs', import.meta.url), 'utf8');
  assert.match(source, /pathToFileURL\(process\.argv\[1\]\)\.href === import\.meta\.url/);
  assert.doesNotMatch(source, /import\.meta\.url === `file:\$\{process\.argv\[1\]\}`/);
});
