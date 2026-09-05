import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalJson } from './verification-plan-schema.mjs';

const admittedBindings = new WeakSet();
const digest = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const reject = message => { throw new TypeError(`qualification scenario bindings: ${message}`); };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const array = (value, label) => { if (!Array.isArray(value)) reject(`${label} must be an array`); return value; };
function relativePath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(value) || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..')) reject('unsafe publication path');
  return value;
}
function snapshot(root, expected) {
  if (!/^sha256:[0-9a-f]{64}$/.test(expected ?? '') || !root || fs.lstatSync(root).isSymbolicLink()) reject('invalid product identity');
  const bytes = new Map();
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name), relative = path.relative(root, full).split(path.sep).join('/');
    relativePath(relative);
    if (entry.isSymbolicLink()) reject('symlink publication');
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) bytes.set(relative, fs.readFileSync(full));
    else reject('unsupported publication entry');
  } };
  walk(root);
  const manifest = JSON.parse(bytes.get('fixture-manifest.json')?.toString() ?? 'null');
  const files = [...bytes].filter(([name]) => name !== 'fixture-manifest.json').map(([name,value]) => ({ path:name,bytes:value.length,digest:digest(value) })).sort((a,b) => a.path.localeCompare(b.path));
  if (digest(`${canonicalJson(files)}\n`) !== expected || manifest?.productDigest !== expected || canonicalJson(manifest.files) !== canonicalJson(files)) reject('independent product bytes or identity mismatch');
  return bytes;
}

