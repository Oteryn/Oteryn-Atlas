import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson } from '../../../tools/verification/verification-plan-schema.mjs';
const sha = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

// Independent protected contract fixture; no candidate product builder dependency.
export function qualificationBindingFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-bindings-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root,name)), {recursive:true}); fs.writeFileSync(path.join(root,name), typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)); };
  const at = x => ({x,y:20,floor:-7});
  const creature = (kind, id, name, x, roles = [], dynamic = false) => ({kind,record_id:`${kind}:${id.repeat(32)}`,entity_id:`${kind}-entity:${id.repeat(32)}`,name,position:at(x),roles,presentation_resolution_state:dynamic?'RESOLVED':'FALLBACK_MARKER',...(dynamic?{outfit_presentation:{outfit_presentation_id:`outfit:${kind}`}}:{})});
  const creatures = [creature('npc','1','Guide',20,['shop','quest']),creature('npc','2','Walker',21,['travel','shop','quest','blessing','trainer'],true),creature('npc','3','A cartographer with a very long meaningful name',22),creature('monster','a','Sentinel',23,[],true),...['b','c','d'].map(id=>creature('monster',id,`Raider ${id}`,24))];
  creatures[2].position.y += 4; // Isolated edge-label fixture; assertions remain unchanged.
  put('web/semantic-search/index.json',{records:[{label:'Harbor',position:at(20),capabilities:['navigation']}]});
  put('data/creatures/search.json',{records:creatures.map(({name,...record})=>({...record,label:name}))});
  put('data/creatures/index.json',{chunks:[{path:'chunks/entities.json'}]});
  put('data/creatures/chunks/entities.json',{records:creatures});
  const tiles = [20,21,22,23].map(x=>({record_type:'tile',position:at(x),presentation:[{resolved_primitives:[{width_units:32,height_units:32}]}]})).map(JSON.stringify).join('\n')+'\n';
  put('publication/semantic/chunks/tiles.jsonl',tiles);
  const group = bytes => ({ offset:0,bytes:Buffer.byteLength(bytes),contentId:sha(bytes),yMin:20,yMaxExclusive:21 });
  const chunks=[{path:'chunks/tiles.jsonl',contentId:sha(tiles),bytes:Buffer.byteLength(tiles),logicalAddress:{floor:-7,region_x:0,region_y:0},groups:[group(tiles)]}];
  for (const region of [1,2,3,4]) {
    const tile=JSON.stringify({record_type:'tile',position:at(region*32+16),presentation:[{resolved_primitives:[{width_units:32,height_units:32}]}]})+'\n';
    const name=`chunks/range-${region}.jsonl`;
    put(`publication/semantic/${name}`,tile);
    chunks.push({path:name,contentId:sha(tile),bytes:Buffer.byteLength(tile),logicalAddress:{floor:-7,region_x:region,region_y:0},groups:[group(tile)]});
  }
  put('runtime-index/floors/f-7.json',{regionSpan:32,bounds:{x_min:10,x_max_exclusive:160,y_min:10,y_max_exclusive:40},chunks});
  const pixels=Buffer.from([1,2,3,255,4,5,6,255]);
  const ids=[sha(pixels.subarray(0,4)),sha(pixels.subarray(4,8))];
  const programs={profile:'oteryn-atlas-animation-runtime-v1',creature_programs:['npc','monster'].map(kind=>({outfit_presentation_id:`outfit:${kind}`,phase_count:2,phase_content_ids:ids,width:1,height:1,animation:{presentation_durations_ms:[100,100],loop_type:'infinite',synchronized:false,default_start_phase:0,loop_count:0}})),blob_index:Object.fromEntries(ids.map((id,i)=>[id,{bucket:'rgba',offset:i*4,bytes:4,width:1,height:1}]))};
  put('animation/programs.json',programs);
  put('animation/buckets/rgba',pixels);
  put('animation/manifest.json',{programs:{path:'programs.json'},buckets:[{id:'rgba',path:'buckets/rgba',bytes:8,digest:sha(pixels)}]});
  const edit=(name,fn)=>{ const value=JSON.parse(fs.readFileSync(path.join(root,name))); fn(value);put(name,value); };
  const seal=()=>{const files=[]; const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name!=='fixture-manifest.json'){const bytes=fs.readFileSync(full);files.push({path:path.relative(root,full).split(path.sep).join('/'),bytes:bytes.length,digest:sha(bytes)});}}};walk(root);files.sort((a,b)=>a.path.localeCompare(b.path));const productDigest=sha(`${canonicalJson(files)}\n`);put('fixture-manifest.json',{files,productDigest});return productDigest;};
  return {root,put,edit,seal, read:name=>JSON.parse(fs.readFileSync(path.join(root,name))), write:put, chunkPath:'data/creatures/chunks/entities.json'};
}