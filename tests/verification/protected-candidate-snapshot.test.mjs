import test from 'node:test';
import assert from 'node:assert/strict';
import { readCandidateSnapshot, resolveDirectMergeGroup } from '../../tools/verification/protected-candidate-snapshot.mjs';
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

test('completed MQ may read back exactly its just-integrated head but cannot widen PR or unrelated main',async()=>{
 const f=fixture();f.responses[`/repos/${repository}/git/ref/heads/stable%2Fnext`].object.sha=headSha;
 const input={...f.input,prNumber:null,changedFiles:[{path:'docs/a.md',status:'modified'}],allowJustIntegratedHead:true};
 assert.equal((await readCandidateSnapshot(input)).baseSha,baseSha);
 await assert.rejects(readCandidateSnapshot({...input,prNumber:7}),/scope/);
 await assert.rejects(readCandidateSnapshot({...input,allowJustIntegratedHead:false}),/base moved/);
 f.responses[`/repos/${repository}/git/ref/heads/stable%2Fnext`].object.sha='d'.repeat(40);
 await assert.rejects(readCandidateSnapshot(input),/base moved/);
});


const qrepo='Example/Atlas',qmain='1'.repeat(40),qfirst='2'.repeat(40),qsecond='3'.repeat(40),qhead='4'.repeat(40),qtree='5'.repeat(40);
function mergeGroupFixture({live=qmain,base=qmain,head=qhead,tree=qtree,refs=[]}={}) {
  const prefix=`/repos/${qrepo}`,headRef='refs/heads/gh-readonly-queue/main/pr-9-fixture',refEndpoint=`${prefix}/git/ref/heads/main`,matchEndpoint=`${prefix}/git/matching-refs/heads/gh-readonly-queue/main/`;
  const responses={
    [prefix]:{full_name:qrepo,default_branch:'main'},
    [refEndpoint]:{object:{sha:live}},
    [matchEndpoint]:refs,
    [`${prefix}/git/commits/${head}`]:{sha:head,tree:{sha:tree},parents:[{sha:base}]},
  };
  const event={repository:{full_name:qrepo,default_branch:'main'},action:'checks_requested',merge_group:{base_ref:'refs/heads/main',base_sha:base,head_ref:headRef,head_sha:head}};
  const request=async endpoint=>{assert.ok(Object.hasOwn(responses,endpoint),endpoint);const value=responses[endpoint];return structuredClone(typeof value==='function'?value():value);};
  return {responses,refEndpoint,matchEndpoint,headRef,event,input:{request,repository:qrepo,defaultBranch:'main',event,githubSha:head,githubRef:headRef}};
}

test('direct Merge Queue candidate remains bound directly to protected main',async()=>{
  const f=mergeGroupFixture();const result=await resolveDirectMergeGroup(f.input);
  assert.equal(result.baseSha,qmain);assert.equal(result.headSha,qhead);
});
test('chained Merge Queue base is accepted only through an active queue ref rooted at protected main',async()=>{
  const ref={ref:'refs/heads/gh-readonly-queue/main/pr-8-fixture',object:{type:'commit',sha:qfirst}};
  const f=mergeGroupFixture({base:qfirst,refs:[ref]});
  f.responses[`/repos/${qrepo}/git/commits/${qfirst}`]={sha:qfirst,tree:{sha:'6'.repeat(40)},parents:[{sha:qmain}]};
  const result=await resolveDirectMergeGroup(f.input);assert.equal(result.baseSha,qfirst);
  const snapshot=await readCandidateSnapshot({request:f.input.request,repository:qrepo,baseSha:qfirst,headSha:qhead,prNumber:null,headRef:f.headRef,changedFiles:[{path:'docs/a.md',status:'modified'}]});
  assert.equal(snapshot.baseSha,qfirst);assert.equal(snapshot.treeSha,qtree);
});
test('bounded multi-candidate queue chain resolves to protected main',async()=>{
  const refs=[qfirst,qsecond].map((sha,index)=>({ref:`refs/heads/gh-readonly-queue/main/pr-${7+index}-fixture`,object:{type:'commit',sha}}));
  const f=mergeGroupFixture({base:qsecond,refs});
  f.responses[`/repos/${qrepo}/git/commits/${qsecond}`]={sha:qsecond,tree:{sha:'7'.repeat(40)},parents:[{sha:qfirst}]};
  f.responses[`/repos/${qrepo}/git/commits/${qfirst}`]={sha:qfirst,tree:{sha:'6'.repeat(40)},parents:[{sha:qmain}]};
  assert.equal((await resolveDirectMergeGroup(f.input)).baseSha,qsecond);
});
test('unreferenced, cyclic and overlong queue ancestry fail closed',async()=>{
  const missing=mergeGroupFixture({base:qfirst,refs:[]});await assert.rejects(resolveDirectMergeGroup(missing.input),/queue ancestry/);
  const refs=[qfirst,qsecond].map((sha,index)=>({ref:`refs/heads/gh-readonly-queue/main/pr-${7+index}-fixture`,object:{type:'commit',sha}}));
  const cycle=mergeGroupFixture({base:qsecond,refs});cycle.responses[`/repos/${qrepo}/git/commits/${qsecond}`]={sha:qsecond,tree:{sha:'7'.repeat(40)},parents:[{sha:qfirst}]};cycle.responses[`/repos/${qrepo}/git/commits/${qfirst}`]={sha:qfirst,tree:{sha:'6'.repeat(40)},parents:[{sha:qsecond}]};await assert.rejects(resolveDirectMergeGroup(cycle.input),/queue ancestry/);
  const nodes='23456789a'.split('').map(c=>c.repeat(40)),long=mergeGroupFixture({base:nodes.at(-1),refs:nodes.map((sha,i)=>({ref:`refs/heads/gh-readonly-queue/main/pr-${i+1}-fixture`,object:{type:'commit',sha}}))});
  nodes.forEach((sha,i)=>{long.responses[`/repos/${qrepo}/git/commits/${sha}`]={sha,tree:{sha:'b'.repeat(40)},parents:[{sha:i?nodes[i-1]:qmain}]};});
  await assert.rejects(resolveDirectMergeGroup(long.input),/queue ancestry/);
});
test('protected main movement outside authenticated queue chain fails closed',async()=>{
  const ref={ref:'refs/heads/gh-readonly-queue/main/pr-8-fixture',object:{type:'commit',sha:qfirst}},f=mergeGroupFixture({base:qfirst,refs:[ref]});
  let reads=0;f.responses[f.refEndpoint]=()=>({object:{sha:++reads===1?qmain:'e'.repeat(40)}});
  f.responses[`/repos/${qrepo}/git/commits/${qfirst}`]={sha:qfirst,tree:{sha:'6'.repeat(40)},parents:[{sha:qmain}]};
  await assert.rejects(resolveDirectMergeGroup(f.input),/protected base moved/);
});
