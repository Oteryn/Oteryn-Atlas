import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {gitChangedFiles} from '../../tools/verification/protected-candidate-snapshot.mjs';
import {assertCandidateReadback} from '../../tools/verification/verification-execution-contract.mjs';
import {candidateSandboxArgs} from '../../tools/verification/run-protected-admission.mjs';
test('controller cross-checks real git changed-file bytes before candidate proof',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-controller-diff-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
 fs.writeFileSync(path.join(root,'source.mjs'),'throw Error("candidate must stay inert");');git('add','.');git('commit','-qm','base');const baseSha=git('rev-parse','HEAD');
 fs.appendFileSync(path.join(root,'source.mjs'),'\n// changed');git('add','.');git('commit','-qm','candidate');const headSha=git('rev-parse','HEAD');
 const planned={repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha,baseSha,treeSha:git('rev-parse','HEAD^{tree}'),changedFiles:gitChangedFiles(root,baseSha,headSha)};
 assert.deepEqual(planned.changedFiles,[{path:'source.mjs',status:'modified'}]);
 const source={sourceRepository:planned.repository,sourceRef:'refs/heads/main',sourceRevision:baseSha};
 assert.equal(assertCandidateReadback({planned,current:planned,...source}),true);
 assert.throws(()=>assertCandidateReadback({planned,current:{...planned,changedFiles:[{path:'unreported.mjs',status:'modified'}]},...source}),/readback/);
});
test('controller sandbox keeps candidate and protected tests read-only with no credentials or external network',()=>{
 const args=candidateSandboxArgs({source:'/candidate-bytes',output:'/isolated-output',script:'/protected-script.mjs',protectedTests:'/protected-tests'});
 for(const value of ['--read-only','none','ALL','no-new-privileges','type=bind,src=/candidate-bytes,dst=/candidate,readonly','type=bind,src=/protected-tests,dst=/candidate/tests,readonly'])assert.ok(args.includes(value),value);
 assert.ok(!args.some(value=>/TOKEN|SECRET|docker.sock|--privileged/.test(value)));
});
