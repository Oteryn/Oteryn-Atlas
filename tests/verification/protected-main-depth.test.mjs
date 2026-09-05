import test from 'node:test';
import assert from 'node:assert/strict';
import * as depth from '../../tools/verification/run-protected-main-depth.mjs';
const sha='a'.repeat(40), tree='b'.repeat(40);
const env={GITHUB_EVENT_NAME:'schedule',GITHUB_REPOSITORY:'Example/Atlas',GITHUB_SHA:sha,GITHUB_REF:'refs/heads/stable',GITHUB_RUN_ID:'12',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'protected-depth'};
const repo={full_name:'Example/Atlas',default_branch:'stable'};
test('depth accepts only exact current protected default revision and real workflow identity',()=>{
 assert.equal(typeof depth.validateMainDepthIdentity,'function');
 assert.deepEqual(depth.validateMainDepthIdentity({env,repo,ref:{object:{sha}},headSha:sha,treeSha:tree,dirty:false}),{repository:'Example/Atlas',prNumber:null,headSha:sha,baseSha:sha,treeSha:tree,changedFiles:[]});
 for(const patch of [{GITHUB_EVENT_NAME:'pull_request_target'},{GITHUB_EVENT_NAME:'merge_group'},{GITHUB_REF:'refs/heads/other'},{GITHUB_SHA:'c'.repeat(40)},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ID:''}])assert.throws(()=>depth.validateMainDepthIdentity({env:{...env,...patch},repo,ref:{object:{sha}},headSha:sha,treeSha:tree,dirty:false}));
});
test('depth rejects repository base tree and execution byte drift',()=>{
 const input={env,repo,ref:{object:{sha}},headSha:sha,treeSha:tree,dirty:false};
 for(const patch of [{repo:{...repo,full_name:'Other/Atlas'}},{ref:{object:{sha:'c'.repeat(40)}}},{headSha:'c'.repeat(40)},{treeSha:'bad'},{dirty:true}])assert.throws(()=>depth.validateMainDepthIdentity({...input,...patch}));
});
