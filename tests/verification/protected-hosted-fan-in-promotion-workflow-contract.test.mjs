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

test('hosted fan-in requires every exact command and stable test once',()=>{
 const f=fixture();assert.equal(evaluateFanIn(f).status,'PASS');
 assert.deepEqual(evaluateFanIn({...f,evidence:f.evidence.slice(0,1)}).missingCommands,[digest('f')]);
 assert.throws(()=>evaluateFanIn({...f,evidence:[...f.evidence,f.evidence[0]]}),/duplicate/);
 for(const tests of [[],[{id:'unplanned',status:'passed',attempt:1}],[...f.evidence[0].tests,...f.evidence[0].tests]]){
  const changed=fixture();changed.evidence[0].tests=tests;assert.throws(()=>evaluateFanIn(changed),/census|artifact report/);
 }
});
test('hosted fan-in rejects skipped failed retried stale and over-budget evidence without fallback',()=>{
 for(const mutate of [f=>f.evidence[0].status='skipped',f=>f.evidence[0].exitCode=1,f=>f.evidence[0].attempt=2,f=>f.evidence[0].tests[0].status='skipped',f=>f.evidence[0].tests[0].attempt=2,f=>f.evidence[0].completedAt='2026-09-07T00:00:11Z',f=>f.now='2026-09-07T00:01:06Z',f=>f.producers[digest('e')]={...f.producers[digest('e')],conclusion:'failure'},f=>f.producers[digest('e')]={...f.producers[digest('e')],runAttempt:2}]){
  const f=fixture();mutate(f);assert.throws(()=>evaluateFanIn(f));
 }
});
