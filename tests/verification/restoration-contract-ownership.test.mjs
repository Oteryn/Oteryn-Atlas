import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = JSON.parse(fs.readFileSync(new URL('../../tools/verification/restoration-contract-ownership.json', import.meta.url), 'utf8'));
const actual = fs.readdirSync(path.join(root, 'tests/verification'))
  .filter(name => name.endsWith('.test.mjs')).map(name => `tests/verification/${name}`).sort();

// This validates ownership accounting, never qualification of the inventoried tests.
function validateOwnership(value, currentPaths) {
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.qualification, 'blocked-until-rewrites-and-executable-qualification');
  const rows = value.contracts;
  assert.equal(new Set(rows.map(row => row.path)).size, rows.length, 'duplicate contract ownership');
  assert.deepEqual(rows.map(row => row.path).sort(), [...currentPaths].sort(), 'missing or unowned current contract');
  for (const row of rows) {
    assert.ok(['active-semantic', 'rewrite-required', 'historical-topology-retained-invariant'].includes(row.status), row.path);
    assert.equal(row.owner, 'deterministic.core');
    assert.ok(row.retainedInvariant.length > 0, `missing retained invariant: ${row.path}`);
    if (row.status !== 'active-semantic') {
      assert.ok(row.requiredRewrite.length > 0, `missing rewrite obligation: ${row.path}`);
      assert.equal(row.qualification, 'blocked');
    }
  }
  assert.deepEqual(value.proposedCoreSpecs, rows.filter(row => row.status === 'active-semantic').map(row => row.path).sort());
  assert.deepEqual(value.unresolvedContracts, rows.filter(row => row.status !== 'active-semantic').map(row => row.path).sort());
  assert.equal(value.retiredByProtectedInventory.length, 2);
  for (const retired of value.retiredByProtectedInventory) assert.ok(!currentPaths.includes(retired), `retired file reappeared: ${retired}`);
}

test('R1 accounts for every current verification contract with an explicit retained invariant', () => {
  validateOwnership(inventory, actual);
  for (const row of inventory.contracts) assert.ok(fs.statSync(path.join(root, row.path)).isFile(), row.path);
});

test('R1 fails closed for new unowned contracts and missing inventoried files', () => {
  assert.throws(() => validateOwnership(inventory, [...actual, 'tests/verification/unowned.test.mjs']), /missing or unowned/);
  assert.throws(() => validateOwnership(inventory, actual.slice(1)), /missing or unowned/);
});

test('R1 rejects duplicate ownership and cannot hide a rewrite inside the active proposal', () => {
  const duplicate = structuredClone(inventory);
  duplicate.contracts.push(duplicate.contracts[0]);
  assert.throws(() => validateOwnership(duplicate, actual), /duplicate contract/);
  const promoted = structuredClone(inventory);
  promoted.proposedCoreSpecs.push(promoted.unresolvedContracts[0]);
  assert.throws(() => validateOwnership(promoted, actual));
  const erased = structuredClone(inventory);
  erased.contracts.find(row => row.status !== 'active-semantic').requiredRewrite = '';
  assert.throws(() => validateOwnership(erased, actual), /missing rewrite obligation/);
});

test('R1 keeps protected historical deletion facts separate from unresolved retained contracts', () => {
  const protectedInventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json'), 'utf8'));
  const protectedText = JSON.stringify(protectedInventory);
  for (const retired of inventory.retiredByProtectedInventory) {
    assert.ok(protectedText.includes(retired), retired);
    assert.equal(fs.existsSync(path.join(root, retired)), false, retired);
  }
  assert.equal(inventory.contracts.filter(row => row.status === 'rewrite-required').length, 28);
  assert.equal(inventory.contracts.filter(row => row.status === 'historical-topology-retained-invariant').length, 9);
});

test('R1 qualification readiness fails closed while any retained contract needs a rewrite', () => {
  function assertQualificationReady(value) {
    assert.equal(value.contracts.some(row => row.status !== 'active-semantic'), false, 'unresolved retained contracts block qualification');
    assert.equal(value.contracts.some(row => row.qualification !== 'qualified'), false, 'executable qualification is missing');
  }
  assert.throws(() => assertQualificationReady(inventory), /unresolved retained contracts/);
  const falselyPromoted = structuredClone(inventory);
  for (const row of falselyPromoted.contracts) row.status = 'active-semantic';
  assert.throws(() => assertQualificationReady(falselyPromoted), /executable qualification is missing/);
});
