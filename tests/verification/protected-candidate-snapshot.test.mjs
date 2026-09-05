import test from 'node:test';
import assert from 'node:assert/strict';
import { readCandidateSnapshot } from '../../tools/verification/protected-candidate-snapshot.mjs';
const repository='Example/Atlas',baseSha='a'.repeat(40),headSha='b'.repeat(40),treeSha='c'.repeat(40),prNumber=7;
function fixture() {
  const prefix=`/repos/${repository}`;
  const responses={
    [prefix]:{full_name:repository,default_branch:'stable/next'},
    [`${prefix}/git/ref/heads/stable%2Fnext`]:{object:{sha:baseSha}},
    [`${prefix}/pulls/7`]:{number:7,state:'open',merged:false,changed_files:1,head:{sha:headSha,repo:{full_name:repository}},base:{sha:baseSha,ref:'stable/next',repo:{full_name:repository}}},
    [`${prefix}/pulls/7/files?per_page=100&page=1`]:[{filename:'src/example.mjs',status:'modified'}],
    [`${prefix}/git/commits/${headSha}`]:{sha:headSha,tree:{sha:treeSha}},
  };
  const calls=[];
  return {responses,calls,input:{repository,baseSha,headSha,prNumber,request:async endpoint=>{calls.push(endpoint);assert.ok(Object.hasOwn(responses,endpoint),endpoint);return structuredClone(responses[endpoint]);}}};
}
test('exact candidate uses current repository default branch, PR association and API file set',async()=>{
  const f=fixture();
  assert.deepEqual(await readCandidateSnapshot({...f.input,changedFiles:[{path:'forged',status:'added'}]}),{repository,prNumber,baseSha,headSha,treeSha,changedFiles:[{path:'src/example.mjs',status:'modified'}]});
  assert.ok(f.calls.includes(`/repos/${repository}/git/ref/heads/stable%2Fnext`));
});
for(const [name,mutate] of Object.entries({
  repository:f=>f.responses[`/repos/${repository}`].full_name='Other/Atlas',
  base:f=>f.responses[`/repos/${repository}/git/ref/heads/stable%2Fnext`].object.sha='d'.repeat(40),
  PR:f=>f.responses[`/repos/${repository}/pulls/7`].number=8,
  head:f=>f.responses[`/repos/${repository}/pulls/7`].head.sha='d'.repeat(40),
  PRbase:f=>f.responses[`/repos/${repository}/pulls/7`].base.sha='d'.repeat(40),
  headRepository:f=>f.responses[`/repos/${repository}/pulls/7`].head.repo.full_name='Other/Atlas',
  baseRepository:f=>f.responses[`/repos/${repository}/pulls/7`].base.repo.full_name='Other/Atlas',
  defaultBranch:f=>f.responses[`/repos/${repository}/pulls/7`].base.ref='main',
  closed:f=>f.responses[`/repos/${repository}/pulls/7`].state='closed',
  merged:f=>f.responses[`/repos/${repository}/pulls/7`].merged=true,
  count:f=>f.responses[`/repos/${repository}/pulls/7`].changed_files=2,
  fileEnumeration:f=>f.responses[`/repos/${repository}/pulls/7/files?per_page=100&page=1`]={},
  commit:f=>f.responses[`/repos/${repository}/git/commits/${headSha}`].sha='d'.repeat(40),
  tree:f=>f.responses[`/repos/${repository}/git/commits/${headSha}`].tree.sha='invalid',
}))test(`snapshot rejects ${name} drift`,async()=>{const f=fixture();mutate(f);await assert.rejects(readCandidateSnapshot(f.input));});
test('snapshot exhausts paginated files and rejects truncation rather than accepting partial evidence',async()=>{
  const f=fixture(),prefix=`/repos/${repository}/pulls/7/files?per_page=100&page=`;
  f.responses[prefix+'1']=Array.from({length:100},(_,i)=>({filename:`src/${i}.mjs`,status:'modified'}));
  f.responses[prefix+'2']=[{filename:'src/final.mjs',status:'added'}];
  f.responses[`/repos/${repository}/pulls/7`].changed_files=101;
  assert.equal((await readCandidateSnapshot(f.input)).changedFiles.length,101);
  const trunc=fixture();trunc.input.request=async endpoint=>endpoint.includes('/files?')?f.responses[prefix+'1']:trunc.responses[endpoint];
  await assert.rejects(readCandidateSnapshot(trunc.input),/truncated/);
});
test('merge-group snapshot requires explicit complete files and binds exact synthetic tree',async()=>{
  const f=fixture();const input={...f.input,prNumber:null,changedFiles:[{path:'web/a.js',status:'modified'}]};
  assert.equal((await readCandidateSnapshot(input)).treeSha,treeSha);
  assert.ok(!f.calls.some(endpoint=>endpoint.includes('/pulls/')));
  await assert.rejects(readCandidateSnapshot({...input,changedFiles:[]}),/complete changed files/);
});
