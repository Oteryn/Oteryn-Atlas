import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n/g, '\n');
const controller = read('.github/workflows/protected-verification-controller.yml');
const executor = read('.github/workflows/protected-hosted-executor.yml');
const state = read('tools/verification/protected-verification-state.mjs');
const gate = read('tools/verification/protected-hosted-gate.mjs');

test('successful protected base-advance controller explicitly dispatches the hosted executor', () => {
  assert.match(controller, /handoff-base-advance:/);
  assert.match(controller, /needs:\s*\[?protected-plan\]?/);
  assert.match(controller, /actions:\s*write/);
  assert.match(controller, /base_advance:\[a-f0-9\]\{40\}/);
  assert.match(controller, /actions\/runs\/\$GITHUB_RUN_ID\/artifacts/);
  assert.match(controller, /protected-verification-plan-/);
  assert.match(controller, /actions\/workflows\/protected-hosted-executor\.yml\/dispatches/);
  assert.match(controller, /controller_run_id/);
  assert.match(controller, /pr_number/);
});

test('executor admits only an exact protected controller workflow_dispatch producer', () => {
  assert.match(executor, /workflow_dispatch:/);
  assert.match(executor, /controller_run_id:/);
  assert.match(executor, /pr_number:/);
  assert.match(executor, /inputs\.pr_number/);
  assert.match(executor, /inputs\.controller_run_id/);
  assert.match(executor, /actions\/runs\/\$CONTROLLER_RUN_ID/);
  assert.match(executor, /protected-verification-controller\.yml/);
  assert.match(executor, /producer.*workflow_dispatch|workflow_dispatch.*producer/is);
  assert.match(executor, /run_attempt/);
  assert.match(executor, /github-actions\[bot\]/);
  assert.match(executor, /plan\.prNumber.*DISPATCH_PR_NUMBER|DISPATCH_PR_NUMBER.*plan\.prNumber/s);
  assert.match(executor, /current-pr\.json/);
});

test('executor preserves per-PR supersession and accepts dispatch-produced lifecycle state', () => {
  assert.match(executor, /group:\s*atlas-protected-hosted-\$\{\{[^\n]*inputs\.pr_number/);
  assert.match(executor, /cancel-in-progress:\s*true/);
  assert.match(executor, /run\.event[^\n]*workflow_run[^\n]*workflow_dispatch|\['workflow_run',\s*'workflow_dispatch'\]/);
  assert.match(state, /EVENTS = new Set\(\[[^\]]*'workflow_run'[^\]]*'workflow_dispatch'/);
  assert.match(gate, /PRODUCER_EVENTS = new Set\(\[[^\]]*'workflow_run'[^\]]*'workflow_dispatch'/);
});
