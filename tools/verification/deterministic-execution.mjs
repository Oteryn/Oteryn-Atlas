import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TEST_PATH=/^tests\/[A-Za-z0-9_./-]+\.(mjs|py)$/;
const EXACT_GOVERNANCE_TEST_PATHS=new Set([
  'tools/governance/test_agent_prompt_lifecycle.mjs',
  'tools/governance/test_validate_meta_agent_policy.py',
]);
function safeTestPath(spec){
  return typeof spec==='string'&&(TEST_PATH.test(spec)||EXACT_GOVERNANCE_TEST_PATHS.has(spec))&&!spec.split('/').some(part=>!part||part==='.'||part==='..');
}

function runtimeFor(spec){
  return spec.endsWith('.py')?{interpreter:'python3',argv:[spec]}:{interpreter:'node',argv:['--test',spec]};
}

// Protected ownership/catalog metadata defines obligations and command policy.
// Authenticated candidate test paths are subjects only: they may execute, but
// they never create ownership, interpreter/argv or transitive coverage authority.
export function resolveDeterministicCommands({root,protectedRoot,catalog,groupIds,ownership,requiredSpecs=[],changedFiles=[]}){
  if(!Array.isArray(groupIds))throw new Error('empty selection');
  if(ownership?.schemaVersion!==1||!Array.isArray(ownership.entries)||(ownership.importAggregators!==undefined&&!Array.isArray(ownership.importAggregators)))throw new Error('unsupported ownership schema');
  if(!Array.isArray(changedFiles))throw new Error('changed test census required');
  const entries=new Map();
  for(const row of [...ownership.entries,...(ownership.importAggregators??[])]){
    if(!row||typeof row!=='object'||!safeTestPath(row.spec))throw new Error('malformed ownership row');
    if(entries.has(row.spec))throw new Error(`duplicate ownership: ${row.spec}`);
    entries.set(row.spec,row);
  }
  const changed=new Set(),renamed=new Map(),directSubjects=new Set(),seenCandidatePaths=new Set(),seenPreviousPaths=new Set();
  for(const item of changedFiles){
    if(!item||typeof item!=='object'||!['added','modified','removed','renamed'].includes(item.status)||typeof item.path!=='string')throw new Error('changed test census required');
    if(seenCandidatePaths.has(item.path)||seenPreviousPaths.has(item.path))throw new Error(`overlapping changed test path: ${item.path}`);seenCandidatePaths.add(item.path);
    if(item.status==='renamed'){
      if(typeof item.previousPath!=='string')throw new Error('changed test rename requires previous path');
      if(seenPreviousPaths.has(item.previousPath))throw new Error(`duplicate deterministic test rename source: ${item.previousPath}`);seenPreviousPaths.add(item.previousPath);
      if(seenCandidatePaths.has(item.previousPath))throw new Error(`overlapping deterministic test rename identity: ${item.previousPath}`);
      const touchesDeterministic=safeTestPath(item.path)||safeTestPath(item.previousPath);
      if(!touchesDeterministic)continue;
      if(!safeTestPath(item.path)||!safeTestPath(item.previousPath)||path.posix.extname(item.path)!==path.posix.extname(item.previousPath))throw new Error(`unsafe deterministic test rename: ${item.previousPath} -> ${item.path}`);
      if(renamed.has(item.previousPath))throw new Error(`duplicate deterministic test rename: ${item.previousPath}`);
      if([...renamed.values()].includes(item.path))throw new Error(`duplicate deterministic test rename target: ${item.path}`);
      if(entries.has(item.previousPath)){renamed.set(item.previousPath,item.path);changed.add(item.previousPath);}
      else {if(entries.has(item.path))throw new Error(`deterministic rename target is protected: ${item.path}`);directSubjects.add(item.path);}
      continue;
    }
    if(!safeTestPath(item.path))continue;
    if(item.status==='removed')throw new Error(`removed deterministic test: ${item.path}`);
    if(item.status==='added'||item.status==='modified'){
      if(entries.has(item.path))changed.add(item.path);else directSubjects.add(item.path);
    }
  }
  const realRoot=fs.realpathSync(root);
  // Only the protected caller may supply this authenticated base checkout.
  // Catalog hashes prove historical edges; they are not a moving source lock.
  const realProtectedRoot=protectedRoot===undefined?null:fs.realpathSync(protectedRoot);
  function executionPath(spec){return renamed.get(spec)??spec;}
  function checkedFile(spec,base=realRoot,physical=executionPath(spec)){
    if(!safeTestPath(physical))throw new Error(`exact safe test path required: ${physical}`);
    const target=path.join(base,physical);
    if(!fs.existsSync(target))throw new Error(`missing file: ${physical}`);
    const real=fs.realpathSync(target);
    if(real!==target||!real.startsWith(`${base}${path.sep}`))throw new Error(`symlink or path escape: ${physical}`);
    if(!fs.statSync(real).isFile())throw new Error(`missing file: ${physical}`);
    return fs.readFileSync(real);
  }
  function validateRow(spec){
    const row=entries.get(spec);
    if(!row)throw new Error(`missing explicit interpreter/import ownership: ${spec}`);
    if(row.qualification==='blocked'||row.qualification?.startsWith('blocked-'))throw new Error(`known qualification blocker: ${spec}: ${row.qualification}`);
    const expected=runtimeFor(spec);
    if(row.interpreter!==expected.interpreter||JSON.stringify(row.argv)!==JSON.stringify(expected.argv))throw new Error(`unsupported interpreter or argv: ${spec}`);
    if(!Array.isArray(row.imports)||!Array.isArray(row.subprocessTests))throw new Error(`missing import proof: ${spec}`);
    if(!/^[a-f0-9]{64}$/.test(row.sourceSha256??''))throw new Error(`missing source proof: ${spec}`);
    const bytes=checkedFile(spec);
    const sourceMatches=crypto.createHash('sha256').update(bytes).digest('hex')===row.sourceSha256;
    if(!changed.has(spec)){
      if(realProtectedRoot!==null){
        if(!bytes.equals(checkedFile(spec,realProtectedRoot,spec)))throw new Error(`protected base source mismatch: ${spec}`);
      }else if(!sourceMatches)throw new Error(`source proof changed: ${spec}`);
    }
    return {row,sourceMatches};
  }
  const obligationClosures=new Map();
  function obligationClosure(spec,visiting=new Set()){
    if(visiting.has(spec))throw new Error(`test import cycle: ${spec}`);
    if(obligationClosures.has(spec))return obligationClosures.get(spec);
    const {row}=validateRow(spec);
    visiting.add(spec);
    const obligations=new Set([spec]),direct=new Set();
    function addChild(child){
      if(!safeTestPath(child)||!entries.has(child))throw new Error(`missing explicit interpreter/import ownership: ${child}`);
      if(direct.has(child))throw new Error(`duplicate execution edge: ${spec}: ${child}`);direct.add(child);
      for(const leaf of obligationClosure(child,visiting))obligations.add(leaf);
    }
    for(const child of row.imports){
      if(row.interpreter!=='node'||typeof child!=='string'||!child.endsWith('.mjs'))throw new Error(`unsupported import interpreter: ${spec}`);
      addChild(child);
    }
    for(const edge of row.subprocessTests){
      if(!edge||typeof edge!=='object'||Array.isArray(edge)||Object.keys(edge).sort().join(',')!=='argv,cwd,execution,interpreter,spec'||row.interpreter!=='node'||edge.execution!=='unconditional-test'||edge.cwd!=='.'||typeof edge.spec!=='string')throw new Error(`unproven subprocess execution: ${spec}`);
      const child=entries.get(edge.spec);if(!child)throw new Error(`missing explicit interpreter/import ownership: ${edge.spec}`);
      if(edge.interpreter!==child.interpreter||JSON.stringify(edge.argv)!==JSON.stringify(child.argv))throw new Error(`unsupported subprocess interpreter or argv: ${spec}: ${edge.spec}`);
      addChild(edge.spec);
    }
    visiting.delete(spec);obligationClosures.set(spec,obligations);return obligations;
  }
  const obligationGroups=new Map();
  function attribute(spec,id){if(!obligationGroups.has(spec))obligationGroups.set(spec,new Set());obligationGroups.get(spec).add(id);}
  for(const id of [...new Set(groupIds)].sort()){
    const group=catalog?.groups?.[id];
    if(!group)throw new Error(`unknown group: ${id}`);
    if(group.capabilities?.browser!==false)throw new Error(`nonbrowser group required: ${id}`);
    if(!Array.isArray(group.specs)||group.specs.length===0)throw new Error(`empty group: ${id}`);
    for(const spec of group.specs){
      if(!safeTestPath(spec))throw new Error(`exact safe test path required: ${spec}`);
      for(const obligation of obligationClosure(spec))attribute(obligation,id);
    }
  }
  if(directSubjects.size){
    for(const spec of directSubjects){checkedFile(spec);obligationGroups.set(spec,new Set());}
  }
  if(groupIds.length===0&&directSubjects.size===0)throw new Error('empty selection');
  const obligations=new Set(obligationGroups.keys());
  for(const spec of requiredSpecs)if(!obligations.has(spec))throw new Error(`required test is not selected: ${spec}`);
  const trustedClosures=new Map();
  function trustedCoverage(spec,visiting=new Set()){
    if(trustedClosures.has(spec))return trustedClosures.get(spec);
    if(directSubjects.has(spec)){const self=new Set([spec]);trustedClosures.set(spec,self);return self;}
    if(visiting.has(spec))throw new Error(`test import cycle: ${spec}`);
    const {row,sourceMatches}=validateRow(spec);
    const covered=new Set([spec]);
    // Candidate parents and rename transitions execute, but their historical
    // transitive closure is only an obligation, never trusted coverage credit.
    if(!sourceMatches||renamed.has(spec)){trustedClosures.set(spec,covered);return covered;}
    visiting.add(spec);
    const direct=[];
    for(const child of row.imports)direct.push(child);
    for(const edge of row.subprocessTests)direct.push(edge.spec);
    for(const child of direct){
      // An unchanged parent still targets the old path, so it cannot claim a
      // renamed child merely because the resolver knows the authenticated move.
      if(renamed.has(child))continue;
      for(const leaf of trustedCoverage(child,visiting)){
        if(covered.has(leaf))throw new Error(`unresolved overlapping import roots: ${leaf}`);
        covered.add(leaf);
      }
    }
    visiting.delete(spec);trustedClosures.set(spec,covered);return covered;
  }
  for(const spec of obligations)trustedCoverage(spec);
  const roots=[...obligations].filter(spec=>![...obligations].some(other=>other!==spec&&trustedClosures.get(other).has(spec))).sort();
  const coveredOnce=new Set();
  for(const spec of roots){
    for(const covered of trustedClosures.get(spec)){
      if(!obligations.has(covered))continue;
      if(coveredOnce.has(covered))throw new Error(`unresolved overlapping import roots: ${covered}`);
      coveredOnce.add(covered);
    }
  }
  for(const spec of obligations)if(!coveredOnce.has(spec))throw new Error(`selected test lost coverage: ${spec}`);
  return roots.map(spec=>{
    const physical=executionPath(spec),shape=runtimeFor(physical),groups=new Set();
    for(const covered of trustedClosures.get(spec))for(const id of obligationGroups.get(covered)??[])groups.add(id);
    if(!groups.size&&!directSubjects.has(spec))throw new Error(`deterministic command lost group ownership: ${spec}`);
    return {...(directSubjects.has(spec)?{executionScope:'candidate-self-only'}:{}),interpreter:shape.interpreter,argv:shape.argv,cwd:realRoot,spec,executionPath:physical,groupIds:[...groups].sort(),coveredSpecs:[...trustedClosures.get(spec)].filter(item=>obligations.has(item)).sort()};
  });
}
