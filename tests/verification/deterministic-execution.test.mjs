import { deriveVerificationMetadata } from '../../tools/verification/verification-metadata.mjs';
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
  const inventory = deriveVerificationMetadata(JSON.parse(fs.readFileSync(new URL('tools/verification/verification-catalog.json', root)))).deterministic;
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
  const ownership = deriveVerificationMetadata(JSON.parse(fs.readFileSync(new URL('tools/verification/verification-catalog.json', root)))).deterministic;
  const commands = resolveDeterministicCommands({ root, ownership, catalog: ownership.proposedCatalog, groupIds: ['deterministic.search', 'deterministic.farm-products'], requiredSpecs: ['tests/semantic-search.mjs', 'tests/farm-bundle.py'] });
  const deployment = resolveDeterministicCommands({ root, ownership, catalog: ownership.proposedCatalog, groupIds: ['deterministic.deployment'] });
  assert.deepEqual(deployment.map(row=>row.spec),['tests/deployment-policy.mjs','tests/synology-live-workflow.mjs']);
  assert.equal(commands.length, 6);
  assert.equal(commands.filter(row => row.interpreter === 'python3').length, 3);
  assert.equal(commands.filter(row => row.interpreter === 'node').length, 3);
  assert.ok(commands.every(row => !row.spec.startsWith('tests/verification/')));

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

function subprocessFixture(t) {
  const value = fixture(t);
  const row = value.ownership.entries[0];
  const source = "import './leaf.mjs';\nimport { execFileSync } from 'node:child_process';\nexecFileSync('python3', ['tests/b.py'], { cwd: process.cwd() });\n";
  fs.writeFileSync(path.join(value.root, row.spec), source);
  row.sourceSha256 = crypto.createHash('sha256').update(source).digest('hex');
  row.subprocessTests = [{ spec: 'tests/b.py', interpreter: 'python3', argv: ['tests/b.py'], cwd: '.', execution: 'unconditional-test' }];
  return value;
}

test('reviewed parent-only subprocess coverage validates and covers children outside selection', t => {
  const value = subprocessFixture(t);
  value.groupIds = ['deterministic.node'];
  const commands = resolveDeterministicCommands(value);
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0].coveredSpecs, ['tests/a.mjs', 'tests/b.py', 'tests/leaf.mjs']);
  fs.appendFileSync(path.join(value.root, 'tests/b.py'), '# changed child\n');
  assert.throws(() => resolveDeterministicCommands(value), /source proof changed/);
});

test('cross-group subprocess ownership deduplicates parent and standalone child', t => {
  const value = subprocessFixture(t);
  assert.equal(resolveDeterministicCommands(value).length, 1);
  assert.deepEqual(resolveDeterministicCommands(value), resolveDeterministicCommands({ ...value, groupIds: [...value.groupIds].reverse() }));
});

test('subprocess child ownership, file, interpreter and unconditional proof fail closed', t => {
  const value = subprocessFixture(t);
  value.groupIds = ['deterministic.node'];
  for (const patch of [{ interpreter: 'python' }, { interpreter: 'node' }, { argv: ['-c', 'pass'] }, { cwd: '/tmp' }, { execution: 'conditional' }, { spec: 'tests/unknown.py' }, { unexpected: true }]) {
    const ownership = structuredClone(value.ownership);
    Object.assign(ownership.entries[0].subprocessTests[0], patch);
    assert.throws(() => resolveDeterministicCommands({ ...value, ownership }), /subprocess|missing/);
  }
  const ownership = structuredClone(value.ownership);
  ownership.entries = ownership.entries.filter(row => row.spec !== 'tests/b.py');
  assert.throws(() => resolveDeterministicCommands({ ...value, ownership }), /missing explicit/);
  fs.unlinkSync(path.join(value.root, 'tests/b.py'));
  assert.throws(() => resolveDeterministicCommands(value), /missing file/);
});

test('subprocess cycles and duplicate execution edges cannot claim once-only coverage', t => {
  const value = subprocessFixture(t);
  const parent = value.ownership.entries[0];
  parent.subprocessTests.push({ spec: parent.spec, interpreter: 'node', argv: parent.argv, cwd: '.', execution: 'unconditional-test' });
  assert.throws(() => resolveDeterministicCommands(value), /cycle/);
  parent.subprocessTests.pop();
  parent.subprocessTests.push({ ...parent.subprocessTests[0] });
  assert.throws(() => resolveDeterministicCommands(value), /duplicate execution edge/);
});

