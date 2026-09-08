import assert from 'node:assert/strict';
import test from 'node:test';
import {sealExecutionContract} from '../../tools/verification/verification-execution-contract.mjs';
const sha=c=>c.repeat(40),digest=c=>`sha256:${c.repeat(64)}`;
function fixture(){
 const identity={repository:'Oteryn/Oteryn-Atlas',headSha:sha('a'),protectedBaseSha:sha('b'),treeSha:sha('e'),candidateDigest:digest('f'),environmentDigest:'9'.repeat(64),planDigest:digest('c'),policyDigest:digest('d')};
 const commands=['e','f'].map((c,i)=>({id:digest(c),argv:['node','--test',`tests/proof-${i}.mjs`],expectedTestIds:[`proof-${i}`],timeoutSeconds:10}));
 return {schemaVersion:1,identity,commands,groups:[{id:'deterministic.example',commandIds:commands.map(c=>c.id)}],reviews:[]};
}
test('sealed semantic contract preserves exact candidate and command identity without an execution verdict',()=>{
 const input=fixture(),contract=sealExecutionContract(input);
 assert.deepEqual(contract.identity,input.identity);
 assert.deepEqual(contract.commands,input.commands);
 assert.deepEqual(sealExecutionContract(contract),contract);
 assert.equal(Object.hasOwn(contract,'status'),false);
 assert.ok(Object.isFrozen(contract.commands[0]));
 for(const key of ['headSha','protectedBaseSha','treeSha','candidateDigest','planDigest','policyDigest','environmentDigest']){
  const changed=fixture();changed.identity[key]=key.endsWith('Sha')?sha('1'):key==='environmentDigest'?'1'.repeat(64):digest('1');
  assert.notEqual(sealExecutionContract(changed).contractDigest,contract.contractDigest,key);
 }
});
test('command requirements cannot disappear through empty duplicate or unreferenced group mappings',()=>{
 for(const mutate of [
  f=>f.commands.push(f.commands[0]),
  f=>f.groups.push(f.groups[0]),
  f=>f.groups[0].commandIds=[],
  f=>f.groups[0].commandIds.push(digest('0')),
  f=>f.groups[0].commandIds.push(f.commands[0].id),
  f=>f.groups[0].commandIds.pop(),
  f=>f.commands[0].expectedTestIds=[],
  f=>f.commands[0].expectedTestIds.push(f.commands[0].expectedTestIds[0]),
 ]){const f=fixture();mutate(f);assert.throws(()=>sealExecutionContract(f),/contract/);}
});
