import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProtectedWorkflowTransition, validateProtectedWorkflowTransition } from '../../tools/verification/protected-workflow-contract.mjs';

const path = '.github/workflows/example.yml';
const source = 'name: Independent proof\non: [pull_request, merge_group]\npermissions:\n  contents: read\njobs:\n  proof:\n    runs-on: ubuntu-latest\n    timeout-minutes: 30\n    steps:\n      - run: node protected-proof.mjs\n  gate:\n    needs: proof\n    timeout-minutes: 60\n    steps:\n      - run: node protected-consume.mjs\n';
const protectedSources = { [path]: source, '.github/workflows/other.yaml': 'name: Other\non: push\njobs:\n  check:\n    steps: []\n' };
const configuration = { schemaVersion: 1, timeouts: { [path]: 90 } };
const render = (config = configuration, sources = protectedSources) => renderProtectedWorkflowTransition({ protectedSources: sources, configuration: config });
const validate = (candidateSources, config = configuration, sources = protectedSources) => validateProtectedWorkflowTransition({ protectedSources: sources, candidateSources, configuration: config });

test('valid exact candidate changes only protected-owned numeric timeout slots', () => {
  const candidate = render();
  assert.equal(candidate[path], source.replace('timeout-minutes: 30', 'timeout-minutes: 90').replace('timeout-minutes: 60', 'timeout-minutes: 90'));
  assert.equal(validate(candidate).accepted, true);
});
test('empty configuration preserves the complete inventory byte for byte', () => {
  assert.deepEqual(render({ schemaVersion: 1, timeouts: {} }), protectedSources);
});
for (const [name, change] of Object.entries({
  command: s => s.replace('node protected-proof.mjs', 'echo GREEN'),
  event: s => s.replace('merge_group', 'workflow_dispatch'),
  permission: s => s.replace('contents: read', 'contents: write'),
  job: s => s.replace('  proof:', '  alternative:'),
  needs: s => s.replace('needs: proof', 'needs: []'),
  producer: s => s.replace('Independent proof', 'Candidate proof'),
  branch: s => s + '\n# branch-specific admission\n',
  PR: s => s.replace('node protected-proof.mjs', 'test "$PR" = 123 || node protected-proof.mjs'),
  newline: s => s.replaceAll('\n', '\r\n'),
})) test(`rejects candidate ${name} mutation outside exact rendered bytes`, () => {
  const candidate = render(); candidate[path] = change(candidate[path]);
  assert.throws(() => validate(candidate));
});
for (const value of [59, 0, -1, 361, 90.5, '90', null, NaN, Infinity]) test(`rejects invalid/lowered timeout ${value}`, () => {
  assert.throws(() => render({ schemaVersion: 1, timeouts: { [path]: value } }));
});
test('rejects added or removed workflows even if their contents are inert', () => {
  const added = render(); added['.github/workflows/new.yml'] = source;
  assert.throws(() => validate(added));
  const removed = render(); delete removed['.github/workflows/other.yaml'];
  assert.throws(() => validate(removed));
});
test('rejects unknown configuration keys, candidate authority and scope expansion', () => {
  for (const config of [{ ...configuration, allowedPaths: [path] }, { ...configuration, branch: 'main' }, { ...configuration, pr: 123 }, { ...configuration, schemaVersion: 2 }, { schemaVersion: 1, timeouts: { '.github/workflows/new.yml': 90 } }]) assert.throws(() => render(config));
});
test('rejects workflows with no existing timeout and expression-valued timeout slots', () => {
  assert.throws(() => render({ schemaVersion: 1, timeouts: { '.github/workflows/other.yaml': 90 } }));
  assert.throws(() => render(configuration, { [path]: source.replace('timeout-minutes: 30', 'timeout-minutes: ${{ inputs.timeout }}') }));
});
test('repeated admission cannot undo an earlier protected timeout increase', () => {
  const nextBase = render();
  assert.throws(() => render({ schemaVersion: 1, timeouts: { [path]: 89 } }, nextBase));
  assert.equal(validate(render(configuration, nextBase), configuration, nextBase).accepted, true);
});
test('preserves step-level timeout slots and timeout-like command strings', () => {
  const withStep = source.replace('      - run: node protected-proof.mjs', '      - run: node protected-proof.mjs\n        timeout-minutes: 2\n      - run: |\n          timeout-minutes: 1');
  const candidate = render(configuration, { [path]: withStep });
  assert.match(candidate[path], /        timeout-minutes: 2/);
  assert.match(candidate[path], /          timeout-minutes: 1/);
});
test('rejects malformed inventories and non-plain objects', () => {
  for (const sources of [null, [], { '../outside.yml': source }, { [path]: 1 }, new Map()]) assert.throws(() => render(configuration, sources));
  assert.throws(() => render(Object.assign(Object.create({ extra: true }), configuration)));
});

test('repository workflow inventory remains byte-identical with empty configuration', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const directory = new URL('../../.github/workflows/', import.meta.url);
  const sources = Object.fromEntries(readdirSync(directory).filter(name => /\.ya?ml$/.test(name)).map(name => [`.github/workflows/${name}`, readFileSync(new URL(name, directory), 'utf8')]));
  assert.equal(validate(sources, { schemaVersion: 1, timeouts: {} }, sources).accepted, true);
});

test('retains comments and rejects duplicate or ambiguous protected timeout slots', () => {
  const commented = source.replace('timeout-minutes: 30', 'timeout-minutes: 30 # protected minimum');
  assert.match(render(configuration, { [path]: commented })[path], /timeout-minutes: 90 # protected minimum/);
  for (const malformed of [source.replace('timeout-minutes: 30', 'timeout-minutes: 30\n    timeout-minutes: 40'), source + '\njobs:\n', source.replace('  proof:', '  "proof":')]) assert.throws(() => render(configuration, { [path]: malformed }));
});

test('configuration and inventory accessors are never evaluated', () => {
  let evaluated = false;
  const hostile = {};
  Object.defineProperty(hostile, path, { enumerable: true, get() { evaluated = true; return source; } });
  assert.throws(() => render(configuration, hostile));
  assert.equal(evaluated, false);
});
