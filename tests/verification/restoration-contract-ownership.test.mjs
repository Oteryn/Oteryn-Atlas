import { deriveVerificationMetadata } from '../../tools/verification/verification-metadata.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const inventory = deriveVerificationMetadata(JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'))).contracts;
const actual = fs.readdirSync(path.join(root, 'tests/verification'))
  .filter(name => name.endsWith('.test.mjs')).map(name => `tests/verification/${name}`).sort();

// This validates ownership accounting, never qualification of the inventoried tests.
function validateOwnership(value, currentPaths) {
  assert.equal(value.schemaVersion, 1);
  assert.equal(typeof value.qualification, 'string');
  assert.ok(value.qualification.length > 0);
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
  const pending = structuredClone(inventory);
  const row = pending.contracts[0];
  row.status = 'rewrite-required'; row.qualification = 'blocked'; row.requiredRewrite = 'Restore exact semantic proof';
  pending.proposedCoreSpecs = pending.contracts.filter(row => row.status === 'active-semantic').map(row => row.path).sort();
  pending.unresolvedContracts = pending.contracts.filter(row => row.status !== 'active-semantic').map(row => row.path).sort();
  validateOwnership(pending, actual);
  const promoted = structuredClone(pending);
  promoted.proposedCoreSpecs.push(row.path);
  assert.throws(() => validateOwnership(promoted, actual));
  const erased = structuredClone(pending);
  erased.contracts.find(row => row.status !== 'active-semantic').requiredRewrite = '';
  assert.throws(() => validateOwnership(erased, actual), /missing rewrite obligation/);
});

test('retired verification contracts remain cataloged as historical facts and absent from the current tree', () => {
  for (const retired of inventory.retiredByProtectedInventory) {
    assert.equal(fs.existsSync(path.join(root, retired)), false, retired);
    assert.ok(!inventory.contracts.some(row => row.path === retired), retired);
  }
});

test('R1 qualification readiness fails closed while any retained contract needs a rewrite', () => {
  function assertQualificationReady(value) {
    assert.equal(value.contracts.some(row => row.status !== 'active-semantic'), false, 'unresolved retained contracts block qualification');
    assert.equal(value.contracts.some(row => row.qualification !== 'qualified'), false, 'executable qualification is missing');
  }
  const pending = structuredClone(inventory);
  pending.contracts[0].status = 'rewrite-required';
  assert.throws(() => assertQualificationReady(pending), /unresolved retained contracts/);
  const falselyPromoted = structuredClone(inventory);
  for (const row of falselyPromoted.contracts) row.status = 'active-semantic';
  falselyPromoted.contracts[0].qualification = 'unqualified';
  assert.throws(() => assertQualificationReady(falselyPromoted), /executable qualification is missing/);
});
