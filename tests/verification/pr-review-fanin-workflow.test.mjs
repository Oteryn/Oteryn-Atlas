import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const gate = ci.split('      - name: Require all Atlas CI components\n')[1].split('        run: |\n')[1].split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
const base = { REPOSITORY_CONTRACT: 'success', SEMANTIC_PROOF: 'success', BROWSER_SEMANTIC: 'success', BROWSER_WEBGL_PROOF: 'success', PROJECT: 'success', VERIFICATION_NODE: 'success', CHANGE_CLASSIFICATION: 'success', DOCS_ONLY: 'false', REQUIRES_E2E: 'true', VERIFICATION_BROWSER: 'success' };
function check(event, delta = {}) { return spawnSync('bash', ['-c', gate], { env: { ...process.env, ...base, GITHUB_EVENT_NAME: event, ...delta }, encoding: 'utf8' }).status; }
test('review submission edit and dismissal trigger the same PR classification and protected consumer', () => {
  assert.match(ci, /pull_request_review:\n    types: \[submitted, edited, dismissed\]/);
  for (const job of ['change-classification', 'verification-browser']) {
    const body = ci.split(`  ${job}:\n`)[1].split(/\n  [a-z-]+:\n/)[0];
    assert.match(body, /github\.event_name == 'pull_request' \|\| github\.event_name == 'pull_request_review'/);
  }
});
test('review fan-in still requires every deterministic and protected browser job', () => {
  assert.equal(check('pull_request_review'), 0);
  for (const name of Object.keys(base).filter(name => name !== 'DOCS_ONLY' && name !== 'REQUIRES_E2E')) {
    for (const result of ['failure', 'cancelled', 'skipped']) assert.notEqual(check('pull_request_review', { [name]: result }), 0, `${name}:${result}`);
  }
});
test('review light classification permits only the existing explicit docs-only browser skip', () => {
  assert.equal(check('pull_request_review', { DOCS_ONLY: 'true', REQUIRES_E2E: 'false', VERIFICATION_BROWSER: 'skipped' }), 0);
  assert.notEqual(check('pull_request_review', { DOCS_ONLY: 'true', REQUIRES_E2E: 'true', VERIFICATION_BROWSER: 'skipped' }), 0);
});
test('ordinary PR and protected-main push retain their prior requirements', () => {
  assert.equal(check('pull_request'), 0);
  assert.notEqual(check('pull_request', { VERIFICATION_BROWSER: 'skipped' }), 0);
  assert.equal(check('push', { CHANGE_CLASSIFICATION: 'skipped', VERIFICATION_BROWSER: 'skipped' }), 0);
  assert.notEqual(check('push', { CHANGE_CLASSIFICATION: 'skipped', VERIFICATION_BROWSER: 'skipped', VERIFICATION_NODE: 'failure' }), 0);
});
test('review fan-in consumes protected-base evidence without dispatching a fresh producer', () => {
  const consumer = ci.split('  verification-browser:\n')[1].split('  atlas-gate:\n')[0];
  assert.match(consumer, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(consumer, /node admission-authority\/tools\/verification\/consume-protected-admission\.mjs/);
  assert.doesNotMatch(consumer, /workflow_dispatch|gh workflow run|\/dispatches|run-protected-admission\.mjs/);
});
