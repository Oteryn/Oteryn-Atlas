import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const legacyWorkflow = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const protectedWorkflow = fs.readFileSync(new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('authoritative full-safe browser execution uses the protected GitHub-hosted qualification path', () => {
  assert.match(protectedWorkflow, /name:\s*Protected Hosted Verification Executor/);
  assert.match(protectedWorkflow, /workflow_run:/);
  assert.match(protectedWorkflow, /runs-on:\s*ubuntu-24\.04/);
  assert.match(protectedWorkflow, /protected-verification-plan/);
  assert.match(protectedWorkflow, /protected-hosted-execution\.mjs/);
  assert.match(protectedWorkflow, /e2e\/compose\.protected-hosted-executor\.yml/);
  assert.match(protectedWorkflow, /e2e\/compose\.github-hosted\.yml/);
  assert.match(protectedWorkflow, /protected-hosted-fan-in\.mjs/);
  assert.match(protectedWorkflow, /ATLAS_E2E_WORKERS:\s*'1'/);
  assert.doesNotMatch(protectedWorkflow, /atlas-local-e2e/);
  assert.doesNotMatch(protectedWorkflow, /192\.168\.|synology|molehill/i);
});

test('pull-request CI requires protected hosted fan-in and no longer depends on local status', () => {
  assert.match(legacyWorkflow, /name:\s*Protected Hosted Playwright evidence/);
  assert.match(legacyWorkflow, /actions\/artifacts\?per_page=100/);
  assert.match(legacyWorkflow, /protected-hosted-fan-in-/);
  assert.doesNotMatch(legacyWorkflow, /atlas-local-e2e/);
  assert.doesNotMatch(legacyWorkflow, /name:\s*Protected Hosted Verification Executor/);
  assert.doesNotMatch(legacyWorkflow, /protected-hosted-fan-in\.mjs/);
});
