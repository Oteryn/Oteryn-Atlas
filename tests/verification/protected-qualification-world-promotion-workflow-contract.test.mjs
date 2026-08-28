import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-qualification-world-promotion.yml');
const legacyWorkflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');

const EXPECTED_DIGEST = 'sha256:f53f1dcb8961c42e82191644b7628cfb4f30641344c8876f4178d37a94dd4cd5';

test('qualification-world promotion uses exact GitHub-hosted no-network proof and never Molehill full E2E', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'qualification-world promotion workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-protected-qualification-world-promotion/);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-qualification-world-promotion/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /Require exact five-file promotion delta/);
  assert.match(workflow, /tests\/verification\/qualification-world\.test\.mjs/);
  assert.match(workflow, /tools\/verification\/qualification-fixture-definition\.mjs/);
  assert.match(workflow, /tools\/verification\/qualification-world\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /node --test tests\/verification\/qualification-world\.test\.mjs/);
  assert.match(workflow, new RegExp(EXPECTED_DIGEST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /playwright test|\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json|synology/i);
});
