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

test('local browser evidence gate is limited to trusted same-repository pull requests', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(browserJob, /github\.event_name == 'pull_request' &&\s+github\.event\.pull_request\.head\.repo\.full_name == github\.repository &&\s+needs\.change-classification\.outputs\.requires_e2e == 'true'/);
  assert.match(browserJob, /needs:\s*\n\s*- verification-node\s*\n\s*- change-classification/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /statuses: read/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas/);
  assert.doesNotMatch(browserJob, /secrets:/);
});

test('local browser evidence gate binds status to exact candidate without running repository Docker code', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /ATLAS_CODE_REVISION: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /commits\/\$ATLAS_CODE_REVISION\/statuses/);
  assert.match(browserJob, /atlas-local-e2e/);
  assert.match(browserJob, /test "\$state" = success/);
  assert.doesNotMatch(browserJob, /actions\/checkout@|docker\s|compose\.selfhosted|ATLAS_PUBLICATION_ORIGIN/);
  assert.doesNotMatch(browserJob, /PREVIEW_CONTAINER|ATLAS_REV/);
});
