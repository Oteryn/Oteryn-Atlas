import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const exists = (path) => fs.existsSync(path);
const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const compose = read('e2e/compose.selfhosted.yml');

test('self-hosted Compose sends checkout into images instead of bind mounting runner paths', () => {
  assert.equal(exists('e2e/Dockerfile.web'), true);
  assert.equal(exists('e2e/compose.selfhosted.yml'), true);
  assert.match(compose, /dockerfile: e2e\/Dockerfile\.web/);
  assert.match(compose, /dockerfile: e2e\/Dockerfile/);
  assert.match(compose, /artifacts:\s*\n/);
  assert.doesNotMatch(compose, /\.\.\/web:|\.\.\/src:|ATLAS_E2E_ARTIFACTS_HOST/);
});

test('self-hosted checkout images preserve health ordering and isolated artifact output', () => {
  assert.match(compose, /read_only: true/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /ATLAS_EXPECTED_REVISION:/);
  assert.match(compose, /ATLAS_ARTIFACTS_DIR: \/artifacts/);
  assert.match(compose, /- artifacts:\/artifacts/);
  assert.doesNotMatch(compose, /network_mode:\s*host|privileged:\s*true/);
});
