import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { qualificationBindingFixture } from './fixtures/qualification-binding-fixture.mjs';
import { resolveQualificationScenarioBindings, renderQualificationHarnessBindings } from '../../tools/verification/qualification-scenario-bindings.mjs';
function setup(t){const fixture=qualificationBindingFixture(t);const source={};for(const dir of ['tests','support'])for(const name of fs.readdirSync(`e2e/${dir}`))if(name.endsWith('.mjs'))source[`${dir}/${name}`]=fs.readFileSync(`e2e/${dir}/${name}`,'utf8');return {fixture,source,render(){const b=resolveQualificationScenarioBindings({productRoot:fixture.root,expectedProductDigest:fixture.seal()});return {b,rendered:renderQualificationHarnessBindings({protectedSources:source,bindings:b})};}};}
function entry(source,name,qualification){const line=source.split('\n').find(line=>line.startsWith(`const ${name} = `));assert.ok(line);return new Function('__atlasQualification',`${line};return ${name};`)(qualification);}
test('actual rendered probe entry uses trusted fixture navigation and preserves production capture options',t=>{
 const {b,rendered}=setup(t).render();const source=rendered['tests/render-probes-desktop.spec.mjs'];
 const qualified=new URL(entry(source,'ENTRY',true),'http://atlas-web:8080');
 assert.equal(qualified.searchParams.get('x'),String(b.navigation.position.x));
 assert.equal(qualified.searchParams.get('y'),String(b.navigation.position.y));
 assert.equal(qualified.searchParams.get('capture'),'1');assert.equal(qualified.searchParams.get('sync-evidence'),'1');assert.equal(qualified.searchParams.get('animation'),'off');
 assert.equal(new URL(entry(source,'ENTRY',false),'http://atlas-web:8080').searchParams.get('x'),'32369');
});
test('every qualification-capability historical gotoAtlas caller binds out-of-bounds defaults',t=>{
 const fixture=setup(t),{rendered}=fixture.render();
 const inventory=JSON.parse(fs.readFileSync('tools/verification/e2e-data-capability-inventory.json'));
 const qualified=inventory.specs.filter(s=>s.dataCapability==='qualification_fixture').map(s=>s.spec.slice(4));
 for(const name of qualified){const source=rendered[name];assert.equal(typeof source,'string');if(!source.includes('gotoAtlas'))continue;
  for(const match of source.matchAll(/['"]\/web\/fullworld\.html\?x=32369&y=32241&floor=-7[^'"]*['"]/g)){
   assert.equal(source.slice(match.index-3,match.index),' : ',`unbound qualification navigation in ${name}`);
  }
 }
 for(const item of inventory.specs.filter(s=>s.spec.includes('creature-gameplay-'))){assert.equal(item.dataCapability,'bounded_real_world');assert.equal(rendered[item.spec.slice(4)],fixture.source[item.spec.slice(4)]);}
});
test('visual canonical coordinates are preserved only when inside independently bound floor bounds',t=>{
 const f=setup(t);let rendered=f.render().rendered;
 assert.equal(new URL(entry(rendered['tests/visual-desktop.spec.mjs'],'VISUAL_ENTRY',true),'http://atlas-web:8080').searchParams.get('x'),'20');
 f.fixture.edit('runtime-index/floors/f-7.json',floor=>{floor.bounds.x_max_exclusive=32400;floor.bounds.y_max_exclusive=32400;});
 rendered=f.render().rendered;
 assert.equal(new URL(entry(rendered['tests/visual-desktop.spec.mjs'],'VISUAL_ENTRY',true),'http://atlas-web:8080').searchParams.get('x'),'32369');
});
