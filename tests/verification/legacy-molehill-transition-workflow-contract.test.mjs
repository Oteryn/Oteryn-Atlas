import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');

test('legacy atlas-local-e2e transition qualifier is bounded, exact-head and repository-approved-runner only', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'legacy transition workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /feat\/issue-179-legacy-transition-qualifier/);
  assert.match(workflow, /feat\/issue-179-protected-controller-v2-promotion/);
  assert.match(workflow, /fix\/issue-179-protected-census-readonly-mount/);
  assert.match(workflow, /group:\s*atlas-runners/);
  assert.match(workflow, /labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /shell:\s*powershell/);
  assert.match(workflow, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /\\e2e\\run\.ps1/);
  assert.match(workflow, /ATLAS_E2E_WORKERS:\s*'1'/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /publish-local-e2e-status\.ps1/);
  assert.match(workflow, /visual-review\.json/);
  assert.match(workflow, /atlas-local-e2e/);
  assert.doesNotMatch(workflow, /^\s*\.\\e2e\\approve-visual-user-acceptance\.ps1\b/m, 'workflow must never auto-approve visual evidence');
  assert.doesNotMatch(workflow, /user-visual-evidence[\s\S]{0,500}upload-artifact|upload-artifact[\s\S]{0,500}user-visual-evidence/, 'full-frame visual evidence must remain in the trusted local acceptance directory');
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.doesNotMatch(workflow, /retries?\s*[:=]\s*[1-9]/i);
  assert.doesNotMatch(workflow, /synology/i);
});

test('PowerShell PR-head fences write JSON as UTF-8 without BOM before Node parses it', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /\[Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.doesNotMatch(workflow, /gh api[^\r\n]*>\s*artifacts-current-pr(?:-after)?\.json/);
});

test('PowerShell transition steps never embed Bash heredoc redirection', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /<<\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/, 'PowerShell cannot parse Bash heredoc redirection');
});

test('PowerShell transition planner uses the exported stable-ID parser instead of its POSIX-only CLI guard', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.doesNotMatch(workflow, /node\s+\.\.\\trusted-base\\tools\\verification\\parse-playwright-test-list\.mjs\s+`/);
  assert.match(workflow, /parsePlaywrightStableTestIds/);
});
