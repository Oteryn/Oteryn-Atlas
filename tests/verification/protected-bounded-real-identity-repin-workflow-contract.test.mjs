import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-bounded-real-identity-repin.yml');
const legacyWorkflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');
const EXPECTED_DIGEST = 'sha256:4b3d3a81c8b0d1d2980f2eafc97d208e404b9b8e23f3de3d8f087f270f2e330e';

test('bounded-real identity repin is exact GitHub-hosted deterministic proof and never Molehill browser E2E', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'bounded-real repin workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-bounded-real-identity-repin/);
  assert.doesNotMatch(heavy, /fix\/issue-179-bounded-real-identity-repin/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /Require exact five-file repin delta/);
  assert.match(workflow, /protected-bounded-real-product-identity\.test\.mjs/);
  assert.match(workflow, /protected-hosted-product-identities\.test\.mjs/);
  assert.match(workflow, /bounded-real-world\.test\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, new RegExp(EXPECTED_DIGEST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /playwright test|\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json|synology/i);
});
