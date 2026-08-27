import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY_PATH = path.join(ROOT, 'tools/verification/e2e-data-capability-inventory.json');
const CENSUS_PATH = path.join(ROOT, 'tools/verification/full-safety-net-stable-ids.json');
const SPEC_ROOT = path.join(ROOT, 'e2e/tests');
const DATA_CAPABILITIES = Object.freeze(['qualification_fixture', 'bounded_real_world', 'real_fullworld']);

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
  assert.equal(inventory.schemaVersion, 1);
  assert.deepEqual(inventory.allowedDataCapabilities, DATA_CAPABILITIES);
  assert.ok(Array.isArray(inventory.specs));

  const paths = inventory.specs.map((entry) => entry.spec);
  assert.deepEqual(paths, [...paths].sort(), 'data-capability inventory must be path-sorted');
  assert.equal(new Set(paths).size, paths.length, 'data-capability inventory contains duplicate specs');
  assert.deepEqual(paths, currentSpecPaths(), 'inventory must cover every current browser spec exactly once');

  for (const entry of inventory.specs) {
    assert.ok(DATA_CAPABILITIES.includes(entry.dataCapability), `${entry.spec} has unsupported data capability`);
    assert.equal(typeof entry.rationale, 'string', `${entry.spec} rationale must be a string`);
    assert.ok(entry.rationale.trim().length >= 24, `${entry.spec} rationale must explain the oracle data need`);
    assert.equal(typeof entry.splitRequired, 'boolean', `${entry.spec} splitRequired must be explicit`);
  }
});

test('ordinary full-safety census contains exactly qualification-fixture browser specs', () => {
  const inventory = readJson(INVENTORY_PATH);
  const census = readJson(CENSUS_PATH);
  const fixtureSpecs = inventory.specs
    .filter((entry) => entry.dataCapability === 'qualification_fixture')
    .map((entry) => entry.spec)
    .sort();
  assert.deepEqual(censusSpecPaths(census), fixtureSpecs,
    'protected ordinary full-safety census must not absorb bounded_real_world or real_fullworld specs');
});

test('bounded source contracts and complete FullWorld census are isolated during policy staging', () => {
  const inventory = readJson(INVENTORY_PATH);
  const bounded = inventory.specs.filter((entry) => entry.dataCapability === 'bounded_real_world');
  const full = inventory.specs.filter((entry) => entry.dataCapability === 'real_fullworld');

  assert.deepEqual(bounded.map((entry) => entry.spec), [
    'e2e/tests/api-contract-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-mobile.spec.mjs',
  ]);
  assert.match(bounded[0].rationale, /source authority|contract_id/i);
  assert.match(bounded[1].rationale, /mixed spec|Game-owned/i);
  assert.match(bounded[2].rationale, /mixed mobile|Game-owned/i);
  assert.deepEqual(full.map((entry) => entry.spec), ['e2e/tests/fullworld-animation-census-desktop.spec.mjs']);
  assert.match(full[0].rationale, /complete published animation|production-wide coverage/i);
  assert.deepEqual(inventory.specs.filter((entry) => entry.splitRequired).map((entry) => entry.spec), [
    'e2e/tests/creature-gameplay-desktop.spec.mjs',
    'e2e/tests/creature-gameplay-mobile.spec.mjs',
  ], 'policy staging must keep the newly merged mixed gameplay specs explicit until final Phase D splits them');
});
