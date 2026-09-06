import { qualificationBindingFixture } from './fixtures/qualification-binding-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as bindings from '../../tools/verification/qualification-scenario-bindings.mjs';
const publication = () => ({initial:{x:80,y:55,floor:-7},anchors:[{x:48,y:16,floor:-7},{x:80,y:16,floor:-7},{x:112,y:16,floor:-7}],floor:{regionSpan:32,bounds:{x_min:32,x_max_exclusive:160,y_min:0,y_max_exclusive:96},chunks:[1,2,3,4].flatMap(x=>[0,1,2].map(y=>({logicalAddress:{region_x:x},contentId:`chunk-${x}-${y}`,groups:[{offset:0,bytes:100,yMin:y*32+16,yMaxExclusive:y*32+17}]})))}});
test('race binding finds two fresh ranges while retaining a visible anchor at actual canvas size',()=>{
 const target=bindings.selectQualificationRaceTarget(publication(),{width:800,height:700});
 assert.deepEqual(target,{x:54,y:16,floor:-7});
});
test('race binding rejects insufficient independent range identities',()=>{
 const p=publication();p.floor.chunks=p.floor.chunks.slice(0,1);
 assert.throws(()=>bindings.selectQualificationRaceTarget(p,{width:800,height:700}),/two uncached/);
});
test('race binding rejects viewport without a visible two-range scene',()=>{
 assert.throws(()=>bindings.selectQualificationRaceTarget(publication(),{width:0,height:700}),/two uncached/);
});

test('race binding rejects already cached group identities',()=>{
 const p=publication(); p.initial={x:80,y:16,floor:-7};
 p.floor.chunks.forEach(c=>{c.contentId='same';});
 assert.throws(()=>bindings.selectQualificationRaceTarget(p,{width:800,height:700}),/two uncached/);
});

import fs from 'node:fs';

test('emitted race and mobile bindings execute while production bindings remain unchanged',async t=>{
 const fixture=qualificationBindingFixture(t);
 const admitted=bindings.resolveQualificationScenarioBindings({productRoot:fixture.root,expectedProductDigest:fixture.seal()});
 const sources={};for(const dir of ['tests','support'])for(const name of fs.readdirSync(`e2e/${dir}`))if(name.endsWith('.mjs'))sources[`${dir}/${name}`]=fs.readFileSync(`e2e/${dir}/${name}`,'utf8');
 const emitted=bindings.renderQualificationHarnessBindings({protectedSources:sources,bindings:admitted});
 const race=emitted['tests/race-desktop.spec.mjs'];
 const start=race.indexOf('  const __atlasRaceTarget = ');const end=race.indexOf('  const faults = ',start);
 assert.ok(start>=0&&end>start);
 const evaluate=new Function('__atlasQualification','page',`return (async()=>{${race.slice(start,end)} return __atlasRaceTarget;})();`);
 const target=await evaluate(true,{locator:()=>({boundingBox:async()=>({width:800,height:700})})});
 assert.ok(Number.isSafeInteger(target.x)&&Number.isSafeInteger(target.y));
 assert.equal(await evaluate(false,null),null);
 const mobile=emitted['tests/geometry-mobile.spec.mjs'];
 const args=[...mobile.matchAll(/aligned = await resizeAndAlign\(page, (.*)\);/g)].map(m=>m[1]);
 const sizes=mode=>args.map(arg=>new Function('__atlasQualification',`return [${arg}];`)(mode));
 assert.deepEqual(sizes(true),[[375,812],[844,390],[390,844]]);
 assert.deepEqual(sizes(false),[[390,844],[844,390],[390,844]]);
 const repeated=bindings.renderQualificationHarnessBindings({protectedSources:emitted,bindings:admitted});
 assert.deepEqual(repeated,emitted);
});
