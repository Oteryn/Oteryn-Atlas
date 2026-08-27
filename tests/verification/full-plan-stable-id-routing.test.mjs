import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const fixtureId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::fixture-backed desktop';
const specialistId = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::complete FullWorld animation census';

const catalog = {
  schemaVersion: 2,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'], projects: [], resourceClass: 'cpu-light', evidence: 'machine-summary',
      capabilities: { browser: false, hosted: true, requiresPublication: false, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
    },
    'e2e.full': {
      specs: ['e2e/tests/desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-full', evidence: 'machine-summary',
      capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
    },
    'fullworld.animation-census': {
      specs: ['e2e/tests/fullworld-animation-census-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-full', evidence: 'machine-summary',
      capabilities: { browser: true, hosted: false, requiresPublication: true, dataCapability: 'real_fullworld', visualReview: false, specialistReason: 'real-fullworld-product' },
    },
  },
};

const impact = {
  schemaVersion: 2,
  entries: [
    { pathPrefix: 'tools/verification/', domains: ['verification-governance'], minimumProfile: 'full', requiredGroups: ['deterministic.core', 'e2e.full'] },
  ],
  crossDomainEscalations: [],
};

test('full qualification plan filters the protected census to selected group specs instead of absorbing specialist IDs', () => {
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tools/verification/planner.mjs' }],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    verificationCatalog: catalog,
    protectedStableTestIds: [fixtureId, specialistId],
  });

  assert.equal(plan.profile, 'full');
  assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.full']);
  assert.deepEqual(plan.requiredDataCapabilities, ['qualification_fixture']);
  assert.equal(plan.requiresRealFullWorld, false);
  assert.deepEqual(plan.stableTestIds, [fixtureId]);
  assert(!plan.stableTestIds.includes(specialistId));
});
