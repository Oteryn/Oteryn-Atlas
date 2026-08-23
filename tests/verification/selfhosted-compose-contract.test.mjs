import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const exists = (path) => fs.existsSync(path);
const read = (path) => exists(path) ? fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : '';
const compose = read('e2e/compose.selfhosted.yml');
const ci = read('.github/workflows/ci.yml');
const nightly = read('.github/workflows/verification-depth.yml');

test('self-hosted Compose sends checkout into images instead of bind mounting runner paths', () => {
  assert.equal(exists('e2e/Dockerfile.web'), true);
  assert.equal(exists('e2e/compose.selfhosted.yml'), true);
  assert.match(compose, /dockerfile: e2e\/Dockerfile\.web/);
  assert.match(compose, /dockerfile: e2e\/Dockerfile/);
  assert.match(compose, /artifacts:\s*\n/);
  assert.doesNotMatch(compose, /\.\.\/web:|\.\.\/src:|ATLAS_E2E_ARTIFACTS_HOST/);
});

test('self-hosted required and nightly jobs use the no-bind Compose path', () => {
  assert.match(ci, /compose\.selfhosted\.yml/);
  assert.match(ci, /docker cp/);
  assert.match(nightly, /compose\.selfhosted\.yml/);
  assert.match(nightly, /docker cp/);
});
