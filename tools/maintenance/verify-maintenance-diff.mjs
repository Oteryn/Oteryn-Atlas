import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [trustedRoot,candidateRoot]=process.argv.slice(2);
const MAX_TEXT_BYTES=2*1024*1024;
const RETAINED_WORKFLOWS=new Set([
  '.github/workflows/merge-authority-audit.yml',
  '.github/workflows/merge-group-gate.yml',
  '.github/workflows/terminal-branch-lifecycle.yml',
]);
const TEMPLATE='tools/maintenance/minimal-merge-group-gate.yml';
const ARCHIVE_ROOT='docs/maintenance/suspended-workflows/';
const REMEDIATION_ALLOWLIST='docs/maintenance/ATLAS_REMEDIATION_ALLOWLIST.json';
const OBSOLETE_VERIFICATION_CONTRACTS='docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json';
const sha=/^[0-9a-f]{40}$/;

function fail(message){throw new TypeError(message);}
function git(root,args,{buffer=false}={}){
  return execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null',...args],{
    encoding:buffer?undefined:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe'],
  });
}
function clean(value){return value.trim();}
function assertSafePath(name){
  if(typeof name!=='string'||!name||name.startsWith('/')||name.includes('\\')||!/^[A-Za-z0-9._/-]+$/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..'))fail(`unsafe path: ${name}`);
}
function treePaths(root,revision,prefix){
  const value=git(root,['ls-tree','-r','--name-only',revision,'--',prefix]);
  return value.split('\n').filter(Boolean);
}
function blob(root,revision,name){return git(root,['show',`${revision}:${name}`],{buffer:true});}
function mode(root,revision,name){
  const row=git(root,['ls-tree',revision,'--',name]).trim();
  return row?row.split(/\s+/,1)[0]:null;
}
function sameList(actual,expected){return JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort());}
function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function exactKeys(value,keys,label){
  if(!plainObject(value)||!sameList(Object.keys(value),keys))fail(`${label} has invalid shape`);
}
function protectedJson(base,name){
  let value;
  try{value=JSON.parse(blob(trustedRoot,base,name).toString('utf8'));}catch{fail(`protected authority is invalid JSON: ${name}`);}
  return value;
}
function assertPolicyPath(name,label){
  assertSafePath(name);
  if(name.startsWith('tools/maintenance/')||name.startsWith('.github/workflows/')||name.startsWith(ARCHIVE_ROOT))fail(`${label} targets protected control-plane path: ${name}`);
}
function loadRemediationAuthority(base){
  const raw=protectedJson(base,REMEDIATION_ALLOWLIST);
  exactKeys(raw,['schemaVersion','programme','lanes'],'remediation allowlist');
  if(raw.schemaVersion!==1||raw.programme!=='atlas-f01-f16-remediation'||!plainObject(raw.lanes))fail('remediation allowlist identity is invalid');
  const lanes=new Map();
  const entries=Object.entries(raw.lanes);
  if(entries.length<1||entries.length>16)fail('remediation allowlist lane count is invalid');
  for(const [lane,value] of entries){
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(lane))fail(`remediation lane id is invalid: ${lane}`);
    exactKeys(value,['findings','rules'],`remediation lane ${lane}`);
    if(!Array.isArray(value.findings)||!value.findings.length||!value.findings.every(item=>/^F(?:0[1-9]|1[0-6])$/.test(item)))fail(`remediation findings are invalid: ${lane}`);
    if(!Array.isArray(value.rules)||!value.rules.length||value.rules.length>64)fail(`remediation rules are invalid: ${lane}`);
    const rules=[];
    for(const rule of value.rules){
      if(!plainObject(rule))fail(`remediation rule is invalid: ${lane}`);
      const hasPath=Object.hasOwn(rule,'path'),hasPrefix=Object.hasOwn(rule,'prefix');
      const expected=hasPath?['operations','path']:['operations','prefix'];
      if(hasPath===hasPrefix)fail(`remediation rule locator is invalid: ${lane}`);
      exactKeys(rule,expected,`remediation rule ${lane}`);
      const locator=hasPath?rule.path:rule.prefix;
      if(typeof locator!=='string'||!locator)fail(`remediation rule locator is invalid: ${lane}`);
      if(hasPrefix&&!locator.endsWith('/'))fail(`remediation prefix must end in slash: ${locator}`);
      assertPolicyPath(hasPrefix?locator.slice(0,-1):locator,`remediation rule ${lane}`);
      if(!Array.isArray(rule.operations)||!rule.operations.length||!rule.operations.every(op=>op==='A'||op==='M')||new Set(rule.operations).size!==rule.operations.length)fail(`remediation operations are invalid: ${lane}`);
      rules.push(Object.freeze({path:hasPath?locator:null,prefix:hasPrefix?locator:null,operations:new Set(rule.operations)}));
    }
    lanes.set(lane,Object.freeze(rules));
  }
  return lanes;
}
function loadObsoleteAuthority(base){
  const raw=protectedJson(base,OBSOLETE_VERIFICATION_CONTRACTS);
  exactKeys(raw,['schemaVersion','paths'],'obsolete verification inventory');
  if(raw.schemaVersion!==1||!Array.isArray(raw.paths)||raw.paths.length>128)fail('obsolete verification inventory is invalid');
  const result=new Set();
  for(const name of raw.paths){
    assertSafePath(name);
    if(!/^tests\/verification\/[A-Za-z0-9][A-Za-z0-9._/-]*\.test\.mjs$/.test(name))fail(`obsolete verification path is invalid: ${name}`);
    if(result.has(name))fail(`duplicate obsolete verification path: ${name}`);
    result.add(name);
  }
  return result;
}
function remediationLanes(change,lanes){
  const matches=new Set();
  for(const [lane,rules] of lanes){
    if(rules.some(rule=>rule.operations.has(change.status)&&(rule.path===change.path||(rule.prefix&&change.path.startsWith(rule.prefix)))))matches.add(lane);
  }
  return matches;
}

