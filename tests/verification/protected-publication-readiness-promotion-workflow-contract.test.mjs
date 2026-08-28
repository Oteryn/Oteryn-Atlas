import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-publication-readiness-promotion.yml');
const legacyWorkflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');

test('protected publication readiness promotion is bounded GitHub-hosted proof and never Molehill E2E', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'protected publication readiness promotion workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-protected-publication-readiness-promotion/);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-publication-readiness-promotion/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /Require exact four-file readiness promotion delta/);
  assert.match(workflow, /publication-readiness\.test\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /playwright test|\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json|synology/i);
});