test('authenticated changed leaf bytes preserve protected parent coverage once', t => {
 const value=subprocessFixture(t);
 fs.appendFileSync(path.join(value.root,'tests/leaf.mjs'),'// candidate leaf bytes\n');
 fs.appendFileSync(path.join(value.root,'tests/b.py'),'# candidate Python bytes\n');
 assert.throws(()=>resolveDeterministicCommands(value),/source proof changed/);
 const changedFiles=[{path:'tests/b.py',status:'modified'},{path:'tests/leaf.mjs',status:'modified'}];
 const commands=resolveDeterministicCommands({...value,changedFiles});
 assert.equal(commands.length,1);
 assert.deepEqual(commands[0].coveredSpecs,['tests/a.mjs','tests/b.py','tests/leaf.mjs']);
 fs.appendFileSync(path.join(value.root,'tests/a.mjs'),'// candidate parent bytes\n');
 const split=resolveDeterministicCommands({...value,changedFiles:[{path:'tests/a.mjs',status:'modified'},...changedFiles]});
 assert.deepEqual(split.map(row=>[row.spec,row.coveredSpecs]),[
  ['tests/a.mjs',['tests/a.mjs']],
  ['tests/b.py',['tests/b.py']],
  ['tests/leaf.mjs',['tests/leaf.mjs']],
 ]);
});
test('candidate changes cannot attest new test edges or replace protected command shape', t => {
 const value=fixture(t);
 fs.writeFileSync(path.join(value.root,'tests/leaf.mjs'),"import './b.py';\n");
 // The bytes can be tested, but cannot claim another test's coverage or command.
 const changedFiles=[{path:'tests/leaf.mjs',status:'modified'}];
 const commands=resolveDeterministicCommands({...value,groupIds:['deterministic.node'],changedFiles});
 assert.deepEqual(commands[0].coveredSpecs,['tests/a.mjs','tests/leaf.mjs']);
 assert.deepEqual(commands[0].argv,['--test','tests/a.mjs']);
 const malformed=structuredClone(value.ownership);delete malformed.entries[1].sourceSha256;
 assert.throws(()=>resolveDeterministicCommands({...value,ownership:malformed,changedFiles}),/missing source proof/);
});

test('added deterministic test executes as an unowned self-only subject under protected core command policy', t => {
 const value=fixture(t);
 fs.writeFileSync(path.join(value.root,'tests/new-subject.mjs'),"import test from 'node:test'; test('candidate add',()=>{});\n");
 value.catalog.groups['deterministic.core']={...value.catalog.groups['deterministic.node'],specs:['tests/a.mjs','tests/leaf.mjs']};
 const commands=resolveDeterministicCommands({...value,groupIds:['deterministic.core'],changedFiles:[{path:'tests/new-subject.mjs',status:'added'}]});
 const subject=commands.find(row=>row.spec==='tests/new-subject.mjs');
 assert.ok(subject);
 assert.deepEqual(subject.argv,['--test','tests/new-subject.mjs']);
 assert.deepEqual(subject.groupIds,['deterministic.core']);
 assert.deepEqual(subject.coveredSpecs,['tests/new-subject.mjs']);
});

test('renamed protected deterministic identity executes the new path without stale parent coverage credit', t => {
 const value=fixture(t);
 fs.renameSync(path.join(value.root,'tests/leaf.mjs'),path.join(value.root,'tests/renamed-leaf.mjs'));
 const commands=resolveDeterministicCommands({...value,groupIds:['deterministic.node'],changedFiles:[{path:'tests/renamed-leaf.mjs',previousPath:'tests/leaf.mjs',status:'renamed'}]});
 const parent=commands.find(row=>row.spec==='tests/a.mjs');
 const renamed=commands.find(row=>row.spec==='tests/leaf.mjs');
 assert.deepEqual(parent.coveredSpecs,['tests/a.mjs']);
 assert.deepEqual(renamed.argv,['--test','tests/renamed-leaf.mjs']);
 assert.equal(renamed.executionPath,'tests/renamed-leaf.mjs');
 assert.deepEqual(renamed.coveredSpecs,['tests/leaf.mjs']);
 assert.throws(()=>resolveDeterministicCommands({...value,groupIds:['deterministic.node'],changedFiles:[{path:'tests/renamed-leaf.py',previousPath:'tests/leaf.mjs',status:'renamed'}]}),/unsafe deterministic test rename/);
});
