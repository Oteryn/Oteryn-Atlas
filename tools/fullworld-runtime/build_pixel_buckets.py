#!/usr/bin/env python3
"""Build stable content-hash-prefix pixel transport buckets from verified G3 pixel publication."""
from __future__ import annotations
import argparse, hashlib, json, os, shutil
from collections import defaultdict
from pathlib import Path
from typing import Any

PUBLICATION_PROFILE='oteryn-atlas-fullworld-publication-v0'
PIXEL_PROFILE='oteryn-atlas-fullworld-pixel-publication-v0'
RUNTIME_PROFILE='oteryn-atlas-runtime-pixel-buckets-v0'
PUBLICATION_DOMAIN=b'OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0'
PIXEL_ROOT_DOMAIN=b'OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0'
PIXEL_ID_DOMAIN=b'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0'
RUNTIME_DOMAIN=b'OTERYN-ATLAS-RUNTIME-PIXEL-BUCKETS-V0\0'

class PixelBucketError(RuntimeError): pass

def canonical(v:Any)->bytes: return (json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n').encode()
def rooted(domain:bytes,v:dict[str,Any])->str:
    core=dict(v); core.pop('rootContentId',None); return 'sha256:'+hashlib.sha256(domain+canonical(core)).hexdigest()
def load(path:Path)->dict[str,Any]:
    raw=path.read_bytes(); v=json.loads(raw)
    if not isinstance(v,dict) or raw!=canonical(v): raise PixelBucketError(f'non-canonical manifest: {path}')
    return v
def safe(root:Path,rel:str)->Path:
    p=Path(rel)
    if p.is_absolute() or any(x in {'','.','..'} for x in p.parts): raise PixelBucketError(f'unsafe path: {rel!r}')
    return root/p
def sha_file(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(8*1024*1024),b''): h.update(b)
    return h.hexdigest()
def pixel_id(width:int,height:int,data:bytes)->str:
    return 'sha256:'+hashlib.sha256(PIXEL_ID_DOMAIN+width.to_bytes(2,'big')+height.to_bytes(2,'big')+data).hexdigest()
def link_or_copy(src:Path,dst:Path):
    dst.parent.mkdir(parents=True,exist_ok=True)
    try: os.link(src,dst)
    except OSError: shutil.copy2(src,dst)

def previous_buckets(root:Path|None, expected_root:str|None, nibbles:int)->dict[str,tuple[dict[str,Any],Path]]:
    if root is None: return {}
    if expected_root is None: raise PixelBucketError('previous pixel bucket reuse requires exact trusted root')
    m=load(root/'manifest.json')
    if m.get('profile')!=RUNTIME_PROFILE or m.get('bucketNibbles')!=nibbles: raise PixelBucketError('previous pixel bucket profile mismatch')
    if rooted(RUNTIME_DOMAIN,m)!=m.get('rootContentId') or m['rootContentId']!=expected_root: raise PixelBucketError('previous pixel bucket trusted root mismatch')
    result={}
    for b in m.get('buckets',[]):
        p=safe(root,b['path'])
        if not p.is_file() or p.stat().st_size!=b['bytes'] or sha_file(p)!=b['sha256']: raise PixelBucketError('previous pixel bucket file identity mismatch')
        result[b['bucket']]=(b,p)
    return result

def build(publication_root:Path, output:Path, expected_publication_root:str, expected_pixel_root:str, nibbles:int=2, previous_output:Path|None=None, expected_previous_root:str|None=None)->dict[str,Any]:
    if not 1<=nibbles<=4: raise PixelBucketError('bucket nibbles must be 1..4')
    pub=load(publication_root/'publication.json')
    if pub.get('profile')!=PUBLICATION_PROFILE or pub.get('source',{}).get('authority')!='Oteryn/Oteryn-Game': raise PixelBucketError('publication authority/profile mismatch')
    if rooted(PUBLICATION_DOMAIN,pub)!=pub.get('rootContentId') or pub['rootContentId']!=expected_publication_root: raise PixelBucketError('publication trusted root mismatch')
    pixel_path=safe(publication_root,pub['pixels']['path']); pm=load(pixel_path)
    if pm.get('profile')!=PIXEL_PROFILE or rooted(PIXEL_ROOT_DOMAIN,pm)!=pm.get('rootContentId') or pm['rootContentId']!=expected_pixel_root or pm['rootContentId']!=pub['pixels']['rootContentId']: raise PixelBucketError('pixel trusted root mismatch')
    pixel_root=pixel_path.parent
    prev=previous_buckets(previous_output,expected_previous_root,nibbles)
    grouped:dict[str,list[dict[str,Any]]]=defaultdict(list)
    for blob in pm.get('blobs',[]):
        cid=blob.get('contentId')
        if not isinstance(cid,str) or not cid.startswith('sha256:'): raise PixelBucketError('invalid blob content id')
        grouped[cid[7:7+nibbles]].append(blob)
    signatures={bucket:[(b['contentId'],int(b['width']),int(b['height']),int(b['bytes'])) for b in sorted(blobs,key=lambda x:x['contentId'])] for bucket,blobs in grouped.items()}
    if output.exists(): shutil.rmtree(output)
    (output/'buckets').mkdir(parents=True)
    # Load/verify source pack bytes lazily only for dirty buckets.
    packs:dict[int,bytes]={}
    def pack_bytes(index:int)->bytes:
        if index in packs:return packs[index]
        desc=pm['packs'][index]; p=safe(pixel_root,desc['path']); data=p.read_bytes()
        if len(data)!=desc['bytes'] or hashlib.sha256(data).hexdigest()!=desc['sha256']: raise PixelBucketError(f'source pixel pack {index} identity mismatch')
        packs[index]=data; return data
    previous_manifest=load(previous_output/'manifest.json') if previous_output is not None else None
    previous_signatures={}
    if previous_manifest:
        for cid,entry in previous_manifest.get('blobIndex',{}).items(): previous_signatures.setdefault(entry['bucket'],[]).append((cid,int(entry['width']),int(entry['height']),int(entry['bytes'])))
        for key in previous_signatures: previous_signatures[key].sort()
    bucket_entries=[]; blob_index={}; reused=rebuilt=0
    for bucket in sorted(grouped):
        rel=f'buckets/{bucket}.rgba'; target=output/rel; ordered=sorted(grouped[bucket],key=lambda x:x['contentId'])
        can_reuse=bucket in prev and previous_signatures.get(bucket)==signatures[bucket]
        if can_reuse:
            old_desc,old_path=prev[bucket]; link_or_copy(old_path,target); raw_sha=old_desc['sha256']; reused+=1
        else:
            out=bytearray()
            for blob in ordered:
                source=pack_bytes(int(blob['pack'])); start=int(blob['offset']); end=start+int(blob['bytes']); data=source[start:end]
                if len(data)!=blob['bytes'] or pixel_id(int(blob['width']),int(blob['height']),data)!=blob['contentId']: raise PixelBucketError(f"pixel blob identity mismatch: {blob['contentId']}")
                out.extend(data)
            target.write_bytes(out); raw_sha=hashlib.sha256(out).hexdigest(); rebuilt+=1
        offset=0
        for blob in ordered:
            blob_index[blob['contentId']]={'bucket':bucket,'offset':offset,'bytes':int(blob['bytes']),'width':int(blob['width']),'height':int(blob['height'])}; offset+=int(blob['bytes'])
        if target.stat().st_size!=offset: raise PixelBucketError('bucket byte reconciliation mismatch')
        bucket_entries.append({'bucket':bucket,'path':rel,'bytes':offset,'sha256':raw_sha,'contentId':'sha256:'+raw_sha,'blobCount':len(ordered),'identityAuthority':False})
    bundle_path=output/'local-max/all-pixels.rgba'; bundle_path.parent.mkdir(parents=True,exist_ok=True)
    bundle_offsets=[]; bundle_hash=hashlib.sha256(); bundle_bytes=0
    with bundle_path.open('wb') as bundle:
        for descriptor in bucket_entries:
            bucket=descriptor['bucket']; data=(output/descriptor['path']).read_bytes()
            bundle_offsets.append({'bucket':bucket,'offset':bundle_bytes,'bytes':len(data)}); bundle.write(data); bundle_hash.update(data); bundle_bytes+=len(data)
    if bundle_bytes != sum(b['bytes'] for b in bucket_entries): raise PixelBucketError('local-max bundle byte reconciliation mismatch')
    bundle_sha=bundle_hash.hexdigest()
    local_max_bundle={'path':'local-max/all-pixels.rgba','bytes':bundle_bytes,'sha256':bundle_sha,'contentId':'sha256:'+bundle_sha,'identityAuthority':False,'bucketOffsets':bundle_offsets}
    core={'profile':RUNTIME_PROFILE,'bucketNibbles':nibbles,'identityAuthority':False,'source':{'authority':'Oteryn/Oteryn-Game','publicationRoot':pub['rootContentId'],'pixelRoot':pm['rootContentId']},'buckets':bucket_entries,'blobIndex':blob_index,'localMaxBundle':local_max_bundle,'counts':{'buckets':len(bucket_entries),'blobs':len(blob_index),'bytes':sum(b['bytes'] for b in bucket_entries)}}
    manifest=dict(core); manifest['rootContentId']=rooted(RUNTIME_DOMAIN,core); (output/'manifest.json').write_bytes(canonical(manifest))
    result=dict(manifest); result['_buildEvidence']={'reusedBuckets':reused,'rebuiltBuckets':rebuilt,'sourcePacksRead':len(packs)}; return result

def main()->int:
    p=argparse.ArgumentParser(); p.add_argument('--publication',type=Path,required=True); p.add_argument('--output',type=Path,required=True); p.add_argument('--expected-publication-root',required=True); p.add_argument('--expected-pixel-root',required=True); p.add_argument('--bucket-nibbles',type=int,default=2); p.add_argument('--previous-output',type=Path); p.add_argument('--expected-previous-root'); a=p.parse_args()
    r=build(a.publication.resolve(),a.output.resolve(),a.expected_publication_root,a.expected_pixel_root,a.bucket_nibbles,a.previous_output.resolve() if a.previous_output else None,a.expected_previous_root)
    print(json.dumps({'result':'PASS','rootContentId':r['rootContentId'],'counts':r['counts'],'buildEvidence':r['_buildEvidence']},sort_keys=True)); return 0
if __name__=='__main__': raise SystemExit(main())
