#!/usr/bin/env python3
"""Fail-closed verifier for the complete full-world Atlas publication."""
from __future__ import annotations

import argparse
import bisect
import hashlib
import importlib.util
import json
import lzma
import sys
import time
import zipfile
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("fullworld_publication", HERE / "publication.py")
PUB = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(PUB)


class VerifyError(RuntimeError):
    pass


def safe_join(root: Path, relative: str) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts:
        raise VerifyError(f"unsafe relative path: {relative}")
    return root / rel

def load_manifest(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise VerifyError(f"missing manifest: {path}")
    raw = path.read_bytes()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise VerifyError(f"invalid JSON manifest: {path}") from exc
    if not isinstance(value, dict):
        raise VerifyError(f"manifest is not an object: {path}")
    if raw != PUB.canonical(value):
        raise VerifyError(f"manifest is not canonical JSON: {path}")
    return value


def check_root(value: dict[str, Any], domain: bytes, label: str) -> None:
    root = value.get("rootContentId")
    core = dict(value)
    core.pop("rootContentId", None)
    expected = PUB.rooted(domain, core)
    if root != expected:
        raise VerifyError(f"{label} root mismatch: {root!r} != {expected!r}")


def checked_file(path: Path, size: int, digest: str, label: str) -> None:
    if not path.is_file():
        raise VerifyError(f"missing {label}: {path}")
    if path.stat().st_size != size:
        raise VerifyError(f"{label} byte-size mismatch: {path}")
    if PUB.sha256_file(path) != digest:
        raise VerifyError(f"{label} digest mismatch: {path}")

def verify_semantic(root: Path, publication: dict[str, Any]) -> tuple[dict[str, Any], set[int]]:
    semantic_path = safe_join(root, publication["semantic"]["path"])
    semantic = load_manifest(semantic_path)
    if semantic.get("profile") != PUB.SEMANTIC_PROFILE:
        raise VerifyError("unsupported semantic publication profile")
    check_root(semantic, PUB.SEMANTIC_DOMAIN, "semantic world")
    if publication["semantic"].get("rootContentId") != semantic["rootContentId"]:
        raise VerifyError("top-level semantic root linkage mismatch")

    floors = semantic.get("floors")
    if not isinstance(floors, list) or not floors:
        raise VerifyError("semantic floor list missing")
    sprite_ids: set[int] = set()
    floor_numbers: set[int] = set()
    logical_addresses: set[tuple[int, int, int]] = set()
    totals = {"floors": 0, "shards": 0, "tiles": 0, "resolvedPrimitives": 0, "bytes": 0}

    semantic_root = semantic_path.parent
    for floor_entry in floors:
        floor = floor_entry.get("floor")
        if not isinstance(floor, int) or floor in floor_numbers:
            raise VerifyError(f"invalid or duplicate floor entry: {floor!r}")
        floor_numbers.add(floor)
        floor_path = safe_join(semantic_root, floor_entry["path"])
        floor_manifest = load_manifest(floor_path)
        check_root(floor_manifest, PUB.FLOOR_DOMAIN, f"floor {floor}")
        if floor_manifest.get("floor") != floor:
            raise VerifyError(f"floor manifest identity mismatch: {floor}")
        if floor_manifest.get("rootContentId") != floor_entry.get("rootContentId"):
            raise VerifyError(f"floor root linkage mismatch: {floor}")
        if floor_manifest.get("sourceFingerprint") != semantic.get("sourceFingerprint"):
            raise VerifyError(f"floor source fingerprint mismatch: {floor}")

        floor_counts = {"tiles": 0, "resolvedPrimitives": 0, "bytes": 0}
        chunks = floor_manifest.get("chunks")
        if not isinstance(chunks, list):
            raise VerifyError(f"floor chunks missing: {floor}")
        for chunk in chunks:
            logical = chunk.get("logicalAddress", {})
            address = (logical.get("floor"), logical.get("region_x"), logical.get("region_y"))
            if address[0] != floor or not all(isinstance(v, int) for v in address):
                raise VerifyError(f"invalid logical chunk address: {address!r}")
            if address in logical_addresses:
                raise VerifyError(f"duplicate logical chunk address: {address!r}")
            logical_addresses.add(address)

            chunk_path = safe_join(semantic_root, chunk["path"])
            content_id = chunk.get("contentId", "")
            if not isinstance(content_id, str) or not content_id.startswith("sha256:"):
                raise VerifyError(f"invalid chunk content ID: {address!r}")
            checked_file(chunk_path, chunk["bytes"], content_id.removeprefix("sha256:"), "semantic chunk")
            primitive_count = 0
            line_count = 0
            with chunk_path.open("rb") as handle:
                for line in handle:
                    if not line.endswith(b"\n"):
                        raise VerifyError(f"unterminated semantic record: {address!r}")
                    line_count += 1
                    ids = [int(value) for value in PUB.SPRITE_RE.findall(line)]
                    primitive_count += len(ids)
                    sprite_ids.update(ids)
            if line_count != chunk.get("tiles"):
                raise VerifyError(f"tile count mismatch: {address!r}")
            if primitive_count != chunk.get("resolvedPrimitives"):
                raise VerifyError(f"primitive count mismatch: {address!r}")
            floor_counts["tiles"] += line_count
            floor_counts["resolvedPrimitives"] += primitive_count
            floor_counts["bytes"] += chunk_path.stat().st_size
            totals["shards"] += 1

        if floor_counts != floor_manifest.get("counts"):
            raise VerifyError(f"floor manifest counts mismatch: {floor}")
        if floor_counts != floor_entry.get("counts"):
            raise VerifyError(f"semantic floor-entry counts mismatch: {floor}")
        totals["floors"] += 1
        for key in floor_counts:
            totals[key] += floor_counts[key]

    totals["uniqueSpriteRefs"] = len(sprite_ids)
    if totals != semantic.get("counts"):
        raise VerifyError(f"semantic world counts mismatch: {totals!r}")
    return semantic, sprite_ids

def verify_pixels(root: Path, publication: dict[str, Any], sprite_ids: set[int]) -> dict[str, Any]:
    pixel_path = safe_join(root, publication["pixels"]["path"])
    pixels = load_manifest(pixel_path)
    if pixels.get("profile") != PUB.PIXEL_PROFILE:
        raise VerifyError("unsupported pixel publication profile")
    check_root(pixels, PUB.PIXEL_ROOT_DOMAIN, "pixel publication")
    if publication["pixels"].get("rootContentId") != pixels["rootContentId"]:
        raise VerifyError("top-level pixel root linkage mismatch")
    if pixels.get("runtimePlacement", {}).get("identityAuthority") is not False:
        raise VerifyError("runtime/GPU placement claims identity authority")

    pixel_root = pixel_path.parent
    packs = pixels.get("packs")
    if not isinstance(packs, list) or not packs:
        raise VerifyError("pixel packs missing")
    pack_data: list[bytes] = []
    for index, pack in enumerate(packs):
        if pack.get("identityAuthority") is not False:
            raise VerifyError(f"pack {index} claims identity authority")
        path = safe_join(pixel_root, pack["path"])
        if not path.is_file():
            raise VerifyError(f"missing pixel pack: {path}")
        data = path.read_bytes()
        if len(data) != pack.get("bytes") or hashlib.sha256(data).hexdigest() != pack.get("sha256"):
            raise VerifyError(f"pixel pack integrity mismatch: {path}")
        pack_data.append(data)

    blobs = pixels.get("blobs")
    if not isinstance(blobs, list):
        raise VerifyError("pixel blob index missing")
    blob_meta: dict[str, tuple[int, int]] = {}
    cursors = [0 for _ in pack_data]
    raw_after = 0
    for blob in blobs:
        content_id = blob.get("contentId")
        width, height = blob.get("width"), blob.get("height")
        pack_no, offset, byte_count = blob.get("pack"), blob.get("offset"), blob.get("bytes")
        if not isinstance(content_id, str) or not content_id.startswith("sha256:"):
            raise VerifyError("invalid pixel blob content ID")
        if content_id in blob_meta:
            raise VerifyError(f"duplicate pixel blob identity: {content_id}")
        if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
            raise VerifyError(f"invalid pixel blob dimensions: {content_id}")
        if byte_count != width * height * 4:
            raise VerifyError(f"pixel blob byte count mismatch: {content_id}")
        if not isinstance(pack_no, int) or not 0 <= pack_no < len(pack_data):
            raise VerifyError(f"invalid pixel pack index: {content_id}")
        if offset != cursors[pack_no]:
            raise VerifyError(f"pixel pack gap/overlap: {content_id}")
        end = offset + byte_count
        if end > len(pack_data[pack_no]):
            raise VerifyError(f"pixel blob exceeds pack: {content_id}")
        rgba = pack_data[pack_no][offset:end]
        if PUB.pixel_id(width, height, rgba) != content_id:
            raise VerifyError(f"pixel content identity mismatch: {content_id}")
        cursors[pack_no] = end
        raw_after += byte_count
        blob_meta[content_id] = (width, height)

    if cursors != [len(data) for data in pack_data]:
        raise VerifyError("pixel pack contains unindexed bytes")
    sprite_index = pixels.get("spriteIndex")
    if not isinstance(sprite_index, dict):
        raise VerifyError("sprite index missing")
    try:
        indexed_ids = {int(key) for key in sprite_index}
    except ValueError as exc:
        raise VerifyError("non-numeric sprite index key") from exc
    if indexed_ids != sprite_ids:
        raise VerifyError("semantic sprite refs and pixel sprite index differ")

    raw_before = 0
    for sid in sorted(sprite_ids):
        mapping = sprite_index[str(sid)]
        content_id = mapping.get("contentId")
        if content_id not in blob_meta:
            raise VerifyError(f"sprite {sid} maps to missing pixel blob")
        dimensions = blob_meta[content_id]
        if (mapping.get("width"), mapping.get("height")) != dimensions:
            raise VerifyError(f"sprite {sid} dimension mapping mismatch")
        raw_before += dimensions[0] * dimensions[1] * 4

    expected_counts = {
        "spriteRefs": len(sprite_index),
        "uniquePixelBlobs": len(blob_meta),
        "rawBytesBeforeDedupe": raw_before,
        "rawBytesAfterDedupe": raw_after,
        "dedupeBytesSaved": raw_before - raw_after,
    }
    if pixels.get("counts") != expected_counts:
        raise VerifyError(f"pixel counts mismatch: {expected_counts!r}")
    return pixels

def verify_authorized_sprite_mappings(
    repo_root: Path,
    asset_zip: Path,
    handoff: dict[str, Any],
    pixels: dict[str, Any],
    sprite_ids: set[int],
) -> None:
    PUB.authorize_assets(repo_root, asset_zip, handoff)
    if pixels.get("assetZipSha256") != handoff["source"]["asset_zip_sha256"]:
        raise VerifyError("pixel manifest asset source mismatch")

    sprite_index = pixels["spriteIndex"]
    with zipfile.ZipFile(asset_zip) as archive:
        catalog_bytes = archive.read("assets/catalog-content.json")
        if hashlib.sha256(catalog_bytes).hexdigest() != handoff["source"]["catalog_sha256"]:
            raise VerifyError("authorized asset catalog digest mismatch")
        sheets = sorted(
            (entry for entry in json.loads(catalog_bytes) if entry.get("type") == "sprite"),
            key=lambda entry: entry["lastspriteid"],
        )
        last_ids = [entry["lastspriteid"] for entry in sheets]
        by_file: dict[str, list[tuple[int, dict[str, Any]]]] = {}
        for sid in sorted(sprite_ids):
            index = bisect.bisect_left(last_ids, sid)
            if index == len(sheets) or sid < sheets[index]["firstspriteid"]:
                raise VerifyError(f"authorized catalog has no sprite {sid}")
            entry = sheets[index]
            by_file.setdefault(entry["file"], []).append((sid, entry))
        checked = 0
        for file_name in sorted(by_file):
            rgba_sheet = PUB.decode_sheet(archive.read("assets/" + file_name))
            for sid, entry in by_file[file_name]:
                width, height, rgba = PUB.extract_sprite(entry, rgba_sheet, sid)
                mapping = sprite_index[str(sid)]
                expected_id = PUB.pixel_id(width, height, rgba)
                if mapping.get("contentId") != expected_id:
                    raise VerifyError(f"forged/incorrect pixel mapping for sprite {sid}")
                if (mapping.get("width"), mapping.get("height")) != (width, height):
                    raise VerifyError(f"authorized dimensions mismatch for sprite {sid}")
                checked += 1
            if checked and checked % 4000 < len(by_file[file_name]):
                print(f"authorized pixels {checked}/{len(sprite_ids)}", flush=True)
    if checked != len(sprite_ids):
        raise VerifyError("authorized sprite mapping reconciliation failed")


def verify_source_linkage(
    publication: dict[str, Any],
    semantic: dict[str, Any],
    handoff: dict[str, Any],
    expected_handoff_sha256: str,
) -> None:
    source = publication.get("source", {})
    expected = {
        "authority": handoff["source_authority"],
        "handoffSha256": expected_handoff_sha256,
        "fabricRoot": handoff["fabric_root"],
        "sourceFingerprint": handoff["source_fingerprint"],
        "gameSha": handoff["source"]["game_sha"],
        "canonicalWorldId": handoff.get("canonical_world_id"),
        "canonicalWorldIdState": handoff.get("canonical_world_id_state"),
    }
    if source != expected:
        raise VerifyError("publication source provenance mismatch")
    if semantic.get("fabricRoot") != handoff["fabric_root"]:
        raise VerifyError("semantic fabric root provenance mismatch")
    if semantic.get("sourceFingerprint") != handoff["source_fingerprint"]:
        raise VerifyError("semantic source fingerprint provenance mismatch")
    if publication.get("serializerStatus") != "PROVISIONAL_NOT_FROZEN":
        raise VerifyError("publication incorrectly freezes serializer choice")


def verify(
    root: Path,
    repo_root: Path,
    handoff_path: Path,
    asset_zip: Path,
    expected_handoff_sha256: str,
) -> dict[str, Any]:
    started = time.perf_counter()
    publication = load_manifest(root / "publication.json")
    if publication.get("profile") != PUB.PUBLICATION_PROFILE:
        raise VerifyError("unsupported top-level publication profile")
    check_root(publication, PUB.PUBLICATION_DOMAIN, "top-level publication")

    try:
        handoff = PUB.load_handoff(handoff_path, expected_handoff_sha256)
    except PUB.PublicationError as exc:
        raise VerifyError(str(exc)) from exc
    semantic, sprite_ids = verify_semantic(root, publication)
    verify_source_linkage(publication, semantic, handoff, expected_handoff_sha256)
    pixels = verify_pixels(root, publication, sprite_ids)
    verify_authorized_sprite_mappings(repo_root, asset_zip, handoff, pixels, sprite_ids)

    evidence_path = root / "build-evidence.json"
    if evidence_path.is_file():
        evidence = load_manifest(evidence_path)
        if evidence.get("publicationRoot") != publication["rootContentId"]:
            raise VerifyError("build evidence publication root mismatch")
        if evidence.get("semanticRoot") != semantic["rootContentId"]:
            raise VerifyError("build evidence semantic root mismatch")
        if evidence.get("pixelRoot") != pixels["rootContentId"]:
            raise VerifyError("build evidence pixel root mismatch")
        if evidence.get("counts") != semantic["counts"]:
            raise VerifyError("build evidence semantic counts mismatch")
        if evidence.get("pixelCounts") != pixels["counts"]:
            raise VerifyError("build evidence pixel counts mismatch")

    return {
        "result": "PASS",
        "publicationRoot": publication["rootContentId"],
        "semanticRoot": semantic["rootContentId"],
        "pixelRoot": pixels["rootContentId"],
        "counts": semantic["counts"],
        "pixelCounts": pixels["counts"],
        "authorizedSpriteMappings": len(sprite_ids),
        "elapsedSeconds": time.perf_counter() - started,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--publication", type=Path, required=True)
    parser.add_argument("--handoff", type=Path, required=True)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--expected-handoff-sha256", required=True)
    args = parser.parse_args()
    try:
        result = verify(
            args.publication,
            args.repo_root,
            args.handoff,
            args.asset_zip,
            args.expected_handoff_sha256,
        )
    except (VerifyError, OSError, KeyError, ValueError, zipfile.BadZipFile, lzma.LZMAError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
