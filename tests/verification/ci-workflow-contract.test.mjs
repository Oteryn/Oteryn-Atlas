import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildVerificationPlan} from '../../tools/verification/build-verification-plan.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${p}`,import.meta.url),'utf8'));
const catalog=read('verification-catalog.json'),impact=read('impact-manifest.json');
const input=()=>({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'tests/verification/example.test.mjs'}],trustedImpactManifest:impact,candidateImpactManifest:impact,trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog});

import {spawnSync} from 'node:child_process';
const classify=paths=>{
 const result=spawnSync(process.execPath,[new URL('../../tools/verification/classify-pr-changes.mjs',import.meta.url).pathname],{input:paths.join('\n')+'\n',encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return result.stdout;
};
test('docs-only classification removes browser work only for a complete instruction-only change set',()=>{
 assert.equal(classify(['docs/guide.md','AGENTS.md']),'docs_only=true\nrequires_e2e=false\n');
 for(const paths of [[],['docs/guide.md','web/fullworld-app.mjs'],['docs/../escape.md'],['README.md'],['docs/config.json']])assert.equal(classify(paths),'docs_only=false\nrequires_e2e=true\n');
 const plan=buildVerificationPlan({...input(),changedFiles:[{path:'docs/guide.md'}]});assert.equal(plan.profile,'none');assert.deepEqual(plan.requiredGroupIds,[]);
});
test('unknown executable impact retains the complete protected safety-net floor and exact revision',()=>{
 const plan=buildVerificationPlan({...input(),changedFiles:[{path:'unknown-runtime.mjs'}]});
 assert.equal(plan.profile,'full');
 assert.deepEqual(plan.requiredGroupIds,Object.entries(catalog.groups).filter(([,g])=>g.executionRole!=='aggregate'&&(g.fullSafetyNet||g.executionRole==='canonical-review')).map(([id])=>id).sort());
 assert.equal(plan.headSha,'a'.repeat(40));assert.equal(plan.integrationBaseSha,'b'.repeat(40));
 assert.equal(plan.retryPolicy.retries,0);
});
