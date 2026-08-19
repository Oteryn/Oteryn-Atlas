#!/usr/bin/env python3
"""Compile verified full-world generation fabric into deterministic Atlas publication."""
from __future__ import annotations

import argparse, bisect, hashlib, json, lzma, os, re, shutil, sys, time, zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

HANDOFF_FORMAT = "oteryn-atlas-fullworld-generation-handoff-v0"
SEMANTIC_PROFILE = "oteryn-atlas-fullworld-semantic-publication-v0"
PIXEL_PROFILE = "oteryn-atlas-fullworld-pixel-publication-v0"
PUBLICATION_PROFILE = "oteryn-atlas-fullworld-publication-v0"
SEMANTIC_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0"
FLOOR_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0"
PIXEL_DOMAIN = b"OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0"
PIXEL_ROOT_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0"
PUBLICATION_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0"
SPRITE_RE = re.compile(br'"sprite_source_id":([0-9]+)')
SPRITE_SIZES = ((32, 32), (32, 64), (64, 32), (64, 64))
PACK_LIMIT = 64 * 1024 * 1024

class PublicationError(RuntimeError): pass

def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()

def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(8*1024*1024), b""): h.update(block)
    return h.hexdigest()

def rooted(domain: bytes, core: dict[str, Any]) -> str:
    h=hashlib.sha256(); h.update(domain); h.update(canonical(core)); return "sha256:"+h.hexdigest()

def load_handoff(path: Path, expected_sha: str) -> dict[str, Any]:
    if sha256_file(path) != expected_sha: raise PublicationError("handoff digest mismatch")
    d=json.loads(path.read_text())
    if d.get("format") != HANDOFF_FORMAT: raise PublicationError("unsupported handoff format")
    if d.get("source_authority") != "Oteryn/Oteryn-Game": raise PublicationError("Game authority missing")
    if d.get("browser_runtime_legacy_fallback") not in (False,"FORBIDDEN"):
        raise PublicationError("legacy runtime fallback not forbidden")
    g=d.get("census",{}).get("global",{})
    if g.get("floors") != 16 or d.get("generation",{}).get("shard_count") != 1197:
        raise PublicationError("handoff census/shard count mismatch")
    return d

def link_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    try: os.link(src,dst)
    except OSError: shutil.copy2(src,dst)

def scan_semantic(fabric: Path, handoff: dict[str,Any], out: Path) -> tuple[dict[str,Any],set[int]]:
    floors: dict[int,list[dict[str,Any]]] = defaultdict(list); sprites:set[int]=set()
    prims=tiles=semantic_bytes=0
    shards=handoff["shards"]
    for i,s in enumerate(shards,1):
        src=fabric/s["relative_path"]/"tiles.jsonl"; h=hashlib.sha256(); local_prims=0
        with src.open("rb") as f:
            for line in f:
                h.update(line); ids=[int(x) for x in SPRITE_RE.findall(line)]
                local_prims += len(ids); sprites.update(ids)
        if h.hexdigest()!=s["tiles_jsonl_sha256"] or src.stat().st_size!=s["tiles_jsonl_bytes"]:
            raise PublicationError(f"shard verification failed: {s['shard_id']}")
        logical=s["logical_address"]; floor=int(logical["floor"])
        rel=f"chunks/{s['shard_id']}.jsonl"; link_or_copy(src,out/rel)
        entry={"logicalAddress":logical,"contentId":"sha256:"+h.hexdigest(),"bytes":s["tiles_jsonl_bytes"],"tiles":s["tile_count"],"resolvedPrimitives":local_prims,"path":rel}
        floors[floor].append(entry); prims+=local_prims; tiles+=s["tile_count"]; semantic_bytes+=s["tiles_jsonl_bytes"]
        if i%100==0 or i==len(shards): print(f"semantic {i}/{len(shards)}", flush=True)
    expected=handoff["census"]["global"]
    if tiles!=expected["tiles"] or prims!=expected["resolved_primitives"]: raise PublicationError("semantic counts do not reconcile")
    if semantic_bytes!=handoff["generation"]["final_jsonl_bytes"]: raise PublicationError("semantic byte count mismatch")
    if len(sprites)!=expected["unique_sprite_source_ids"]: raise PublicationError("unique sprite count mismatch")
    floor_entries=[]
    for floor in sorted(floors):
        fc=handoff["census"]["floors"][str(floor)]; chunks=sorted(floors[floor],key=lambda x:(x["logicalAddress"]["region_x"],x["logicalAddress"]["region_y"]))
        core={"profile":SEMANTIC_PROFILE,"floor":floor,"bounds":fc["bounds"],"sourceFingerprint":handoff["source_fingerprint"],"chunks":chunks,"counts":{"tiles":sum(x["tiles"] for x in chunks),"resolvedPrimitives":sum(x["resolvedPrimitives"] for x in chunks),"bytes":sum(x["bytes"] for x in chunks)}}
        if core["counts"]["tiles"]!=fc["tiles"] or core["counts"]["resolvedPrimitives"]!=fc["resolved_primitives"]: raise PublicationError(f"floor {floor} mismatch")
        manifest=dict(core); manifest["rootContentId"]=rooted(FLOOR_DOMAIN,core); p=out/f"floors/f{floor}.json"; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(canonical(manifest))
        floor_entries.append({"floor":floor,"path":f"floors/f{floor}.json","rootContentId":manifest["rootContentId"],"counts":core["counts"]})
    core={"profile":SEMANTIC_PROFILE,"fabricRoot":handoff["fabric_root"],"sourceFingerprint":handoff["source_fingerprint"],"floors":floor_entries,"counts":{"floors":len(floor_entries),"shards":len(shards),"tiles":tiles,"resolvedPrimitives":prims,"uniqueSpriteRefs":len(sprites),"bytes":semantic_bytes}}
    world=dict(core); world["rootContentId"]=rooted(SEMANTIC_DOMAIN,core); (out/"world.json").write_bytes(canonical(world)); return world,sprites

