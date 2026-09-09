// Execute only from protected base. All policy inputs except `routing` must be
// loaded from that same protected tree; routing is a closed inert candidate JSON.
import crypto from 'node:crypto';
import fs from 'node:fs';
const PROPERTIES=JSON.parse(fs.readFileSync(new URL('./protected-scenario-properties.json',import.meta.url),'utf8'));
const MANUAL_DEPTH_GROUPS=['e2e.bounded-performance','e2e.bounded-soak','e2e.bounded-stress'];
import { deriveVerificationMetadata } from './verification-metadata.mjs';
import { buildVerificationPlan } from './build-verification-plan.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';
const fail = label => { throw new TypeError(`protected routing: ${label}`); };
function shape(value,required,optional=[]) {
 if(!value || Object.getPrototypeOf(value)!==Object.prototype || required.some(k=>!Object.hasOwn(value,k)) || Object.keys(value).some(k=>![...required,...optional].includes(k))) fail('unknown or missing fields');
}
function ids(value) {
 if(!Array.isArray(value)||!value.length||value.some(id=>typeof id!=='string'||!/^.+::.+::.+$/.test(id))||new Set(value).size!==value.length) fail('invalid protected scenario census');
 return [...value].sort();
}
function identity(candidate,proofPurpose) {
 shape(candidate,['repository','prNumber','headSha','baseSha','treeSha','changedFiles']);
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate.repository)||(candidate.prNumber!==null&&(!Number.isSafeInteger(candidate.prNumber)||candidate.prNumber<1))) fail('repository or PR identity');
 for(const k of ['headSha','baseSha','treeSha']) if(typeof candidate[k]!=='string'||!/^[a-f0-9]{40}$/.test(candidate[k])) fail(k);
 if(!Array.isArray(candidate.changedFiles)||(proofPurpose!=='depth'&&!candidate.changedFiles.length)) fail('missing complete changed files');
 if(proofPurpose==='depth'&&(candidate.prNumber!==null||candidate.headSha!==candidate.baseSha||candidate.changedFiles.length)) fail('depth requires exact protected main identity');
 const seen=new Set();
 const files=candidate.changedFiles.map(file=>{
  shape(file,['path','status'],file.status==='renamed'?['previousPath']:[]);
  if(!['added','modified','removed','renamed','copied','changed','unchanged'].includes(file.status)) fail('file status');
  if(file.status==='renamed'&&!file.previousPath) fail('rename source missing');
  for(const p of [file.path,...(file.previousPath?[file.previousPath]:[])]) if(typeof p!=='string'||p.includes('\\')||p.split('/').some(s=>!s||s==='.'||s==='..')||/[\x00-\x1f]/.test(p)) fail('unsafe path');
  if(seen.has(file.path)) fail('duplicate changed file'); seen.add(file.path);return {...file};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 return {...candidate,changedFiles:files};
}
export function validateProtectedRouting(routing,census) {
 shape(routing,['schemaVersion','mode'],['groups']);
 if(routing.schemaVersion!==1||!['conservative','selective'].includes(routing.mode)) fail('unsupported schema or mode');
 const protectedIds=ids(census?.stableTestIds);
 if(routing.groups!==undefined) {
  if(!routing.groups||Object.getPrototypeOf(routing.groups)!==Object.prototype||!Object.keys(routing.groups).length) fail('group map');
  const all=[];
  for(const [name,values] of Object.entries(routing.groups)) {
   if(!/^[a-z]+(?:[.-][a-z]+)*$/.test(name)) fail('generic group identifier');
   all.push(...ids(values));
  }
  if(new Set(all).size!==all.length||canonicalJson(all.sort())!==canonicalJson(protectedIds)) fail('grouping must preserve exact protected census');
 }
 return structuredClone(routing);
}
function matches(group,id) {
 const [project,spec]=id.split('::');
 return group.projects.includes(project)&&group.specs.includes(spec);
}

// Compatibility output only. Canonical planner ownership selects candidate
// execution; old scenario properties supply labels, never selection or frames.
export function evaluateProtectedRouting({candidate,manifest,catalog,census,inventory,routing,forceFull=false,proofPurpose='candidate'}={}) {
 if(!['candidate','depth'].includes(proofPurpose)) fail('unsupported proof purpose');
 const current=identity(candidate,proofPurpose), policy=validateProtectedRouting(routing,census);
 if(typeof forceFull!=='boolean') fail('forceFull must be boolean');
 const {browser}=deriveVerificationMetadata(catalog);
 const allIds=ids(inventory?.stableTestIds);
 if(census.stableTestIds.some(id=>!allIds.includes(id))) fail('inventory omits protected census floor');
 const bySpec=new Map(browser.specs.map(row=>[row.spec,row]));
 for(const row of browser.specs) {
  if(!allIds.some(id=>id.startsWith(`${row.execution.project}::${row.spec}::`))) fail(`inventory omits protected execution spec ${row.spec}`);
 }
 for(const id of allIds) {
  const [project,spec]=id.split('::');
  if(bySpec.get(spec)?.execution.project!==project) fail(`inventory contains unknown spec or project ${id}`);
 }
 const args={repository:current.repository,headSha:current.headSha,integrationBaseSha:current.baseSha,mergeBaseSha:current.baseSha,changedFiles:current.changedFiles,trustedImpactManifest:manifest,candidateImpactManifest:manifest,verificationCatalog:catalog,protectedStableTestIds:allIds};
 let plan=buildVerificationPlan(args);
 if(proofPurpose==='candidate'&&(forceFull||(policy.mode==='conservative'&&plan.groups.some(group=>group.executionEngine==='playwright')))) {
  plan=buildVerificationPlan({...args,requiredGroupFloor:['deterministic.core','e2e.full']});
 }
 let groups=plan.groups;
 if(proofPurpose==='depth') {
  // Explicit inactive manual purpose, bound above to exact protected main.
  // No invented changed file and no implicit property-profile filter.
  groups=MANUAL_DEPTH_GROUPS.map(id=>{
   const group=catalog.groups[id];
   if(group?.executionRole!=='canonical-machine'||group.executionEngine!=='playwright'||group.capabilities.dataCapability!=='qualification_fixture') fail(`manual depth owner unresolved ${id}`);
   return {...structuredClone(group),id};
  });
 }
 if(groups.some(group=>group.executionRole==='aggregate'||group.id==='e2e.full')) fail('aggregate alias reached execution obligations');
 const requiredGroups=groups.map(group=>group.id).sort();
 const machineGroups=groups.filter(group=>group.executionEngine==='playwright'&&group.executionRole==='canonical-machine');
 const selectedReviewGroups=groups.filter(group=>group.executionRole==='canonical-review');
 const scenarioIds=[...new Set(machineGroups.flatMap(group=>allIds.filter(id=>matches(group,id))))].sort();
 if(proofPurpose==='candidate'&&canonicalJson([...plan.stableTestIds].sort())!==canonicalJson(scenarioIds)) fail('planner scenario obligations differ from canonical execution owners');
 const requiredFrames=[];
 const review=[];
 for(const group of selectedReviewGroups) {
  const obligation=browser.reviewGroups[group.id];
  if(!obligation||!obligation.requiredFrames.length) fail(`review owner unresolved ${group.id}`);
  if(obligation.dependsOnMachineGroups.some(id=>!requiredGroups.includes(id))) fail(`review missing machine owner ${group.id}`);
  for(const frame of obligation.requiredFrames) {
   if(!scenarioIds.includes(frame.stableTestId)) fail(`review frame missing selected execution ${frame.frameId}`);
   if(requiredFrames.some(existing=>existing.frameId===frame.frameId)) fail(`duplicate review frame ${frame.frameId}`);
   requiredFrames.push(structuredClone(frame));
  }
  review.push({dataCapability:group.capabilities.dataCapability,scenarioIds:allIds.filter(id=>matches(group,id)).sort(),groupIds:[group.id],evidenceKind:group.evidence});
 }
 requiredFrames.sort((a,b)=>a.frameId.localeCompare(b.frameId));
 const hosted=new Map(),specialist=[];
 for(const group of machineGroups) {
  const selected=allIds.filter(id=>matches(group,id)).sort();
  if(!selected.length) fail(`selected execution group ${group.id} has no protected scenarios`);
  const {dataCapability,hosted:isHosted,specialistReason}=group.capabilities;
  if(isHosted) {
   if(dataCapability==='real_fullworld') fail('real fullworld requires specialist placement');
   if(!hosted.has(dataCapability)) hosted.set(dataCapability,new Set());
   selected.forEach(id=>hosted.get(dataCapability).add(id));
  } else {
   if(!specialistReason) fail('unresolved specialist execution');
   specialist.push({dataCapability,scenarioIds:selected,groupIds:[group.id],evidenceKind:group.evidence});
  }
 }
 const hostedPartitions=[...hosted].sort(([a],[b])=>a.localeCompare(b)).map(([dataCapability,values])=>({dataCapability,scenarioIds:[...values].sort()}));
 const propertyById=new Map(PROPERTIES.scenarios.map(row=>[row.stableId,row]));
 if(propertyById.size!==PROPERTIES.scenarios.length) fail('duplicate protected property labels');
 const propertyObligations=scenarioIds.map(stableId=>structuredClone(propertyById.get(stableId)??{stableId,properties:[]}));
 const scenarioGroups=policy.groups?Object.fromEntries(Object.entries(policy.groups).map(([name,values])=>[name,values.filter(id=>scenarioIds.includes(id)).sort()]).filter(([,values])=>values.length)):{};
 const capabilities=[...new Set(groups.map(group=>group.capabilities.dataCapability))].sort();
 const result={schemaVersion:1,candidate:current,hostedPartitions,specialist,review,proofPurpose,evidenceKind:proofPurpose==='depth'?'protected-main-depth-v1':'protected-candidate-v1',requiredGroups,scenarioIds,requiredFrames,propertyObligations,scenarioGroups,capabilities,profile:proofPurpose==='depth'?'full':plan.profile,workers:1,retries:0};
 result.semanticDigest=`sha256:${crypto.createHash('sha256').update(canonicalJson({result,manifest,catalog,census,inventory,properties:PROPERTIES,routing:policy,forceFull,proofPurpose})).digest('hex')}`;
 return result;
}
