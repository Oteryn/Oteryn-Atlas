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

test('heavy jobs execute only protected default-branch source and never checkout controller output', () => {
  const environmentStart = executor.indexOf('  environment-qualification:');
  const hostedStart = executor.indexOf('  hosted-shards:');
  const fanInStart = executor.indexOf('  fan-in:');
  assert.ok(environmentStart >= 0 && hostedStart > environmentStart && fanInStart > hostedStart);
  for (const block of [executor.slice(environmentStart, hostedStart), executor.slice(hostedStart, fanInStart)]) {
    assert.match(block, /id:\s*checkout_protected[\s\S]*?ref:\s*\$\{\{ github\.sha \}\}/);
    assert.doesNotMatch(block, /ref:\s*\$\{\{ needs\.preflight\.outputs\.controller_source_sha \}\}/);
    assert.match(block, /id:\s*checkout_protected_fence[\s\S]*?CONTROLLER_SOURCE_SHA:\s*\$\{\{ needs\.preflight\.outputs\.controller_source_sha \}\}[\s\S]*?rev-parse HEAD\)" = "\$CONTROLLER_SOURCE_SHA"/);
  }
});

test('executor preserves one concurrency key across successive heads of the same PR and accepts dispatch-produced lifecycle state', () => {
  const concurrencyGroupLine = executor
    .split('\n')
    .find((line) => line.trimStart().startsWith('group: atlas-protected-hosted-'))
    ?.trim();
  assert.equal(
    concurrencyGroupLine,
    'group: atlas-protected-hosted-${{ inputs.pr_number || github.event.workflow_run.head_branch }}',
    'workflow_run supersession must use stable candidate branch identity instead of per-run identity',
  );
  assert.match(executor, /cancel-in-progress:\s*true/);
  assert.match(executor, /run\.event[^\n]*workflow_run[^\n]*workflow_dispatch|\['workflow_run',\s*'workflow_dispatch'\]/);
  assert.match(state, /EVENTS = new Set\(\[[^\]]*'workflow_run'[^\]]*'workflow_dispatch'/);
  assert.match(gate, /PRODUCER_EVENTS = new Set\(\[[^\]]*'workflow_run'[^\]]*'workflow_dispatch'/);
});

test('executor terminates the restored base-state tuple before bash read reaches EOF', () => {
  assert.ok(
    executor.includes('process.stdout.write(`${previous.plan.protectedBaseSha} ${current.protectedBaseSha} ${current.candidateHeadSha}\\n`);'),
    'base-advance tuple must end with a newline so bash read succeeds under set -e',
  );
});
