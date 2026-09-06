import fs from 'node:fs';
import {loadFullWorldPixelCatalog} from '../sources/src/browser/fullworld-pixels.mjs';
import {canonicalJsonBytes} from '../sources/src/browser/loader.mjs';
const out=new URL('../results/canonical-fixtures/',import.meta.url), results=[];
for(const name of ['single','same-width','mixed-width']) {
 const bytes=fs.readFileSync(new URL(name+'.json',out)), manifest=JSON.parse(bytes);
 let error=null,catalog;
 try{catalog=await loadFullWorldPixelCatalog('https://audit.invalid/publication/',{pixels:{path:'pixels/manifest.json',rootContentId:manifest.rootContentId}},{pixelRoot:manifest.rootContentId},async()=>new Response(bytes));}catch(e){error=e.message;}
 results.push({id:name,expected:'Python metadata accepted by actual JavaScript consumer',satisfied:error===null,error,spriteCount:catalog?.sprites.size??null,root:manifest.rootContentId});
}
const vectors=JSON.parse(fs.readFileSync(new URL('serializer-vectors.json',out))).map(row=>({...row,javascript:Buffer.from(canonicalJsonBytes(JSON.parse(row.python))).toString()})).map(row=>({...row,equal:row.python===row.javascript}));
const report={commit:'51623c7dab2346cee39cd51e3caa845bf4b65426',fixtureScope:'synthetic metadata; real producer serialization and real consumer; not a FullWorld compile',results,vectors};
fs.writeFileSync(new URL('../results/cross-language.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
