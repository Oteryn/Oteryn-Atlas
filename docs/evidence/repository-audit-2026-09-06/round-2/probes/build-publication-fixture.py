"""Execute original compile_all on tiny self-generated fixtures. NOT Game data.
The 1,197-shard/16-floor census is forced by the production compiler's current
hand-off guard. All pixels, tile records, pins and source claims are test doubles.
No real asset archive, GitHub branch, product publication, or host is modified.
"""
from __future__ import annotations
import contextlib,hashlib,importlib.util,io,json,lzma,struct,sys,tempfile
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED,ZipInfo
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('publication',ROOT/'sources/tools/fullworld-publication/publication.py')
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
WORK=ROOT/'results/synthetic-build';WORK.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()

def asset_zip(target:Path,ids:list[int])->tuple[str,str]:
    # 384x384 32bpp top-down BMP; two synthetic colored tiles, zero outside.
    pixels=bytearray(384*384*4)
    for ordinal,sid in enumerate(ids):
        x0=((sid-1)%12)*32;y0=((sid-1)//12)*32
        bgra=bytes([0,40+ordinal*80,180-ordinal*60,255])
        for y in range(y0,y0+32):
            for x in range(x0,x0+32):pixels[(y*384+x)*4:(y*384+x+1)*4]=bgra
    header=b'BM'+struct.pack('<IHHI',54+len(pixels),0,0,54)+struct.pack('<IiiHHIIiiII',40,384,-384,1,32,0,len(pixels),0,0,0,0)
    dictionary=1<<20;filters=[{'id':lzma.FILTER_LZMA1,'dict_size':dictionary,'lc':3,'lp':0,'pb':2}]
    compressed=lzma.compress(header+pixels,format=lzma.FORMAT_RAW,filters=filters)
    sheet=b'\x70\x0a\xfa\x80\x24'+b'\x00'+bytes([93])+dictionary.to_bytes(4,'little')+(len(header)+len(pixels)).to_bytes(8,'little')+compressed
    cat=p.canonical([{'type':'sprite','spritetype':0,'firstspriteid':1,'lastspriteid':144,'file':'audit-self-generated-sheet'}])
    with ZipFile(target,'w',ZIP_DEFLATED) as z:
        z.writestr(ZipInfo('assets/catalog-content.json',(1980,1,1,0,0,0)),cat);z.writestr(ZipInfo('assets/audit-self-generated-sheet',(1980,1,1,0,0,0)),sheet)
    return sha(target.read_bytes()),sha(cat)

def prepare(name:str,ids:list[int]):
    root=WORK/name;root.mkdir(exist_ok=True)
    fabric=root/'fabric';fabric.mkdir(exist_ok=True)
    repo=root/'synthetic-repo';(repo/'docs/legal').mkdir(parents=True,exist_ok=True)
    az=root/'SELF-GENERATED-AUDIT-PIXELS.zip';asset_digest,catalog_digest=asset_zip(az,ids)
    # Named as expected by original unit under test, never a real attestation.
    (repo/'docs/legal/DYN-ATLAS-001-15-32-asset-rights-attestation.md').write_text('SYNTHETIC UNIT-TEST INPUT ONLY. These are self-generated audit pixels, not 15.32 or Game assets. This file is not a real rights attestation. Test archive SHA-256: '+asset_digest+'\n')
    shards=[];floor_counts={};nbytes=0
    for i in range(1197):
        floor=i%16-15;x=i*256+1;y=1
        row={'record_type':'tile','position':{'floor':floor,'x':x,'y':y},'source_position':{'legacy_x':x,'legacy_y':y,'legacy_z':-floor},'tile_record_id':f'tile:audit-{i}','presentation':[{'appearance_source_id':1,'export_record_id':f'presentation:audit-{i}','presentation_order':{'order':0,'plane':0},'source_role':'ground','resolved_primitives':[{'sprite_source_id':ids[i%len(ids)],'width_units':32,'height_units':32,'displacement':{'dx_units':0,'dy_units':0},'source_profile_id':'oteryn-atlas-15-32-appearance-spatial-v1','phase':0,'layer_index':0,'frame_group_id':2,'frame_group_type':2,'pattern':{'x':0,'y':0,'z':0},'visual_coverage_offsets':[{'dx_tiles':0,'dy_tiles':0}]}]}]}
        raw=p.canonical(row);relative=f'shard-{i:04d}';directory=fabric/relative;directory.mkdir(exist_ok=True);(directory/'tiles.jsonl').write_bytes(raw);nbytes+=len(raw)
        shards.append({'relative_path':relative,'shard_id':relative,'tiles_jsonl_sha256':sha(raw),'tiles_jsonl_bytes':len(raw),'logical_address':{'floor':floor,'region_x':i,'region_y':0},'tile_count':1})
        fc=floor_counts.setdefault(str(floor),{'tiles':0,'resolved_primitives':0,'bounds':{'x_min':0,'x_max_exclusive':400000,'y_min':0,'y_max_exclusive':400000}});fc['tiles']+=1;fc['resolved_primitives']+=1
    handoff={'format':p.HANDOFF_FORMAT,'source_authority':'Oteryn/Oteryn-Game','browser_runtime_legacy_fallback':'FORBIDDEN','generation':{'shard_count':1197,'final_jsonl_bytes':nbytes},'census':{'global':{'floors':16,'tiles':1197,'resolved_primitives':1197,'unique_sprite_source_ids':len(ids)},'floors':floor_counts},'source_fingerprint':'sha256:'+'1'*64,'fabric_root':'sha256:'+'2'*64,'source':{'asset_zip_sha256':asset_digest,'catalog_sha256':catalog_digest,'game_sha':'a'*40},'shards':shards}
    hp=root/'SYNTHETIC-HANDOFF.json';hp.write_bytes(p.canonical(handoff))
    evidence=p.compile_all(repo,fabric,hp,az,root/'publication',sha(hp.read_bytes()))
    return {'name':name,'inputSpriteIds':ids,'sourceShardCount':1197,'publicationShardCount':evidence['counts']['shards'],'publicationFloors':evidence['counts']['floors'],'publicationRoot':evidence['publicationRoot'],'pixelRoot':evidence['pixelRoot'],'rawSourceBytes':nbytes,'scope':'Original compile_all with synthetic source metadata and self-generated pixels. No real Game/FullWorld validation.'}

rows=[]
for name,ids in [('control-same-width',[11,12]),('cross-language-mixed',[2,10])]:
    with contextlib.redirect_stdout(io.StringIO()) as log:
        rows.append(prepare(name,ids))
    (WORK/(name+'.log')).write_text(log.getvalue())
(ROOT/'results/synthetic-build.json').write_text(json.dumps({'compiler':'original hash-verified publication.py','results':rows},indent=2))
print(json.dumps(rows,indent=2))
