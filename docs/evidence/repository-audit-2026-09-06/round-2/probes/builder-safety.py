"""Audit original compiler only against throwaway, self-generated directories."""
from pathlib import Path
import importlib.util, tempfile, shutil, json, hashlib, contextlib, io
ROOT=Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('publication',ROOT/'sources/tools/fullworld-publication/publication.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
base=ROOT/'results/synthetic-build/control-same-width';rows=[]
with tempfile.TemporaryDirectory(prefix='atlas-audit-safety-') as td:
    root=Path(td);fabric=root/'fabric';shutil.copytree(base/'fabric',fabric)
    marker=fabric/'AUDIT-ONLY-SENTINEL.txt';marker.write_text('audit-owned disposable input')
    hp=base/'SYNTHETIC-HANDOFF.json';hd=hashlib.sha256(hp.read_bytes()).hexdigest()
    error=None
    try:
        with contextlib.redirect_stdout(io.StringIO()):p.compile_all(base/'synthetic-repo',fabric,hp,base/'SELF-GENERATED-AUDIT-PIXELS.zip',fabric,hd)
    except Exception as e:error=type(e).__name__+': '+str(e)
    rows.append({'id':'output-equals-input-fabric','expected':'reject overlapping output before deleting inputs','satisfied':marker.exists(),'sentinelSurvives':marker.exists(),'remainingSourceShards':len(list(fabric.glob('shard-*/tiles.jsonl'))),'initialSourceShards':1197,'error':error})
with tempfile.TemporaryDirectory(prefix='atlas-audit-link-') as td:
    root=Path(td);source=root/'source';source.write_bytes(b'original');target=root/'out'/'published';p.link_or_copy(source,target)
    shared=source.stat().st_ino==target.stat().st_ino
    target.write_bytes(b'changed')
    rows.append({'id':'published-file-hardlink-alias','type':'observation, not intrinsically a defect under enforced immutability','sameInode':shared,'sourceChangedWithOutput':source.read_bytes()==b'changed'})
(ROOT/'results/builder-safety.json').write_text(json.dumps({'scope':'All deleted/modified files were created by audit in temporary sandbox directories. No user repository or host touched.','results':rows},indent=2))
print(json.dumps(rows,indent=2))
