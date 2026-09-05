import {execFileSync} from 'node:child_process';
const fail=message=>{throw new TypeError(`protected snapshot: ${message}`);};
export const githubRequest=endpoint=>Promise.resolve(JSON.parse(execFileSync('gh',['api',endpoint],{encoding:'utf8',maxBuffer:32*1024*1024})));
export function gitChangedFiles(root,base,head) {
  const rows=execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null','diff','--no-ext-diff','--no-renames','--name-status','-z',base,head,'--'],{encoding:'utf8',maxBuffer:16*1024*1024}).split('\0');rows.pop();const files=[];
  while(rows.length){const status=rows.shift(),path=rows.shift();if(!path||!['A','M','D'].includes(status))fail('unsupported changed-file status');files.push({path,status:{A:'added',M:'modified',D:'removed'}[status]});}
  return files.sort((a,b)=>a.path.localeCompare(b.path));
}
export async function readCandidateSnapshot({request=githubRequest,repository,baseSha,headSha,prNumber=null,changedFiles}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))fail('repository');
  for(const sha of [baseSha,headSha])if(!/^[a-f0-9]{40}$/.test(sha??''))fail('revision');
  if(prNumber!==null&&(!Number.isSafeInteger(prNumber)||prNumber<1))fail('PR');
  const prefix=`/repos/${repository}`,repo=await request(prefix);
  if(repo.full_name!==repository||typeof repo.default_branch!=='string')fail('repository association');
  const base=await request(`${prefix}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  if(base.object?.sha!==baseSha)fail('protected base moved');
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