function parseChanges(root,base,head){
  const tokens=git(root,['diff','--name-status','-z','-M','-C',base,head,'--'],{buffer:true}).toString('utf8').split('\0');
  if(tokens.at(-1)==='')tokens.pop();
  const changes=[];
  while(tokens.length){
    const statusToken=tokens.shift();
    const status=statusToken[0];
    if(!['A','M','D','R','C'].includes(status))fail(`unsupported diff status: ${statusToken}`);
    if(status==='R'||status==='C'){
      const oldPath=tokens.shift(),newPath=tokens.shift();
      assertSafePath(oldPath);assertSafePath(newPath);
      changes.push({status,oldPath,newPath,path:newPath});
    }else{
      const name=tokens.shift();assertSafePath(name);changes.push({status,path:name});
    }
  }
  if(!changes.length)fail('maintenance diff is empty');
  const seen=new Set();
  for(const change of changes){
    for(const name of [change.oldPath,change.path].filter(Boolean)){
      const key=`${change.status}:${name}`;
      if(seen.has(key))fail(`duplicate diff path: ${name}`);seen.add(key);
    }
  }
  return changes;
}

function verifyRegularText(root,revision,name){
  if(mode(root,revision,name)!=='100644')fail(`candidate path is not a regular 100644 file: ${name}`);
  const bytes=blob(root,revision,name);
  if(bytes.length>MAX_TEXT_BYTES)fail(`candidate text exceeds size limit: ${name}`);
  if(bytes.includes(0))fail(`candidate path is not text content: ${name}`);
  try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail(`candidate path is not UTF-8 text content: ${name}`);}
}

function allowedNormal(change,authority){
  const {status,path:name}=change;
  if(change.oldPath)fail(`rename or copy is forbidden: ${change.oldPath} -> ${name}`);
  if(name.startsWith('tools/maintenance/')||name===REMEDIATION_ALLOWLIST||name===OBSOLETE_VERIFICATION_CONTRACTS)fail(`maintenance authority is immutable: ${name}`);
  if(name.startsWith('.github/workflows/')||name.startsWith(ARCHIVE_ROOT))fail('workflow transition is not the complete suspension cutover');
  if(name==='AGENTS.md')return status==='M'?{kind:'maintenance'}:null;
  if(name.startsWith('docs/agents/')||name.startsWith('docs/evidence/')||name.startsWith('docs/maintenance/'))return ['A','M','D'].includes(status)?{kind:'maintenance'}:null;
  if(name.startsWith('tools/governance/'))return ['A','M','D'].includes(status)?{kind:'maintenance'}:null;
  if(status==='D'&&authority.obsolete.has(name))return {kind:'obsolete-removal'};
  const lanes=remediationLanes(change,authority.lanes);
  if(lanes.size)return {kind:'remediation',lanes};
  return null;
}

