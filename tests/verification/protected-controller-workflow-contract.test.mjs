import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-verification-controller.yml'), 'utf8');

test('protected controller runs from pull_request_target protected base with PR-scoped cancellation', () => {
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});

test('protected controller treats candidate as data and cross-checks GitHub changed-file evidence', () => {
  assert.match(workflow, /pulls\/\$ATLAS_PR_NUMBER\/files/);
  assert.match(workflow, /git diff --name-status -z --find-renames/);
  assert.match(workflow, /GitHub changed-file evidence does not match protected merge-base diff/);
  assert.match(workflow, /git show "\$ATLAS_PROTECTED_BASE_SHA:tools\/verification\/impact-manifest\.json"/);
  assert.match(workflow, /git show "\$ATLAS_CANDIDATE_HEAD_SHA:tools\/verification\/verification-catalog\.json"/);
  assert.match(workflow, /git show "\$ATLAS_PROTECTED_BASE_SHA:tools\/verification\/protected-hosted-product-identities\.json"/);
  assert.doesNotMatch(workflow, /git show "\$ATLAS_CANDIDATE_HEAD_SHA:tools\/verification\/protected-hosted-product-identities\.json"/);
  assert.match(workflow, /protected-hosted-plan\.mjs/);
});

test('protected controller binds protected and candidate censuses and rejects stale head before publication', () => {
  assert.match(workflow, /playwright test --config=e2e\/playwright\.config\.mjs --list/);
  assert.match(workflow, /candidate-playwright-test-list\.txt/);
  assert.match(workflow, /parse-playwright-test-list\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /protected-verification-plan/);
  assert.match(workflow, /product-identities\.json/);
});
