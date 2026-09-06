"""Exercise the real Python serializer with synthetic metadata, not Game assets."""
from pathlib import Path
import importlib.util, hashlib, json, sys
ROOT = Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('publication',ROOT/'sources/tools/fullworld-publication/publication.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
out=ROOT/'results/canonical-fixtures';out.mkdir(exist_ok=True)
for name,ids in [('single',['2']),('same-width',['11','12']),('mixed-width',['2','10'])]:
    pixel=bytes([255,0,0,255])*32*32
    cid=m.pixel_id(32,32,pixel)
    core={'profile':m.PIXEL_PROFILE,'assetZipSha256':'0'*64,'pixelHashDomain':m.PIXEL_DOMAIN[:-1].decode(),'spriteIndex':{i:{'contentId':cid,'width':32,'height':32} for i in ids},'blobs':[{'contentId':cid,'width':32,'height':32,'pack':0,'offset':0,'bytes':len(pixel)}],'packs':[{'path':'packs/pack-0000.rgba','bytes':len(pixel),'sha256':hashlib.sha256(pixel).hexdigest(),'identityAuthority':False}],'counts':{'spriteRefs':len(ids),'uniquePixelBlobs':1,'rawBytesAfterDedupe':len(pixel),'rawBytesBeforeDedupe':len(pixel)*len(ids),'dedupeBytesSaved':len(pixel)*(len(ids)-1)},'runtimePlacement':{'identityAuthority':False}}
    manifest={**core,'rootContentId':m.rooted(m.PIXEL_ROOT_DOMAIN,core)}
    (out/f'{name}.json').write_bytes(m.canonical(manifest))
# Pure serialization corpus: not all values are allowed by every product schema.
cases={'numeric-keys':{'spriteIndex':{'2':0,'10':0}},'integer':{'a':1},'float-integer':{'a':1.0},'small-float':{'a':1e-7},'negative-zero':{'a':-0.0},'proto-key':{'a':1,'__proto__':{'hidden':2}}}
(out/'serializer-vectors.json').write_text(json.dumps([{'name':name,'python':m.canonical(value).decode()} for name,value in cases.items()]))
print('Produced three synthetic metadata fixtures with original Python canonical()/rooted()/pixel_id(). No asset archive or production inputs used.')
