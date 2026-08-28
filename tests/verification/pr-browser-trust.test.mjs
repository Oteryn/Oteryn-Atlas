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

test('protected hosted browser evidence gate is limited to trusted same-repository pull requests', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(browserJob, /github\.event_name == 'pull_request' &&\s+github\.event\.pull_request\.head\.repo\.full_name == github\.repository &&\s+needs\.change-classification\.outputs\.requires_e2e == 'true'/);
  assert.match(browserJob, /needs:\s*\n\s*- verification-node\s*\n\s*- change-classification/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /actions: read/);
  assert.match(browserJob, /pull-requests: read/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas/);
  assert.doesNotMatch(browserJob, /secrets:/);
});

test('protected hosted browser evidence gate binds exact candidate controller and fan-in without legacy local status', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /ATLAS_CODE_REVISION: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /ATLAS_PR_NUMBER: \${{ github\.event\.pull_request\.number }}/);
  assert.match(browserJob, /protected-hosted-fan-in-/);
  assert.match(browserJob, /Protected Hosted Verification Executor/);
  assert.match(browserJob, /\.github\/workflows\/protected-hosted-executor\.yml/);
  assert.match(browserJob, /Protected Verification Controller/);
  assert.match(browserJob, /\.github\/workflows\/protected-verification-controller\.yml/);
  assert.match(browserJob, /\.event == "pull_request_target"/);
  assert.match(browserJob, /gh run download/);
  assert.match(browserJob, /evidence\.candidateHeadSha !== expectedHead/);
  assert.match(browserJob, /expectedStableTestIdsDigest/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e|commits\/\$ATLAS_CODE_REVISION\/statuses/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas|ATLAS_PUBLICATION_ORIGIN/);
});
