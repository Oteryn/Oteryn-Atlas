import assert from 'node:assert/strict';
import test from 'node:test';
import {readCandidateSnapshot} from '../../tools/verification/protected-candidate-snapshot.mjs';
import {assertCandidateReadback,classifyProductEvent} from '../../tools/verification/verification-execution-contract.mjs';
const repository='Oteryn/Oteryn-Atlas',head='a'.repeat(40),base='b'.repeat(40);
function fixture(){
 const pr={number:7,state:'open',merged:false,changed_files:1,head:{sha:head,repo:{full_name:repository}},base:{sha:base,ref:'main',repo:{full_name:repository}}};
 const state={pr,finalPr:structuredClone(pr),rows:[{filename:'README.md',status:'modified'}],final:false};
 const input={repository,headSha:head,baseSha:base,prNumber:7,request:async endpoint=>{
  if(endpoint===`/repos/${repository}`)return {full_name:repository,default_branch:'main'};
  if(endpoint.includes('/git/ref/'))return {object:{sha:base}};
  if(endpoint.includes('/files?'))return state.rows;
  if(endpoint.endsWith('/pulls/7'))return state.final?state.finalPr:state.pr;
  if(endpoint.includes('/git/commits/'))return {sha:head,tree:{sha:'c'.repeat(40)}};
  throw Error(endpoint);
 }};
 return {state,input,async classify(){const planned=await readCandidateSnapshot(input);state.final=true;const current=await readCandidateSnapshot(input);return assertCandidateReadback({planned,current,sourceRepository:repository,sourceRef:'refs/heads/main',sourceRevision:base});}};
}
test('review payload without changed_files uses live metadata and never dispatches product work',async()=>{
 const f=fixture(),reviewEvent={action:'submitted',pull_request:structuredClone(f.state.pr)};delete reviewEvent.pull_request.changed_files;
 assert.equal(reviewEvent.pull_request.changed_files,undefined);
 assert.equal(classifyProductEvent({eventName:'pull_request_review',action:reviewEvent.action}),'authority-only');
 assert.equal(await f.classify(),true);
});
for(const [name,mutate]of Object.entries({
 'wrong live head':s=>s.pr.head.sha='d'.repeat(40),
 'wrong live base':s=>s.pr.base.sha='d'.repeat(40),
 'wrong repository':s=>s.pr.head.repo.full_name='Other/Atlas',
 'wrong PR':s=>s.pr.number=8,
 'closed PR':s=>s.pr.state='closed',
 'incomplete changed-file count':s=>s.pr.changed_files=2,
 'invalid changed-file count':s=>s.pr.changed_files=null,
 'head drift before publication':s=>s.finalPr.head.sha='d'.repeat(40),
 'base drift before publication':s=>s.finalPr.base.sha='d'.repeat(40),
 'count drift before publication':s=>s.finalPr.changed_files=2,
}))test(`live review classifier rejects ${name}`,async()=>{const f=fixture();mutate(f.state);await assert.rejects(f.classify());});
