import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createProtectedVisualReferenceContract,captureProtectedVisualReferences,validateProtectedVisualReferences,validateProtectedVisualReferenceSource,validateProtectedVisualReferenceMounts,validateProtectedVisualReferenceFiles,PROTECTED_VISUAL_BROWSER} from './protected-visual-reference.mjs';

// Host-only orchestration. Candidate never runs while reference output is writable.
export async function runProtectedVisualReference({protectedRoot,referenceRoot=protectedRoot,outputRoot,identity,navigation,composeEnv,freshReadback,candidateWritablePaths}={}) {
 if(typeof freshReadback!=='function')throw new TypeError('protected visual reference requires live readback');
 fs.mkdirSync(outputRoot,{mode:0o700});
 const snapshots=path.join(outputRoot,'visual-reference-snapshots');fs.mkdirSync(snapshots);
 const output=path.join(outputRoot,'visual-reference');fs.mkdirSync(output,{mode:0o777});fs.chmodSync(output,0o777);
 const source=()=>validateProtectedVisualReferenceSource({root:referenceRoot,baseSha:identity.baseSha,referenceTree:identity.referenceTree});
 validateProtectedVisualReferenceMounts({referencePaths:[outputRoot],candidateWritablePaths});
 source();await freshReadback();
 const contract=createProtectedVisualReferenceContract({identity,navigation,referenceOrigin:'http://atlas-web:8080'});
 const input=path.join(outputRoot,'visual-reference-input.json');fs.writeFileSync(input,JSON.stringify({identity,navigation,referenceOrigin:contract.referenceOrigin}));
 const env={...composeEnv,ATLAS_EXECUTION_CONTEXT:referenceRoot,ATLAS_CODE_REVISION:identity.baseSha,COMPOSE_PROJECT_NAME:`${composeEnv.COMPOSE_PROJECT_NAME}-reference`,ATLAS_REFERENCE_AUTHORITY:protectedRoot,ATLAS_REFERENCE_INPUT:input,ATLAS_REFERENCE_OUTPUT:output};
 const compose=['compose','-f',path.join(protectedRoot,'e2e/compose.protected-hosted-executor.yml'),'-f',path.join(protectedRoot,'e2e/compose.github-hosted.yml'),'-f',path.join(protectedRoot,'e2e/compose.protected-visual-reference.yml')];
 const run=args=>execFileSync('docker',[...compose,...args],{env,stdio:'inherit',timeout:600_000});
 try {run(['up','-d','--wait','atlas-publication','atlas-web']);run(['run','--rm','reference-capture']);}
 finally {run(['down','-v','--remove-orphans']);}
 source();await freshReadback();
 const images=new Map(contract.scenarios.map(s=>[s.project,fs.readFileSync(path.join(output,`${s.project}.png`))]));
 const manifest=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
 validateProtectedVisualReferences({contract,manifest,images});
 // Dedicated external expected-data directory; no candidate file is modified.
 for(const s of contract.scenarios){const stem=s.name.slice(0,-4);fs.writeFileSync(path.join(snapshots,`${stem}-${s.project}-linux.png`),images.get(s.project),{flag:'wx',mode:0o444});}
 const imagePaths=new Map(contract.scenarios.map(s=>[s.project,path.join(snapshots,`${s.name.slice(0,-4)}-${s.project}-linux.png`)]));
 const revalidate=async()=>{
  validateProtectedVisualReferenceMounts({referencePaths:[outputRoot],candidateWritablePaths});
  source();await freshReadback();
  validateProtectedVisualReferenceFiles({contract,manifest,imagePaths});
  validateProtectedVisualReferenceFiles({contract,manifest,imagePaths:new Map(contract.scenarios.map(s=>[s.project,path.join(output,`${s.project}.png`)]))});
  if(JSON.stringify(JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8')))!==JSON.stringify(manifest))throw new TypeError('reference manifest drift');
 };
 return {snapshots,manifest,revalidate};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [inputFile,output]=process.argv.slice(2),input=JSON.parse(fs.readFileSync(inputFile,'utf8'));
 const require=createRequire('/protected/e2e/package.json');const {chromium}=require('playwright');
 const contract=createProtectedVisualReferenceContract(input);
 if(contract.identity.browserImage!==PROTECTED_VISUAL_BROWSER)throw new TypeError('reference image mismatch');
 const browser=await chromium.launch({headless:true});
 try {
  // Container has only protected code/input. Host performs fresh GitHub and source
  // reads around this isolated process; no network token is exposed here.
  const result=await captureProtectedVisualReferences({contract,browser,readback:async()=>input.identity});
  for(const [project,bytes]of result.images)fs.writeFileSync(path.join(output,`${project}.png`),bytes,{flag:'wx'});
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(result.manifest),{flag:'wx'});
 }finally{await browser.close();}
}
