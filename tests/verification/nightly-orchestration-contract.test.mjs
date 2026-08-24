import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const nightly = read('.github/workflows/verification-depth.yml');
const live = read('.github/workflows/synology-live-acceptance.yml');

function block(source, start, end = null) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  if (!end) return source.slice(begin);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('Molehill nightly uses the Windows PowerShell shell installed on the runner', () => {
  const browser = block(nightly, '  browser-depth:\n');
  assert.doesNotMatch(browser, /shell:\s*pwsh/);
  const powershellSteps = browser.match(/shell:\s*powershell/g) ?? [];
  assert.ok(powershellSteps.length >= 5, 'all Molehill PowerShell steps must use powershell.exe');
});

test('nightly cannot evict a pending Synology live acceptance through shared concurrency', () => {
  const browser = block(nightly, '  browser-depth:\n');
  const liveConcurrency = block(live, 'concurrency:\n', '\njobs:\n');
  assert.match(liveConcurrency, /group:\s*atlas-synology-live-acceptance/);
  assert.doesNotMatch(browser, /group:\s*atlas-synology-live-acceptance/);
});

test('nightly fail-closes if the served live revision is stale or changes during depth', () => {
  const browser = block(nightly, '  browser-depth:\n');
  const revisionHeaderChecks = browser.match(/X-Oteryn-Atlas-Revision/g) ?? [];
  assert.ok(revisionHeaderChecks.length >= 2, 'nightly must verify live revision before and after browser depth');
  assert.match(browser, /ATLAS_CODE_REVISION/);
  assert.match(browser, /Verify exact checkout and read-only publication origin/);
  assert.match(browser, /Verify publication revision remained exact/);
});
