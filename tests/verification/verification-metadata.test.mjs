import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { deriveVerificationMetadata } from '../../tools/verification/verification-metadata.mjs';
const root = new URL('../../', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(`tools/verification/${name}.json`, root)));
const load = () => read('verification-catalog');

test('one canonical policy projects complete browser, product and verification ownership', () => {
  const catalog = load();
  const { browser, deterministic, contracts } = deriveVerificationMetadata(catalog);
  assert.equal(browser.specs.length, 36);
  assert.equal(deterministic.entries.length, 59);
  assert.deepEqual(deterministic.proposedCatalog.groups['deterministic.core'].specs, catalog.groups['deterministic.core'].specs, 'contract disposition never narrows canonical execution');
  const actual = fs.readdirSync(new URL('tests/verification/', root)).filter(p => p.endsWith('.test.mjs')).map(p => `tests/verification/${p}`).sort();
  assert.deepEqual(contracts.contracts.map(row => row.path).sort(), actual);
  assert.deepEqual(deterministic.importAggregators.map(row => row.spec).sort(), actual);
  for (const row of browser.specs) assert.equal(row.machineGroups.length, 1);
  for (const row of [...deterministic.entries, ...deterministic.importAggregators]) {
    assert.ok(fs.existsSync(new URL(row.spec, root)), row.spec);
    assert.match(row.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(row.group);
  }
});

test('legacy files are explicit pointers and projections contain no second source of execution facts', () => {
  const catalog = load();
  for (const [name, projection] of [['browser-semantic-ownership', 'browser'], ['deterministic-test-ownership', 'deterministic'], ['restoration-contract-ownership', 'contracts']]) {
    assert.deepEqual(read(name), { schemaVersion: 1, canonicalSource: 'tools/verification/verification-catalog.json', projection });
    // The projector accepts canonical data only; a pointer is never a loader.
    for (const canonicalSource of ['../../candidate.json', '/tmp/policy.json', 'https://candidate.invalid/policy']) {
      assert.throws(() => deriveVerificationMetadata({ ...read(name), canonicalSource }), /unsupported canonical/);
    }
  }
  for (const row of catalog.executionPolicy.browser.specs) {
    for (const field of ['machineGroups', 'reviewGroups', 'execution', 'resourceClass', 'minimumDataCapability']) assert.equal(Object.hasOwn(row, field), false, field);
  }
  for (const row of catalog.executionPolicy.deterministic.entries) assert.equal(Object.hasOwn(row, 'group'), false);
  const size = ['verification-catalog', 'browser-semantic-ownership', 'deterministic-test-ownership', 'restoration-contract-ownership'].reduce((n, name) => n + fs.statSync(new URL(`tools/verification/${name}.json`, root)).size, 0);
  assert.ok(size < 240018, `canonical metadata grew beyond the original registries: ${size}`);
});

test('canonical edits propagate to independent views while missing and duplicate owners fail closed', () => {
  const catalog = load();
  const first = deriveVerificationMetadata(catalog).browser.specs[0];
  catalog.groups[first.machineGroups[0]].resourceClass = 'performance';
  catalog.executionPolicy.browser.specs[0].oracle = 'Updated canonical oracle';
  const view = deriveVerificationMetadata(catalog);
  assert.equal(view.browser.specs[0].resourceClass, 'performance');
  assert.equal(view.browser.specs[0].oracle, 'Updated canonical oracle');
  view.browser.specs[0].oracle = 'mutated view';
  assert.equal(catalog.executionPolicy.browser.specs[0].oracle, 'Updated canonical oracle');
  const duplicate = structuredClone(catalog);
  duplicate.groups['e2e.duplicate'] = structuredClone(duplicate.groups[first.machineGroups[0]]);
  assert.throws(() => deriveVerificationMetadata(duplicate), /exactly one/);
  delete catalog.groups[first.machineGroups[0]];
  assert.throws(() => deriveVerificationMetadata(catalog), /exactly one/);
});
