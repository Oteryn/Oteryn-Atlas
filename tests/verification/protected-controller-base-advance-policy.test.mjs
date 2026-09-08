import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildVerificationPlan} from '../../tools/verification/build-verification-plan.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${p}`,import.meta.url),'utf8'));
const catalog=read('verification-catalog.json'),impact=read('impact-manifest.json');
const input=()=>({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'tests/verification/example.test.mjs'}],trustedImpactManifest:impact,candidateImpactManifest:impact,trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog});

test('base-advance planning rejects absent candidate policy instead of guessing inherited bytes',()=>{
 assert.equal(buildVerificationPlan(input()).profile,'focused');
 for(const field of ['trustedImpactManifest','candidateImpactManifest','trustedVerificationCatalog','candidateVerificationCatalog']){
  const missing=input();delete missing[field];assert.throws(()=>buildVerificationPlan(missing),field);
 }
});
test('candidate narrowing cannot erase the protected plan required groups',()=>{
 const trusted=buildVerificationPlan(input());
 const narrowed=structuredClone(impact);
 for(const entry of narrowed.entries){entry.requiredGroups=[];entry.minimumProfile='none';}
 const candidate=buildVerificationPlan({...input(),candidateImpactManifest:narrowed});
 for(const id of trusted.requiredGroupIds)assert.ok(candidate.requiredGroupIds.includes(id),id);
});
