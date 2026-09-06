import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadFullWorldPublication,loadSemanticWorld} from '../sources/src/browser/fullworld.mjs';
import {loadFullWorldPixelCatalog} from '../sources/src/browser/fullworld-pixels.mjs';
const root=fileURLToPath(new URL('../results/synthetic-build/',import.meta.url));
const results=[];
for(const name of ['control-same-width','cross-language-mixed']){
 const folder=path.join(root,name,'publication');const read=relative=>fs.readFileSync(path.join(folder,relative));
 const pub=JSON.parse(read('publication.json')),semantic=JSON.parse(read('semantic/world.json'));
 const trust={publicationRoot:pub.rootContentId,semanticRoot:pub.semantic.rootContentId,pixelRoot:pub.pixels.rootContentId,sourceFingerprint:semantic.sourceFingerprint};
 const fetcher=async(url)=>{const pathname=new URL(String(url)).pathname;const rel=pathname.replace(/^\/publication\//,'');const bytes=read(rel);return new Response(bytes,{headers:{'content-length':String(bytes.length)}});};
 let phase='publication',error=null;
 try{
  const loaded=await loadFullWorldPublication('https://audit.invalid/publication/',trust,fetcher);
  phase='semantic-world';await loadSemanticWorld('https://audit.invalid/publication/',loaded,trust,fetcher);
  phase='pixel-catalog';await loadFullWorldPixelCatalog('https://audit.invalid/publication/',loaded,trust,fetcher);
  phase='complete';
 }catch(e){error=e.message;}
 results.push({name,accepted:error===null,phase,error,trust});
}
const report={scope:'Original compiler outputs -> original JS publication, semantic-world and pixel-catalog loaders. Synthetic metadata/pixels only; not full runtime or real Game source verification.',results};
fs.writeFileSync(new URL('../results/synthetic-build-consumption.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
