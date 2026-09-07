import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import test from 'node:test';
import { resolveDeterministicCommands } from '../../tools/verification/deterministic-execution.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-deterministic-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sources = { 'tests/a.mjs': "import './leaf.mjs';\n", 'tests/leaf.mjs': "import test from 'node:test';\n", 'tests/b.py': 'assert True\n' };
  const entries = Object.entries(sources).map(([spec, source]) => {
    fs.mkdirSync(path.dirname(path.join(root, spec)), { recursive: true });
    fs.writeFileSync(path.join(root, spec), source);
    return { spec, group: spec.endsWith('.py') ? 'deterministic.python' : 'deterministic.node', interpreter: spec.endsWith('.py') ? 'python3' : 'node', argv: spec.endsWith('.py') ? [spec] : ['--test', spec], sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), imports: spec === 'tests/a.mjs' ? ['tests/leaf.mjs'] : [], subprocessTests: [] };
  });
  const ownership = { schemaVersion: 1, entries, importAggregators: [] };
  const catalog = { groups: { 'deterministic.node': { specs: ['tests/a.mjs', 'tests/leaf.mjs'], capabilities: { browser: false } }, 'deterministic.python': { specs: ['tests/b.py'], capabilities: { browser: false } } } };
  return { root, catalog, ownership, groupIds: Object.keys(catalog.groups) };
}

test('exact selected Node/Python commands retain imported leaf coverage once', t => {
  const value = fixture(t);
  const commands = resolveDeterministicCommands(value);
  assert.deepEqual(commands.map(row => [row.interpreter, row.argv]), [['node', ['--test', 'tests/a.mjs']], ['python3', ['tests/b.py']]]);
  assert.deepEqual(commands[0].coveredSpecs, ['tests/a.mjs', 'tests/leaf.mjs']);
  assert.deepEqual(resolveDeterministicCommands({ ...value, groupIds: ['deterministic.node'], requiredSpecs: ['tests/leaf.mjs'] }), commands.slice(0, 1));
  assert.throws(() => resolveDeterministicCommands({ ...value, groupIds: ['deterministic.node'], requiredSpecs: ['tests/b.py'] }), /required test is not selected/);
});

test('missing files, missing or empty groups, browser groups and unsupported interpreters fail closed', t => {
  const value = fixture(t);
  assert.throws(() => resolveDeterministicCommands({ ...value, groupIds: ['missing'] }), /unknown group/);
  assert.throws(() => resolveDeterministicCommands({ ...value, groupIds: [] }), /empty selection/);
  const empty = structuredClone(value.catalog); empty.groups['deterministic.node'].specs = [];
  assert.throws(() => resolveDeterministicCommands({ ...value, catalog: empty }), /empty group/);
  const browser = structuredClone(value.catalog); browser.groups['deterministic.node'].capabilities.browser = true;
  assert.throws(() => resolveDeterministicCommands({ ...value, catalog: browser }), /nonbrowser/);
  const invalid = structuredClone(value.ownership); invalid.entries[0].interpreter = 'bash';
  assert.throws(() => resolveDeterministicCommands({ ...value, ownership: invalid }), /interpreter/);
  fs.unlinkSync(path.join(value.root, 'tests/leaf.mjs'));
  assert.throws(() => resolveDeterministicCommands(value), /missing file/);
});

test('path escapes, wildcard commands and symlink escapes are rejected', t => {
  const value = fixture(t);
  for (const spec of ['../outside.mjs', '/tmp/outside.mjs', 'tests/*.mjs', 'tests/../outside.mjs']) {
    const catalog = structuredClone(value.catalog); catalog.groups['deterministic.node'].specs = [spec];
    assert.throws(() => resolveDeterministicCommands({ ...value, catalog }), /exact safe test path/);
  }
  fs.unlinkSync(path.join(value.root, 'tests/leaf.mjs'));
  fs.symlinkSync('/etc/passwd', path.join(value.root, 'tests/leaf.mjs'));
  assert.throws(() => resolveDeterministicCommands(value), /symlink/);
});

