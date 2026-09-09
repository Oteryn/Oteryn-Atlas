import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {readCandidateSnapshot,resolveDirectMergeGroup} from '../../tools/verification/protected-candidate-snapshot.mjs';

const repository='Oteryn/Oteryn-Atlas',defaultBranch='main';
const sha=value=>value.repeat(40);
const base=sha('a'),head=sha('b'),tree=sha('c'),other=sha('d');
const headRef='refs/heads/gh-readonly-queue/main/pr-7-deadbeef';
function fixture(){
  const event={repository:{full_name:repository,default_branch:defaultBranch},action:'checks_requested',merge_group:{base_ref:'refs/heads/main',base_sha:base,head_ref:headRef,head_sha:head}};
  const responses={
    [`/repos/${repository}`]:{full_name:repository,default_branch:defaultBranch},
    [`/repos/${repository}/git/ref/heads/main`]:{object:{sha:base}},
    [`/repos/${repository}/git/commits/${head}`]:{sha:head,tree:{sha:tree},parents:[{sha:base},{sha:other}]},
  };
  return {event,responses,input:{repository,defaultBranch,event,githubSha:head,githubRef:headRef,request:async url=>{assert.ok(responses[url],url);return structuredClone(responses[url]);}}};
}

test('direct merge_group binds protected base, queue ref, exact head and candidate tree',async()=>{
  const f=fixture();
  assert.deepEqual(await resolveDirectMergeGroup(f.input),{repository,baseSha:base,headSha:head,treeSha:tree,headRef});
});

test('direct merge_group accepts only the exact just-integrated head after event creation',async()=>{
  const f=fixture();
  f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=head;
  assert.deepEqual(await resolveDirectMergeGroup(f.input),{repository,baseSha:base,headSha:head,treeSha:tree,headRef});
});

test('direct queue snapshot readback accepts exact integrated head but rejects unrelated main drift',async()=>{
  const f=fixture(),changedFiles=[{path:'docs/canary.md',status:'added'}];
  f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=head;
  const request=f.input.request;
  assert.deepEqual(await readCandidateSnapshot({request,repository,baseSha:base,headSha:head,prNumber:null,headRef,changedFiles}),
    {repository,prNumber:null,baseSha:base,headSha:head,treeSha:tree,changedFiles});
  f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=other;
  await assert.rejects(readCandidateSnapshot({request,repository,baseSha:base,headSha:head,prNumber:null,headRef,changedFiles}),/protected base moved/);
});

test('direct merge_group rejects stale base, wrong branch/action/head and synthetic topology',async()=>{
  const mutations=[
    f=>{f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=other;},
    f=>{f.event.merge_group.base_ref='refs/heads/other';},
    f=>{f.event.merge_group.head_ref='refs/heads/feature/forged';f.input.githubRef=f.event.merge_group.head_ref;},
    f=>{f.input.githubRef='refs/heads/gh-readonly-queue/main/pr-8-forged';},
    f=>{f.input.githubSha=other;},
    f=>{f.event.action='destroyed';},
    f=>{f.event.repository.default_branch='other';},
    f=>{f.event.repository.full_name='Other/Atlas';},
    f=>{f.responses[`/repos/${repository}/git/commits/${head}`].tree.sha='bad';},
    f=>{f.responses[`/repos/${repository}/git/commits/${head}`].parents=[];},
    f=>{f.responses[`/repos/${repository}/git/commits/${head}`].parents=[{sha:other}];},
  ];
  for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(resolveDirectMergeGroup(f.input));}
});

test('protected workflow uses direct merge_group only and keeps no-work-compatible conditional execute',()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const active=fs.readFileSync(`${root}/.github/workflows/verification-shadow.yml`,'utf8');
  const template=fs.readFileSync(`${root}/tools/maintenance/verification-shadow.yml`,'utf8');
  assert.equal(active,template);
  assert.match(active,/\n  merge_group:\n    types: \[checks_requested\]/);
  assert.doesNotMatch(active,/\n  workflow_run:/);
  assert.match(active,/github\.event\.merge_group\.base_sha/);
  assert.match(active,/github\.event\.merge_group\.head_sha/);
  assert.match(active,/if: needs\.plan\.outputs\.has_commands == 'true'/);
  assert.equal((active.match(/persist-credentials: false/g)??[]).length,4);
  assert.doesNotMatch(active,/statuses:\s*write|checks:\s*write/);
});
