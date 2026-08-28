import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-verification-controller.yml'), 'utf8');
const legacyTransition = fs.readFileSync(path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml'), 'utf8').replace(/\r\n/g, '\n');
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

test('candidate census mounts protected dependencies outside the read-only candidate tree', () => {
  assert.match(workflow, /--mount "type=bind,src=\$candidate_dir,dst=\/candidate,readonly"/);
  assert.match(workflow, /ln -s \/protected-e2e-node-modules\/node_modules "\$candidate_dir\/e2e\/node_modules"/);
  assert.match(workflow, /dst=\/protected-e2e-node-modules\/node_modules,readonly/);
  assert.doesNotMatch(workflow, /dst=\/candidate\/e2e\/node_modules/);
});


test('PR 234 bootstrap publishes legacy compatibility only after a GitHub-hosted protected census smoke', () => {
  const heavyStart = legacyTransition.indexOf('  legacy-qualification:\n');
  const bootstrapStart = legacyTransition.indexOf('  protected-census-bootstrap:\n');
  const publishStart = legacyTransition.indexOf('  publish-reviewed-status:\n');
  assert.notEqual(heavyStart, -1, 'missing legacy-qualification');
  assert.notEqual(bootstrapStart, -1, 'missing protected-census-bootstrap');
  assert.notEqual(publishStart, -1, 'missing publish-reviewed-status');
  const heavy = legacyTransition.slice(heavyStart, bootstrapStart);
  const bootstrap = legacyTransition.slice(bootstrapStart, publishStart);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-census-readonly-mount/);
  assert.match(bootstrap, /fix\/issue-179-protected-census-readonly-mount/);
  assert.match(bootstrap, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(bootstrap, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(bootstrap, /\.github\/workflows\/legacy-molehill-transition-qualification\.yml/);
  assert.match(bootstrap, /\.github\/workflows\/protected-verification-controller\.yml/);
  assert.match(bootstrap, /tests\/verification\/protected-controller-workflow-contract\.test\.mjs/);
  assert.match(bootstrap, /pulls\/\$ATLAS_PR_NUMBER\/files/);
  assert.match(bootstrap, /playwright test --config=\/candidate\/e2e\/playwright\.config\.mjs --list/);
  assert.match(bootstrap, /--network none/);
  assert.match(bootstrap, /--read-only/);
  assert.match(bootstrap, /--cap-drop ALL/);
  assert.match(bootstrap, /no-new-privileges/);
  assert.match(bootstrap, /\/protected-e2e-node-modules\/node_modules/);
  assert.match(bootstrap, /ATLAS_ARTIFACTS_DIR=\/tmp\/artifacts[^']*playwright test[^']*--list/);
  assert.match(bootstrap, /assert-current-pr-head\.mjs/);
  assert.match(bootstrap, /statuses:\s*write/);
  assert.match(bootstrap, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(bootstrap, /\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json/);
});
