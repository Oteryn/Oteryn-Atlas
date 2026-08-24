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

test('heavy nightly browser depth is pinned to the dedicated Molehill Windows runner', () => {
  const browser = block(nightly, '  browser-depth:\n');
  assert.match(browser, /group: atlas-runners/);
  assert.match(browser, /labels: oteryn-atlas-pc/);
  assert.match(browser, /oteryn-molehill-atlas/);
  assert.match(browser, /runner\.os[^\n]*Windows|RUNNER_OS[^\n]*Windows/);
  assert.doesNotMatch(browser, /labels: oteryn-atlas\s*(?:\n|$)/);
});

test('Synology live acceptance remains on the Atlas Synology runner', () => {
  assert.match(live, /group: atlas-runners/);
  assert.match(live, /labels: oteryn-atlas\s*(?:\n|$)/);
  assert.match(live, /oteryn-synology-atlas/);
  assert.doesNotMatch(live, /oteryn-atlas-pc|oteryn-molehill-atlas/);
});