def decode_sheet(data: bytes) -> bytes:
    p=0
    while p<len(data) and data[p]==0:p+=1
    if data[p:p+5]!=b"\x70\x0a\xfa\x80\x24": raise PublicationError("invalid sprite sheet header")
    p+=5
    while p<len(data) and data[p]&0x80:p+=1
    p+=1; prop=data[p]; lc=prop%9; rem=prop//9; lp,pb=rem%5,rem//5; dictionary=int.from_bytes(data[p+1:p+5],"little"); p+=13
    bmp=lzma.decompress(data[p:],format=lzma.FORMAT_RAW,filters=[{"id":lzma.FILTER_LZMA1,"dict_size":dictionary,"lc":lc,"lp":lp,"pb":pb}])
    if bmp[:2]!=b"BM": raise PublicationError("decoded sprite sheet is not BMP")
    off=int.from_bytes(bmp[10:14],"little"); w=int.from_bytes(bmp[18:22],"little",signed=True); h=int.from_bytes(bmp[22:26],"little",signed=True)
    if w!=384 or abs(h)!=384: raise PublicationError("unexpected sprite sheet dimensions")
    pixels=bmp[off:off+w*abs(h)*4]; rows=[pixels[i*w*4:(i+1)*w*4] for i in range(abs(h))]
    if h>0: rows.reverse()
    rgba=bytearray()
    for row in rows:
        for i in range(0,len(row),4):
            b,g,r,a=row[i:i+4]; rgba.extend((r,g,b,a))
    return bytes(rgba)

def extract_sprite(entry:dict[str,Any],rgba:bytes,sid:int)->tuple[int,int,bytes]:
    st=entry.get("spritetype")
    if not isinstance(st,int) or not 0<=st<len(SPRITE_SIZES): raise PublicationError("unsupported sprite type")
    w,h=SPRITE_SIZES[st]; first,last=entry["firstspriteid"],entry["lastspriteid"]
    if not first<=sid<=last: raise PublicationError("sprite outside sheet")
    cols=384//w; n=sid-first; x=(n%cols)*w; y=(n//cols)*h; out=bytearray()
    for row in range(y,y+h): out.extend(rgba[(row*384+x)*4:(row*384+x+w)*4])
    if len(out)!=w*h*4: raise PublicationError("sprite extraction mismatch")
    return w,h,bytes(out)

def pixel_id(w:int,h:int,rgba:bytes)->str:
    return "sha256:"+hashlib.sha256(PIXEL_DOMAIN+w.to_bytes(2,"big")+h.to_bytes(2,"big")+rgba).hexdigest()

def authorize_assets(repo:Path,asset:Path,handoff:dict[str,Any])->None:
    expected=handoff["source"]["asset_zip_sha256"]
    if sha256_file(asset)!=expected: raise PublicationError("asset ZIP digest mismatch")
    att=repo/"docs/legal/DYN-ATLAS-001-15-32-asset-rights-attestation.md"
    if not att.is_file() or expected not in att.read_text(): raise PublicationError("exact-source rights attestation missing")

