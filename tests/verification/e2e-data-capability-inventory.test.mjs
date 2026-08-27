import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY_PATH = path.join(ROOT, 'tools/verification/e2e-data-capability-inventory.json');
const CENSUS_PATH = path.join(ROOT, 'tools/verification/full-safety-net-stable-ids.json');
const SPEC_ROOT = path.join(ROOT, 'e2e/tests');
const DATA_CAPABILITIES = Object.freeze([
  'qualification_fixture',
  'bounded_real_world',
  'real_fullworld',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function currentSpecPaths() {
  return fs.readdirSync(SPEC_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.mjs'))
    .map((entry) => `e2e/tests/${entry.name}`)
    .sort();
}

function censusSpecPaths(census) {
  return [...new Set(census.stableTestIds.map((id) => {
    const parts = id.split('::');
    assert.equal(parts.length, 3, `stable ID must contain project, spec and scenario: ${id}`);
    return parts[1];
  }))].sort();
}

test('every current Playwright spec has one reviewed minimum data capability', () => {
  const inventory = readJson(INVENTORY_PATH);
  const census = readJson(CENSUS_PATH);
  assert.equal(inventory.schemaVersion, 1);
  assert.deepEqual(inventory.allowedDataCapabilities, DATA_CAPABILITIES);
  assert.ok(Array.isArray(inventory.specs));

  const paths = inventory.specs.map((entry) => entry.spec);
  assert.deepEqual(paths, [...paths].sort(), 'data-capability inventory must be path-sorted');
  assert.equal(new Set(paths).size, paths.length, 'data-capability inventory contains duplicate specs');
  assert.deepEqual(paths, currentSpecPaths(), 'inventory must cover every current browser spec exactly once');
  assert.deepEqual(paths, censusSpecPaths(census), 'inventory must cover the exact stable-ID census spec set');

  for (const entry of inventory.specs) {
    assert.ok(DATA_CAPABILITIES.includes(entry.dataCapability), `${entry.spec} has unsupported data capability`);
    assert.equal(typeof entry.rationale, 'string', `${entry.spec} rationale must be a string`);
    assert.ok(entry.rationale.trim().length >= 24, `${entry.spec} rationale must explain the minimum data need`);
    assert.equal(typeof entry.splitRequired, 'boolean', `${entry.spec} splitRequired must be explicit`);
    if (entry.splitRequired) {
      assert.equal(entry.dataCapability, 'real_fullworld', `${entry.spec} split marker is only valid for a mixed complete-product oracle`);
    }
  }
});

test('the complete visual coverage census is isolated without widening ordinary visual E2E', () => {
  const inventory = readJson(INVENTORY_PATH);
  const visual = inventory.specs.find((entry) => entry.spec === 'e2e/tests/visual-desktop.spec.mjs');
  const fullworld = inventory.specs.find((entry) => entry.spec === 'e2e/tests/visual-fullworld-desktop.spec.mjs');

  assert.ok(visual, 'ordinary visual desktop spec must be inventoried');
  assert.equal(visual.dataCapability, 'bounded_real_world');
  assert.equal(visual.splitRequired, false);

  assert.ok(fullworld, 'isolated complete-product visual spec must be inventoried');
  assert.equal(fullworld.dataCapability, 'real_fullworld');
  assert.equal(fullworld.splitRequired, false);
  assert.match(fullworld.rationale, /coverage census/i);

  const remaining = inventory.specs.filter((entry) => entry.spec !== fullworld.spec);
  assert.equal(remaining.some((entry) => entry.dataCapability === 'real_fullworld'), false,
    'no other current browser spec has a reviewed whole-product FullWorld oracle');
  assert.equal(inventory.specs.some((entry) => entry.splitRequired), false,
    'no mixed data-capability spec may remain after the visual split');
});
