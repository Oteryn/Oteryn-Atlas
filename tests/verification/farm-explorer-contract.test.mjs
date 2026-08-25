import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import '../farm-intelligence.mjs';
import '../farm-state.mjs';
import '../farm-lod.mjs';
import '../farm-gui-contract.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PYTHON_FILES = [
  'tools/build-farm-intelligence.py',
  'tools/build-farm-spatial-index.py',
  'tools/build-farm-bundle.py',
  'tests/farm-intelligence-build.py',
  'tests/farm-spatial-index.py',
  'tests/farm-bundle.py',
];
function runPython(args) {
  const result = spawnSync('python', args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test('Farm Explorer Python builders compile and pass deterministic contract tests', () => {
  runPython(['-m', 'py_compile', ...PYTHON_FILES]);
  assert.match(runPython(['tests/farm-intelligence-build.py']), /PASS/);
  assert.match(runPython(['tests/farm-spatial-index.py']), /PASS/);
  assert.match(runPython(['tests/farm-bundle.py']), /PASS/);
});