def publish_pixels(repo:Path,asset:Path,sprites:set[int],handoff:dict[str,Any],out:Path)->dict[str,Any]:
    authorize_assets(repo,asset,handoff); blobs:dict[str,tuple[int,int,bytes]]={}; index={}
    with zipfile.ZipFile(asset) as z:
        cat=z.read("assets/catalog-content.json")
        if hashlib.sha256(cat).hexdigest()!=handoff["source"]["catalog_sha256"]: raise PublicationError("catalog digest mismatch")
        sheets=sorted((x for x in json.loads(cat) if x.get("type")=="sprite"),key=lambda x:x["lastspriteid"]); lasts=[x["lastspriteid"] for x in sheets]; by_file=defaultdict(list)
        for sid in sorted(sprites):
            n=bisect.bisect_left(lasts,sid)
            if n==len(sheets) or sid<sheets[n]["firstspriteid"]: raise PublicationError(f"missing catalog sprite {sid}")
            by_file[sheets[n]["file"]].append((sid,sheets[n]))
        done=0
        for fname in sorted(by_file):
            rgba=decode_sheet(z.read("assets/"+fname))
            for sid,entry in by_file[fname]:
                w,h,pix=extract_sprite(entry,rgba,sid); cid=pixel_id(w,h,pix); blobs.setdefault(cid,(w,h,pix)); index[str(sid)]={"contentId":cid,"width":w,"height":h}; done+=1
            if done%2000< len(by_file[fname]): print(f"pixels {done}/{len(sprites)}",flush=True)
    if len(index)!=len(sprites): raise PublicationError("sprite index reconciliation failed")
    out.mkdir(parents=True,exist_ok=True); packs=[]; entries=[]; current=bytearray(); pack_no=0
    def flush()->None:
        nonlocal current,pack_no
        if not current:return
        data=bytes(current); name=f"packs/pack-{pack_no:04d}.rgba"; p=out/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data); packs.append({"path":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),"identityAuthority":False}); pack_no+=1; current=bytearray()
    raw_before=0
    for cid,(w,h,pix) in sorted(blobs.items()):
        if current and len(current)+len(pix)>PACK_LIMIT: flush()
        offset=len(current); current.extend(pix); entries.append({"contentId":cid,"width":w,"height":h,"pack":pack_no,"offset":offset,"bytes":len(pix)})
    flush()
    for sid,v in index.items(): raw_before += v["width"]*v["height"]*4
    raw_after=sum(x["bytes"] for x in entries)
    core={"profile":PIXEL_PROFILE,"assetZipSha256":handoff["source"]["asset_zip_sha256"],"pixelHashDomain":PIXEL_DOMAIN[:-1].decode(),"spriteIndex":index,"blobs":entries,"packs":packs,"counts":{"spriteRefs":len(index),"uniquePixelBlobs":len(entries),"rawBytesBeforeDedupe":raw_before,"rawBytesAfterDedupe":raw_after,"dedupeBytesSaved":raw_before-raw_after},"runtimePlacement":{"identityAuthority":False}}
    manifest=dict(core); manifest["rootContentId"]=rooted(PIXEL_ROOT_DOMAIN,core); (out/"manifest.json").write_bytes(canonical(manifest)); return manifest

def compile_all(repo:Path,fabric:Path,handoff_path:Path,asset:Path,out:Path,expected_sha:str)->dict[str,Any]:
    started=time.perf_counter(); handoff=load_handoff(handoff_path,expected_sha)
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True); semantic,sprites=scan_semantic(fabric,handoff,out/"semantic"); pixel=publish_pixels(repo,asset,sprites,handoff,out/"pixels")
    core={"profile":PUBLICATION_PROFILE,"source":{"authority":handoff["source_authority"],"handoffSha256":expected_sha,"fabricRoot":handoff["fabric_root"],"sourceFingerprint":handoff["source_fingerprint"],"gameSha":handoff["source"]["game_sha"],"canonicalWorldId":handoff.get("canonical_world_id"),"canonicalWorldIdState":handoff.get("canonical_world_id_state")},"semantic":{"path":"semantic/world.json","rootContentId":semantic["rootContentId"]},"pixels":{"path":"pixels/manifest.json","rootContentId":pixel["rootContentId"]},"serializerStatus":"PROVISIONAL_NOT_FROZEN"}
    pub=dict(core); pub["rootContentId"]=rooted(PUBLICATION_DOMAIN,core); (out/"publication.json").write_bytes(canonical(pub))
    evidence={"publicationRoot":pub["rootContentId"],"semanticRoot":semantic["rootContentId"],"pixelRoot":pixel["rootContentId"],"counts":semantic["counts"],"pixelCounts":pixel["counts"],"elapsedSeconds":time.perf_counter()-started,"outputPath":str(out)}
    (out/"build-evidence.json").write_bytes(canonical(evidence)); return evidence

def main()->int:
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument("--repo-root",type=Path,required=True); ap.add_argument("--fabric-dir",type=Path,required=True); ap.add_argument("--handoff",type=Path,required=True); ap.add_argument("--asset-zip",type=Path,required=True); ap.add_argument("--output",type=Path,required=True); ap.add_argument("--expected-handoff-sha256",required=True); a=ap.parse_args()
    try: result=compile_all(a.repo_root,a.fabric_dir,a.handoff,a.asset_zip,a.output,a.expected_handoff_sha256)
    except (PublicationError,OSError,ValueError,KeyError,zipfile.BadZipFile,lzma.LZMAError) as e: print("ERROR:",e,file=sys.stderr); return 1
    print(json.dumps(result,indent=2,sort_keys=True)); return 0
if __name__=="__main__": raise SystemExit(main())
