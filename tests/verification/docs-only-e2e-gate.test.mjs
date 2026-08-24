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

test('safe docs-only PRs skip heavy exact-head local E2E while unknown paths fail closed', () => {
  const scope = block(ci, '  verification-scope:\n', '  verification-node:\n');
  const browser = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));

  assert.match(scope, /fetch-depth:\s*0/);
  assert.match(scope, /github\.event\.pull_request\.base\.sha/);
  assert.match(scope, /git diff --name-only/);
  assert.match(scope, /docs\/\*/);
  assert.match(scope, /requires-e2e=true/);
  assert.match(scope, /requires-e2e=false/);
  assert.match(scope, /test -s/);

  assert.match(browser, /needs:\s*\[verification-node, verification-scope\]/);
  assert.match(browser, /needs\.verification-scope\.outputs\.requires-e2e == 'true'/);

  assert.match(gate, /- verification-scope/);
  assert.match(gate, /VERIFICATION_SCOPE:/);
  assert.match(gate, /REQUIRES_E2E:/);
  assert.match(gate, /REQUIRES_E2E.*true.*VERIFICATION_BROWSER.*success/s);
  assert.match(gate, /REQUIRES_E2E.*false.*VERIFICATION_BROWSER.*skipped/s);
});
