import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const ci = read('.github/workflows/ci.yml');
const nightly = read('.github/workflows/verification-depth.yml');
const live = read('.github/workflows/synology-live-acceptance.yml');

function jobBlock(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('required heavy browser gate is pinned to Molehill-PC and exact candidate evidence', () => {
  const job = jobBlock(ci, '  verification-browser:\n', '  atlas-gate:\n');
  assert.match(job, /group: atlas-runners/);
  assert.match(job, /labels: oteryn-atlas-pc/);
  assert.match(job, /RUNNER_NAME -ne 'oteryn-molehill-atlas'/);
  assert.match(job, /RUNNER_OS -ne 'Windows'/);
  assert.match(job, /ATLAS_CODE_REVISION: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
  assert.match(job, /ATLAS_SOURCE_PUBLICATION_ORIGIN: http:\/\/192\.168\.1\.2:8097/);
  assert.match(job, /\.\\e2e\\run-pc\.ps1/);
  assert.doesNotMatch(job, /oteryn-synology-atlas/);
});

test('scheduled heavy browser depth is pinned to Molehill-PC while deterministic depth stays hosted', () => {
  const deterministic = jobBlock(nightly, '  deterministic-depth:\n', '  browser-depth:\n');
  const browser = jobBlock(nightly, '  browser-depth:\n', '      - name: Publish bounded nightly browser evidence\n');
  assert.match(deterministic, /runs-on: ubuntu-24\.04/);
  assert.match(browser, /group: atlas-runners/);
  assert.match(browser, /labels: oteryn-atlas-pc/);
  assert.match(browser, /RUNNER_NAME -ne 'oteryn-molehill-atlas'/);
  assert.match(browser, /ATLAS_SOURCE_PUBLICATION_ORIGIN: http:\/\/192\.168\.1\.2:8097/);
  assert.match(browser, /\.\\e2e\\run-nightly-pc\.ps1/);
  assert.doesNotMatch(browser, /oteryn-synology-atlas/);
});

test('Synology remains deployment/live acceptance authority only', () => {
  assert.match(live, /labels: oteryn-atlas/);
  assert.match(live, /RUNNER_NAME:-.*oteryn-synology-atlas/);
  assert.doesNotMatch(live, /oteryn-atlas-pc|oteryn-molehill-atlas|run-pc\.ps1|run-nightly-pc\.ps1/);
});

test('PC runner helpers and bounded host publication relay are repository-owned', () => {
  for (const path of ['e2e/run-pc.ps1', 'e2e/run-nightly-pc.ps1', 'e2e/publication-relay.mjs']) {
    assert.equal(fs.existsSync(path), true, `missing ${path}`);
  }
  const relay = read('e2e/publication-relay.mjs');
  assert.match(relay, /ATLAS_RELAY_TARGET/);
  assert.match(relay, /ATLAS_RELAY_PORT/);
  assert.match(relay, /maxSockets/);
  assert.doesNotMatch(relay, /retry/i);
});
