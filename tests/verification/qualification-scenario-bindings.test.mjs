import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../tools/verification/verification-plan-schema.mjs';
import * as module from '../../tools/verification/qualification-scenario-bindings.mjs';
const sha = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-bindings-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root,name)), {recursive:true}); fs.writeFileSync(path.join(root,name), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  const at = x => ({x,y:20,floor:-7});
  const creature = (kind, id, name, x, roles = [], dynamic = false) => ({kind,record_id:`${kind}:${id.repeat(32)}`,entity_id:`${kind}-entity:${id.repeat(32)}`,name,position:at(x),roles,presentation_resolution_state:dynamic?'RESOLVED':'FALLBACK_MARKER',...(dynamic?{outfit_presentation:{outfit_presentation_id:`outfit:${kind}`}}:{})});
  const creatures = [creature('npc','1','Guide',20,['shop','quest']),creature('npc','2','Walker',21,['travel','shop','quest','blessing','trainer'],true),creature('npc','3','A cartographer with a very long meaningful name',22),creature('monster','a','Sentinel',23,[],true),...['b','c','d'].map(id=>creature('monster',id,`Raider ${id}`,24))];
  put('web/semantic-search/index.json',{records:[{label:'Harbor',position:at(20),capabilities:['navigation']}]});
  put('data/creatures/search.json',{records:creatures.map(({name,...record})=>({...record,label:name}))});
  put('data/creatures/index.json',{chunks:[{path:'chunks/entities.json'}]});
  put('data/creatures/chunks/entities.json',{records:creatures});
  const tiles = [20,21,22,23].map(x=>({record_type:'tile',position:at(x),presentation:[{resolved_primitives:[{width_units:32,height_units:32}]}]})).map(JSON.stringify).join('\n')+'\n';
  put('publication/semantic/chunks/tiles.jsonl',tiles);
  put('runtime-index/floors/f-7.json',{bounds:{x_min:10,x_max_exclusive:40,y_min:10,y_max_exclusive:40},chunks:[{path:'chunks/tiles.jsonl',contentId:sha(tiles),bytes:Buffer.byteLength(tiles)}]});
  const pixels=Buffer.from([1,2,3,255,4,5,6,255]);
  const ids=[sha(pixels.subarray(0,4)),sha(pixels.subarray(4,8))];
  const programs={profile:'oteryn-atlas-animation-runtime-v1',creature_programs:['npc','monster'].map(kind=>({outfit_presentation_id:`outfit:${kind}`,phase_count:2,phase_content_ids:ids,width:1,height:1,animation:{presentation_durations_ms:[100,100],loop_type:'infinite',synchronized:false,default_start_phase:0,loop_count:0}})),blob_index:Object.fromEntries(ids.map((id,i)=>[id,{bucket:'rgba',offset:i*4,bytes:4,width:1,height:1}]))};
  put('animation/programs.json',programs);
  put('animation/buckets/rgba',pixels);
  put('animation/manifest.json',{programs:{path:'programs.json'},buckets:[{id:'rgba',path:'buckets/rgba',bytes:8,digest:sha(pixels)}]});
  const edit=(name,fn)=>{ const value=JSON.parse(fs.readFileSync(path.join(root,name))); fn(value);put(name,value); };
  const seal=()=>{const files=[]; const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name!=='fixture-manifest.json'){const bytes=fs.readFileSync(full);files.push({path:path.relative(root,full).split(path.sep).join('/'),bytes:bytes.length,digest:sha(bytes)});}}};walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));const productDigest=sha(`${canonicalJson(files)}\n`);put('fixture-manifest.json',{files,productDigest});return productDigest;};
  return {root,put,edit,seal};
}
function resolve(f) {assert.equal(typeof module.resolveQualificationScenarioBindings,'function','protected binding resolver must exist');return module.resolveQualificationScenarioBindings({productRoot:f.root,expectedProductDigest:f.seal()});}
test('valid independent publication yields immutable structural scenario bindings',t=>{const f=fixture(t);const b=resolve(f);assert.equal(b.navigation.label,'Harbor');assert.equal(b.overflowNpc.roles.length,5);assert.equal(b.distinct.length,4);assert.equal(b.animatedMonster.name,'Sentinel');assert.equal(Object.isFrozen(b.overflowNpc.roles),true);});
for(const [name,edit] of [
 ['search identity disagreement',f=>f.edit('data/creatures/search.json',v=>v.records[0].entity_id='npc-entity:'+ 'f'.repeat(32))],
 ['out of bounds navigation',f=>f.edit('web/semantic-search/index.json',v=>v.records[0].position.x=100)],
 ['insufficient overflow roles',f=>{for(const p of ['data/creatures/search.json','data/creatures/chunks/entities.json'])f.edit(p,v=>v.records[1].roles.pop());}],
 ['duplicate publication records',f=>f.edit('data/creatures/chunks/entities.json',v=>v.records.push(v.records[0]))],
 ['duplicate search records',f=>f.edit('data/creatures/search.json',v=>v.records.push(v.records[0]))],
 ['single phase animation',f=>f.edit('animation/programs.json',v=>v.creature_programs[0].phase_count=1)],
 ['identical animation phases',f=>f.edit('animation/programs.json',v=>v.creature_programs[0].phase_content_ids[1]=v.creature_programs[0].phase_content_ids[0])],
 ['fake pixel content IDs',f=>f.edit('animation/programs.json',v=>Object.values(v.blob_index)[0].offset=4)],
 ['escaping chunk path',f=>f.edit('data/creatures/index.json',v=>v.chunks[0].path='../outside')],
 ['missing anchor publication',f=>f.edit('runtime-index/floors/f-7.json',v=>v.chunks=[])],
 ['unpublished anchor digest',f=>f.edit('runtime-index/floors/f-7.json',v=>v.chunks[0].contentId='sha256:'+'0'.repeat(64))],
 ['ambiguous navigation',f=>f.edit('web/semantic-search/index.json',v=>v.records.push(v.records[0]))],
])test(`rejects ${name}`,t=>{const f=fixture(t);edit(f);assert.equal(typeof module.resolveQualificationScenarioBindings,'function');assert.throws(()=>resolve(f));});
test('rejects stale digest after file drift without trusting candidate manifest',t=>{const f=fixture(t);const expectedProductDigest=f.seal();f.put('extra','drift');assert.equal(typeof module.resolveQualificationScenarioBindings,'function');assert.throws(()=>module.resolveQualificationScenarioBindings({productRoot:f.root,expectedProductDigest}));});
test('rejects a symlink instead of publication data',t=>{const f=fixture(t);const expectedProductDigest=f.seal();fs.symlinkSync('/etc/hosts',path.join(f.root,'link'));assert.equal(typeof module.resolveQualificationScenarioBindings,'function');assert.throws(()=>module.resolveQualificationScenarioBindings({productRoot:f.root,expectedProductDigest}));});
function protectedSources() {
  const result={};
  for(const dir of ['tests','support'])for(const name of fs.readdirSync(`e2e/${dir}`))if(name.endsWith('.mjs'))result[`${dir}/${name}`]=fs.readFileSync(`e2e/${dir}/${name}`,'utf8');
  return result;
}
test('candidate harness accepts only protected binding delta while preserving production and oracle source',t=>{
  const b=resolve(fixture(t)), source=protectedSources();
  assert.equal(typeof module.renderQualificationHarnessBindings,'function');
  const candidate=module.renderQualificationHarnessBindings({protectedSources:source,bindings:b});
  assert.equal(module.validateQualificationHarnessBindings({protectedSources:source,candidateSources:candidate,bindings:b}).accepted,true);
  assert.match(candidate['tests/desktop.spec.mjs'],/Thais/);
  assert.match(candidate['tests/desktop.spec.mjs'],/Harbor/);
  assert.equal(candidate['tests/visual-desktop.spec.mjs'].includes('comparePngOutsideRects'),true);
  for(const name of Object.keys(source))assert.deepEqual([...candidate[name].matchAll(/test\('([^']+)'/g)].map(m=>m[1]),[...source[name].matchAll(/test\('([^']+)'/g)].map(m=>m[1]),`stable titles ${name}`);
  const weakened={...candidate,'tests/visual-desktop.spec.mjs':candidate['tests/visual-desktop.spec.mjs'].replace('comparePngOutsideRects','fakeAlwaysPassing')};
  assert.throws(()=>module.validateQualificationHarnessBindings({protectedSources:source,candidateSources:weakened,bindings:b}),/oracle|source/);
  assert.throws(()=>module.validateQualificationHarnessBindings({protectedSources:source,candidateSources:{...candidate,'tests/bypass.spec.mjs':'test.skip()'},bindings:b}),/source/);
});
test('harness rejects candidate-defined bindings that did not pass protected resolution',()=>{
  assert.equal(typeof module.renderQualificationHarnessBindings,'function');
  assert.throws(()=>module.renderQualificationHarnessBindings({protectedSources:protectedSources(),bindings:{navigation:{label:'anything'}}}),/protected/);
});

test('protected binding contract supports a later fixture transition without another bootstrap',t=>{
  const first=fixture(t), sources=protectedSources();
  const admitted=module.renderQualificationHarnessBindings({protectedSources:sources,bindings:resolve(first)});
  const next=fixture(t);next.edit('web/semantic-search/index.json',v=>v.records[0].label='A second harbor');
  const rebound=module.renderQualificationHarnessBindings({protectedSources:admitted,bindings:resolve(next)});
  assert.match(rebound['tests/desktop.spec.mjs'],/A second harbor/);
  assert.match(rebound['tests/desktop.spec.mjs'],/Thais/);
  assert.doesNotMatch(rebound['tests/desktop.spec.mjs'],/"Harbor"/);
});
test('generated candidate files parse and presentation targets preserve production behavior',t=>{
  const f=fixture(t), candidate=module.renderQualificationHarnessBindings({protectedSources:protectedSources(),bindings:resolve(f)});
  for(const [name,source] of Object.entries(candidate)){
    const check=spawnSync(process.execPath,['--input-type=module','--check'],{input:source,encoding:'utf8'});
    assert.equal(check.status,0,`${name}: ${check.stderr}`);
  }
  const helper=candidate['support/creature-presentation-fixtures.mjs'];
  for(const [capability,label] of [['qualification_fixture','Walker'],['real_fullworld','Eremo'],['','Eremo']]){
    const run=spawnSync(process.execPath,['--input-type=module'],{input:helper+'\nconsole.log(OVERFLOW_NPC.label)',encoding:'utf8',env:{...process.env,ATLAS_E2E_DATA_CAPABILITY:capability}});
    assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),label);
  }
});

