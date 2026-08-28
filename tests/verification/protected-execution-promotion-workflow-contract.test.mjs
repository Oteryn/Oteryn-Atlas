import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-execution-promotion-qualification.yml');
const legacyWorkflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');

test('protected execution promotion qualification is GitHub-hosted, exact-head, and never Molehill full E2E', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'promotion qualification workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-protected-execution-contract-promotion/);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-execution-contract-promotion/);
  assert.match(workflow, /fix\/issue-179-bounded-real-row-framing/);
  assert.doesNotMatch(heavy, /fix\/issue-179-bounded-real-row-framing/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /\.github\/workflows\/protected-execution-promotion-qualification\.yml/);
  assert.match(workflow, /tests\/verification\/protected-execution-promotion-workflow-contract\.test\.mjs/);
  assert.match(workflow, /tests\/verification\/protected-hosted-execution\.test\.mjs/);
  assert.match(workflow, /tools\/verification\/protected-hosted-execution\.mjs/);
  assert.match(workflow, /resolveProtectedPromotionQualification/);
  assert.match(workflow, /tests\/verification\/bounded-real-world\.test\.mjs/);
  assert.match(workflow, /tests\/verification\/protected-hosted-product-identities\.test\.mjs/);
  assert.match(workflow, /protected-hosted-product-identities\.json/);
  assert.match(workflow, /buildBoundedRealWorld/);
  assert.match(workflow, /expectedProductDigest/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /node --test tests\/verification\/protected-hosted-execution\.test\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /playwright test|\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json|synology/i);
});

test('protected execution promotion preauthorizes the qualification trust-descriptor repair on exact GitHub-hosted evidence', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /fix\/issue-179-qualification-trust-descriptor/);
  assert.doesNotMatch(heavy, /fix\/issue-179-qualification-trust-descriptor/);
  assert.match(workflow, /qualificationTrustDescriptor/);
  assert.match(workflow, /buildQualificationWorld/);
  assert.match(workflow, /resolveFullWorldTrust/);
  assert.match(workflow, /tests\/verification\/qualification-world\.test\.mjs/);
  assert.match(workflow, /tests\/verification\/protected-hosted-compose-promotion\.test\.mjs/);
  assert.match(workflow, /tools\/verification\/qualification-world\.mjs/);
});
