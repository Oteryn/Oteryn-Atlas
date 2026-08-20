#!/usr/bin/env python3
from importlib.util import module_from_spec, spec_from_file_location
import hashlib, json, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = spec_from_file_location('build_minimap', ROOT / 'tools/fullworld-minimap/build_minimap.py')
module = module_from_spec(spec); spec.loader.exec_module(module)

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')

def tree_digest(root):
    digest = hashlib.sha256()
    for path in sorted(p for p in root.rglob('*') if p.is_file()):
        digest.update(path.relative_to(root).as_posix().encode()); digest.update(path.read_bytes())
    return digest.hexdigest()
with tempfile.TemporaryDirectory() as tmp:
    base = Path(tmp); pub = base / 'publication'; semantic = pub / 'semantic'; pixels = pub / 'pixels'
    raw = bytes([64, 160, 96, 255]) * (32 * 32)
    pixels.mkdir(parents=True); (pixels / 'pack.rgba').write_bytes(raw)
    cid = 'sha256:' + hashlib.sha256(raw).hexdigest()
    dump(pixels / 'manifest.json', {
        'blobs':[{'bytes':len(raw),'contentId':cid,'height':32,'offset':0,'pack':0,'width':32}],
        'packs':[{'path':'pack.rgba'}],
        'spriteIndex':{'1':{'contentId':cid,'height':32,'width':32}},
    })
    chunk = {'position':{'floor':-7,'x':32360,'y':32230}, 'presentation':[{
        'resolved_primitives':[{'sprite_source_id':1}], 'source_role':'ground'
    }], 'record_type':'tile'}
    chunk_bytes = (json.dumps(chunk, sort_keys=True, separators=(',', ':')) + '\n').encode()
    chunk_path = semantic / 'chunks/c.jsonl'; chunk_path.parent.mkdir(parents=True); chunk_path.write_bytes(chunk_bytes)
    dump(semantic / 'floors/f-7.json', {
        'bounds':{'x_min':32256,'x_max_exclusive':32512,'y_min':32000,'y_max_exclusive':32256},
        'chunks':[{'bytes':len(chunk_bytes),'contentId':'sha256:'+hashlib.sha256(chunk_bytes).hexdigest(),
                   'logicalAddress':{'floor':-7,'region_x':126,'region_y':125},
                   'path':'chunks/c.jsonl','resolvedPrimitives':1,'tiles':1}],
        'floor':-7,'rootContentId':'sha256:'+'11'*32,
    })
    dump(semantic / 'world.json', {'floors':[{'floor':-7,'path':'floors/f-7.json','rootContentId':'sha256:'+'11'*32}]})
    dump(pub / 'publication.json', {
        'source':{'gameSha':'a'*40},
        'pixels':{'rootContentId':'sha256:'+'22'*32},
        'semantic':{'rootContentId':'sha256:'+'33'*32},
        'rootContentId':'sha256:'+'44'*32,
    })
    out1 = base / 'out1'; out2 = base / 'out2'
    first = module.build(pub, out1, 1)
    second = module.build(pub, out2, 1)
    assert first['counts'] == {'bytes': first['counts']['bytes'], 'chunks': 1, 'floors': 1, 'tiles': 1}
    assert first['rootContentId'] == second['rootContentId']
    assert tree_digest(out1) == tree_digest(out2)
    assert first['semantics']['terrainClassification'] == 'NOT_CLAIMED'
    assert first['semantics']['walkability'] == 'NOT_CLAIMED'
    assert first['semantics']['canonicalRegions'] == 'NOT_CLAIMED'
    tile_png = next((out1 / 'tiles/f-7').glob('*.png'))
    assert tile_png.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    floor = json.loads((out1 / 'floors/f-7.json').read_text())
    assert floor['chunks'][0]['logicalAddress'] == {'floor':-7,'region_x':126,'region_y':125}
    assert floor['chunks'][0]['tiles'] == 1
print('PASS minimap builder deterministic fixture')
