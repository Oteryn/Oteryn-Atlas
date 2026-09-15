import {execFileSync} from 'node:child_process';
const fail=message=>{throw new TypeError(`protected snapshot: ${message}`);};
const SHA=/^[a-f0-9]{40}$/;
export const githubRequest=endpoint=>Promise.resolve(JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:32*1024*1024})));
export function gitChangedFiles(root,base,head) {
  const rows=execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null','diff','--no-ext-diff','--no-renames','--name-status','-z',base,head,'--'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\0');rows.pop();const files=[];
  while(rows.length){const status=rows.shift(),path=rows.shift();if(!path||!['A','M','D'].includes(status))fail('unsupported changed-file status');files.push({path,status:{A:'added',M:'modified',D:'removed'}[status]});}
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
const MAX_QUEUE_CHAIN_DEPTH=8;
async function authenticateQueueBase({request,repository,defaultBranch,baseSha,headSha,headRef,liveBase}) {
  const queuePrefix=`refs/heads/gh-readonly-queue/${defaultBranch}/`;
  if(liveBase===baseSha||liveBase===headSha)return;
  if(!SHA.test(liveBase??'')||typeof headRef!=='string'||!headRef.startsWith(queuePrefix))fail('merge-group protected base moved');
  let refs;
  try { refs=await request(`/repos/${repository}/git/matching-refs/heads/gh-readonly-queue/${defaultBranch}/`); }
  catch { fail('merge-group protected base moved'); }
  if(!Array.isArray(refs)||!refs.length)fail('merge-group queue ancestry');
  const active=new Set();
  for(const ref of refs) {
    if(typeof ref?.ref!=='string'||!ref.ref.startsWith(queuePrefix)||ref.object?.type!=='commit'||!SHA.test(ref.object?.sha??''))fail('merge-group queue ancestry');
    active.add(ref.object.sha);
  }
  let cursor=baseSha;const chain=new Set([liveBase]);
  for(let depth=0;depth<MAX_QUEUE_CHAIN_DEPTH&&cursor!==liveBase;depth++) {
    if(chain.has(cursor)||!active.has(cursor))fail('merge-group queue ancestry');
    chain.add(cursor);
    const commit=await request(`/repos/${repository}/git/commits/${cursor}`);
    if(commit.sha!==cursor||!SHA.test(commit.tree?.sha??'')||!Array.isArray(commit.parents)||!commit.parents.length||commit.parents.some(parent=>!SHA.test(parent?.sha??'')))fail('merge-group queue ancestry');
    cursor=commit.parents[0].sha;
  }
  if(cursor!==liveBase)fail('merge-group queue ancestry');
  const fresh=(await request(`/repos/${repository}/git/ref/heads/${encodeURIComponent(defaultBranch)}`)).object?.sha;
  if(fresh!==headSha&&!chain.has(fresh))fail('merge-group protected base moved');
}
export async function resolveDirectMergeGroup({request=githubRequest,repository,defaultBranch,event,githubSha,githubRef}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository??'')||!/^[A-Za-z0-9._/-]+$/.test(defaultBranch??''))fail('merge-group authority');
  if(event?.repository?.full_name!==repository||event.repository.default_branch!==defaultBranch||event.action!=='checks_requested')fail('merge-group event identity');
  const group=event.merge_group,baseRef=`refs/heads/${defaultBranch}`,queuePrefix=`refs/heads/gh-readonly-queue/${defaultBranch}/`;
  if(group?.base_ref!==baseRef||!SHA.test(group.base_sha??'')||!SHA.test(group.head_sha??'')||group.base_sha===group.head_sha
    ||typeof group.head_ref!=='string'||!group.head_ref.startsWith(queuePrefix)||githubSha!==group.head_sha||githubRef!==group.head_ref)fail('merge-group candidate identity');
  const protectedRef=await request(`/repos/${repository}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
  const liveBase=protectedRef.object?.sha;
  await authenticateQueueBase({request,repository,defaultBranch,baseSha:group.base_sha,headSha:group.head_sha,headRef:group.head_ref,liveBase});
  const commit=await request(`/repos/${repository}/git/commits/${group.head_sha}`);
  if(commit.sha!==group.head_sha||!SHA.test(commit.tree?.sha??'')||!Array.isArray(commit.parents)||!commit.parents.length
    ||commit.parents[0]?.sha!==group.base_sha||commit.parents.some(parent=>!SHA.test(parent?.sha??'')))fail('merge-group candidate commit');
  return {repository,baseSha:group.base_sha,headSha:group.head_sha,treeSha:commit.tree.sha,headRef:group.head_ref};
}
export async function readCandidateSnapshot({request=githubRequest,repository,baseSha,headSha,prNumber=null,changedFiles,allowJustIntegratedHead=false,headRef=null}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))fail('repository');
  for(const sha of [baseSha,headSha])if(!/^[a-f0-9]{40}$/.test(sha??''))fail('revision');
  if(prNumber!==null&&(!Number.isSafeInteger(prNumber)||prNumber<1))fail('PR');
  const prefix=`/repos/${repository}`,repo=await request(prefix);
  if(repo.full_name!==repository||typeof repo.default_branch!=='string')fail('repository association');
  const base=await request(`${prefix}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  if(typeof allowJustIntegratedHead!=='boolean'||(allowJustIntegratedHead&&prNumber!==null))fail('integrated MQ readback scope');
  const queueReadback=prNumber===null&&typeof headRef==='string'&&headRef.startsWith(`refs/heads/gh-readonly-queue/${repo.default_branch}/`);
  if(base.object?.sha!==baseSha&&!(allowJustIntegratedHead&&base.object?.sha===headSha)) {
    if(!queueReadback)fail('protected base moved');
    await authenticateQueueBase({request,repository,defaultBranch:repo.default_branch,baseSha,headSha,headRef,liveBase:base.object?.sha});
  }
  if(prNumber!==null){
    const pr=await request(`${prefix}/pulls/${prNumber}`);
    if(pr.number!==prNumber||pr.state!=='open'||pr.merged||pr.head?.sha!==headSha||pr.base?.sha!==baseSha||pr.head?.repo?.full_name!==repository||pr.base?.repo?.full_name!==repository||pr.base?.ref!==repo.default_branch)fail('PR identity drift');
    changedFiles=[];
    for(let page=1;;page++){
      const rows=await request(`${prefix}/pulls/${prNumber}/files?per_page=100&page=${page}`);
      if(!Array.isArray(rows))fail('file enumeration');
      changedFiles.push(...rows.map(f=>({path:f.filename,status:f.status,...(f.previous_filename?{previousPath:f.previous_filename}:{})})));
      if(rows.length<100)break;if(page>=30)fail('file enumeration truncated');
    }
    if(changedFiles.length!==pr.changed_files)fail('file count drift');
  }
  if(!Array.isArray(changedFiles)||!changedFiles.length)fail('complete changed files required');
  const commit=await request(`${prefix}/git/commits/${headSha}`);
  if(commit.sha!==headSha||!/^[a-f0-9]{40}$/.test(commit.tree?.sha??''))fail('candidate commit or tree');
  return {repository,prNumber,headSha,baseSha,treeSha:commit.tree.sha,changedFiles:changedFiles.sort((a,b)=>a.path.localeCompare(b.path))};
}
