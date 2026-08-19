#!/usr/bin/env python3
"""Publish the authorized DYN-ATLAS-001 sprite subset as a verified raw-RGBA pack.

The store is proof-local and content-addressed. Pixel identity is the hash of the
exact Game-selected source dimensions plus RGBA bytes; the pack is transport
state only and has no World/appearance identity authority.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path

import measure_metadata as mm

RIGHTS_ATTESTATION = Path("docs/legal/DYN-ATLAS-001-15-32-asset-rights-attestation.md")
STORE_PROFILE = "dyn-atlas-pixel-store-v0"
ROOT_DOMAIN = b"OTERYN-DYN-ATLAS-PIXEL-STORE-V0\0"


class PublishError(mm.MeasureError):
    pass


def canonical_json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def authorize(repo_root: Path) -> None:
    path = repo_root / RIGHTS_ATTESTATION
    if not path.is_file():
        raise PublishError("missing exact 15.32 rights attestation")
    text = path.read_text(encoding="utf-8")
    if mm.ASSET_ZIP_SHA256 not in text or mm.DRIVE_FILE_ID not in text:
        raise PublishError("rights attestation does not cover exact source")


def pixel_content_id(width: int, height: int, rgba: bytes) -> str:
    digest = hashlib.sha256(
        mm.PIXEL_HASH_DOMAIN
        + width.to_bytes(2, "big")
        + height.to_bytes(2, "big")
        + rgba
    ).hexdigest()
    return f"sha256:{digest}"


def publish(repo_root: Path, game_fixture: Path, asset_zip: Path, output: Path) -> dict:
    authorize(repo_root)
    if mm.sha256_file(asset_zip) != mm.ASSET_ZIP_SHA256:
        raise PublishError("unexpected 15.32 asset ZIP digest")

    sprite_ids = mm.referenced_sprite_ids(game_fixture)
    blobs: dict[str, tuple[int, int, bytes]] = {}
    sprite_index: dict[str, dict] = {}

    with zipfile.ZipFile(asset_zip) as archive:
        catalog_bytes = archive.read("assets/catalog-content.json")
        if hashlib.sha256(catalog_bytes).hexdigest() != mm.ASSET_CATALOG_SHA256:
            raise PublishError("unexpected 15.32 catalog digest")
        catalog = json.loads(catalog_bytes)
        sheets = sorted(
            (entry for entry in catalog if entry.get("type") == "sprite"),
            key=lambda entry: entry["firstspriteid"],
        )
        by_file: dict[str, list[tuple[int, dict]]] = {}
        for sprite_id in sorted(sprite_ids):
            matches = [
                entry for entry in sheets
                if entry["firstspriteid"] <= sprite_id <= entry["lastspriteid"]
            ]
            if len(matches) != 1:
                raise PublishError(f"catalog resolution failed for sprite {sprite_id}")
            by_file.setdefault(matches[0]["file"], []).append((sprite_id, matches[0]))

        for file_name in sorted(by_file):
            rgba_sheet = mm.decode_sheet(archive.read(f"assets/{file_name}"))
            for sprite_id, entry in by_file[file_name]:
                width, height, rgba = mm.extract_sprite(entry, rgba_sheet, sprite_id)
                content_id = pixel_content_id(width, height, rgba)
                digest = content_id.removeprefix("sha256:")
                blobs.setdefault(digest, (width, height, rgba))
                sprite_index[str(sprite_id)] = {
                    "contentId": content_id,
                    "height": height,
                    "width": width,
                }

    if len(sprite_index) != 990 or len(blobs) != 987:
        raise PublishError("authorized store reconciliation failed")

    pack = bytearray()
    entries: list[dict] = []
    for digest, (width, height, rgba) in sorted(blobs.items()):
        offset = len(pack)
        pack.extend(rgba)
        entries.append({
            "bytes": len(rgba),
            "contentId": f"sha256:{digest}",
            "height": height,
            "offset": offset,
            "width": width,
        })

    pack_bytes = bytes(pack)
    pack_sha256 = hashlib.sha256(pack_bytes).hexdigest()
    output.mkdir(parents=True, exist_ok=True)
    (output / "pack.rgba").write_bytes(pack_bytes)

    manifest_core = {
        "assetZipSha256": mm.ASSET_ZIP_SHA256,
        "blobCount": len(entries),
        "blobs": entries,
        "gameSemanticArtifact": mm.GAME_ARTIFACT_DIGEST,
        "pack": {
            "bytes": len(pack_bytes),
            "path": "pack.rgba",
            "sha256": pack_sha256,
        },
        "pixelHashDomain": mm.PIXEL_HASH_DOMAIN[:-1].decode(),
        "profile": STORE_PROFILE,
        "spriteIndex": sprite_index,
        "version": 0,
    }
    root_hash = hashlib.sha256()
    root_hash.update(ROOT_DOMAIN)
    root_hash.update(canonical_json_bytes(manifest_core))
    manifest = dict(manifest_core)
    manifest["rootContentId"] = f"sha256:{root_hash.hexdigest()}"
    manifest_bytes = canonical_json_bytes(manifest)
    (output / "manifest.json").write_bytes(manifest_bytes)

    return {
        "blobCount": len(entries),
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "packBytes": len(pack_bytes),
        "packSha256": pack_sha256,
        "rootContentId": manifest["rootContentId"],
        "spriteRefs": len(sprite_index),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path("."))
    parser.add_argument("--game-fixture", type=Path, required=True)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = publish(args.repo_root, args.game_fixture, args.asset_zip, args.output)
    except (mm.MeasureError, OSError, ValueError, KeyError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
