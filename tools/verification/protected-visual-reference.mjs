// Execute only from protected authority. The producer owns reference source,
// publication validation, server isolation, browser launch, and live readbacks.
import crypto from 'node:crypto';
import { canonicalJson } from './verification-plan-schema.mjs';
export const PROTECTED_VISUAL_BROWSER = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const contracts = new WeakSet();
const reject = message => { throw new TypeError(`protected visual reference: ${message}`); };
const freeze = value => { if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
const digest = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const keys = ['repository','pr','headSha','baseSha','candidateTree','referenceTree','productDigest','workflow','runId','jobId','attempt','browserImage'];
function validateIdentity(value) {
 if(!value || canonicalJson(Object.keys(value).sort())!==canonicalJson([...keys].sort()))reject('incomplete or expanded identity');
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository))reject('repository');
 for(const key of ['headSha','baseSha','candidateTree','referenceTree'])if(!/^[a-f0-9]{40}$/.test(value[key]))reject(key);
 if(value.pr!==null&&(!Number.isSafeInteger(value.pr)||value.pr<1))reject('pr');
 for(const key of ['runId','jobId'])if(!Number.isSafeInteger(value[key]) || value[key]<1)reject(key);
 if(value.attempt!==1 || value.browserImage!==PROTECTED_VISUAL_BROWSER || !/^sha256:[a-f0-9]{64}$/.test(value.productDigest) || !/^\.github\/workflows\/[A-Za-z0-9_-]+\.ya?ml$/.test(value.workflow))reject('producer, product or browser identity');
}
export function createProtectedVisualReferenceContract({identity,navigation,referenceOrigin}={}) {
 validateIdentity(identity);
 const origin=new URL(referenceOrigin);
 if(!['http:','https:'].includes(origin.protocol)||origin.origin!==referenceOrigin||origin.username||origin.password)reject('reference origin');
 if(typeof navigation?.id!=='string'||!navigation.id||typeof navigation.label!=='string'||!navigation.label||![navigation.position?.x,navigation.position?.y,navigation.position?.floor].every(Number.isSafeInteger))reject('navigation');
 const nav={id:navigation.id,label:navigation.label,position:{...navigation.position}};
 const scenarios=[['desktop-chromium','desktop-inspector.png',{viewport:{width:1440,height:900}},2,'map'],['mobile-chromium','mobile-inspector-panel.png',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2},2,'auto']].map(([project,name,context,zoom,mode])=>{
  const query=new URLSearchParams({x:String(nav.position.x),y:String(nav.position.y),floor:String(nav.position.floor),zoom:String(zoom),mode,creatures:'npc,monster',semantic:nav.id,selected:`${nav.position.floor}:${nav.position.x}:${nav.position.y}`,q:nav.label.slice(0,256),layers:'minimap-overview'});
  if(project==='desktop-chromium')query.set('animation','off');
  return {project,name,selector:'#mobile-inspector-panel',entry:`/web/fullworld.html?${query}`,context:{...context,locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'},screenshot:{animations:'disabled',caret:'hide',scale:'css'}};
 });
 const contract=freeze({schemaVersion:1,identity:structuredClone(identity),navigation:nav,referenceOrigin,scenarios});contracts.add(contract);return contract;
}
export function validateProtectedVisualReferenceReadback(contract,identity) {
 if(!contracts.has(contract))reject('requires protected contract');
 validateIdentity(identity);
 if(canonicalJson(identity)!==canonicalJson(contract.identity))reject('exact identity drift');
 return true;
}
// A seal records trusted capture bytes, not authorization of arbitrary images.
// Only producer-owned capture output may be published; candidate manifests are inert.
export function sealProtectedVisualReferences(contract,images) {
 if(!contracts.has(contract))reject('requires protected contract');
 if(!(images instanceof Map)||images.size!==contract.scenarios.length)reject('incomplete reference images');
 const rows=contract.scenarios.map(s=>{
  const bytes=images.get(s.project);
  if(!Buffer.isBuffer(bytes)||bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)<1||bytes.readUInt32BE(20)<1)reject('invalid reference PNG');
  return {project:s.project,name:s.name,bytes:bytes.length,sha256:digest(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 });
 return freeze({schemaVersion:1,identity:contract.identity,contractDigest:digest(canonicalJson(contract)),images:rows});
}
export function validateProtectedVisualReferences({contract,manifest,images}={}) {
 const expected=sealProtectedVisualReferences(contract,images);
 if(canonicalJson(expected)!==canonicalJson(manifest))reject('reference evidence drift or incomplete');
 return expected;
}

// Uses a normal supported semantic deep link ONLY for the independent reference.
// The candidate scenario still must complete its full search/selection journey.
// The producer must provide a browser launched in the pinned protected image and
// an isolated origin serving protected-base UI and the independently verified
// read-only product. readback must freshly verify those bytes and live identity.
export async function captureProtectedVisualReferences({contract,browser,readback}={}) {
 if(typeof readback!=='function')reject('fresh producer readback required');
 validateProtectedVisualReferenceReadback(contract,await readback());
 const images=new Map();
 for(const scenario of contract.scenarios){
  const context=await browser.newContext(scenario.context);
  try {
   const page=await context.newPage();
   const failures=[];
   page.on('pageerror',error=>failures.push(error.message));
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===contract.referenceOrigin?route.continue():route.abort('blockedbyclient');
   });
   const response=await page.goto(new URL(scenario.entry,contract.referenceOrigin).href,{waitUntil:'domcontentloaded',timeout:60_000});
   const headers=response?.headers()??{};
   if(!response?.ok()||(headers['x-oteryn-atlas-code-revision']||headers['x-oteryn-atlas-revision'])!==contract.identity.baseSha)reject('reference response source revision');
   await page.waitForFunction(()=>['PASS','FAIL'].includes(document.querySelector('#qualification-result')?.dataset.status),null,{timeout:90_000});
   const result=JSON.parse(await page.locator('#qualification-result').textContent());
   if(result.status!=='PASS'||result.error!==null||result.capabilities?.blockedOrUnknownEnabled!==false)reject('reference product qualification');
   await page.waitForFunction(()=>globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.status==='PASS',null,{timeout:30_000});
   const content=await page.locator('#inspector-content').textContent();
   if(!content?.includes(contract.navigation.label)||!content.includes(contract.navigation.id))reject('reference inspector binding');
   if(scenario.project==='mobile-chromium'){
    const toggle=page.getByRole('button',{name:'Open inspector'});
    await toggle.tap();
    if(await toggle.getAttribute('aria-expanded')!=='true')reject('reference inspector did not open');
    await page.waitForFunction(()=>{const rect=document.querySelector('#mobile-inspector-panel').getBoundingClientRect();return Math.abs(rect.right-innerWidth)<=1&&rect.left>=-1;},null,{timeout:15_000});
   }
   const locator=page.locator(scenario.selector);
   const first=await locator.screenshot({...scenario.screenshot,timeout:15_000});
   const second=await locator.screenshot({...scenario.screenshot,timeout:15_000});
   if(!first.equals(second))reject('unstable independent reference');
   if(failures.length)reject(`reference runtime failures: ${failures.join('; ')}`);
   images.set(scenario.project,second);
  } finally {await context.close();}
 }
 validateProtectedVisualReferenceReadback(contract,await readback());
 return {manifest:sealProtectedVisualReferences(contract,images),images};
}

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
// Call on the host before and after capture, while the source is mounted read-only.
// Compare bytes directly with protected Git objects; a revision header alone is
// never evidence that a candidate server is the protected reference renderer.
export function validateProtectedVisualReferenceSource({root,baseSha,referenceTree}={}) {
 if(!/^[a-f0-9]{40}$/.test(baseSha??'')||!/^[a-f0-9]{40}$/.test(referenceTree??'')||!root)reject('reference source identity');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
 if(git(['rev-parse','HEAD']).trim()!==baseSha||git(['rev-parse',`${baseSha}^{tree}`]).trim()!==referenceTree)reject('reference source revision');
 const expected=new Map(git(['ls-tree','-r','-z',baseSha,'--','web','src']).split('\0').filter(Boolean).map(row=>{
  const match=/^(100644) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
  if(!match)reject('reference source must be regular');return [match[3],match[2]];
 }));
 const actual=new Map();
 function walk(relative){
  const absolute=path.join(root,relative),stat=fs.lstatSync(absolute);
  if(stat.isSymbolicLink())reject('reference source must be regular');
  if(stat.isDirectory())for(const name of fs.readdirSync(absolute).sort())walk(`${relative}/${name}`);
  else if(stat.isFile()){
   const bytes=fs.readFileSync(absolute);
   const hash=crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');actual.set(relative,hash);
  }else reject('reference source must be regular');
 }
 walk('web');walk('src');
 if(!expected.size||canonicalJson([...expected.keys()].sort())!==canonicalJson([...actual.keys()].sort()))reject('reference source file set drift');
 for(const [name,hash]of expected)if(actual.get(name)!==hash)reject(`reference source bytes drift: ${name}`);
 return freeze({baseSha,referenceTree,sourceDigest:digest(canonicalJson([...actual].sort(([a],[b])=>a.localeCompare(b))))});
}

export function validateProtectedVisualReferenceMounts({referencePaths,candidateWritablePaths}={}) {
 if(!Array.isArray(referencePaths)||!referencePaths.length||!Array.isArray(candidateWritablePaths)||!candidateWritablePaths.length)reject('complete mount graph required');
 const canonical=p=>{if(typeof p!=='string'||!path.isAbsolute(p))reject('absolute mount path required');return fs.realpathSync(p);};
 const writable=candidateWritablePaths.map(canonical);
 for(const reference of referencePaths.map(canonical))for(const mount of writable)if(reference===mount||reference.startsWith(mount+path.sep))reject('reference reachable through candidate writable mount');
 return true;
}
export function validateProtectedVisualReferenceFiles({contract,manifest,imagePaths}={}) {
 if(!(imagePaths instanceof Map))reject('reference image paths required');
 const images=new Map([...imagePaths].map(([project,file])=>{
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink())reject('reference image must remain regular');
  return [project,fs.readFileSync(file)];
 }));
 return validateProtectedVisualReferences({contract,manifest,images});
}
