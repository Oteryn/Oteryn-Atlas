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
  assert.match(browserJob, /node admission-authority\/tools\/verification\/consume-protected-admission\.mjs/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas|secrets:/);
});
test('protected hosted gate binds exact candidate, base, producer and artifact bytes without browser execution', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  const consumer = fs.readFileSync('tools/verification/consume-protected-admission.mjs', 'utf8');
  assert.match(browserJob, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(browserJob, /ATLAS_CODE_REVISION: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(browserJob, /ATLAS_PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(consumer, /validateProtectedAdmissionEvidence/);
  assert.match(consumer, /protected-admission\.yml/);
  assert.match(consumer, /latest exact producer is failed or retried/);
  assert.match(consumer, /independent evidence artifact missing or expired/);
  assert.match(consumer, /final producer reread/);
  assert.match(consumer, /final producer jobs reread/);
  assert.doesNotMatch(browserJob, /ATLAS_LEGACY_CUTOVER|validateLegacyTransitionBootstrapGate/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e/);
  assert.doesNotMatch(browserJob, /docker\s|compose\.selfhosted|ATLAS_PUBLICATION_ORIGIN/);
});
