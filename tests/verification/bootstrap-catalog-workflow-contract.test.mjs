import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { normalizeTrustedVerificationCatalog } from '../../tools/verification/verification-plan-schema.mjs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

function bootstrapCatalog() {
  const line = workflow.split(/\r?\n/).find((candidate) => candidate.includes('> "$trusted_catalog"') && candidate.includes("printf '%s\\n'"));
  assert.ok(line, 'CI must define an explicit trusted bootstrap catalog');
  const match = line.match(/printf '%s\\n' '(.+)' > "\$trusted_catalog"/);
  assert.ok(match, 'trusted bootstrap catalog must remain a single parseable JSON literal');
  return JSON.parse(match[1]);
}

test('legacy protected-base bootstrap catalog upgrades only to a fail-closed semantic lower bound', () => {
  const legacy = bootstrapCatalog();
  assert.equal(legacy.schemaVersion, 1, 'current protected base is intentionally a legacy bootstrap input');

  const catalog = normalizeTrustedVerificationCatalog(legacy);
  assert.equal(catalog.schemaVersion, 2);
  assert.deepEqual(Object.keys(catalog.groups).sort(), ['deterministic.core', 'e2e.full']);

  assert.deepEqual(catalog.groups['deterministic.core'], {
    specs: ['tests/verification/*.test.mjs'],
    projects: [],
    stableTestIds: [],
    resourceClass: 'cpu-light',
    evidence: 'machine-summary',
    sequential: false,
    fullSafetyNet: true,
    dependsOnGroups: [],
    capabilities: {
      browser: false,
      hosted: true,
      requiresPublication: false,
      dataCapability: 'qualification_fixture',
      visualReview: false,
      specialistReason: null,
    },
  });

  assert.deepEqual(catalog.groups['e2e.full'], {
    specs: ['e2e/tests/*.spec.mjs'],
    projects: ['desktop-chromium', 'mobile-chromium'],
    stableTestIds: [],
    resourceClass: 'browser-full',
    evidence: 'restricted-visual-review',
    sequential: false,
    fullSafetyNet: true,
    dependsOnGroups: [],
    capabilities: {
      browser: true,
      hosted: false,
      requiresPublication: true,
      dataCapability: 'real_fullworld',
      visualReview: true,
      specialistReason: 'real-fullworld-product',
    },
  });
});

test('trusted bootstrap upgrade rejects any non-exact legacy schema-v1 shape', () => {
  const legacy = bootstrapCatalog();
  legacy.groups['e2e.full'].specs = ['e2e/tests/desktop.spec.mjs'];
  assert.throws(() => normalizeTrustedVerificationCatalog(legacy), /trusted verification catalog invalid/);
});
