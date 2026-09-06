import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { qualificationBindingFixture } from './fixtures/qualification-binding-fixture.mjs';
import { resolveQualificationScenarioBindings, renderQualificationHarnessBindings } from '../../tools/verification/qualification-scenario-bindings.mjs';
import { resolveQualificationEntry } from '../../e2e/tests/qualification-navigation.mjs';
const entry='/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
const descriptor={marker:'oteryn-atlas-qualification-trust-v1',fixtureId:'atlas-qualification-world-v2',dataCapability:'qualification_fixture'};
for(const field of ['publicationRoot','semanticRoot','pixelRoot','overviewRoot','minimapRoot','runtimeIndexRoot','pixelBucketRoot','sourceFingerprint','productDigest']) descriptor[field]='sha256:'+'a'.repeat(64);
const index={source:{fixture_id:descriptor.fixtureId,semantic_digest:descriptor.semanticRoot,contract_id:'oteryn-atlas-qualification-fixture-v1',capability:'qualification-semantic-search-v1'},records:[{capabilities:['navigation'],position:{x:20,y:20,floor:-7}}]};
function sources(){const result={};for(const dir of ['tests','support'])for(const name of fs.readdirSync(`e2e/${dir}`))if(name.endsWith('.mjs'))result[`${dir}/${name}`]=fs.readFileSync(`e2e/${dir}/${name}`,'utf8');return result;}
function generate(t){const f=qualificationBindingFixture(t);const b=resolveQualificationScenarioBindings({productRoot:f.root,expectedProductDigest:f.seal()});return {b,rendered:renderQualificationHarnessBindings({protectedSources:sources(),bindings:b})};}
async function navigate(source,qualification,{ok=true,revision='exact'}={}){
 const start=source.indexOf('export async function gotoAtlas('),end=source.indexOf('\nexport ',start+1);
 const body=source.slice(start,end<0?undefined:end).replace('export ','');
 const expect=value=>({not:{toBeNull:()=>assert.notEqual(value,null)},toBeTruthy:()=>assert.ok(value),toBe:expected=>assert.equal(value,expected)});
 const run=new Function('__atlasQualification','resolveQualificationEntry','process','readQualificationSemanticIndex','expect',`${body};return gotoAtlas;`)(qualification,resolveQualificationEntry,{env:{ATLAS_QUALIFICATION_TRUST_JSON:JSON.stringify(descriptor),ATLAS_EXPECTED_REVISION:'exact'}},async()=>index,expect);
 let visited;
 await run({goto:async url=>{visited=url;return {ok:()=>ok,status:()=>ok?200:500,headers:()=>({'x-oteryn-atlas-code-revision':revision})};}},entry);
 return visited;
}
test('generated qualification navigation preserves the already bound canonical entry',async t=>{
 const {b,rendered}=generate(t);
 assert.equal(await navigate(rendered['tests/runtime.mjs'],true),entry);
 assert.deepEqual(renderQualificationHarnessBindings({protectedSources:rendered,bindings:b}),rendered);
});
test('production arm preserves existing navigation resolution behavior',async t=>{
 assert.equal(await navigate(generate(t).rendered['tests/runtime.mjs'],false),await navigate(sources()['tests/runtime.mjs'],false));
});
test('generated navigation retains HTTP and exact revision assertions',async t=>{
 const source=generate(t).rendered['tests/runtime.mjs'];
 await assert.rejects(()=>navigate(source,true,{ok:false}));
 await assert.rejects(()=>navigate(source,true,{revision:'wrong'}));
});
test('unknown protected navigation source shape fails closed',t=>{
 const {b}=generate(t), source=sources();
 source['tests/runtime.mjs']=source['tests/runtime.mjs'].replace('readSemanticIndex: () => readQualificationSemanticIndex(page)', 'readSemanticIndex: () => otherReader(page)');
 assert.throws(()=>renderQualificationHarnessBindings({protectedSources:source,bindings:b}),/navigation binding slot/);
});
