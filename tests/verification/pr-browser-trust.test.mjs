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

test('self-hosted browser gate is limited to trusted same-repository pull requests', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(browserJob, /github\.event_name == 'push' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(browserJob, /group: atlas-runners/);
  assert.match(browserJob, /labels: oteryn-atlas/);
  assert.doesNotMatch(browserJob, /secrets:/);
});
test('self-hosted browser gate binds evidence to exact candidate and does not deploy', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /ATLAS_CODE_REVISION: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
  assert.match(browserJob, /ATLAS_EXPECTED_REVISION: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
  assert.match(browserJob, /ref: \${{ github\.event\.pull_request\.head\.sha \|\| github\.sha }}/);
  assert.match(browserJob, /persist-credentials: false/);
  assert.match(browserJob, /test ! -e \/var\/lib\/oteryn-staging-state/);
  assert.doesNotMatch(browserJob, /docker\s+(?:stop|rename)\b/);
  assert.doesNotMatch(browserJob, /PREVIEW_CONTAINER|ATLAS_REV/);
});
