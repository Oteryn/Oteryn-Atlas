import assert from 'node:assert/strict';
import test from 'node:test';
import {sealExecutionContract} from '../../tools/verification/verification-execution-contract.mjs';
const digest=c=>`sha256:${c.repeat(64)}`;
function fixture(){
 const identity={repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),protectedBaseSha:'b'.repeat(40),treeSha:'e'.repeat(40),candidateDigest:digest('f'),environmentDigest:'9'.repeat(64),planDigest:digest('c'),policyDigest:digest('d')};
 const commands=[{id:digest('e'),argv:['node','test.mjs'],expectedTestIds:['scene'],timeoutSeconds:10}];
 const groups=[{id:'machine.scene',commandIds:[commands[0].id]},{id:'review.scene',commandIds:[commands[0].id]}];
 const reviews=[{groupId:'review.scene',commandIds:[commands[0].id],frames:[{frameId:'full-frame',stableTestId:'scene'}]}];
 return {schemaVersion:1,identity,commands,groups,reviews};
}
test('machine command mapping preserves independent review frame obligations',()=>{
 const f=fixture(),contract=sealExecutionContract(f);
 assert.deepEqual(contract.reviews,f.reviews);
 assert.equal(contract.commands.length,1);
 assert.equal(contract.groups.length,2);
 assert.equal(Object.hasOwn(contract.reviews[0],'approved'),false);
 const changed=fixture();changed.reviews[0].frames.push({frameId:'second-frame',stableTestId:'scene'});
 assert.notEqual(sealExecutionContract(changed).contractDigest,contract.contractDigest);
});
test('review requirements reject missing groups commands and ambiguous frame identity',()=>{
 for(const mutate of [
  f=>f.reviews[0].groupId='missing',
  f=>f.reviews.push(f.reviews[0]),
  f=>f.reviews[0].frames=[],
  f=>f.reviews[0].frames.push(f.reviews[0].frames[0]),
  f=>f.reviews[0].frames[0].stableTestId='',
  f=>f.reviews[0].commandIds=[],
  f=>f.reviews[0].commandIds=[digest('0')],
  f=>f.reviews[0].commandIds.push(f.commands[0].id),
 ]){const f=fixture();mutate(f);assert.throws(()=>sealExecutionContract(f),/contract/);}
});
