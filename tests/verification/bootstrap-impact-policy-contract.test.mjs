import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeTrustedVerificationCatalog, validateImpactManifest } from '../../tools/verification/verification-plan-schema.mjs';

const protectedMainCatalogV1 = {
  schemaVersion: 1,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'], projects: [], resourceClass: 'cpu-light', evidence: 'machine-summary', fullSafetyNet: true,
    },
    'e2e.common-smoke': {
      specs: ['e2e/tests/desktop.spec.mjs', 'e2e/tests/mobile.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-targeted', evidence: 'machine-summary', fullSafetyNet: true,
    },
    'e2e.creatures': {
      specs: ['e2e/tests/creatures-desktop.spec.mjs', 'e2e/tests/creature-interaction-desktop.spec.mjs', 'e2e/tests/creature-interaction-mobile.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-targeted', evidence: 'machine-summary', fullSafetyNet: true,
    },
    'e2e.full': {
      specs: ['e2e/tests/*.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-full', evidence: 'restricted-visual-review', fullSafetyNet: true,
    },
    'visual.creatures': {
      specs: ['e2e/tests/visual-desktop.spec.mjs', 'e2e/tests/visual-mobile.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-targeted', evidence: 'restricted-visual-review', fullSafetyNet: true,
    },
  },
};
const protectedMainImpactV1 = {
  schemaVersion: 1,
  entries: [
    { pathPrefix: 'docs/', domains: ['documentation'], minimumProfile: 'none', requiredGroups: [] },
    { pathPrefix: 'tools/dyn-atlas-semantic/', domains: ['generator'], minimumProfile: 'focused', requiredGroups: ['deterministic.core'] },
    { pathPrefix: 'src/browser/creature-', domains: ['creatures'], minimumProfile: 'targeted', requiredGroups: ['deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'visual.creatures'] },
    { pathPrefix: 'src/browser/', domains: ['browser-runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core', 'e2e.common-smoke'] },
    { pathPrefix: 'tools/verification/', domains: ['verification-governance'], minimumProfile: 'full', requiredGroups: ['deterministic.core', 'e2e.full'] },
  ],
};

test('current protected-main impact schema v1 migrates exactly to v2 with no invented cross-domain rules', () => {
  const result = validateImpactManifest(protectedMainImpactV1, normalizeTrustedVerificationCatalog(protectedMainCatalogV1));
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.entries, protectedMainImpactV1.entries);
  assert.deepEqual(result.crossDomainEscalations, []);
});

test('legacy impact migration rejects any non-exact v1 policy mutation', () => {
  const narrowed = structuredClone(protectedMainImpactV1);
  narrowed.entries[4].minimumProfile = 'none';
  narrowed.entries[4].requiredGroups = [];
  assert.throws(() => validateImpactManifest(narrowed, normalizeTrustedVerificationCatalog(protectedMainCatalogV1)), /legacy schemaVersion 1.*exact known protected manifest/i);
});
