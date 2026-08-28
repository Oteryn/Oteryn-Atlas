import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const inventory = JSON.parse(fs.readFileSync(new URL('../../tools/verification/e2e-data-capability-inventory.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'));

const bySpec = new Map(inventory.specs.map((entry) => [entry.spec, entry]));

test('final Phase D contains no mixed data-capability Playwright spec', () => {
  assert.deepEqual(inventory.specs.filter((entry) => entry.splitRequired).map((entry) => entry.spec), []);
});

test('legacy protected real-fact IDs remain bounded while fixture Gameplay coverage uses new paths', () => {
  const fixtureSpecs = [
    'e2e/tests/creature-gameplay-fixture-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-fixture-mobile.spec.mjs',
  ];
  const protectedRealSpecs = [
    'e2e/tests/creature-gameplay-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-mobile.spec.mjs',
  ];

  for (const spec of fixtureSpecs) {
    assert.equal(bySpec.get(spec)?.dataCapability, 'qualification_fixture');
    assert.ok(catalog.groups['e2e.full'].specs.includes(spec));
  }
  for (const spec of protectedRealSpecs) {
    assert.equal(bySpec.get(spec)?.dataCapability, 'bounded_real_world');
    assert.ok(catalog.groups['integration.source-contract'].specs.includes(spec));
    assert.ok(!catalog.groups['e2e.full'].specs.includes(spec));
  }
});

test('creature gameplay separates fixture UI behavior from bounded real Game facts', () => {
  for (const spec of ['e2e/tests/creature-gameplay-fixture-desktop.spec.mjs', 'e2e/tests/creature-gameplay-fixture-mobile.spec.mjs']) {
    assert.equal(bySpec.get(spec)?.dataCapability, 'qualification_fixture');
  }
  for (const spec of ['e2e/tests/creature-gameplay-desktop.spec.mjs', 'e2e/tests/creature-gameplay-mobile.spec.mjs']) {
    assert.equal(bySpec.get(spec)?.dataCapability, 'bounded_real_world');
  }
  assert.deepEqual(catalog.groups['integration.source-contract'].specs, [
    'e2e/tests/api-contract-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-mobile.spec.mjs',
  ]);
});

test('fixture visual specs have exactly one hosted catalog placement', () => {
  const visualSpecs = [
    'e2e/tests/visual-desktop.spec.mjs',
    'e2e/tests/visual-mobile.spec.mjs',
  ];
  const creatureImpact = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'))
    .entries.find((entry) => entry.pathPrefix === 'src/browser/creature-');

  for (const spec of visualSpecs) {
    assert.equal(bySpec.get(spec)?.dataCapability, 'qualification_fixture');
    assert.deepEqual(
      Object.entries(catalog.groups)
        .filter(([, group]) => group.specs.includes(spec))
        .map(([id]) => id),
      ['e2e.full'],
      `${spec} must have one hosted fixture placement`,
    );
  }
  assert.ok(creatureImpact, 'creature impact policy is missing');
  assert.ok(!creatureImpact.requiredGroups.includes('visual.creatures'));
});
