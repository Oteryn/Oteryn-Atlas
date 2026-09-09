import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildVerificationPlan} from '../../tools/verification/build-verification-plan.mjs';

const read=p=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${p}`,import.meta.url),'utf8'));
const catalog=read('verification-catalog.json'),impact=read('impact-manifest.json');
const input=()=>({
  repository:'Oteryn/Oteryn-Atlas',
  headSha:'a'.repeat(40),
  integrationBaseSha:'b'.repeat(40),
  mergeBaseSha:'c'.repeat(40),
  changedFiles:[{path:'tests/verification/example.test.mjs'}],
  trustedImpactManifest:impact,
  candidateImpactManifest:impact,
  trustedVerificationCatalog:catalog,
  candidateVerificationCatalog:catalog,
});

test('unknown executable impact retains the complete protected safety-net floor and exact revision',()=>{
  const plan=buildVerificationPlan({...input(),changedFiles:[{path:'unknown-runtime.mjs'}]});
  assert.equal(plan.profile,'full');
  assert.deepEqual(
    plan.requiredGroupIds,
    Object.entries(catalog.groups)
      .filter(([,group])=>group.executionRole!=='aggregate'&&(group.fullSafetyNet||group.executionRole==='canonical-review'))
      .map(([id])=>id)
      .sort(),
  );
  assert.equal(plan.headSha,'a'.repeat(40));
  assert.equal(plan.integrationBaseSha,'b'.repeat(40));
  assert.equal(plan.retryPolicy.retries,0);
});
