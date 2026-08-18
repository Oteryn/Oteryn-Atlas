#!/usr/bin/env python3
"""Publish the authorized DYN-ATLAS-001 sprite subset as content-addressed PNGs.

Consumes the exact Game semantic fixture and exact 15.32.zip. Pixel authority is
strictly digest-scoped by the recorded project-owner attestation. Output is a
replaceable proof-local store: one PNG per unique dimension+RGBA blob plus a
sprite-source-id index. No Game semantic facts are inferred from pixels.
"""
from __future__ import annotations

import argparse, binascii, hashlib, json, struct, zlib, zipfile
from collections import defaultdict
from pathlib import Path

import measure_metadata as mm

RIGHTS_ATTESTATION = Path("docs/legal/DYN-ATLAS-001-15-32-asset-rights-attestation.md")
STORE_PROFILE = "dyn-atlas-pixel-store-v0"


def png_bytes(width: int, height: int, rgba: bytes) -> bytes:
    if len(rgba) != width * height * 4:
        raise mm.MeasureError("RGBA length mismatch")
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", binascii.crc32(kind + data) & 0xffffffff)
    rows = b"".join(b"\x00" + rgba[y*width*4:(y+1)*width*4] for y in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


def authorize(repo_root: Path) -> None:
    path = repo_root / RIGHTS_ATTESTATION
    if not path.is_file():
        raise mm.MeasureError("missing exact 15.32 rights attestation")
    text = path.read_text(encoding="utf-8")
    if mm.ASSET_ZIP_SHA256 not in text or mm.DRIVE_FILE_ID not in text:
        raise mm.MeasureError("rights attestation does not cover exact source")


def publish(repo_root: Path, game_fixture: Path, asset_zip: Path, output: Path) -> dict:
    authorize(repo_root)
    if mm.sha256_file(asset_zip) != mm.ASSET_ZIP_SHA256:
        raise mm.MeasureError("unexpected 15.32 asset ZIP digest")
    sprite_ids = mm.referenced_sprite_ids(game_fixture)
    blobs: dict[str, tuple[int,int,bytes]] = {}
    sprite_index: dict[str, dict] = {}
    with zipfile.ZipFile(asset_zip) as archive:
        catalog_bytes = archive.read("assets/catalog-content.json")
        if hashlib.sha256(catalog_bytes).hexdigest() != mm.ASSET_CATALOG_SHA256:
            raise mm.MeasureError("unexpected 15.32 catalog digest")
        catalog = json.loads(catalog_bytes)
        sheets = sorted((e for e in catalog if e.get("type") == "sprite"), key=lambda e: e["firstspriteid"])
        by_file = defaultdict(list)
        for sid in sorted(sprite_ids):
            matches = [e for e in sheets if e["firstspriteid"] <= sid <= e["lastspriteid"]]
            if len(matches) != 1:
                raise mm.MeasureError(f"catalog resolution failed for sprite {sid}")
            by_file[matches[0]["file"]].append((sid, matches[0]))
        for file_name in sorted(by_file):
            rgba_sheet = mm.decode_sheet(archive.read(f"assets/{file_name}"))
            for sid, entry in by_file[file_name]:
                width, height, rgba = mm.extract_sprite(entry, rgba_sheet, sid)
                digest = hashlib.sha256(mm.PIXEL_HASH_DOMAIN + width.to_bytes(2,"big") + height.to_bytes(2,"big") + rgba).hexdigest()
                blobs.setdefault(digest, (width,height,rgba))
                sprite_index[str(sid)] = {"contentId": f"sha256:{digest}", "height": height, "width": width}
    if len(sprite_index) != 990 or len(blobs) != 987:
        raise mm.MeasureError("authorized store reconciliation failed")
    blob_dir = output / "blobs"
    blob_dir.mkdir(parents=True, exist_ok=True)
    entries=[]
    for digest,(width,height,rgba) in sorted(blobs.items()):
        data=png_bytes(width,height,rgba)
        path=blob_dir/f"{digest}.png"
        path.write_bytes(data)
        entries.append({"bytes":len(data),"contentId":f"sha256:{digest}","height":height,"path":f"blobs/{digest}.png","pngSha256":hashlib.sha256(data).hexdigest(),"width":width})
    manifest={"assetZipSha256":mm.ASSET_ZIP_SHA256,"blobCount":len(entries),"blobs":entries,"gameSemanticArtifact":mm.GAME_ARTIFACT_DIGEST,"pixelHashDomain":mm.PIXEL_HASH_DOMAIN[:-1].decode(),"profile":STORE_PROFILE,"spriteIndex":sprite_index,"version":0}
    manifest_bytes=(json.dumps(manifest,sort_keys=True,separators=(",",":"))+"\n").encode()
    (output/"manifest.json").write_bytes(manifest_bytes)
    return {"blobCount":len(entries),"manifestSha256":hashlib.sha256(manifest_bytes).hexdigest(),"pngBytes":sum(e["bytes"] for e in entries),"spriteRefs":len(sprite_index)}


def main() -> int:
    p=argparse.ArgumentParser(description=__doc__); p.add_argument("--repo-root",type=Path,default=Path(".")); p.add_argument("--game-fixture",type=Path,required=True); p.add_argument("--asset-zip",type=Path,required=True); p.add_argument("--output",type=Path,required=True); a=p.parse_args()
    try: print(json.dumps(publish(a.repo_root,a.game_fixture,a.asset_zip,a.output),indent=2,sort_keys=True)); return 0
    except (mm.MeasureError,OSError,ValueError,KeyError,zipfile.BadZipFile) as e: print(f"ERROR: {e}"); return 1
if __name__=="__main__": raise SystemExit(main())
