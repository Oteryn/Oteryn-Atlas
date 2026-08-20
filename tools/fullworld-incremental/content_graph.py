#!/usr/bin/env python3
"""Deterministic incremental dependency graph for the FullWorld Atlas."""
from __future__ import annotations
import argparse, hashlib, json
from collections import defaultdict
from pathlib import Path
from typing import Any

GRAPH_PROFILE = 'oteryn-atlas-incremental-content-graph-v0'
PLAN_PROFILE = 'oteryn-atlas-incremental-update-plan-v0'
GRAPH_DOMAIN = b'OTERYN-ATLAS-INCREMENTAL-CONTENT-GRAPH-V0\0'
CELL_DOMAIN = b'OTERYN-ATLAS-INCREMENTAL-CELL-V0\0'
PIXEL_BUCKET_DOMAIN = b'OTERYN-ATLAS-INCREMENTAL-PIXEL-BUCKET-V0\0'

class GraphError(RuntimeError): pass

def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()

def rooted(domain: bytes, value: Any) -> str:
    return 'sha256:' + hashlib.sha256(domain + canonical(value)).hexdigest()

def sha256_bytes(data: bytes) -> str:
    return 'sha256:' + hashlib.sha256(data).hexdigest()

def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_bytes())
    if not isinstance(value, dict): raise GraphError(f'JSON object required: {path}')
    return value

def safe_join(root: Path, rel: str) -> Path:
    path = Path(rel)
    if path.is_absolute() or any(p in {'', '.', '..'} for p in path.parts): raise GraphError(f'unsafe path: {rel!r}')
    return root / path

def tile_position(line: bytes) -> tuple[int, int, int]:
    try: raw = json.loads(line)
    except json.JSONDecodeError as exc: raise GraphError('invalid semantic JSONL') from exc
    pos = raw.get('position', {})
    values = (pos.get('floor'), pos.get('x'), pos.get('y'))
    if not all(isinstance(v, int) for v in values): raise GraphError('invalid semantic tile position')
    return values

