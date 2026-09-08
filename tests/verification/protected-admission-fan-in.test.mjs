import assert from 'node:assert/strict';
import test from 'node:test';
import {bindExecutionArtifacts} from './helpers/execution-proof-fixture.mjs';
import {sealExecutionContract,evaluateFanIn} from '../../tools/verification/verification-execution-contract.mjs';
const sha=c=>c.repeat(40),digest=c=>`sha256:${c.repeat(64)}`;
function fixture(event='pull_request_target'){
 const identity={repository:'Oteryn/Oteryn-Atlas',headSha:sha('a'),protectedBaseSha:sha('b'),treeSha:sha('e'),candidateDigest:digest('f'),environmentDigest:'9'.repeat(64),planDigest:digest('c'),policyDigest:digest('d')};
 const producerPolicy={repositoryId:1337995824,workflowPath:'.github/workflows/product-verification.yml',jobName:'proof',event};
 const commands=['e','f'].map((c,i)=>({id:digest(c),argv:['node','--test',`tests/proof-${i}.mjs`],expectedTestIds:[`proof-${i}`],timeoutSeconds:10}));
 const contract=sealExecutionContract({schemaVersion:1,identity,producerPolicy,maxEvidenceAgeMs:60000,retries:0,commands,groups:[{id:'deterministic.example',commandIds:commands.map(c=>c.id)}],reviews:[]});
 const producers=Object.fromEntries(commands.map((command,i)=>[command.id,{...producerPolicy,repository:identity.repository,headSha:identity.headSha,baseSha:identity.protectedBaseSha,sourceSha:identity.protectedBaseSha,sourceRef:'refs/heads/main',headRepositoryId:producerPolicy.repositoryId,baseRepositoryId:producerPolicy.repositoryId,runId:12,jobId:13+i,runAttempt:1,status:'completed',conclusion:'success',artifactDigest:digest(String(i))}]));
 const evidence=commands.map((command,i)=>({commandId:command.id,identity,contractDigest:contract.contractDigest,status:'passed',exitCode:0,attempt:1,logDigest:digest('1'),tests:[{id:`proof-${i}`,status:'passed',attempt:1}],startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:00:05Z',producer:{runId:12,jobId:13+i,artifactDigest:digest(String(i))},captures:[]}));
 return bindExecutionArtifacts({contract,evidence,producers,now:'2026-09-07T00:00:10Z'});
}

test('PR and Merge Queue use the same complete evidence contract bound to their own protected producer event',()=>{
 for(const event of ['pull_request_target','merge_group']){
  const f=fixture(event);assert.equal(evaluateFanIn(f).status,'PASS');
  const missing=evaluateFanIn({...f,evidence:[]});assert.equal(missing.status,'BLOCKED');assert.equal(missing.missingCommands.length,2);
  f.producers[digest('e')]={...f.producers[digest('e')],event:event==='merge_group'?'pull_request_target':'merge_group'};assert.throws(()=>evaluateFanIn(f),/producer/);
 }
});
test('admission rejects repository source workflow job base and artifact association substitution',()=>{
 for(const [key,value]of Object.entries({repository:'Other/Atlas',headSha:sha('f'),baseSha:sha('f'),sourceSha:sha('f'),sourceRef:'refs/heads/candidate',repositoryId:99,headRepositoryId:99,baseRepositoryId:99,workflowPath:'.github/workflows/candidate.yml',jobName:'untrusted',artifactDigest:digest('f'),runId:99,jobId:99})){
  const f=fixture();f.producers[digest('e')]={...f.producers[digest('e')],[key]:value};assert.throws(()=>evaluateFanIn(f),key);
 }
});