test('hostile candidate labels remain inert string and regex data',t=>{
  const f=fixture(t);
  const label="Harbor'); globalThis.compromised=true; // $& [a-z]+";
  f.edit('web/semantic-search/index.json',v=>v.records[0].label=label);
  const sources=protectedSources();
  const generated=module.renderQualificationHarnessBindings({protectedSources:sources,bindings:resolve(f)});
  const checked=spawnSync(process.execPath,['--input-type=module','--check'],{input:generated['tests/desktop.spec.mjs'],encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
  assert.equal(module.validateQualificationHarnessBindings({protectedSources:sources,candidateSources:generated,bindings:resolve(f)}).accepted,true);
});
test('missing protected source and modified production fallback are rejected',t=>{
  const sources=protectedSources(), bindings=resolve(fixture(t));
  const candidate=module.renderQualificationHarnessBindings({protectedSources:sources,bindings});
  const absent={...sources};delete absent['tests/race-desktop.spec.mjs'];
  assert.throws(()=>module.renderQualificationHarnessBindings({protectedSources:absent,bindings}),/missing protected/);
  assert.throws(()=>module.validateQualificationHarnessBindings({protectedSources:sources,candidateSources:{...candidate,'tests/desktop.spec.mjs':candidate['tests/desktop.spec.mjs'].replace(": 'Thais'",": 'ChangedProduction'")},bindings}),/oracle source/);
});