// This module is executed from protected base. Candidate output is data only:
// no candidate module, manifest assertion, selector, or expected behavior executes.
export function resolveQualificationScenarioBindings({ productRoot, expectedProductDigest } = {}) {
  const bytes = snapshot(productRoot, expectedProductDigest);
  const read = name => { const value = bytes.get(relativePath(name)); if (!value) reject(`missing publication ${name}`); return value; };
  const json = name => JSON.parse(read(name));
  const position = record => {
    const p = record?.position;
    if (![p?.x,p?.y,p?.floor].every(Number.isSafeInteger)) reject('invalid position');
    const floor = json(`runtime-index/floors/f${p.floor}.json`), b = floor.bounds;
    if (![b?.x_min,b?.x_max_exclusive,b?.y_min,b?.y_max_exclusive].every(Number.isSafeInteger) || p.x < b.x_min || p.x >= b.x_max_exclusive || p.y < b.y_min || p.y >= b.y_max_exclusive) reject('position outside published bounds');
    return p;
  };
  const one = (records,predicate,label) => { const found = records.filter(predicate); if(found.length !== 1) reject(`requires exactly one ${label}`); return found[0]; };
  const semantic = array(json('web/semantic-search/index.json').records, 'semantic records');
  const navigation = one(semantic,r=>r.capabilities?.includes('navigation'),'navigation target');
  if (typeof navigation.label !== 'string' || !navigation.label) reject('invalid navigation label');
  position(navigation);
  const published = array(json('data/creatures/index.json').chunks, 'creature chunks').flatMap(c => array(json(`data/creatures/${relativePath(c.path)}`).records,'published creatures'));
  const byId = new Map(published.map(r=>[r.record_id,r]));
  if (byId.size !== published.length) reject('duplicate publication record');
  const search = array(json('data/creatures/search.json').records,'search creatures');
  if (new Set(search.map(r=>r.record_id)).size !== search.length) reject('duplicate search record');
  const creatures = search.map(r=>{
    const p=byId.get(r.record_id);
    if (!['npc','monster'].includes(r.kind) || !new RegExp(`^${r.kind}:[0-9a-f]{32}$`).test(r.record_id ?? '') || !new RegExp(`^${r.kind}-entity:[0-9a-f]{32}$`).test(r.entity_id ?? '') || !p || p.kind !== r.kind || p.name !== r.label || p.entity_id !== r.entity_id || canonicalJson(p.position) !== canonicalJson(r.position) || canonicalJson(p.roles ?? []) !== canonicalJson(r.roles ?? [])) reject('search/publication identity disagreement');
    if (typeof r.label !== 'string' || !r.label) reject('empty creature label');
    position(p);
    return {...p,label:r.label};
  });
  const roleNpc = one(creatures,r=>r.kind==='npc' && canonicalJson(r.roles)===canonicalJson(['shop','quest']),'shop/quest NPC');
  const overflowNpc = one(creatures,r=>r.kind==='npc' && canonicalJson(r.roles)===canonicalJson(['travel','shop','quest','blessing','trainer']),'five-role overflow NPC');
  const longNpc = one(creatures,r=>r.kind==='npc' && r.label.length >= 32,'long-name NPC');
  const manifest = json('animation/manifest.json');
  const programs = json(`animation/${relativePath(manifest.programs?.path)}`);
  if (programs.profile !== 'oteryn-atlas-animation-runtime-v1') reject('invalid animation profile');
  const buckets = new Map(array(manifest.buckets,'animation buckets').map(b=>[b.id,b]));
  if (buckets.size !== manifest.buckets.length) reject('duplicate animation bucket');
  const dynamic = new Set();
  for (const p of array(programs.creature_programs,'creature programs')) {
    if (!Number.isSafeInteger(p.phase_count) || p.phase_count < 2) continue;
    const ids=array(p.phase_content_ids,'phase IDs'), a=p.animation;
    if (ids.length!==p.phase_count || new Set(ids).size<2 || !Number.isSafeInteger(p.width) || p.width<1 || !Number.isSafeInteger(p.height) || p.height<1 || !a || !Array.isArray(a.presentation_durations_ms) || a.presentation_durations_ms.length!==p.phase_count || !a.presentation_durations_ms.every(n=>Number.isSafeInteger(n)&&n>0) || !['infinite','pingpong','counted'].includes(a.loop_type) || typeof a.synchronized!=='boolean' || !Number.isSafeInteger(a.default_start_phase) || a.default_start_phase<0 || a.default_start_phase>=p.phase_count || !Number.isSafeInteger(a.loop_count) || a.loop_count<0) reject('invalid dynamic animation contract');
    for(const id of ids) {
      const blob=programs.blob_index?.[id], bucket=buckets.get(blob?.bucket);
      if (!blob || !bucket || blob.width!==p.width || blob.height!==p.height || blob.bytes!==p.width*p.height*4 || !Number.isSafeInteger(blob.offset) || blob.offset<0) reject('invalid pixel backing');
      const data=read(`animation/${relativePath(bucket.path)}`);
      if(data.length!==bucket.bytes || digest(data)!==bucket.digest || blob.offset+blob.bytes>data.length || digest(data.subarray(blob.offset,blob.offset+blob.bytes))!==id) reject('invalid pixel backing digest');
    }
    if(dynamic.has(p.outfit_presentation_id)) reject('ambiguous dynamic presentation');
    dynamic.add(p.outfit_presentation_id);
  }
  const animated = r=>r.presentation_resolution_state==='RESOLVED' && dynamic.has(r.outfit_presentation?.outfit_presentation_id);
  const animatedNpc=one(creatures,r=>r.kind==='npc'&&animated(r),'pixel-backed animated NPC');
  const animatedMonster=one(creatures,r=>r.kind==='monster'&&animated(r),'pixel-backed animated monster');
  const same=(a,b)=>canonicalJson(a.position)===canonicalJson(b.position);
  const monsters=creatures.filter(r=>r.kind==='monster');
  const overlap=monsters.filter(r=>monsters.filter(o=>same(r,o)).length>=3);
  if(overlap.length<3 || overlap.some(r=>!same(r,overlap[0]))) reject('requires one dense monster scene');
  const nearbyNpcs=creatures.filter(r=>r.kind==='npc'&&r.position.floor===roleNpc.position.floor&&Math.abs(r.position.x-roleNpc.position.x)<=8&&Math.abs(r.position.y-roleNpc.position.y)<=8);
  if(nearbyNpcs.length<3) reject('requires nearby NPC scene');
  const floor=json(`runtime-index/floors/f${navigation.position.floor}.json`);
  const anchors=[];
  for(const chunk of array(floor.chunks,'runtime chunks')) {
    const source=read(`publication/semantic/${relativePath(chunk.path)}`);
    if(source.length!==chunk.bytes || digest(source)!==chunk.contentId) reject('anchor chunk identity mismatch');
    for(const line of source.toString().split('\n').filter(Boolean)) {
      const tile=JSON.parse(line);
      if(tile.record_type==='tile'&&tile.position?.floor===navigation.position.floor&&tile.presentation?.some(p=>p.resolved_primitives?.some(r=>r.width_units>0&&r.height_units>0))) { position(tile); anchors.push(tile.position); }
    }
  }
  const distinct=[...new Map(anchors.map(p=>[canonicalJson(p),p])).values()].sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,4);
  if(distinct.length!==4) reject('requires four distinct published anchor targets');
  // A final fresh enumeration detects product changes during resolution.
  snapshot(productRoot,expectedProductDigest);
  const result = freeze({schemaVersion:1,dataCapability:'qualification_fixture',productDigest:expectedProductDigest,navigation,roleNpc,overflowNpc,longNpc,animatedNpc,animatedMonster,overlap,nearbyNpcs,creatures,distinct});
  admittedBindings.add(result);
  return result;
}

