import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

const ci = read('.github/workflows/ci.yml');
const molehill = read('.github/workflows/molehill-pr-e2e.yml');
const agents = read('AGENTS.md');
const platform = read('docs/testing/ATLAS-VERIFICATION-PLATFORM.md');

test('ordinary PR Playwright runs on GitHub-hosted CI instead of external atlas-local-e2e status', () => {
  const browserJob = ci.slice(ci.indexOf('  verification-browser:\n'), ci.indexOf('  atlas-gate:\n'));
  assert.ok(browserJob.length > 0, 'verification-browser job is missing');
  assert.match(browserJob, /runs-on:\s*ubuntu-24\.04/);
  assert.match(browserJob, /docker compose/);
  assert.match(browserJob, /summary\.json/);
  assert.match(browserJob, /ATLAS_EXPECTED_REVISION/);
  assert.match(browserJob, /retries|retry/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e/);
  assert.doesNotMatch(browserJob, /statuses:\s*read/);
});

test('Molehill is specialist-only and cannot run automatically for ordinary PR events', () => {
  assert.match(molehill, /workflow_dispatch:/);
  assert.doesNotMatch(molehill, /pull_request_target:/);
  assert.doesNotMatch(molehill, /^\s*pull_request:\s*$/m);
  assert.match(molehill, /reason_code/);
  assert.match(molehill, /required_capability/);
  assert.match(molehill, /native-gpu|native-windows|restricted-visual|lan-smoke|hardware-repro|specialist-benchmark/);
  assert.match(molehill, /head_sha/);
  assert.match(molehill, /pr_number/);
});

test('repository guidance states GitHub-hosted default, Molehill specialist-only, and Synology deployment-only', () => {
  for (const [name, content] of [['AGENTS.md', agents], ['ATLAS-VERIFICATION-PLATFORM.md', platform]]) {
    assert.match(content, /GitHub-hosted/i, `${name} must name GitHub-hosted execution`);
    assert.match(content, /Molehill[^\n]*(specialist|exception)/i, `${name} must constrain Molehill`);
    assert.match(content, /Synology[^\n]*(deployment|deploy)/i, `${name} must constrain Synology`);
  }
});
