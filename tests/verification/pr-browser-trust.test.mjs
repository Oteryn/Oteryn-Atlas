import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n/g, '\n');

function jobBlock(start, end) {
  const begin = ci.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = ci.indexOf(end, begin + start.length);
  return ci.slice(begin, finish === -1 ? ci.length : finish);
}

test('protected hosted browser gate is limited to trusted same-repository pull requests', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /actions: read/);
  assert.match(browserJob, /pull-requests: read/);
  assert.match(browserJob, /expected_name="protected-hosted-fan-in-\$ATLAS_PROTECTED_BASE_SHA-\$ATLAS_CODE_REVISION"/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas|secrets:/);
});
test('protected hosted gate binds exact candidate, base, producer and artifact bytes without browser execution', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /ref: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.match(browserJob, /run\.status !== 'completed'/);
  assert.match(browserJob, /run\.conclusion !== 'success'/);
  assert.match(browserJob, /\.github\/workflows\/protected-hosted-executor\.yml/);
  assert.match(browserJob, /protected-hosted-fan-in\.json/);
  assert.match(browserJob, /protected-verification-state\.json/);
  assert.match(browserJob, /validateProtectedHostedGate/);
  assert.match(browserJob, /expectedCandidateHeadSha: process\.env\.ATLAS_CODE_REVISION/);
  assert.match(browserJob, /expectedProtectedBaseSha: process\.env\.ATLAS_PROTECTED_BASE_SHA/);
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_BASE_SHA: f8de8e42ca57112cf71100aa19322ef22527b168/);
  assert.match(browserJob, /ATLAS_PROTECTED_BASE_SHA.*ATLAS_LEGACY_CUTOVER_BASE_SHA/);
  assert.match(browserJob, /atlas-local-e2e/);
  assert.doesNotMatch(browserJob, /docker\s|compose\.selfhosted|ATLAS_PUBLICATION_ORIGIN/);
});
