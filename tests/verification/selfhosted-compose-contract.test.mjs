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

test('required PR gate validates hosted lifecycle artifacts while nightly keeps the no-bind self-hosted Compose path', () => {
  assert.match(ci, /Protected Hosted Playwright evidence/);
  assert.match(ci, /protected-hosted-fan-in/);
  assert.match(ci, /protected-verification-state/);
  assert.match(ci, /validateProtectedHostedGate/);
  assert.match(ci, /ATLAS_LEGACY_CUTOVER_BASE_SHA: b285c4d57d48cbc70bca54619849b7f7cfd423f6/);
  assert.match(ci, /atlas-local-e2e/);
  assert.doesNotMatch(ci, /compose\.selfhosted\.yml|docker cp/);
  assert.match(nightly, /compose\.selfhosted\.yml/);
  assert.match(nightly, /docker cp/);
});
