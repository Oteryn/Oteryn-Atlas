import {execFileSync} from 'node:child_process';

const [trustedRoot,candidateRoot]=process.argv.slice(2);
const RETIREMENT_AUTHORITY='docs/maintenance/ATLAS_LEGACY_RETIREMENT_AUTHORITY.json';
const ARCHIVE_ROOT='docs/maintenance/suspended-workflows/';
const RESTORATION_ROOT='docs/maintenance/verification-restoration/';
const LEGACY_EXACT=new Set([
  'docs/maintenance/ATLAS-MAINTENANCE-MODE.md',
  'docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json',
  'docs/maintenance/ATLAS_VERIFICATION_RESTORATION_ALLOWLIST.json',
  'docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json',
]);
const REGULAR_MODES=new Set(['100644','100755']);
const sha=/^[0-9a-f]{40}$/;

function fail(message){throw new TypeError(message);}
function git(root,args,{buffer=false}={}){
  return execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null',...args],{
    encoding:buffer?undefined:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe'],
  });
}
function clean(value){return value.trim();}
function assertSafePath(name){
  if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||!/^[A-Za-z0-9._/-]+$/.test(name)
    ||name.split('/').some(part=>!part||part==='.'||part==='..'))fail(`unsafe path: ${name}`);
}
function sameList(actual,expected){return JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort());}
function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value,keys,label){if(!plainObject(value)||!sameList(Object.keys(value),keys))fail(`${label} has invalid shape`);}
function blob(root,revision,name){return git(root,['show',`${revision}:${name}`],{buffer:true});}
function mode(root,revision,name){
  const row=git(root,['ls-tree',revision,'--',name]).trim();
  return row?row.split(/\s+/,1)[0]:null;
}
function jsonAt(root,revision,name){
  try{return JSON.parse(blob(root,revision,name).toString('utf8'));}catch{fail(`protected authority is invalid JSON: ${name}`);}
}
function validatePaths(values,label){
  if(!Array.isArray(values))fail(`${label} must be an array`);
  const seen=new Set();
  for(const name of values){
    assertSafePath(name);
    if(name===RETIREMENT_AUTHORITY||name.startsWith('.github/workflows/')||name.startsWith('tools/maintenance/'))
      fail(`${label} targets protected control-plane path: ${name}`);
    if(seen.has(name))fail(`${label} contains duplicate path: ${name}`);
    seen.add(name);
  }
  return Object.freeze([...values]);
}
function loadRetirementAuthority(root,revision){
  if(mode(root,revision,RETIREMENT_AUTHORITY)!=='100644')fail('legacy retirement authority is absent');
  const raw=jsonAt(root,revision,RETIREMENT_AUTHORITY);
  exactKeys(raw,['programme','schemaVersion','waves'],'legacy retirement authority');
  if(raw.schemaVersion!==1||raw.programme!=='atlas-legacy-retirement'||!plainObject(raw.waves))
    fail('legacy retirement authority identity is invalid');
  const entries=Object.entries(raw.waves);
  if(entries.length<1||entries.length>8)fail('legacy retirement wave count is invalid');
  const retireByPath=new Map(),supportByPath=new Map(),waves=new Map();
  let count=0;
  for(const [wave,value] of entries){
    if(!/^lr[2-9]-[a-z0-9][a-z0-9-]{0,63}$/.test(wave))fail(`legacy retirement wave id is invalid: ${wave}`);
    exactKeys(value,['retireDelete','retireModifyDelete','supportModify'],`legacy retirement wave ${wave}`);
    const modifyDelete=validatePaths(value.retireModifyDelete,`${wave}.retireModifyDelete`);
    const deleteOnly=validatePaths(value.retireDelete,`${wave}.retireDelete`);
    const support=validatePaths(value.supportModify,`${wave}.supportModify`);
    if(!modifyDelete.length&&!deleteOnly.length)fail(`legacy retirement wave has no retirement targets: ${wave}`);
    const local=new Set();
    for(const name of [...modifyDelete,...deleteOnly,...support]){
      if(local.has(name)||retireByPath.has(name)||supportByPath.has(name))fail(`duplicate legacy retirement path: ${name}`);
      local.add(name);
    }
    for(const name of modifyDelete)retireByPath.set(name,Object.freeze({wave,operations:new Set(['M','D'])}));
    for(const name of deleteOnly)retireByPath.set(name,Object.freeze({wave,operations:new Set(['D'])}));
    for(const name of support)supportByPath.set(name,Object.freeze({wave,operations:new Set(['M'])}));
    count+=local.size;
    waves.set(wave,Object.freeze({retireModifyDelete:modifyDelete,retireDelete:deleteOnly,supportModify:support}));
  }
  if(count>192)fail('legacy retirement rule count is invalid');
  return Object.freeze({raw,waves,retireByPath,supportByPath});
}
function verifyMonotonicAuthority(baseAuthority,candidateAuthority){
  let grew=false;
  for(const [wave,baseWave] of baseAuthority.waves){
    const candidateWave=candidateAuthority.waves.get(wave);
    if(!candidateWave)fail(`legacy retirement authority removed wave: ${wave}`);
    for(const key of ['retireModifyDelete','retireDelete','supportModify']){
      const candidate=new Set(candidateWave[key]);
      for(const name of baseWave[key])if(!candidate.has(name))fail(`legacy retirement authority changed protected rule: ${name}`);
      if(candidateWave[key].length>baseWave[key].length)grew=true;
    }
  }
  if(candidateAuthority.waves.size>baseAuthority.waves.size)grew=true;
  if(!grew)fail('legacy retirement authority update is not monotonic growth');
}
function controlPlanePath(name){return name.startsWith('.github/workflows/')||name.startsWith('tools/maintenance/');}
function legacyNamespace(name,authority){
  return name.startsWith(ARCHIVE_ROOT)||name.startsWith(RESTORATION_ROOT)||LEGACY_EXACT.has(name)||authority.retireByPath.has(name);
}
function parseChanges(root,base,head){
  const tokens=git(root,['diff','--name-status','-z','--no-renames',base,head,'--'],{buffer:true}).toString('utf8').split('\0');
  if(tokens.at(-1)==='')tokens.pop();
  const changes=[];
  while(tokens.length){
    const statusToken=tokens.shift(),status=statusToken[0];
    if(!['A','M','D'].includes(status))fail(`unsupported diff status: ${statusToken}`);
    const name=tokens.shift();assertSafePath(name);changes.push({status,path:name});
  }
  if(!changes.length)fail('protected diff is empty');
  return changes;
}
function verifyRegular(root,revision,name,label){
  if(!REGULAR_MODES.has(mode(root,revision,name)))fail(`${label} is not a regular file: ${name}`);
}
function verifyChangeStorage(change,base,head){
  if(change.status==='D'){verifyRegular(candidateRoot,base,change.path,'removed path');return;}
  verifyRegular(candidateRoot,head,change.path,'candidate path');
}
function verifyRetirement(changes,base,head,authority){
  let wave=null,hasRetire=false;
  for(const change of changes){
    const retired=authority.retireByPath.get(change.path),support=authority.supportByPath.get(change.path);
    let selected=null;
    if(retired?.operations.has(change.status)){selected=retired;hasRetire=true;}
    else if(support?.operations.has(change.status))selected=support;
    else fail(`legacy retirement path is outside protected wave authority: ${change.path}`);
    wave??=selected.wave;
    if(selected.wave!==wave)fail('legacy retirement diff spans multiple waves');
    verifyChangeStorage(change,base,head);
  }
  if(!hasRetire)fail('legacy retirement wave requires at least one retirement target');
  return {mode:'legacy-retirement',retirementWave:wave,changedPaths:changes.map(change=>change.path).sort()};
}
function verifyAuthorityUpdate(changes,base,head){
  if(changes.length!==1||changes[0].path!==RETIREMENT_AUTHORITY||changes[0].status!=='M')
    fail('legacy retirement authority update must be one isolated modification');
  verifyRegular(candidateRoot,head,RETIREMENT_AUTHORITY,'candidate authority');
  const protectedAuthority=loadRetirementAuthority(trustedRoot,base);
  const candidateAuthority=loadRetirementAuthority(candidateRoot,head);
  verifyMonotonicAuthority(protectedAuthority,candidateAuthority);
  return {mode:'legacy-retirement-authority-update',changedPaths:[RETIREMENT_AUTHORITY]};
}
function verifySteadyState(changes,base,head){
  if(changes.some(change=>change.path===RETIREMENT_AUTHORITY))return verifyAuthorityUpdate(changes,base,head);
  const authority=loadRetirementAuthority(trustedRoot,base);
  const retirementCandidate=changes.some(change=>authority.retireByPath.get(change.path)?.operations.has(change.status));
  if(retirementCandidate)return verifyRetirement(changes,base,head,authority);
  for(const change of changes){
    if(controlPlanePath(change.path))fail(`protected control-plane path is immutable: ${change.path}`);
    if(legacyNamespace(change.path,authority))fail(`legacy path requires protected retirement authority: ${change.path}`);
    verifyChangeStorage(change,base,head);
  }
  return {mode:'steady-state',changedPaths:changes.map(change=>change.path).sort()};
}
function verifyIdentity(){
  if(!trustedRoot||!candidateRoot)fail('trusted and candidate roots are required');
  const env=process.env;
  if(env.ATLAS_EVENT_REPOSITORY!==env.GITHUB_REPOSITORY)fail('repository identity mismatch');
  if(!env.ATLAS_DEFAULT_BRANCH)fail('default branch identity is absent');
  const event=env.GITHUB_EVENT_NAME;
  if(event==='pull_request_target'){
    if(!['opened','reopened','synchronize','edited'].includes(env.ATLAS_EVENT_ACTION))fail('pull request action identity mismatch');
    if(env.ATLAS_BASE_REF!==env.ATLAS_DEFAULT_BRANCH)fail('base ref identity mismatch');
    if(!/^\d+$/.test(env.ATLAS_PR_NUMBER??''))fail('pull request number identity mismatch');
  }else if(event==='merge_group'){
    if(env.ATLAS_EVENT_ACTION!=='checks_requested')fail('merge-group action identity mismatch');
    if(env.ATLAS_BASE_REF!==`refs/heads/${env.ATLAS_DEFAULT_BRANCH}`)fail('base ref identity mismatch');
    if(env.GITHUB_SHA!==env.ATLAS_CODE_REVISION)fail('merge-group head identity mismatch');
  }else fail('unsupported protected event');
  const base=env.ATLAS_PROTECTED_BASE_SHA,head=env.ATLAS_CODE_REVISION;
  if(!sha.test(base??'')||!sha.test(head??'')||base===head)fail('candidate revision identity is malformed');
  if(clean(git(trustedRoot,['rev-parse','HEAD']))!==base)fail('protected base identity mismatch');
  if(clean(git(candidateRoot,['rev-parse','HEAD']))!==head)fail('candidate head identity mismatch');
  if(clean(git(candidateRoot,['merge-base',base,head]))!==base)fail('candidate does not descend from protected base');
  if(clean(git(trustedRoot,['status','--porcelain','--untracked-files=all'])))fail('protected worktree is dirty');
  if(clean(git(candidateRoot,['status','--porcelain','--untracked-files=all'])))fail('candidate worktree is dirty');
  return {base,head};
}

try{
  const {base,head}=verifyIdentity();
  const changes=parseChanges(candidateRoot,base,head);
  const result=verifySteadyState(changes,base,head);
  process.stdout.write(`${JSON.stringify({schemaVersion:1,result:'PASS',baseSha:base,headSha:head,...result})}\n`);
}catch(error){
  process.stderr.write(`atlas maintenance gate: ${error?.message??error}\n`);
  process.exitCode=1;
}
