import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const impact = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'));
const creatures = fs.readFileSync(new URL('../../web/fullworld-creatures.mjs', import.meta.url), 'utf8');
const protectedController = fs.readFileSync(new URL('../../.github/workflows/protected-verification-controller.yml', import.meta.url), 'utf8');
const protectedExecutor = fs.readFileSync(new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url), 'utf8');
const candidateMaintenanceWorkflow = new URL('../../.github/workflows/candidate-maintenance-qualification.yml', import.meta.url);

function entry(pathPrefix) {
  const matches = impact.entries.filter((candidate) => candidate.pathPrefix === pathPrefix);
  assert.equal(matches.length, 1, `expected exactly one impact rule for ${pathPrefix}`);
  return matches[0];
}

test('pure verification tests are deterministic-only while executable verification authority stays full', () => {
  assert.deepEqual(entry('tests/verification/'), {
    pathPrefix: 'tests/verification/',
    domains: ['test-contract'],
    minimumProfile: 'focused',
    requiredGroups: ['deterministic.core'],
  });
  assert.deepEqual(entry('tools/verification/'), {
    pathPrefix: 'tools/verification/',
    domains: ['verification-governance'],
    minimumProfile: 'full',
    requiredGroups: ['deterministic.core', 'e2e.full'],
  });
  assert.deepEqual(entry('.github/workflows/'), {
    pathPrefix: '.github/workflows/',
    domains: ['verification-governance'],
    minimumProfile: 'full',
    requiredGroups: ['deterministic.core', 'e2e.full'],
  });
});

test('creature runtime derives source authority from active FullWorld trust', () => {
  assert.match(creatures, /ancillarySourceExpectations/);
  assert.match(creatures, /EXPECTED_CREATURE_SOURCE\s*=\s*ancillarySourceExpectations\(FULLWORLD_TRUST\)\.creatures/);
  assert.match(creatures, /index\.source\?\.contract_id\s*===\s*EXPECTED_CREATURE_SOURCE\.contractId/);
  assert.match(creatures, /index\.source\?\.capability\s*===\s*EXPECTED_CREATURE_SOURCE\.capability/);
  assert.match(creatures, /index\.source\?\.semantic_digest\s*===\s*EXPECTED_CREATURE_SOURCE\.semanticDigest/);
  assert.doesNotMatch(creatures, /const EXPECTED_CONTRACT\s*=/);
  assert.doesNotMatch(creatures, /const EXPECTED_CAPABILITY\s*=/);
  assert.doesNotMatch(creatures, /const EXPECTED_SEMANTIC_DIGEST\s*=/);
});

test('qualification proof authority stays protected and candidate test changes remain overlays', () => {
  assert.equal(fs.existsSync(candidateMaintenanceWorkflow), false, 'candidate-owned maintenance workflow must not be an authoritative qualification path');
  assert.match(protectedController, /pull_request_target:/, 'qualification planning must originate from protected workflow code');
  assert.match(protectedExecutor, /workflow_run:/, 'protected executor must consume protected controller output');
  assert.match(protectedExecutor, /rm -rf \"\$protected_context\/e2e\"/);
  assert.match(protectedExecutor, /cp -a protected-control\/e2e \"\$protected_context\/e2e\"/);
  assert.match(protectedExecutor, /candidate-modifications/, 'modified candidate tests must be tracked separately from protected assertions');
  assert.match(protectedExecutor, /candidate-additions/, 'candidate-added tests must be tracked separately from protected assertions');
});
