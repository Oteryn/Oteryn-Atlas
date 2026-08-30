import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-product-promotion.yml'), 'utf8').replace(/\r\n/g, '\n');
const legacy = fs.readFileSync(path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml'), 'utf8').replace(/\r\n/g, '\n');

test('protected qualification product promotion is GitHub-hosted, exact-head, and never Molehill browser E2E', () => {
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';
  assert.match(workflow, /pull_request:\n\s+types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-protected-qualification-product-promotion/);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-qualification-product-promotion/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  for (const pathname of [
    '.github/workflows/protected-qualification-product-promotion.yml',
    'src/browser/semantic-search.mjs',
    'tests/verification/protected-qualification-product-promotion-workflow-contract.test.mjs',
    'tests/verification/qualification-semantic-source-trust.test.mjs',
    'tests/verification/qualification-world.test.mjs',
    'tools/verification/qualification-fixture-definition.mjs',
    'tools/verification/qualification-world.mjs',
  ]) assert.match(workflow, new RegExp(pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /node --test tests\/verification\/qualification-semantic-source-trust\.test\.mjs tests\/verification\/qualification-world\.test\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /playwright test|\\e2e\\run\.ps1|ATLAS_PUBLICATION_ORIGIN|visual-review\.json|synology/i);
});
