import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

test('shadow plan artifact carries the exact stable-ID census into browser execution', () => {
  assert.match(
    workflow,
    /name:\s+atlas-shadow-plan-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}[\s\S]*?path:\s+\|[\s\S]*?artifacts\/verification\/shadow-verification-plan\.json[\s\S]*?artifacts\/verification\/stable-test-ids\.json/,
  );
  assert.match(
    workflow,
    /uses:\s+actions\/download-artifact@[a-f0-9]{40}[\s\S]*?name:\s+atlas-shadow-plan-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}[\s\S]*?path:\s+artifacts\/verification/,
  );
});

test('browser validator is bound to the planned exact stable-ID set and plan digest', () => {
  assert.match(workflow, /ATLAS_SHADOW_PLAN_DIGEST:\s+\$\{\{ needs\.change-classification\.outputs\.shadow_plan_digest \}\}/);
  assert.match(
    workflow,
    /validate-shadow-plan-evidence\.mjs[\s\S]*?--plan\s+artifacts\/verification\/shadow-verification-plan\.json[\s\S]*?--expected-plan-digest\s+"\$ATLAS_SHADOW_PLAN_DIGEST"[\s\S]*?--head-sha\s+"\$ATLAS_CODE_REVISION"[\s\S]*?--stable-test-ids\s+artifacts\/verification\/stable-test-ids\.json/,
  );
  assert.match(
    workflow,
    /validate-github-hosted-e2e\.mjs[\s\S]*?--summary\s+"\$ATLAS_E2E_ARTIFACTS_HOST\/summary\.json"[\s\S]*?--head-sha\s+"\$ATLAS_CODE_REVISION"[\s\S]*?--workers\s+"\$ATLAS_E2E_WORKERS"[\s\S]*?--expected-stable-test-ids\s+artifacts\/verification\/stable-test-ids\.json/,
  );
});
