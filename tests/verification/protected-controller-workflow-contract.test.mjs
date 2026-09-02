import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-verification-controller.yml'), 'utf8');
const legacyTransition = fs.readFileSync(path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml'), 'utf8').replace(/\r\n/g, '\n');
test('protected controller resolves the live PR and checks out its protected base with PR-scoped cancellation', () => {
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pulls\/\$GITHUB_REPOSITORY\/|repos\/\$GITHUB_REPOSITORY\/pulls\/\$ATLAS_REQUESTED_PR_NUMBER/);
  assert.match(workflow, /Requested lifecycle PR is not an open same-repository main-targeting PR/);
  assert.match(workflow, /cancel-in-progress:\s*true/);
  assert.match(workflow, /ref:\s*\$\{\{ steps\.identity\.outputs\.base_sha \}\}/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});

test('protected controller treats candidate as data and cross-checks GitHub changed-file evidence', () => {
  assert.match(workflow, /pulls\/\$ATLAS_PR_NUMBER\/files/);
  assert.match(workflow, /git diff --name-status -z --find-renames/);
  assert.match(workflow, /GitHub changed-file evidence does not match protected merge-base diff/);
  assert.match(workflow, /git show "\$ATLAS_PROTECTED_BASE_SHA:tools\/verification\/impact-manifest\.json"/);
  assert.match(workflow, /snapshot_candidate_policy tools\/verification\/verification-catalog\.json/);
  assert.match(workflow, /git cat-file -e "\$ATLAS_CANDIDATE_HEAD_SHA:\$path"/);
  assert.match(workflow, /git show "\$ATLAS_CANDIDATE_HEAD_SHA:\$path"/);
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

test('candidate census materializes inert candidate bytes without privileged worktree checkout', () => {
  assert.match(workflow, /git archive "\$ATLAS_CANDIDATE_HEAD_SHA" \| tar -x -C "\$candidate_dir"/);
  assert.doesNotMatch(workflow, /git worktree add/);
  assert.doesNotMatch(workflow, /git checkout[^\n]*\$ATLAS_CANDIDATE_HEAD_SHA/);
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

test('legacy transition recovers only the approved Molehill Docker engine with bounded readiness polling', () => {
  const heavyStart = legacyTransition.indexOf('  legacy-qualification:\n');
  const bootstrapStart = legacyTransition.indexOf('  protected-census-bootstrap:\n');
  assert.notEqual(heavyStart, -1, 'missing legacy-qualification');
  assert.notEqual(bootstrapStart, -1, 'missing protected-census-bootstrap');
  const heavy = legacyTransition.slice(heavyStart, bootstrapStart);

  assert.match(heavy, /function Test-MolehillDockerReady/);
  assert.match(heavy, /docker version/);
  assert.match(heavy, /docker desktop start/);
  assert.match(heavy, /Docker Desktop\.exe/);
  assert.match(heavy, /for \(\$attempt = 0; \$attempt -lt 60; \$attempt \+= 1\)/);
  assert.match(heavy, /Start-Sleep -Seconds 2/);
  assert.match(heavy, /if \(-not \(Test-MolehillDockerReady\)\) \{ throw 'Docker is unavailable\.' \}/);
  assert.doesNotMatch(heavy, /Stop-Process|Stop-Service|Restart-Service|taskkill|TerminateProcess/);

  assert.match(workflow, /Host recovery remains outside the protected controller/);
  assert.doesNotMatch(workflow, /docker desktop start|Docker Desktop\.exe|Start-Process|Start-Service|Stop-Process|Stop-Service/);
});

test('Docker readiness probes do not become terminating PowerShell errors under fail-closed admission', () => {
  const heavyStart = legacyTransition.indexOf('  legacy-qualification:\n');
  const bootstrapStart = legacyTransition.indexOf('  protected-census-bootstrap:\n');
  assert.notEqual(heavyStart, -1, 'missing legacy-qualification');
  assert.notEqual(bootstrapStart, -1, 'missing protected-census-bootstrap');
  const heavy = legacyTransition.slice(heavyStart, bootstrapStart);

  assert.match(heavy, /cmd\.exe \/d \/c "docker version >NUL 2>NUL"/);
  assert.match(heavy, /cmd\.exe \/d \/c "docker desktop start >NUL 2>NUL"/);
  assert.doesNotMatch(heavy, /docker version \*> \$null/);
  assert.doesNotMatch(heavy, /docker desktop start \*> \$null/);
});
