#!/usr/bin/env python3
from __future__ import annotations
import importlib.util, json, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('graph',ROOT/'tools/fullworld-incremental/content_graph.py'); graph=importlib.util.module_from_spec(spec); assert spec.loader; spec.loader.exec_module(graph)
def c(v): return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def snapshot(root:Path,changed:bool):
    (root/'semantic/chunks').mkdir(parents=True); (root/'semantic/floors').mkdir(parents=True); (root/'pixels').mkdir(parents=True)
    rows=[]
    for name,x,value in [('a',32000,'new' if changed else 'old'),('b',32300,'stable')]:
        data=c({'position':{'floor':-7,'x':x,'y':32000},'value':value}); (root/f'semantic/chunks/{name}.jsonl').write_bytes(data)
        rows.append({'logicalAddress':{'floor':-7,'region_x':x//256,'region_y':125},'contentId':graph.sha256_bytes(data),'bytes':len(data),'tiles':1,'resolvedPrimitives':1,'path':f'chunks/{name}.jsonl'})
    floorroot='sha256:'+('1' if changed else '0')*64
    (root/'semantic/floors/f-7.json').write_bytes(c({'rootContentId':floorroot,'chunks':rows,'counts':{'tiles':2}}))
    semroot='sha256:'+('3' if changed else '2')*64; fp='sha256:'+('5' if changed else '4')*64
    (root/'semantic/world.json').write_bytes(c({'rootContentId':semroot,'sourceFingerprint':fp,'floors':[{'floor':-7,'path':'floors/f-7.json','rootContentId':floorroot}]}))
    blobs=[{'contentId':'sha256:'+'aa'*32,'bytes':4,'width':1,'height':1}]
    if changed: blobs.append({'contentId':'sha256:'+'bb'*32,'bytes':4,'width':1,'height':1})
    pixroot='sha256:'+('7' if changed else '6')*64; (root/'pixels/manifest.json').write_bytes(c({'rootContentId':pixroot,'blobs':blobs}))
    (root/'publication.json').write_bytes(c({'rootContentId':'sha256:'+('9' if changed else '8')*64,'source':{'authority':'Oteryn/Oteryn-Game','gameSha':'a'*40},'semantic':{'path':'semantic/world.json'},'pixels':{'path':'pixels/manifest.json'}}))
with tempfile.TemporaryDirectory() as td:
    base=Path(td); old=base/'old'; new=base/'new'; snapshot(old,False); snapshot(new,True)
    old_graph=graph.build_graph(old); new_graph=graph.build_graph(new)
    assert old_graph['counts']=={'floors':1,'chunks':2,'cells':2,'tiles':2}
    assert old_graph['source']['authority']=='Oteryn/Oteryn-Game'
    assert old_graph['rootContentId'].startswith('sha256:')
    plan=graph.diff_graph(old_graph,new_graph)
    assert plan['fullWorldRebuildRequired'] is False
    assert plan['dirty']['chunks']==['-7:125:125']; assert plan['dirty']['floors']==[-7]; assert plan['reuse']['chunks']==1
    assert len(plan['dirty']['overviewCells'])==1; assert plan['dirty']['pixelBuckets']==['bb']; assert plan['reuse']['pixelBuckets']==1

    chunk=old/'semantic/chunks/a.jsonl'; original=chunk.read_bytes(); chunk.write_bytes(original+b' ')
    try: graph.build_graph(old)
    except graph.GraphError as error: assert 'identity mismatch' in str(error)
    else: raise AssertionError('content graph accepted a corrupt semantic chunk')
    chunk.write_bytes(original)

    pixels=json.loads((old/'pixels/manifest.json').read_text())
    pixels['blobs'][0]['contentId']='not-a-content-id'
    (old/'pixels/manifest.json').write_bytes(c(pixels))
    try: graph.build_graph(old)
    except graph.GraphError as error: assert 'pixel blob identity' in str(error)
    else: raise AssertionError('content graph accepted an invalid pixel identity')

    try: graph.pixel_buckets({'blobs':[]},0)
    except graph.GraphError as error: assert '1..4' in str(error)
    else: raise AssertionError('content graph accepted an unbounded pixel bucket prefix')

    bad_graph=dict(new_graph); bad_graph['profile']='unknown'
    try: graph.diff_graph(old_graph,bad_graph)
    except graph.GraphError as error: assert 'profile' in str(error)
    else: raise AssertionError('content graph accepted an unsupported graph profile')
print('incremental-content-graph-self-test: PASS')