const BINDING_FILES = new Set([
  'tests/runtime.mjs', 'tests/audit-desktop.spec.mjs', 'tests/state-desktop.spec.mjs',
  'tests/race-desktop.spec.mjs', 'tests/desktop.spec.mjs', 'tests/mobile.spec.mjs',
  'tests/degraded-search-desktop.spec.mjs', 'tests/visual-desktop.spec.mjs',
  'tests/visual-mobile.spec.mjs', 'tests/creatures-desktop.spec.mjs',
  'tests/creature-presentation-desktop.spec.mjs', 'tests/creature-presentation-mobile.spec.mjs',
  'tests/farm-explorer-desktop.spec.mjs', 'tests/farm-explorer-mobile.spec.mjs',
  'tests/creature-interaction-desktop.spec.mjs', 'tests/creature-interaction-mobile.spec.mjs',
  'tests/geometry-desktop.spec.mjs', 'tests/geometry-mobile.spec.mjs',
  'tests/layer-audit-desktop.spec.mjs', 'tests/performance-desktop.spec.mjs',
  'tests/soak-desktop.spec.mjs', 'tests/stress-desktop.spec.mjs',
]);
const QUALIFICATION_PREFIX = "const __atlasQualification = process.env.ATLAS_E2E_DATA_CAPABILITY === 'qualification_fixture';\n";
const conditional = (original, next) => `(__atlasQualification ? ${next} : ${original})`;
// Recover only the original arm of this protected emitter's own conditional
// format. No expression is evaluated. This keeps future fixture repins generic.
function productionSource(source) {
  if (!source.startsWith(QUALIFICATION_PREFIX)) {
    if (source.includes('__atlasQualification')) reject('unknown protected binding syntax');
    return source;
  }
  let result=source.slice(QUALIFICATION_PREFIX.length);
  const marker='(__atlasQualification ? ';
  for (let start=result.indexOf(marker);start>=0;start=result.indexOf(marker)) {
    let quote=null, escaped=false, depth=0, separator=-1, end=-1;
    for(let i=start+marker.length;i<result.length;i++) {
      const c=result[i];
      if(quote) { if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;continue; }
      if(c==='"'||c==="'"||c==='`') {quote=c;continue;}
      if(c==='('||c==='{'||c==='[')depth++;
      else if(c===')') {if(depth===0){end=i;break;}depth--;}
      else if(c==='}'||c===']')depth--;
      else if(c===':'&&depth===0&&result.slice(i-1,i+2)===' : '&&separator<0)separator=i;
      if(depth<0)reject('malformed protected binding expression');
    }
    if(separator<0||end<0)reject('malformed protected binding expression');
    result=result.slice(0,start)+result.slice(separator+2,end)+result.slice(end+1);
  }
  if(result.includes('__atlasQualification'))reject('unknown protected binding residue');
  return result;
}

function sourceMap(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || !Object.keys(value).length) reject('protected source map required');
  for (const [name,source] of Object.entries(value)) {
    relativePath(name);
    if (typeof source !== 'string') reject('source bytes must be strings');
  }
}

