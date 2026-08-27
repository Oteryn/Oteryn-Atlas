import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { normalizeTrustedVerificationCatalog } from '../../tools/verification/verification-plan-schema.mjs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

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

function bootstrapCatalog() {
  const line = workflow.split(/\r?\n/).find((candidate) => candidate.includes('> "$trusted_catalog"') && candidate.includes("printf '%s\\n'"));
  assert.ok(line, 'CI must define an explicit trusted bootstrap catalog');
  const match = line.match(/printf '%s\\n' '(.+)' > "\$trusted_catalog"/);
  assert.ok(match, 'trusted bootstrap catalog must remain a single parseable JSON literal');
  return JSON.parse(match[1]);
}

test('legacy workflow bootstrap catalog upgrades only to a fail-closed semantic lower bound', () => {
  const legacy = bootstrapCatalog();
  assert.equal(legacy.schemaVersion, 1);

  const catalog = normalizeTrustedVerificationCatalog(legacy);
  assert.equal(catalog.schemaVersion, 2);
  assert.deepEqual(Object.keys(catalog.groups).sort(), ['deterministic.core', 'e2e.full']);
  assert.equal(catalog.groups['deterministic.core'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(catalog.groups['deterministic.core'].capabilities.hosted, true);
  assert.equal(catalog.groups['e2e.full'].capabilities.dataCapability, 'real_fullworld');
  assert.equal(catalog.groups['e2e.full'].capabilities.hosted, false);
  assert.equal(catalog.groups['e2e.full'].capabilities.visualReview, true);
  assert.equal(catalog.groups['e2e.full'].capabilities.specialistReason, 'real-fullworld-product');
});

test('current protected-main schema-v1 catalog is mapped explicitly and keeps wildcard full fail closed', () => {
  const catalog = normalizeTrustedVerificationCatalog(protectedMainCatalogV1);
  assert.equal(catalog.schemaVersion, 2);
  assert.deepEqual(Object.keys(catalog.groups).sort(), [
    'deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'e2e.full', 'visual.creatures',
  ]);
  assert.equal(catalog.groups['e2e.common-smoke'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(catalog.groups['e2e.common-smoke'].capabilities.hosted, true);
  assert.equal(catalog.groups['e2e.creatures'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(catalog.groups['e2e.creatures'].capabilities.hosted, true);
  assert.equal(catalog.groups['visual.creatures'].capabilities.dataCapability, 'bounded_real_world');
  assert.equal(catalog.groups['visual.creatures'].capabilities.hosted, false);
  assert.equal(catalog.groups['visual.creatures'].capabilities.visualReview, true);
  assert.equal(catalog.groups['e2e.full'].capabilities.dataCapability, 'real_fullworld');
  assert.equal(catalog.groups['e2e.full'].capabilities.hosted, false);
});

test('trusted schema-v1 upgrade rejects any non-exact known protected shape', () => {
  const legacy = structuredClone(protectedMainCatalogV1);
  legacy.groups['e2e.full'].specs = ['e2e/tests/desktop.spec.mjs'];
  assert.throws(() => normalizeTrustedVerificationCatalog(legacy), /trusted verification catalog invalid/);
});
