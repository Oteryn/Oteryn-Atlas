import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');

const workflow = read('.github/workflows/protected-execution-promotion-qualification.yml');
const compose = read('e2e/compose.protected-hosted-executor.yml');
const job = workflow.split('  qualification-functional-fixture:')[1]?.split('  candidate-modification-overlay:')[0] ?? '';
const browserStep = job.split('      - name: Prove complete protected qualification functional safety net in Chromium')[1]
  ?.split('      - name: Fence exact head and publish functional qualification compatibility status')[0] ?? '';

test('functional transition supplies every semantic identity required by protected hosted Compose', () => {
  const required = [...compose.matchAll(/\$\{(ATLAS_(?:PLAN_SEMANTIC_DIGEST|PLAN_INSTANCE_DIGEST|AUTHORITY_DIGEST|ENVIRONMENT_DIGEST)):\?/g)]
    .map((match) => match[1]);
  assert.deepEqual([...new Set(required)].sort(), [
    'ATLAS_AUTHORITY_DIGEST',
    'ATLAS_ENVIRONMENT_DIGEST',
    'ATLAS_PLAN_INSTANCE_DIGEST',
    'ATLAS_PLAN_SEMANTIC_DIGEST',
  ]);
  for (const name of required) {
    assert.match(browserStep, new RegExp(`export ${name}=`), `${name} must be exported before Compose interpolation`);
  }
  assert.match(browserStep, /verification-authority-identity\.json/);
  assert.match(browserStep, /protected-execution-environment-identity\.json/);
  assert.match(browserStep, /transition-semantic-identity\.json/);
  assert.match(browserStep, /transition-instance-identity\.json/);
});

test('transition semantic identities are derived from exact protected and candidate evidence, not placeholders', () => {
  assert.match(browserStep, /buildVerificationAuthorityIdentity/);
  assert.match(browserStep, /buildProtectedExecutionEnvironmentIdentity/);
  assert.match(browserStep, /ATLAS_CODE_REVISION/);
  assert.match(browserStep, /ATLAS_BASE_SHA/);
  assert.match(browserStep, /qualification_fixture/);
  assert.doesNotMatch(browserStep, /ATLAS_(?:PLAN_SEMANTIC_DIGEST|PLAN_INSTANCE_DIGEST|AUTHORITY_DIGEST|ENVIRONMENT_DIGEST)=['"]?sha256:0{64}/);
});
