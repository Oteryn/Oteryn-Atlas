import {readCandidateSnapshot,gitChangedFiles} from './protected-candidate-snapshot.mjs';
import {validateProtectedExecutionCandidate} from './protected-admission-policy.mjs';
import {assertSameCandidate} from './run-protected-admission.mjs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const [protectedRoot,candidateRoot]=process.argv.slice(2);
if(!protectedRoot||!candidateRoot)throw new TypeError('protected authority roots required');
const env=process.env,queue=env.GITHUB_EVENT_NAME==='merge_group';
if(!['pull_request_target','merge_group'].includes(env.GITHUB_EVENT_NAME))throw new TypeError('protected audit event required');
if(env.ATLAS_EVENT_REPOSITORY!==env.GITHUB_REPOSITORY||!env.ATLAS_DEFAULT_BRANCH)throw new TypeError('audit repository association');
if(queue&&(env.ATLAS_EVENT_ACTION!=='checks_requested'||env.ATLAS_BASE_REF!==`refs/heads/${env.ATLAS_DEFAULT_BRANCH}`||env.GITHUB_SHA!==env.ATLAS_CODE_REVISION))throw new TypeError('audit merge-group event identity');
if(!queue&&env.ATLAS_BASE_REF!==env.ATLAS_DEFAULT_BRANCH)throw new TypeError('audit PR target identity');
const options={repository:env.GITHUB_REPOSITORY,baseSha:env.ATLAS_PROTECTED_BASE_SHA,headSha:env.ATLAS_CODE_REVISION,prNumber:queue?null:Number(env.ATLAS_PR_NUMBER)};
const snapshot=()=>readCandidateSnapshot({...options,...(queue?{changedFiles:gitChangedFiles(candidateRoot,options.baseSha,options.headSha)}:{})});
const candidate=await snapshot();
const admission=validateProtectedExecutionCandidate({protectedRoot,candidateRoot,currentCandidate:candidate});
// Only mechanically validated, protected-equivalent provenance code executes.
// Isolated Python mode prevents candidate siblings from shadowing stdlib imports.
execFileSync('python3',['-I',path.join(candidateRoot,'tools/governance/verify_extraction_provenance.py')],{stdio:'inherit',timeout:180000});
assertSameCandidate(candidate,await snapshot());
validateProtectedExecutionCandidate({protectedRoot,candidateRoot,currentCandidate:candidate});
console.log(JSON.stringify({candidate,admission,result:'PASS',kind:'inert-authority-validation'}));
