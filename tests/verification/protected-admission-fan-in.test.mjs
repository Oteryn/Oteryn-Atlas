import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
const read = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
test('PR consumes generic evidence using exact protected-base code', () => {
  const source = read('.github/workflows/ci.yml');
  assert.match(source, /path: admission-authority/);
  assert.match(source, /node admission-authority\/tools\/verification\/consume-protected-admission.mjs/);
  assert.match(source, /ref: \$\{\{ github.event.pull_request.base.sha \}\}/);
});
test('MQ uses same evidence contract and executes shared protected plan on absence', () => {
  const source = read('.github/workflows/merge-group-gate.yml');
  assert.match(source, /node trusted-base\/tools\/verification\/consume-protected-admission.mjs/);
  assert.match(source, /steps.generic-admission.outputs.admission_accepted != 'true'/);
  assert.match(source, /node trusted-base\/tools\/verification\/run-protected-merge-group.mjs/);
});
