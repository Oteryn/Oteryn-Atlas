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

test('PR CI cancels superseded workflow heads without coupling independent PRs', () => {
  const preJobs = ci.slice(0, ci.indexOf('\njobs:\n'));
  assert.match(preJobs, /concurrency:\s*\n\s*group: atlas-ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/);
  assert.match(preJobs, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
});

test('browser evidence is fenced against the live PR head before execution and again before acceptance', () => {
  const browser = block(ci, '  verification-browser:\n', '  atlas-gate:\n');
  const before = browser.indexOf('Fence current PR head before browser execution');
  const run = browser.indexOf('Run exact-head Docker Playwright on GitHub-hosted runner');
  const after = browser.indexOf('Fence current PR head before evidence acceptance');
  const publish = browser.indexOf('Publish bounded GitHub-hosted browser metadata');
  assert.ok(before >= 0 && before < run, 'missing pre-browser live-head fence');
  assert.ok(after > run && after < publish, 'missing pre-publication live-head fence');
  assert.equal((browser.match(/assert-current-pr-head\.mjs/g) ?? []).length, 2);
  assert.match(browser, /pull-requests: read/);
  assert.match(browser, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(browser, /ATLAS_PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(browser, /Publish bounded GitHub-hosted browser metadata\n\s*if: \$\{\{ success\(\) \}\}/);
});

test('final atlas fan-in rechecks the live PR head immediately before gate acceptance', () => {
  const gate = ci.slice(ci.indexOf('  atlas-gate:\n'));
  const fence = gate.indexOf('Fence current PR head before final fan-in');
  const requireAll = gate.indexOf('Require all Atlas CI components');
  assert.ok(fence >= 0 && fence < requireAll, 'final fan-in must fence current PR head first');
  assert.match(gate, /assert-current-pr-head\.mjs/);
  assert.match(gate, /if: github\.event_name == 'pull_request'/);
});
