import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function block(source, start, end) {
  const begin = source.indexOf(start);
  assert.notEqual(begin, -1, `missing ${start}`);
  const finish = source.indexOf(end, begin + start.length);
  return source.slice(begin, finish === -1 ? source.length : finish);
}

test('required browser gate consumes exact-head protected hosted fan-in instead of legacy local status', () => {
  const browser = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  assert.match(browser, /name:\s*Protected Hosted Playwright evidence/);
  assert.match(browser, /actions:\s*read/);
  assert.match(browser, /pull-requests:\s*read/);
  assert.match(browser, /actions\/artifacts\?per_page=100/);
  assert.match(browser, /protected-hosted-fan-in-/);
  assert.match(browser, /fan-in/);
  assert.match(browser, /candidateHeadSha/);
  assert.match(browser, /evidenceScope/);
  assert.match(browser, /hosted-placement/);
  assert.match(browser, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.doesNotMatch(browser, /atlas-local-e2e/);
  assert.doesNotMatch(browser, /docker compose|compose\.selfhosted\.yml|molehill|synology|192\.168\./i);
});

test('atlas-gate keeps hosted evidence as the heavy PR qualification dependency', () => {
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));
  assert.match(gate, /- verification-browser/);
  assert.match(gate, /VERIFICATION_BROWSER:.*needs\.verification-browser\.result/);
  assert.match(gate, /true:false[\s\S]*VERIFICATION_BROWSER[\s\S]*success/);
  assert.doesNotMatch(gate, /atlas-local-e2e/);
});
