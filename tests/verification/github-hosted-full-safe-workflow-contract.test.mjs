import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('required browser lane executes the exact qualification-fixture full safety net on GitHub-hosted infrastructure', () => {
  assert.match(workflow, /name:\s*GitHub-hosted qualification Playwright evidence/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.match(workflow, /prepare-hosted-qualification\.mjs/);
  assert.match(workflow, /resolve-hosted-full-safe\.mjs/);
  assert.match(workflow, /e2e\/compose\.yml\s+-f\s+e2e\/compose\.github-hosted\.yml/);
  assert.match(workflow, /validate-hosted-full-safe-summary\.mjs/);
  assert.match(workflow, /ATLAS_E2E_WORKERS:\s*'1'/);
  assert.doesNotMatch(workflow, /atlas-local-e2e/);
  assert.doesNotMatch(workflow, /192\.168\.|synology|molehill/i);
});
