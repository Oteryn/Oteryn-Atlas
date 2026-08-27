import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const controller = fs.readFileSync(new URL('../../.github/workflows/protected-verification-controller.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const executor = fs.readFileSync(new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function occurrences(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

test('protected controller obtains candidate census only inside a no-network no-secret read-only sandbox', () => {
  assert.match(controller, /pull_request_target:/);
  assert.match(controller, /git\s+(?:-C\s+\S+\s+)?worktree\s+add\s+--detach/);
  assert.match(controller, /--network\s+none/);
  assert.match(controller, /--read-only/);
  assert.match(controller, /--cap-drop(?:=|\s+)ALL/);
  assert.match(controller, /no-new-privileges/);
  assert.match(controller, /candidate-census/i);
  assert.match(controller, /parse-playwright-test-list\.mjs/);
  assert.match(controller, /protected-hosted-plan\.mjs/);
  assert.match(controller, /git\s+show[^\n]*tools\/verification\/impact-manifest\.json/);
  assert.match(controller, /git\s+show[^\n]*tools\/verification\/verification-catalog\.json/);
  assert.match(controller, /assert-current-pr-head\.mjs/);
  assert.match(controller, /cancel-in-progress:\s*true/);
  assert.doesNotMatch(controller, /atlas-local-e2e|192\.168\.|molehill|synology/i);
});

test('hosted executor consumes a published protected plan under read-only GitHub permissions', () => {
  assert.match(executor, /name:\s*Protected Hosted Verification Executor/);
  assert.match(executor, /workflow_run:/);
  assert.match(executor, /Protected Verification Controller/);
  assert.match(executor, /runs-on:\s*ubuntu-24\.04/);
  assert.match(executor, /contents:\s*read/);
  assert.match(executor, /actions:\s*read/);
  assert.match(executor, /pull-requests:\s*read/);
  assert.match(executor, /protected-verification-plan/);
  assert.match(executor, /protected-hosted-execution\.mjs/);
  assert.match(executor, /e2e\/compose\.github-hosted\.yml/);
  assert.match(executor, /protected-hosted-fan-in\.mjs/);
  assert.ok(occurrences(executor, /assert-current-pr-head\.mjs/g) >= 2, 'executor must fence the PR head before expensive execution and before fan-in');
  assert.match(executor, /cancel-in-progress:\s*true/);
  assert.doesNotMatch(executor, /pull_request_target:|atlas-local-e2e|192\.168\.|molehill|synology|secrets:/i);
});
