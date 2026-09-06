import fs from 'node:fs';
import path from 'node:path';
import {canonicalJson} from './verification-plan-schema.mjs';
import {protectedReviewDigest,validateProtectedVisualCapture} from './protected-review-evidence.mjs';

/** Collect protected test output as data. This never asserts perceptual approval. */
export function collectProtectedVisualCapture({artifactRoot,currentCandidate,authority,producer}) {
 const fail=message=>{throw new TypeError(`protected visual capture: ${message}`);};
 const root=path.resolve(artifactRoot);
 if(!fs.lstatSync(root).isDirectory()||fs.lstatSync(root).isSymbolicLink())fail('regular artifact root required');
 const regular=relative=>{
  if(typeof relative!=='string'||relative.includes('\\')||relative.startsWith('/')||relative.split('/').some(p=>!p||p==='.'||p==='..'))fail('unsafe capture path');
  let target=root;
  for(const part of relative.split('/')){target=path.join(target,part);if(fs.lstatSync(target).isSymbolicLink())fail('capture symlink');}
  if(!fs.lstatSync(target).isFile())fail('regular capture file required');
  return fs.readFileSync(target);
 };
 const manifests=[];
 function walk(relative){
  const dir=path.join(root,relative),stat=fs.lstatSync(dir);if(stat.isSymbolicLink()||!stat.isDirectory())fail('capture directory invalid');
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
   const child=path.posix.join(relative,entry.name);if(entry.isSymbolicLink())fail('capture symlink');
   if(entry.isDirectory())walk(child);
   else if(entry.name==='manifest.json')manifests.push({relative:child,value:JSON.parse(regular(child))});
  }
 }
 walk('user-visual-evidence');
 const files=[{path:'summary.json',bytes:regular('summary.json')}],frames=[];
 for(const required of authority.requiredFrames){
  const matches=manifests.filter(m=>m.value.scenarioId===required.frameId);
  if(matches.length!==1)fail(`complete unique frame required: ${required.frameId}`);
  const {relative,value:m}=matches[0],project=required.scenarioId.split('::')[0];
  if(m.version!==1||m.atlasRevision!==currentCandidate.headSha||m.targetMode!=='checkout-overlay'||m.browserProfile!==project||m.browserName!=='chromium'||m.screenshot!=='viewport.png'||![m.viewport?.width,m.viewport?.height,m.deviceScaleFactor].every(n=>Number.isFinite(n)&&n>0))fail('frame identity or viewport drift');
  const file=path.posix.join(path.posix.dirname(relative),m.screenshot),bytes=regular(file),digest=protectedReviewDigest(bytes);
  if(digest!==m.screenshotSha256)fail('frame pixels drift');
  files.push({path:file,bytes});frames.push({frameId:required.frameId,scenarioId:required.scenarioId,path:file,digest});
 }
 const capture={schemaVersion:1,kind:'protected-visual-capture',candidate:currentCandidate,producer,
  planDigest:authority.planDigest,oracleDigest:authority.oracleDigest,productDigest:authority.productDigest,
  dataCapability:authority.dataCapability,scenarioIds:authority.scenarioIds,
  summary:{path:'summary.json',digest:protectedReviewDigest(files[0].bytes)},frames};
 const captureBytes=Buffer.from(canonicalJson(capture));
 validateProtectedVisualCapture({currentCandidate,authority,captureBytes,files,...(currentCandidate.prNumber===null?{executionKind:'shadow'}:{})});
 for(const file of files)if(!regular(file.path).equals(file.bytes))fail('capture changed before publication');
 return {capture,files};
}
