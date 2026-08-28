import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-hosted-compose-promotion.yml');
const legacyWorkflowPath = path.join(ROOT, '.github/workflows/legacy-molehill-transition-qualification.yml');

test('protected hosted compose promotion is bounded GitHub-hosted browser bootstrap and never Molehill E2E', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'protected hosted compose promotion workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const legacy = fs.readFileSync(legacyWorkflowPath, 'utf8');
  const heavy = legacy.split('  legacy-qualification:')[1]?.split('  protected-census-bootstrap:')[0] ?? '';

  assert.match(workflow, /pull_request:\s*\n\s*types:\s*\[labeled\]/);
  assert.match(workflow, /github\.event\.label\.name == 'atlas-legacy-transition-qualification'/);
  assert.match(workflow, /fix\/issue-179-protected-hosted-compose-promotion/);
  assert.doesNotMatch(heavy, /fix\/issue-179-protected-hosted-compose-promotion/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc/);
  assert.match(workflow, /Require exact six-file compose promotion delta/);
  assert.match(workflow, /protected-hosted-compose-promotion\.test\.mjs/);
  assert.match(workflow, /buildQualificationWorld/);
  assert.match(workflow, /qualificationTrustDescriptor/);
  assert.match(workflow, /ATLAS_EXECUTION_CONTEXT="\$PWD\/trusted-base"/);
  assert.match(workflow, /tests\/accessibility-desktop\.spec\.mjs/);
  assert.match(workflow, /--project=desktop-chromium/);
  assert.match(workflow, /--workers=1/);
  assert.match(workflow, /--retries=0/);
  assert.match(workflow, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.match(workflow, /docker compose[\s\S]*config -q/);
  assert.match(workflow, /compose run --no-deps --rm e2e/);
  assert.doesNotMatch(workflow, /compose run --rm e2e/);
  assert.match(workflow, /assert-current-pr-head\.mjs/);
  assert.match(workflow, /statuses:\s*write/);
  assert.match(workflow, /context='atlas-local-e2e'|context.*atlas-local-e2e/s);
  assert.doesNotMatch(workflow, /\\e2e\\run\.ps1|visual-review\.json|synology|molehill|--retries=[1-9]/i);
});