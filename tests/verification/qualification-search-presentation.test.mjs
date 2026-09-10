import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../web/fullworld-search.mjs',import.meta.url),'utf8');
function actual(name,next,context){const start=source.indexOf(`function ${name}(`),end=source.indexOf(`function ${next}(`,start);assert.ok(start>=0&&end>start);return vm.runInNewContext(`${source.slice(start,end).replace(/async\s*$/,'')};${name}`,context);}
function element(){return {children:[],textContent:'',append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){},addEventListener(type,handler){this[type]=handler;}};}
function inspector(mode,staticCreature=false){const host=element(),pill=element();const authority=mode==='qualification_fixture'?'Oteryn/Oteryn-Atlas':'Oteryn/Oteryn-Game';const record={kind:'town',label:'Fixture Harbor',position:{x:1,y:2,floor:-7},id:'town:1',capabilities:['navigation'],bounds:null,provenance:{authority,source_capability:staticCreature?'static-creatures-v1':'qualification-semantic-search-v1'}};const render=actual('renderActiveInspector','loadCreatureSearch',{state:{active:record,index:{source:{game_revision:mode==='qualification_fixture'?'fixture':'a'.repeat(40),profile_id:'profile'}}},SOURCE_EXPECTATIONS:{mode,semanticSearch:{authority}},document:{querySelector:s=>s==='#inspector-content'?host:pill,createElement:element},kindLabel:x=>x,displayFloor:x=>x,addActiveLayer(){}});render();return host.children.map(x=>x.textContent);}
test('qualification inspector attributes source and unpublished bounds to fixture authority',()=>{const text=inspector('qualification_fixture');assert.ok(text.includes('Source: Oteryn/Oteryn-Atlas@fixture · profile'));assert.ok(text.includes('Authoritative bounds: not published by fixture.'));assert.ok(!text.some(x=>x.includes('Oteryn/Oteryn-Game')));});
test('production inspector keeps canonical Game attribution and unavailable bounds wording',()=>{const text=inspector('production');assert.ok(text.includes('Source: Oteryn/Oteryn-Game@aaaaaaaaaaaa · profile'));assert.ok(text.includes('Authoritative bounds: not published by Game.'));assert.ok(inspector('production',true).includes('Source: Oteryn/Oteryn-Game · static-creatures-v1'));});
test('overlay-only search results remain discoverable but cannot navigate',()=>{
 const host=element(),overlay={id:'poi:1',label:'Fixture Point',kind:'poi',position:{x:1,y:2,floor:-7},capabilities:['overlay-point']},navigable={...overlay,id:'town:1',capabilities:['navigation']};
 let navigations=0;const render=actual('renderResults','wireForm',{state:{index:{},status:'READY'},queryAll:()=>[overlay,navigable],document:{createElement:element},kindLabel:x=>x,displayFloor:x=>x,navigate:()=>navigations++,publish(){}});render(host,'Fixture');
 assert.equal(host.children.length,2);assert.equal(host.children[0].disabled,true);assert.notEqual(host.children[1].disabled,true);host.children[1].click();assert.equal(navigations,1);
 const location={search:'?original'};const navigate=actual('navigate','hideResults',{location,state:{index:{}},navigationSearchParams:()=>new URLSearchParams('x=1')});navigate(overlay,'Fixture');assert.equal(location.search,'?original');navigate(navigable,'Fixture');assert.equal(location.search,'x=1');
});

test('canonical static creature placements retain direct navigation',()=>{
 const location={search:'?original'};const navigate=actual('navigate','hideResults',{location,state:{index:{}},navigationSearchParams:()=>new URLSearchParams('x=1')});
 navigate({kind:'npc',record_id:'npc:'+ 'a'.repeat(32),capabilities:['static-placement']},'Sam');assert.equal(location.search,'x=1&creature=npc%3A'+ 'a'.repeat(32));
});