function verifyNormal(changes,base,head){
  const authority={lanes:loadRemediationAuthority(base),obsolete:loadObsoleteAuthority(base)};
  let candidateLanes=null;
  for(const change of changes){
    const admission=allowedNormal(change,authority);
    if(!admission)fail(`maintenance path is frozen: ${change.path}`);
    if(admission.kind==='remediation'){
      candidateLanes=candidateLanes===null?admission.lanes:new Set([...candidateLanes].filter(lane=>admission.lanes.has(lane)));
      if(!candidateLanes.size)fail('maintenance diff spans multiple remediation lanes');
    }
    if(change.status==='D'){
      if(mode(candidateRoot,base,change.path)!=='100644')fail(`removed path was not a regular 100644 file: ${change.path}`);
    }else verifyRegularText(candidateRoot,head,change.path);
  }
  return {mode:candidateLanes?'bounded-remediation':'maintenance-only',remediationLane:candidateLanes?[...candidateLanes].sort()[0]:null,changedPaths:changes.map(change=>change.path).sort()};
}

function verifyCutover(changes,base,head){
  const protectedActive=treePaths(candidateRoot,base,'.github/workflows').filter(name=>/\.ya?ml$/.test(name));
  const candidateActive=treePaths(candidateRoot,head,'.github/workflows').filter(name=>/\.ya?ml$/.test(name));
  if(!sameList(candidateActive,RETAINED_WORKFLOWS))fail('workflow transition is not the complete suspension cutover: active workflow inventory is not the required three-file set');
  for(const retained of ['.github/workflows/merge-authority-audit.yml','.github/workflows/terminal-branch-lifecycle.yml']){
    if(!blob(candidateRoot,base,retained).equals(blob(candidateRoot,head,retained)))fail(`retained workflow changed: ${retained}`);
  }
  if(!blob(candidateRoot,head,'.github/workflows/merge-group-gate.yml').equals(blob(candidateRoot,base,TEMPLATE)))fail('minimal Merge Queue gate does not equal protected template');
  const suspendable=protectedActive.filter(name=>!RETAINED_WORKFLOWS.has(name));
  const expectedArchives=suspendable.map(name=>`${ARCHIVE_ROOT}${path.posix.basename(name)}`);
  const actualArchives=treePaths(candidateRoot,head,ARCHIVE_ROOT);
  if(!sameList(actualArchives,expectedArchives))fail('cutover archived workflow inventory is incomplete');
  for(let index=0;index<suspendable.length;index++){
    if(!blob(candidateRoot,base,suspendable[index]).equals(blob(candidateRoot,head,expectedArchives[index])))fail(`archived workflow bytes changed: ${suspendable[index]}`);
  }
  const allowed=new Set([
    ...suspendable,
    ...expectedArchives,
    '.github/workflows/merge-group-gate.yml',
    'docs/maintenance/ATLAS-MAINTENANCE-MODE.md',
  ]);
  for(const change of changes){
    if(change.status==='R'||change.status==='C'){
      const expectedArchive=`${ARCHIVE_ROOT}${path.posix.basename(change.oldPath)}`;
      if(!suspendable.includes(change.oldPath)||change.path!==expectedArchive)fail(`rename or copy is forbidden: ${change.oldPath} -> ${change.path}`);
    }else if(!allowed.has(change.path))fail(`cutover contains unrelated path: ${change.path}`);
    if(change.status!=='D'&&change.path!=='docs/maintenance/ATLAS-MAINTENANCE-MODE.md')verifyRegularText(candidateRoot,head,change.path);
  }
  return {mode:'workflow-suspension-cutover',suspendedWorkflows:suspendable.map(name=>path.posix.basename(name)).sort()};
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
  }else fail('unsupported maintenance event');
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
  const workflowChange=changes.some(change=>change.path.startsWith('.github/workflows/')||change.path.startsWith(ARCHIVE_ROOT)||change.oldPath?.startsWith('.github/workflows/'));
  const result=workflowChange?verifyCutover(changes,base,head):verifyNormal(changes,base,head);
  process.stdout.write(`${JSON.stringify({schemaVersion:1,result:'PASS',baseSha:base,headSha:head,...result})}\n`);
}catch(error){
  process.stderr.write(`atlas maintenance gate: ${error?.message??error}\n`);
  process.exitCode=1;
}