test('duplicate selections deduplicate while stale import proof, cycles and opaque overlaps block', t => {
  const value = fixture(t);
  assert.deepEqual(resolveDeterministicCommands({ ...value, groupIds: [...value.groupIds, ...value.groupIds] }), resolveDeterministicCommands(value));
  const cyclic = structuredClone(value.ownership); cyclic.entries[1].imports = ['tests/a.mjs'];
  assert.throws(() => resolveDeterministicCommands({ ...value, ownership: cyclic }), /cycle/);
  const opaque = structuredClone(value.ownership); opaque.entries[0].subprocessTests = ['tests/b.py'];
  assert.throws(() => resolveDeterministicCommands({ ...value, ownership: opaque }), /unproven subprocess/);
  fs.appendFileSync(path.join(value.root, 'tests/a.mjs'), '// changed\n');
  assert.throws(() => resolveDeterministicCommands(value), /source proof changed/);
});

test('repository ownership preserves all 53 nonverification entrypoints and separates browser harnesses', () => {
  const root = new URL('../../', import.meta.url);
  const inventory = JSON.parse(fs.readFileSync(new URL('tools/verification/deterministic-test-ownership.json', root)));
  const baseline = JSON.parse(fs.readFileSync(new URL('docs/maintenance/verification-restoration/contract-ownership.json', root)));
  assert.deepEqual(inventory.entries.map(row => row.spec).sort(), baseline.deterministicEntrypoints.filter(row => !row.path.startsWith('tests/verification/')).map(row => row.path).sort());
  assert.equal(inventory.entries.length, 53);
  for (const row of inventory.entries) {
    assert.ok(inventory.proposedCatalog.groups[row.group].specs.includes(row.spec), row.spec);
    assert.ok(!row.spec.endsWith('.html'));
  }
  assert.ok(inventory.excludedBrowserHarnesses.includes('tests/browser-proof.html'));
});

test('repository commands preserve source tests without executing the historical core', () => {
  const root = new URL('../../', import.meta.url);
  const ownership = JSON.parse(fs.readFileSync(new URL('tools/verification/deterministic-test-ownership.json', root)));
  const commands = resolveDeterministicCommands({ root, ownership, catalog: ownership.proposedCatalog, groupIds: ['deterministic.search', 'deterministic.farm-products'], requiredSpecs: ['tests/semantic-search.mjs', 'tests/farm-bundle.py'] });
  assert.throws(() => resolveDeterministicCommands({ root, ownership, catalog: ownership.proposedCatalog, groupIds: ['deterministic.deployment'] }), /known qualification blocker/);
  assert.equal(commands.length, 6);
  assert.equal(commands.filter(row => row.interpreter === 'python3').length, 3);
  assert.equal(commands.filter(row => row.interpreter === 'node').length, 3);
  assert.ok(commands.every(row => !row.spec.startsWith('tests/verification/')));
  assert.throws(() => resolveDeterministicCommands({ root, ownership, catalog: ownership.proposedCatalog, groupIds: ['deterministic.fullworld-runtime'] }), /unproven subprocess/);
});

test('independent aggregators sharing an imported leaf cannot silently duplicate its proof', t => {
  const value = fixture(t);
  const source = "import './leaf.mjs';\n// second parent\n";
  fs.writeFileSync(path.join(value.root, 'tests/other.mjs'), source);
  value.ownership.entries.push({ ...value.ownership.entries[0], spec: 'tests/other.mjs', argv: ['--test', 'tests/other.mjs'], sourceSha256: crypto.createHash('sha256').update(source).digest('hex') });
  value.catalog.groups['deterministic.node'].specs.push('tests/other.mjs');
  assert.throws(() => resolveDeterministicCommands(value), /overlapping import roots/);
});

test('parent-only subprocess edges cannot execute unbound child tests', t => {
  const value = fixture(t);
  value.ownership.entries[0].subprocessTests = ['tests/b.py'];
  // A child absent from the selected groups still executes under its parent.
  value.groupIds = ['deterministic.node'];
  assert.throws(() => resolveDeterministicCommands(value), /unproven subprocess/);
  fs.writeFileSync(path.join(value.root, 'tests/b.py'), 'raise RuntimeError("changed")\n');
  assert.throws(() => resolveDeterministicCommands(value), /unproven subprocess/);
});
