import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrowserSemanticContentIdentity } from '../../tools/verification/browser-semantic-content.mjs';

const oid = (character) => character.repeat(40);
const entry = (path, character, overrides = {}) => ({
  path,
  mode: '100644',
  type: 'blob',
  objectId: oid(character),
  ...overrides,
});

function identity({ protectedEntries = [], candidateEntries = [] } = {}) {
  return buildBrowserSemanticContentIdentity({ protectedEntries, candidateEntries });
}

test('browser semantic content identity is canonical and independent from entry ordering', () => {
  const protectedEntries = [
    entry('e2e/tests/desktop.spec.mjs', '1'),
    entry('src/browser/app.mjs', '2'),
  ];
  const candidateEntries = [
    entry('web/fullworld.mjs', '3'),
    entry('e2e/support/diagnostics.mjs', '4'),
  ];
  const left = identity({ protectedEntries, candidateEntries });
  const right = identity({
    protectedEntries: [...protectedEntries].reverse(),
    candidateEntries: [...candidateEntries].reverse(),
  });
  assert.equal(left.browserSemanticContentDigest, right.browserSemanticContentDigest);
  assert.deepEqual(left, right);
  assert.match(left.browserSemanticContentDigest, /^sha256:[a-f0-9]{64}$/);
});

test('control-plane-only, verification-contract and documentation movement does not change browser content identity', () => {
  const semantic = [entry('src/browser/app.mjs', '1'), entry('e2e/tests/desktop.spec.mjs', '2')];
  const baseline = identity({ protectedEntries: semantic, candidateEntries: semantic });
  const controlPlaneChanged = identity({
    protectedEntries: [
      ...semantic,
      entry('.github/workflows/ci.yml', '3'),
      entry('tools/verification/evidence-reuse.mjs', '4'),
      entry('tests/verification/evidence-reuse.test.mjs', '5'),
      entry('docs/testing/ATLAS-VERIFICATION-PLATFORM.md', '6'),
      entry('AGENTS.md', '7'),
      entry('README.md', '8'),
    ],
    candidateEntries: [
      ...semantic,
      entry('.github/workflows/ci.yml', '9'),
      entry('tools/verification/evidence-reuse.mjs', 'a'),
      entry('tests/verification/evidence-reuse.test.mjs', 'b'),
      entry('docs/testing/ATLAS-VERIFICATION-PLATFORM.md', 'c'),
      entry('AGENTS.md', 'd'),
      entry('README.md', 'e'),
    ],
  });
  assert.equal(baseline.browserSemanticContentDigest, controlPlaneChanged.browserSemanticContentDigest);
});

test('runtime, browser UI, test body and harness content changes invalidate browser content identity', () => {
  const cases = [
    'src/browser/app.mjs',
    'web/fullworld.mjs',
    'e2e/tests/desktop.spec.mjs',
    'e2e/support/diagnostics.mjs',
    'e2e/playwright.config.mjs',
    'e2e/package-lock.json',
  ];
  for (const path of cases) {
    const baseline = identity({ candidateEntries: [entry(path, '1')] });
    const changed = identity({ candidateEntries: [entry(path, '2')] });
    assert.notEqual(baseline.browserSemanticContentDigest, changed.browserSemanticContentDigest, path);
  }
});

test('protected and candidate semantic content are independently bound', () => {
  const baseline = identity({
    protectedEntries: [entry('e2e/tests/desktop.spec.mjs', '1')],
    candidateEntries: [entry('src/browser/app.mjs', '2')],
  });
  const protectedChanged = identity({
    protectedEntries: [entry('e2e/tests/desktop.spec.mjs', '3')],
    candidateEntries: [entry('src/browser/app.mjs', '2')],
  });
  const candidateChanged = identity({
    protectedEntries: [entry('e2e/tests/desktop.spec.mjs', '1')],
    candidateEntries: [entry('src/browser/app.mjs', '4')],
  });
  assert.notEqual(baseline.browserSemanticContentDigest, protectedChanged.browserSemanticContentDigest);
  assert.notEqual(baseline.browserSemanticContentDigest, candidateChanged.browserSemanticContentDigest);
});

test('unknown repository paths fail closed by participating in browser semantic identity', () => {
  const baseline = identity({ candidateEntries: [entry('mystery/runtime.bin', '1')] });
  const changed = identity({ candidateEntries: [entry('mystery/runtime.bin', '2')] });
  assert.notEqual(baseline.browserSemanticContentDigest, changed.browserSemanticContentDigest);
  assert.deepEqual(baseline.unknownPaths, ['mystery/runtime.bin']);
});

test('rename, deletion, mode and type drift change browser semantic content identity', () => {
  const baseline = identity({ candidateEntries: [entry('src/browser/a.mjs', '1')] });
  const renamed = identity({ candidateEntries: [entry('src/browser/b.mjs', '1')] });
  const deleted = identity({ candidateEntries: [] });
  const executable = identity({ candidateEntries: [entry('src/browser/a.mjs', '1', { mode: '100755' })] });
  const symlink = identity({ candidateEntries: [entry('src/browser/a.mjs', '1', { mode: '120000', type: 'blob' })] });
  for (const candidate of [renamed, deleted, executable, symlink]) {
    assert.notEqual(baseline.browserSemanticContentDigest, candidate.browserSemanticContentDigest);
  }
});

test('malformed or duplicate tree evidence fails closed', () => {
  assert.throws(() => identity({ candidateEntries: [entry('../escape', '1')] }), /path|safe/i);
  assert.throws(() => identity({ candidateEntries: [entry('src/browser/a.mjs', '1'), entry('src/browser/a.mjs', '2')] }), /duplicate/i);
  assert.throws(() => identity({ candidateEntries: [{ ...entry('src/browser/a.mjs', '1'), objectId: 'bad' }] }), /object|identity|sha/i);
  assert.throws(() => identity({ candidateEntries: [{ ...entry('src/browser/a.mjs', '1'), mode: '999999' }] }), /mode/i);
});