// Only data expression slots in protected source are rewritten. The result is
// submitted as candidate bytes and compared before execution, never patched into
// a running browser context. Outside qualification mode the original expression
// is retained verbatim. Complete source-map equality protects all other helpers.
export function renderQualificationHarnessBindings({ protectedSources, bindings } = {}) {
  sourceMap(protectedSources);
  if (!admittedBindings.has(bindings)) reject('bindings require protected product resolution');
  const b = bindings, at = r => `x=${r.position.x}&y=${r.position.y}&floor=${r.position.floor}`;
  const urls = new Map([
    ['x=32369&y=32241&floor=-7', at(b.navigation)],
    ['x=32361&y=32198&floor=-7', at(b.roleNpc)],
    ['x=32364&y=32240.2&floor=-7', at(b.roleNpc)],
    ['x=33018&y=32009&floor=-7', at(b.overlap[0])],
    ['x=32831&y=32596&floor=-12', at(b.animatedMonster)],
    ['x=32209&y=31924&floor=-12', at(b.animatedNpc)],
    ['x=32724&y=31155&floor=-15', at(b.animatedMonster)],
  ]);
  const values = new Map([
    ['Thais',b.navigation.label],['Sam',b.roleNpc.label],['Cave Rat',b.animatedMonster.label],
    ['monster-entity:8b41afe4c98e72744557d7adc250f7e6',b.animatedMonster.entity_id],
    ['Misguided Thief',b.overlap[0].label],
    ['monster:014cc0368c5989dd788e2af63e087e83',b.overlap[0].record_id],
    ['monster:6c316dffde0b35aa6a9165eb46694374',b.overlap[1].record_id],
    ['monster:7a7d419f84cf4eac5cad81f7cb266dae',b.overlap[2].record_id],
    ['32369',String(b.navigation.position.x)],['32241',String(b.navigation.position.y)],
  ]);
  for (const [i,[x,y]] of [[32380,32250],[32390,32260],[32469,32341],[32569,32441]].entries()) {
    const p=b.distinct[i];
    values.set(`${x} ${y} -7`,`${p.x} ${p.y} ${p.floor}`);
    values.set(String(x),String(p.x)); values.set(String(y),String(p.y));
  }
  const result={...protectedSources};
  for(const name of BINDING_FILES) {
    if (!Object.hasOwn(protectedSources,name)) reject(`missing protected oracle source ${name}`);
    const original=productionSource(protectedSources[name]);
    // Matching a complete quoted token prevents data from becoming JavaScript.
    // Known regex selectors become RegExp expressions with escaped literal data.
    let transformed=original.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\/\^Cave Rat\$\/|\/Sam\/i|\/Thais\/i|\b(?:32369|32241|32380|32250|32390|32260|32469|32341|32569|32441)\b/g, token=>{
      if(token[0]==="'" || token[0]==='"') {
        const raw=token.slice(1,-1);
        let next=values.get(raw);
        if(next===undefined && raw.startsWith('/web/fullworld.html?')) for(const [before,after] of urls) if(raw.includes(before)) {next=raw.replace(before,after);break;}
        return next===undefined?token:conditional(token,JSON.stringify(next));
      }
      if(token.startsWith('/')) {
        const label=token==='/^Cave Rat$/'?b.animatedMonster.label:token==='/Sam/i'?b.roleNpc.label:b.navigation.label;
        const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        return conditional(token,`new RegExp(${JSON.stringify(token==='/^Cave Rat$/'?`^${escaped}$`:escaped)}, ${JSON.stringify(token.endsWith('i')?'i':'')})`);
      }
      return conditional(token,values.get(token));
    });
    const oldPosition='{ floor: -10, x: 32522, y: 32419 }';
    if(transformed.includes(oldPosition)) transformed=transformed.replace(oldPosition,conditional(oldPosition,JSON.stringify(b.overlap[0].position)));
    result[name]=transformed===original?original:QUALIFICATION_PREFIX+transformed;
  }
  const helper='support/creature-presentation-fixtures.mjs';
  if(typeof protectedSources[helper]!=='string') reject('missing protected presentation source');
  const record = r=>({label:r.label,kind:r.kind,record_id:r.record_id,position:r.position,roles:r.roles??[]});
  const scenes={TWO_ROLE_NPC:record(b.roleNpc),OVERFLOW_NPC:record(b.overflowNpc),LONG_NAME_NPC:record(b.longNpc),NEARBY_NPC_SCENE:{center:b.roleNpc.position,recordIds:b.nearbyNpcs.map(r=>r.record_id)},DENSE_MONSTER_SCENE:{center:b.overlap[0].position,recordIds:b.overlap.map(r=>r.record_id)},MIXED_SCENE:{center:b.animatedNpc.position,npcRecordId:b.animatedNpc.record_id,monsterRecordIds:[b.animatedMonster,...b.overlap.slice(0,2)].map(r=>r.record_id)}};
  let helperSource=productionSource(protectedSources[helper]);
  for(const [name,value] of Object.entries(scenes)) {
    const expression=new RegExp(`(export const ${name} = (?:record|Object\\.freeze)\\()([\\s\\S]*?)(\\);\\n)`);
    const match=expression.exec(helperSource);
    if(!match || !match[2].startsWith('{') || !match[2].endsWith('}')) reject(`unknown protected presentation slot ${name}`);
    helperSource=helperSource.replace(expression,(_,open,old,close)=>open+conditional(old,JSON.stringify(value))+close);
  }
  result[helper]=QUALIFICATION_PREFIX+helperSource;
  return freeze(result);
}

export function validateQualificationHarnessBindings({ protectedSources, candidateSources, bindings } = {}) {
  sourceMap(candidateSources);
  const expected=renderQualificationHarnessBindings({protectedSources,bindings});
  if(canonicalJson(Object.keys(expected).sort())!==canonicalJson(Object.keys(candidateSources).sort())) reject('candidate source inventory drift');
  for(const [name,source] of Object.entries(expected)) if(candidateSources[name]!==source) reject(`candidate oracle source differs from protected binding contract: ${name}`);
  return freeze({accepted:true,dataCapability:'qualification_fixture',productDigest:bindings.productDigest,sourceDigest:digest(canonicalJson(expected))});
}
