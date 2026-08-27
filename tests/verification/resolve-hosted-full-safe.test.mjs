import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const helperPath = fileURLToPath(new URL('../../tools/verification/resolve-hosted-full-safe.mjs', import.meta.url));
const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(new URL('../../tools/verification/e2e-data-capability-inventory.json', import.meta.url), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

async function loadHelper() {
  assert.equal(fs.existsSync(helperPath), true, 'hosted full-safety resolver is missing');
  return import(pathToFileURL(helperPath).href);
}

test('hosted full-safety resolver derives the exact e2e.full fixture-backed Playwright selection', async () => {
  const { resolveHostedFullSafe } = await loadHelper();
  const resolved = resolveHostedFullSafe({ catalog, inventory });
  const expectedSpecs = [...catalog.groups['e2e.full'].specs].sort();
  assert.equal(resolved.groupId, 'e2e.full');
  assert.equal(resolved.dataCapability, 'qualification_fixture');
  assert.deepEqual(resolved.specs, expectedSpecs);
  assert.deepEqual(resolved.playwrightSpecs, expectedSpecs.map((spec) => spec.slice('e2e/'.length)));
  assert.deepEqual(resolved.projects, [...catalog.groups['e2e.full'].projects].sort());
});

test('hosted full-safety resolver rejects capability narrowing or specialist contamination', async () => {
  const { resolveHostedFullSafe } = await loadHelper();
  for (const mutate of [
    (group) => { group.capabilities.browser = false; },
    (group) => { group.capabilities.hosted = false; },
    (group) => { group.capabilities.requiresPublication = false; },
    (group) => { group.capabilities.dataCapability = 'bounded_real_world'; },
    (group) => { group.capabilities.visualReview = true; },
    (group) => { group.capabilities.specialistReason = 'private-visual'; },
    (group) => { group.fullSafetyNet = false; },
  ]) {
    const candidate = clone(catalog);
    mutate(candidate.groups['e2e.full']);
    assert.throws(() => resolveHostedFullSafe({ catalog: candidate, inventory }), /e2e\.full|hosted|qualification|full safety/i);
  }
});

test('hosted full-safety resolver rejects malformed, duplicate, missing or non-fixture specs', async () => {
  const { resolveHostedFullSafe } = await loadHelper();

  const duplicateCatalog = clone(catalog);
  duplicateCatalog.groups['e2e.full'].specs.push(duplicateCatalog.groups['e2e.full'].specs[0]);
  assert.throws(() => resolveHostedFullSafe({ catalog: duplicateCatalog, inventory }), /duplicate/i);

  const traversalCatalog = clone(catalog);
  traversalCatalog.groups['e2e.full'].specs[0] = 'e2e/tests/../outside.spec.mjs';
  assert.throws(() => resolveHostedFullSafe({ catalog: traversalCatalog, inventory }), /spec|path/i);

  const missingInventory = clone(inventory);
  missingInventory.specs = missingInventory.specs.filter((entry) => entry.spec !== catalog.groups['e2e.full'].specs[0]);
  assert.throws(() => resolveHostedFullSafe({ catalog, inventory: missingInventory }), /inventory|missing/i);

  const wrongCapability = clone(inventory);
  wrongCapability.specs.find((entry) => entry.spec === catalog.groups['e2e.full'].specs[0]).dataCapability = 'bounded_real_world';
  assert.throws(() => resolveHostedFullSafe({ catalog, inventory: wrongCapability }), /qualification_fixture|capability/i);

  const splitRequired = clone(inventory);
  splitRequired.specs.find((entry) => entry.spec === catalog.groups['e2e.full'].specs[0]).splitRequired = true;
  assert.throws(() => resolveHostedFullSafe({ catalog, inventory: splitRequired }), /split/i);
});
