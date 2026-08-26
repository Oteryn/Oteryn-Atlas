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

test('ordinary browser evidence gate is limited to trusted same-repository pull requests', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(browserJob, /github\.event_name == 'pull_request' &&\s+github\.event\.pull_request\.head\.repo\.full_name == github\.repository &&\s+needs\.change-classification\.outputs\.requires_e2e == 'true'/);
  assert.match(browserJob, /needs:\s*\n\s*- verification-node\s*\n\s*- change-classification/);
  assert.match(browserJob, /runs-on: ubuntu-24\.04/);
  assert.match(browserJob, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(browserJob, /statuses: read/);
  assert.doesNotMatch(browserJob, /group: atlas-runners|labels: oteryn-atlas/);
  assert.doesNotMatch(browserJob, /secrets:/);
});

test('ordinary browser evidence gate runs exact candidate Docker and validates exact-head summary', () => {
  const browserJob = jobBlock('  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browserJob, /ATLAS_CODE_REVISION: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /ATLAS_EXPECTED_REVISION: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /ATLAS_E2E_WORKERS: '1'/);
  assert.match(browserJob, /ATLAS_USER_VISUAL_EVIDENCE: '0'/);
  assert.match(browserJob, /actions\/checkout@/);
  assert.match(browserJob, /ref: \${{ github\.event\.pull_request\.head\.sha }}/);
  assert.match(browserJob, /test "\$\(git rev-parse HEAD\)" = "\$ATLAS_CODE_REVISION"/);
  assert.match(browserJob, /docker compose -f e2e\/compose\.yml build e2e/);
  assert.match(browserJob, /docker compose -f e2e\/compose\.yml run --rm e2e/);
  assert.match(browserJob, /summary\.json/);
  assert.match(browserJob, /validate-github-hosted-e2e\.mjs/);
  assert.match(browserJob, /--head-sha "\$ATLAS_CODE_REVISION"/);
  assert.match(browserJob, /--workers "\$ATLAS_E2E_WORKERS"/);
  assert.doesNotMatch(browserJob, /atlas-local-e2e|commits\/\$ATLAS_CODE_REVISION\/statuses/);
  assert.doesNotMatch(browserJob, /compose\.selfhosted\.yml|ATLAS_PUBLICATION_ORIGIN|PREVIEW_CONTAINER/);
});