def chunk_cells(path: Path, floor: int, cell_size: int) -> tuple[list[dict[str, Any]], int]:
    digests: dict[tuple[int,int], Any] = {}
    counts: dict[tuple[int,int], int] = defaultdict(int)
    total = 0
    with path.open('rb') as handle:
        for line in handle:
            if not line.endswith(b'\n'): raise GraphError(f'unterminated semantic line: {path}')
            f, x, y = tile_position(line)
            if f != floor: raise GraphError(f'floor mismatch: {path}')
            key = (x // cell_size, y // cell_size)
            if key not in digests:
                h = hashlib.sha256(); h.update(CELL_DOMAIN); h.update(f'{floor}:{key[0]}:{key[1]}\0'.encode()); digests[key] = h
            digests[key].update(hashlib.sha256(line).digest()); counts[key] += 1; total += 1
    return ([{'cell_x': x, 'cell_y': y, 'rootContentId': 'sha256:' + digests[(x,y)].hexdigest(), 'tiles': counts[(x,y)]} for x,y in sorted(digests)], total)

def pixel_buckets(manifest: dict[str, Any], nibbles: int) -> list[dict[str, Any]]:
    if not 1 <= nibbles <= 4: raise GraphError('pixel bucket nibbles must be 1..4')
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for blob in manifest.get('blobs', []):
        cid = blob.get('contentId')
        if not isinstance(cid, str) or not cid.startswith('sha256:'): raise GraphError('invalid pixel blob identity')
        grouped[cid[7:7+nibbles]].append({'contentId': cid, 'bytes': int(blob['bytes']), 'width': int(blob['width']), 'height': int(blob['height'])})
    out=[]
    for bucket in sorted(grouped):
        entries=sorted(grouped[bucket], key=lambda x:x['contentId']); core={'bucket':bucket,'entries':entries}
        out.append({'bucket':bucket,'blobCount':len(entries),'bytes':sum(x['bytes'] for x in entries),'rootContentId':rooted(PIXEL_BUCKET_DOMAIN, core)})
    return out

def build_graph(publication_root: Path, cell_size: int = 16, pixel_bucket_nibbles: int = 2) -> dict[str, Any]:
    publication=load_json(publication_root/'publication.json')
    if publication.get('source',{}).get('authority') != 'Oteryn/Oteryn-Game': raise GraphError('Game authority missing')
    semantic_path=safe_join(publication_root, publication['semantic']['path']); semantic=load_json(semantic_path); semantic_root=semantic_path.parent
    pixel_path=safe_join(publication_root, publication['pixels']['path']); pixels=load_json(pixel_path)
    floors=[]; counts={'floors':0,'chunks':0,'cells':0,'tiles':0}
    for floor_entry in semantic.get('floors',[]):
        floor=int(floor_entry['floor']); fm=load_json(safe_join(semantic_root,floor_entry['path'])); chunks=[]; fc={'chunks':0,'cells':0,'tiles':0}
        for chunk in fm.get('chunks',[]):
            path=safe_join(semantic_root,chunk['path']); data=path.read_bytes()
            if sha256_bytes(data) != chunk.get('contentId'): raise GraphError(f"semantic chunk identity mismatch: {chunk['path']}")
            cells, tile_count=chunk_cells(path,floor,cell_size)
            if tile_count != int(chunk.get('tiles',-1)): raise GraphError('semantic chunk tile count mismatch')
            chunks.append({'logicalAddress':chunk['logicalAddress'],'contentId':chunk['contentId'],'bytes':int(chunk['bytes']),'tiles':tile_count,'resolvedPrimitives':int(chunk['resolvedPrimitives']),'cells':cells})
            fc['chunks']+=1; fc['cells']+=len(cells); fc['tiles']+=tile_count
        floors.append({'floor':floor,'sourceFloorRoot':floor_entry['rootContentId'],'chunks':chunks,'counts':fc})
        counts['floors']+=1; counts['chunks']+=fc['chunks']; counts['cells']+=fc['cells']; counts['tiles']+=fc['tiles']
    graph={'profile':GRAPH_PROFILE,'dependencyPolicy':{'baseSemantic':{'dependencyRadiusTiles':0},'overview':{'dependencyRadiusTiles':0,'cellSizeTiles':cell_size},'runtimeIndex':{'dependencyRadiusTiles':0},'pixelBuckets':{'bucketNibbles':pixel_bucket_nibbles,'identityAuthority':False}},'source':{'authority':'Oteryn/Oteryn-Game','publicationRoot':publication['rootContentId'],'semanticRoot':semantic['rootContentId'],'pixelRoot':pixels['rootContentId'],'sourceFingerprint':semantic['sourceFingerprint'],'gameSha':publication['source'].get('gameSha')},'floors':floors,'pixelBuckets':pixel_buckets(pixels,pixel_bucket_nibbles),'counts':counts}
    graph['rootContentId']=rooted(GRAPH_DOMAIN,graph); return graph

def _chunks(graph):
    return {f"{c['logicalAddress']['floor']}:{c['logicalAddress']['region_x']}:{c['logicalAddress']['region_y']}":c for f in graph.get('floors',[]) for c in f.get('chunks',[])}
def _cells(graph):
    return {f"{f['floor']}:{cell['cell_x']}:{cell['cell_y']}":cell for f in graph.get('floors',[]) for c in f.get('chunks',[]) for cell in c.get('cells',[])}
def _buckets(graph): return {b['bucket']:b for b in graph.get('pixelBuckets',[])}
def diff_graph(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    if old.get('profile')!=GRAPH_PROFILE or new.get('profile')!=GRAPH_PROFILE: raise GraphError('unsupported graph profile')
    oc,nc=_chunks(old),_chunks(new); oe,ne=_cells(old),_cells(new); ob,nb=_buckets(old),_buckets(new)
    ck=sorted(set(oc)|set(nc)); ek=sorted(set(oe)|set(ne)); bk=sorted(set(ob)|set(nb))
    dirty_chunks=[k for k in ck if oc.get(k,{}).get('contentId')!=nc.get(k,{}).get('contentId')]
    dirty_cells=[k for k in ek if oe.get(k,{}).get('rootContentId')!=ne.get(k,{}).get('rootContentId')]
    dirty_buckets=[k for k in bk if ob.get(k,{}).get('rootContentId')!=nb.get(k,{}).get('rootContentId')]
    dirty_floors=sorted({int(k.split(':',1)[0]) for k in dirty_chunks})
    return {'profile':PLAN_PROFILE,'oldGraphRoot':old['rootContentId'],'newGraphRoot':new['rootContentId'],'fullWorldRebuildRequired':False,'dirty':{'chunks':dirty_chunks,'floors':dirty_floors,'overviewCells':dirty_cells,'pixelBuckets':dirty_buckets},'reuse':{'chunks':len(ck)-len(dirty_chunks),'overviewCells':len(ek)-len(dirty_cells),'pixelBuckets':len(bk)-len(dirty_buckets)},'counts':{'chunks':len(ck),'overviewCells':len(ek),'pixelBuckets':len(bk)}}
def write_json(path: Path, value: Any): path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(canonical(value))
def main() -> int:
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='command',required=True)
    b=sub.add_parser('build'); b.add_argument('publication',type=Path); b.add_argument('output',type=Path); b.add_argument('--cell-size',type=int,default=16); b.add_argument('--pixel-bucket-nibbles',type=int,default=2)
    d=sub.add_parser('diff'); d.add_argument('old',type=Path); d.add_argument('new',type=Path); d.add_argument('output',type=Path); a=p.parse_args()
    if a.command=='build':
        g=build_graph(a.publication.resolve(),a.cell_size,a.pixel_bucket_nibbles); write_json(a.output,g); print(json.dumps({'result':'PASS','rootContentId':g['rootContentId'],'counts':g['counts']},sort_keys=True)); return 0
    plan=diff_graph(load_json(a.old),load_json(a.new)); write_json(a.output,plan); print(json.dumps({'result':'PASS','dirty':plan['dirty'],'reuse':plan['reuse']},sort_keys=True)); return 0
if __name__=='__main__': raise SystemExit(main())
