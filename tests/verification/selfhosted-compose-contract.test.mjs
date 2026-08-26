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

test('ordinary PR gate uses GitHub-hosted Docker while self-hosted Compose stays outside required PR CI', () => {
  const browserJob = ci.slice(ci.indexOf('  verification-browser:\n'), ci.indexOf('  atlas-gate:\n'));
  assert.match(browserJob, /GitHub-hosted Docker Playwright evidence/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /docker compose -f e2e\/compose\.yml/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e/);
  assert.doesNotMatch(browserJob, /compose\.selfhosted\.yml/);
  assert.doesNotMatch(browserJob, /docker cp/);
  assert.match(nightly, /compose\.selfhosted\.yml/);
  assert.match(nightly, /docker cp/);
});
