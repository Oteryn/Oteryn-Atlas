import assert from 'node:assert/strict';
import test from 'node:test';
import { readCandidateSnapshot } from '../../tools/verification/protected-candidate-snapshot.mjs';
const repository='Example/Atlas', baseSha='a'.repeat(40), headSha='b'.repeat(40);
function fixture() {
  const pages=[Array.from({length:100},(_,i)=>({filename:`src/${i}.mjs`,status:'modified'})),[{filename:'src/new.mjs',previous_filename:'src/old.mjs',status:'renamed'}]];
  const pr={number:7,state:'open',merged:false,changed_files:101,head:{sha:headSha,repo:{full_name:repository}},base:{sha:baseSha,ref:'main',repo:{full_name:repository}}};
  const calls=[];
  const input={repository,baseSha,headSha,prNumber:7,request:async endpoint=>{
    calls.push(endpoint);
    if(endpoint.endsWith('/Example/Atlas')) return {full_name:repository,default_branch:'main'};
    if(endpoint.includes('/git/ref/')) return {object:{sha:baseSha}};
    if(endpoint.includes('/files?')) return pages[Number(new URL(endpoint,'https://example.invalid').searchParams.get('page'))-1];
    if(endpoint.endsWith('/pulls/7')) return pr;
    if(endpoint.includes('/git/commits/')) return {sha:headSha,tree:{sha:'c'.repeat(40)}};
    throw Error(endpoint);
  }};
  return {input,pages,pr,calls};
}
test('qualification file census reads every page and preserves rename-source identity',async()=>{
  const f=fixture(), snapshot=await readCandidateSnapshot(f.input);
  assert.equal(snapshot.changedFiles.length,101);
  assert.deepEqual(snapshot.changedFiles.find(f=>f.status==='renamed'),{path:'src/new.mjs',previousPath:'src/old.mjs',status:'renamed'});
  assert.equal(f.calls.filter(p=>p.includes('/files?')).length,2);
});
test('qualification file census rejects missing pages and live count disagreement',async()=>{
  const f=fixture(); f.pages[1]=[];
  await assert.rejects(readCandidateSnapshot(f.input),/count/);
  f.pages[1]={}; await assert.rejects(readCandidateSnapshot(f.input),/enumeration/);
  const truncated=fixture();truncated.pages=undefined;
  const request=truncated.input.request;
  truncated.input.request=endpoint=>endpoint.includes('/files?')?Promise.resolve(f.pages[0]):request(endpoint);
  await assert.rejects(readCandidateSnapshot(truncated.input),/truncated/);
});
