// Execute only from protected base. All policy inputs except `routing` must be
// loaded from that same protected tree; routing is a closed inert candidate JSON.
import crypto from 'node:crypto';
import fs from 'node:fs';
const PROPERTIES=JSON.parse(fs.readFileSync(new URL('./protected-scenario-properties.json',import.meta.url),'utf8'));
const DEPTH_PROFILES=['performance','scale','soak','stress'];
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
function matchesSpecPattern(pattern, spec) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`).test(spec);
}

function matches(group,id) {
 const [project,spec]=id.split('::');
 return group.projects.includes(project)&&group.specs.some(pattern=>matchesSpecPattern(pattern,spec));
}
function partitions(plan) {
 const hosted=new Map(),specialist=[],review=[];
 for(const group of plan.groups.filter(g=>g.capabilities.browser)) {
  const scenarioIds=plan.stableTestIds.filter(id=>matches(group,id)).sort();
  if(!scenarioIds.length) fail(`selected browser group ${group.id} has no protected scenarios`);
  const {dataCapability,hosted:isHosted,visualReview,specialistReason}=group.capabilities;
  if(isHosted) {
   if(dataCapability==='real_fullworld') fail('real fullworld requires specialist placement');
   if(!hosted.has(dataCapability)) hosted.set(dataCapability,new Set());
   scenarioIds.forEach(id=>hosted.get(dataCapability).add(id));
  } else if(dataCapability==='real_fullworld'&&specialistReason==='real-fullworld-product') {
   specialist.push({dataCapability,scenarioIds,groupIds:[group.id],evidenceKind:group.evidence});
  } else if(visualReview&&specialistReason==='private-visual') {
   review.push({dataCapability,scenarioIds,groupIds:[group.id],evidenceKind:group.evidence});
  } else fail('unsupported non-hosted obligation');
 }
 return {hostedPartitions:[...hosted].sort(([a],[b])=>a.localeCompare(b)).map(([dataCapability,set])=>({dataCapability,scenarioIds:[...set].sort()})),specialist,review};
}
export function evaluateProtectedRouting({candidate,manifest,catalog,census,inventory,routing,forceFull=false,proofPurpose='candidate'}={}) {
 if(!['candidate','depth'].includes(proofPurpose)) fail('unsupported proof purpose');
 const current=identity(candidate,proofPurpose), policy=validateProtectedRouting(routing,census);
 if(typeof forceFull!=='boolean') fail('forceFull must be boolean');
 const allIds=ids(inventory?.stableTestIds);
 if(census.stableTestIds.some(id=>!allIds.includes(id))) fail('inventory omits protected census floor');
 for(const group of Object.values(catalog.groups).filter(g=>g.capabilities.browser)) {
  for(const spec of group.specs) if(!allIds.some(id=>matches({...group,specs:[spec]},id))) fail(`inventory omits protected browser spec ${spec}`);
 }
 const args={repository:current.repository,headSha:current.headSha,integrationBaseSha:current.baseSha,mergeBaseSha:current.baseSha,changedFiles:current.changedFiles,trustedImpactManifest:manifest,candidateImpactManifest:manifest,verificationCatalog:catalog,protectedStableTestIds:allIds};
 let plan=buildVerificationPlan(args);
 if(forceFull||(policy.mode==='conservative'&&plan.groups.some(g=>g.capabilities.browser))) plan=buildVerificationPlan({...args,requiredGroupFloor:['deterministic.core','e2e.full']});
 const propertyIds=PROPERTIES.scenarios.map(row=>row.stableId).sort();
 if(canonicalJson(propertyIds)!==canonicalJson(allIds)||new Set(propertyIds).size!==propertyIds.length) fail('protected property inventory drift');
 const propertyById=new Map(PROPERTIES.scenarios.map(row=>[row.stableId,row]));
 if(PROPERTIES.scenarios.some(row=>!['functional',...DEPTH_PROFILES].includes(row.profile)||!Array.isArray(row.properties)||!row.properties.length)) fail('protected property assignment');
 const transition=forceFull||plan.impactDomains.some(domain=>['verification-governance','unknown-runtime-impact','invalid-change-evidence'].includes(domain));
 const selectedDepth=new Set(proofPurpose==='depth'?DEPTH_PROFILES:[]);
 if(proofPurpose==='candidate') for(const rule of PROPERTIES.depthDependencies) {
  if(current.changedFiles.some(file=>[file.path,file.previousPath].filter(Boolean).some(p=>rule.pathPrefixes.some(prefix=>p.startsWith(prefix))&&!(rule.excludedPaths??[]).includes(p)))) rule.profiles.forEach(p=>selectedDepth.add(p));
 }
 const functionalBroadening=proofPurpose==='candidate'&&PROPERTIES.functionalDependencies.some(rule=>current.changedFiles.some(file=>[file.path,file.previousPath].filter(Boolean).some(p=>rule.pathPrefixes.some(prefix=>p.startsWith(prefix)))));
 let scenarioIds=[...plan.stableTestIds].sort();
 if(proofPurpose==='depth') scenarioIds=PROPERTIES.scenarios.filter(row=>DEPTH_PROFILES.includes(row.profile)).map(row=>row.stableId).sort();
 else if(policy.mode==='selective'&&!transition) scenarioIds=scenarioIds.filter(id=>propertyById.get(id).profile==='functional'||selectedDepth.has(propertyById.get(id).profile));
 if(proofPurpose==='candidate'&&policy.mode==='selective'&&!transition) scenarioIds=[...new Set([...scenarioIds,...PROPERTIES.scenarios.filter(row=>selectedDepth.has(row.profile)).map(row=>row.stableId)])].sort();
 if(functionalBroadening) scenarioIds=[...new Set([...scenarioIds,...census.stableTestIds.filter(id=>propertyById.get(id).profile==='functional')])].sort();
 // Keep the protected catalog for capability placement, with only exact selected
 // scenarios. Names expose the new semantics instead of claiming e2e.full on 64.
 let requiredGroups=proofPurpose==='depth'?DEPTH_PROFILES.map(p=>`depth.${p}`):plan.requiredGroupIds.flatMap(id=>id==='e2e.full'&&policy.mode==='selective'&&!transition?['functional.full',...DEPTH_PROFILES.filter(p=>scenarioIds.some(s=>propertyById.get(s).profile===p)).map(p=>`depth.${p}`)]:[id]);
 if(proofPurpose==='candidate'&&policy.mode==='selective'&&!transition) requiredGroups=[...new Set([...requiredGroups,...[...selectedDepth].map(p=>`depth.${p}`)])].sort();
 if(functionalBroadening&&!requiredGroups.includes('e2e.full')) requiredGroups=[...new Set([...requiredGroups,'functional.full'])].sort();
 const placementPlan={...plan,stableTestIds:scenarioIds,groups:plan.groups.filter(g=>!g.capabilities.browser||scenarioIds.some(id=>matches(g,id)))};
 if(proofPurpose==='candidate'&&(selectedDepth.size||functionalBroadening)&&!placementPlan.groups.some(g=>g.id==='e2e.full')) placementPlan.groups.push({...catalog.groups['e2e.full'],id:'e2e.full'});
 if(proofPurpose==='depth') placementPlan.groups=[{...catalog.groups['e2e.full'],id:'e2e.full'}];
 // Group aliases are presentation only. They cannot replace protected group IDs,
 // alter minimum selection, or select capabilities/executors/assertions.
 const scenarioGroups=policy.groups?Object.fromEntries(Object.entries(policy.groups).map(([name,values])=>[name,values.filter(id=>scenarioIds.includes(id)).sort()]).filter(([,values])=>values.length)):{};
 const placement=partitions(placementPlan);
 const capabilities=[...new Set([...plan.requiredDataCapabilities,...placement.hostedPartitions.map(p=>p.dataCapability),...placement.specialist.map(p=>p.dataCapability),...placement.review.map(p=>p.dataCapability)])].sort();
 const result={schemaVersion:1,candidate:current,...placement,proofPurpose,evidenceKind:proofPurpose==='depth'?'protected-main-depth-v1':'protected-candidate-v1',requiredGroups,scenarioIds,propertyObligations:scenarioIds.map(id=>structuredClone(propertyById.get(id))),scenarioGroups,capabilities,profile:plan.profile,workers:1,retries:0};
 result.semanticDigest=`sha256:${crypto.createHash('sha256').update(canonicalJson({result,manifest,catalog,census,inventory,properties:PROPERTIES,routing:policy,forceFull,proofPurpose})).digest('hex')}`;
 return result;
}
