import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const impactManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/impact-manifest.json'), 'utf8'));
const verificationCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));

function planFor(pathname) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: pathname }],
    trustedImpactManifest: impactManifest,
    candidateImpactManifest: impactManifest,
    trustedVerificationCatalog: verificationCatalog,
    candidateVerificationCatalog: verificationCatalog,
  });
}

function classify(paths) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools/verification/classify-pr-changes.mjs')], {
    cwd: ROOT,
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map((line) => line.split('=')));
}

test('Issue #314 bootstrap: root AGENTS is instruction-only and does not recurse into browser qualification', () => {
  assert.deepEqual(classify(['AGENTS.md']), { docs_only: 'true', requires_e2e: 'false' });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.profile, 'none');
  assert.deepEqual(plan.requiredGroupIds, []);
});

test('Issue #314 bootstrap: pure verification regressions remain deterministic-only', () => {
  const plan = planFor('tests/verification/example-regression.test.mjs');
  assert.equal(plan.profile, 'focused');
  assert.deepEqual(plan.requiredGroupIds, ['deterministic.core']);
  assert.deepEqual(plan.requiredDataCapabilities, ['qualification_fixture']);
});

test('Issue #314 bootstrap: generic repair is exact-scope and branch agnostic', async () => {
  const {validateQualificationRepairTransition}=await import('../../tools/verification/qualification-repair-policy.mjs');
  const plan={profile:'full',requiredGroupIds:['deterministic.core','e2e.full'],requiredDataCapabilities:['qualification_fixture'],retryPolicy:{retries:0}};
  const input={changedPaths:['src/browser/fullworld-trust.mjs'],protectedPlan:plan,candidatePlan:plan};
  const admitted=validateQualificationRepairTransition(input);
  assert.equal(admitted.eligible,true);
  assert.equal(admitted.browserProof.workers,1);
  assert.equal(admitted.browserProof.retries,0);
  assert.equal(Object.hasOwn(admitted,'branch'),false);
  for(const changedPaths of [['.github/workflows/injected.yml'],['src/browser/../escape.mjs'],[]])
    assert.throws(()=>validateQualificationRepairTransition({...input,changedPaths}));
});

test('Issue #314 bootstrap: creature authority rejects incomplete, mixed and mismatched source forms', async () => {
  const {validateCreaturePublicationSource}=await import('../../src/browser/creature-publication-source.mjs');
  const digest=`sha256:${'a'.repeat(64)}`;
  const expected={contractId:'protected-creatures',capability:'animated-creatures-v1',semanticDigest:digest,npcRoleSchemaVersion:1};
  const animation={appearance_product_root:digest,outfit_spatial_product_root:digest};
  const source={contract_id:expected.contractId,capability:expected.capability,semantic_digest:digest,npc_role_schema_version:1,...animation};
  assert.deepEqual(validateCreaturePublicationSource(source,animation,expected),source);
  for(const key of Object.keys(source)){const incomplete={...source};delete incomplete[key];assert.throws(()=>validateCreaturePublicationSource(incomplete,animation,expected),key);}
  assert.throws(()=>validateCreaturePublicationSource({...source,fixture_id:'candidate-fixture'},animation,expected),/fixture/);
  assert.throws(()=>validateCreaturePublicationSource(source,{...animation,appearance_product_root:`sha256:${'b'.repeat(64)}`},expected),/appearance/);
});
