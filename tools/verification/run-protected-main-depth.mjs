import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {githubRequest} from './protected-candidate-snapshot.mjs';
import {executeProtectedCandidateProof,assertSameCandidate} from './run-protected-admission.mjs';
const fail=message=>{throw new TypeError(`protected main depth: ${message}`);};
export function validateMainDepthIdentity({env,repo,ref,headSha,treeSha,dirty}) {
 if(!['schedule','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME))fail('event');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY??'')||repo.full_name!==env.GITHUB_REPOSITORY)fail('repository');
 if(typeof repo.default_branch!=='string'||env.GITHUB_REF!==`refs/heads/${repo.default_branch}`)fail('protected default branch');
 if(!/^[a-f0-9]{40}$/.test(headSha??'')||headSha!==env.GITHUB_SHA||headSha!==ref.object?.sha||!/^[a-f0-9]{40}$/.test(treeSha??'')||dirty!==false)fail('revision or execution bytes');
 if(!/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID??'')||env.GITHUB_RUN_ATTEMPT!=='1'||env.GITHUB_JOB!=='protected-depth')fail('producer');
 return {repository:repo.full_name,prNumber:null,headSha,baseSha:headSha,treeSha,changedFiles:[]};
}
async function main(root,outputRoot) {
 root=path.resolve(root);outputRoot=path.resolve(outputRoot);
 const git=(...args)=>execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8'}).trim();
 const snapshot=async()=>{
  const repo=await githubRequest(`/repos/${process.env.GITHUB_REPOSITORY}`);
  const ref=await githubRequest(`/repos/${process.env.GITHUB_REPOSITORY}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  return validateMainDepthIdentity({env:process.env,repo,ref,headSha:git('rev-parse','HEAD'),treeSha:git('rev-parse','HEAD^{tree}'),dirty:git('status','--porcelain','--untracked-files=no')!==''});
 };
 const candidate=await snapshot();
 const proof=await executeProtectedCandidateProof({protectedRoot:root,candidateRoot:root,outputRoot,candidate,admission:{eligible:true,forceFull:false},proofPurpose:'depth'});
 assertSameCandidate(candidate,await snapshot());
 if(proof.plan?.proofPurpose!=='depth'||proof.plan?.evidenceKind!=='protected-main-depth-v1')fail('wrong evidence purpose');
 const producer={workflow:'.github/workflows/protected-main-depth.yml',runId:Number(process.env.GITHUB_RUN_ID),attempt:1,job:'protected-depth'};
 fs.writeFileSync(path.join(outputRoot,'protected-main-depth.json'),JSON.stringify({candidate,producer,proof},null,2)+'\n',{flag:'wx'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length!==4)fail('root and output required');
 await main(...process.argv.slice(2));
}
