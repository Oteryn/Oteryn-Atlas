import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const nightly = fs.readFileSync(
  new URL('../../.github/workflows/verification-depth.yml', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

function browserDepthBlock() {
  const start = nightly.indexOf('  browser-depth:\n');
  assert.notEqual(start, -1, 'missing browser-depth job');
  return nightly.slice(start);
}

test('nightly browser depth adds depth-only coverage instead of replaying the full PR E2E suite', () => {
  const browserDepth = browserDepthBlock();

  assert.doesNotMatch(browserDepth, /run_case required[\s\S]*?e2e npm test/);
  assert.match(browserDepth, /run_case repeated-critical/);
  assert.match(browserDepth, /--repeat-each=3/);
  assert.match(browserDepth, /for seed in 133 1096043585 2779096485 3735928559/);
  assert.match(browserDepth, /run_case extra-profiles/);
  assert.match(browserDepth, /run_optional performance/);
  assert.match(browserDepth, /run_optional visual/);
  assert.match(browserDepth, /run_optional accessibility/);
  assert.match(browserDepth, /run_optional race-fault/);
  assert.match(browserDepth, /run_optional soak-leak/);
});
