import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

function bootstrapCatalog() {
  const line = workflow.split(/\r?\n/).find((candidate) => candidate.includes('> "$trusted_catalog"') && candidate.includes("printf '%s\\n'"));
  assert.ok(line, 'CI must define an explicit trusted bootstrap catalog');
  const match = line.match(/printf '%s\\n' '(.+)' > "\$trusted_catalog"/);
  assert.ok(match, 'trusted bootstrap catalog must remain a single parseable JSON literal');
  return JSON.parse(match[1]);
}

test('protected-base bootstrap catalog uses the current semantic schema without narrowing full safety', () => {
  const catalog = bootstrapCatalog();
  assert.equal(catalog.schemaVersion, 2);
  assert.deepEqual(Object.keys(catalog.groups).sort(), ['deterministic.core', 'e2e.full']);

  assert.deepEqual(catalog.groups['deterministic.core'], {
    specs: ['tests/verification/*.test.mjs'],
    projects: [],
    resourceClass: 'cpu-light',
    evidence: 'machine-summary',
    capabilities: {
      browser: false,
      hosted: true,
      requiresPublication: false,
      dataCapability: 'qualification_fixture',
      visualReview: false,
      specialistReason: null,
    },
    fullSafetyNet: true,
  });

  assert.deepEqual(catalog.groups['e2e.full'], {
    specs: ['e2e/tests/*.spec.mjs'],
    projects: ['desktop-chromium', 'mobile-chromium'],
    resourceClass: 'browser-full',
    evidence: 'machine-summary',
    capabilities: {
      browser: true,
      hosted: true,
      requiresPublication: true,
      dataCapability: 'qualification_fixture',
      visualReview: false,
      specialistReason: null,
    },
    fullSafetyNet: true,
  });
});
