#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path

PROFILE = "oteryn-atlas-animation-runtime-v1"
ROOT_DOMAIN = b"OTERYN-ATLAS-ANIMATION-RUNTIME-V1\0"
PIXEL_DOMAIN = b"OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0"
EXPECTED_ROOT = "sha256:43ca727af914da89bba591a9e3c7324bfc72ffe96bd4ba0524bdf71a6c6a4caf"

class VerifyError(RuntimeError): pass

def canonical(v): return (json.dumps(v, ensure_ascii=False, sort_keys=True, separators=(",", ":"))+"\n").encode()
def sha(data): return hashlib.sha256(data).hexdigest()
def checked_file(root, descriptor, path_key="path", bytes_key="bytes", sha_key="sha256"):
    path=root/descriptor[path_key]; data=path.read_bytes()
    if len(data)!=descriptor[bytes_key] or sha(data)!=descriptor[sha_key]: raise VerifyError(f"file identity mismatch: {path.name}")
    return data

def pixel_id(width, height, data):
    return "sha256:"+sha(PIXEL_DOMAIN+int(width).to_bytes(2,"big")+int(height).to_bytes(2,"big")+data)
def verify(root: Path):
    raw=(root/"manifest.json").read_bytes(); manifest=json.loads(raw)
    if raw!=canonical(manifest): raise VerifyError("manifest is not canonical")
    if manifest.get("profile")!=PROFILE: raise VerifyError("profile mismatch")
    core=dict(manifest); core.pop("rootContentId",None)
    rooted="sha256:"+sha(ROOT_DOMAIN+canonical(core))
    if manifest.get("rootContentId")!=rooted or rooted!=EXPECTED_ROOT: raise VerifyError("root mismatch")
    if manifest.get("rights",{}).get("publicFullWorldRedistributionAuthorized") is not False: raise VerifyError("rights scope widened")
    if manifest.get("counts")!={"resolvedMonsterRecords":87193,"resolvedNpcRecords":973}: raise VerifyError("creature census mismatch")
    objects=json.loads(checked_file(root,manifest["objects"]))
    creatures=json.loads(checked_file(root,manifest["creatures"]))
    if len(objects.get("programs",[]))!=5190 or len(creatures.get("presentations",{}))!=1377: raise VerifyError("program census mismatch")
    object_index=json.loads(checked_file(root,{"path":manifest["objectPixels"]["indexPath"],"bytes":manifest["objectPixels"]["indexBytes"],"sha256":manifest["objectPixels"]["indexSha256"]}))
    object_pack=checked_file(root,manifest["objectPixels"])
    creature_pack=checked_file(root,manifest["creaturePixels"])
    return manifest, object_index, creatures, object_pack, creature_pack
def verify_pixels(object_index, creatures, object_pack, creature_pack):
    seen=set()
    for sprite_id,entry in object_index.get("sprites",{}).items():
        if not str(sprite_id).isdigit(): raise VerifyError("invalid sprite id")
        start=int(entry["offset"]); end=start+int(entry["bytes"])
        data=object_pack[start:end]
        if len(data)!=entry["bytes"] or pixel_id(entry["width"],entry["height"],data)!=entry["contentId"]: raise VerifyError("object pixel identity mismatch")
        seen.add(entry["contentId"])
    if len(object_index.get("sprites",{}))!=40680: raise VerifyError("object sprite census mismatch")
    creature_ids=set()
    for presentation in creatures.get("presentations",{}).values():
        frames=presentation.get("frames",[])
        if len(frames)!=presentation.get("phaseCount"): raise VerifyError("creature phase cardinality mismatch")
        for entry in frames:
            start=int(entry["offset"]); end=start+int(entry["bytes"]); data=creature_pack[start:end]
            if len(data)!=entry["bytes"] or pixel_id(entry["width"],entry["height"],data)!=entry["contentId"]: raise VerifyError("creature pixel identity mismatch")
            creature_ids.add(entry["contentId"])
    return {"objectSpriteRefs":len(object_index["sprites"]),"objectPixelIdentities":len(seen),"creaturePixelIdentities":len(creature_ids)}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("product",type=Path); args=parser.parse_args()
    try:
        manifest,object_index,creatures,object_pack,creature_pack=verify(args.product)
        counts=verify_pixels(object_index,creatures,object_pack,creature_pack)
    except (OSError,ValueError,KeyError,VerifyError) as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
    print(json.dumps({"status":"PASS","rootContentId":manifest["rootContentId"],**counts},sort_keys=True))
if __name__=="__main__": main()
