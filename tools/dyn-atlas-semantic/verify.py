#!/usr/bin/env python3
"""Fail-closed verifier for committed DYN-ATLAS-001 compact semantic chunks."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

PROFILE = "dyn-atlas-compact-json-v0"
SOURCE_ARTIFACT = "sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e"
EXPECTED_COUNTS = {"tiles": 24311, "presentationRecords": 39282, "resolvedPrimitives": 39282}
EXPECTED_BOUNDS = {"floor": -7, "xMaxExclusive": 32441, "xMin": 32280, "yMaxExclusive": 32306, "yMin": 32155}
MAX_CHUNKS = 512
MAX_CHUNK_BYTES = 2 * 1024 * 1024
MAX_TILES_PER_CHUNK = 4096
MAX_PRESENTATIONS_PER_TILE = 512
MAX_PRIMITIVES_PER_PRESENTATION = 2048


class VerifyError(RuntimeError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify(root: Path) -> dict[str, Any]:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise VerifyError("missing manifest")

    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    if canonical_bytes(manifest) != manifest_bytes:
        raise VerifyError("manifest not canonical")
    if manifest.get("profile") != PROFILE or manifest.get("version") != 0:
        raise VerifyError("unsupported profile/version")
    if manifest.get("bounds") != EXPECTED_BOUNDS or manifest.get("counts") != EXPECTED_COUNTS:
        raise VerifyError("bounds/count mismatch")
    if manifest.get("source", {}).get("artifactDigest") != SOURCE_ARTIFACT:
        raise VerifyError("source artifact mismatch")

    chunks = manifest.get("chunks")
    if not isinstance(chunks, list) or not chunks or len(chunks) > MAX_CHUNKS:
        raise VerifyError("invalid chunk list")

    manifest_core = dict(manifest)
    root_content_id = manifest_core.pop("rootContentId", None)
    root_hash = hashlib.sha256()
    root_hash.update(b"OTERYN-DYN-ATLAS-COMPACT-JSON-V0\0")
    root_hash.update(canonical_bytes(manifest_core))
    if root_content_id != f"sha256:{root_hash.hexdigest()}":
        raise VerifyError("root content id mismatch")

    seen_addresses: set[str] = set()
    tile_total = presentation_total = primitive_total = 0

    for entry in chunks:
        if set(entry) != {"address", "bytes", "contentId", "gzipBytes", "path", "tiles"}:
            raise VerifyError("chunk manifest shape mismatch")
        address = entry["address"]
        if address in seen_addresses:
            raise VerifyError("duplicate logical address")
        seen_addresses.add(address)

        chunk_path = root / entry["path"]
        if not chunk_path.is_file():
            raise VerifyError(f"missing chunk {entry['path']}")
        chunk_bytes = chunk_path.read_bytes()
        if len(chunk_bytes) != entry["bytes"] or len(chunk_bytes) > MAX_CHUNK_BYTES:
            raise VerifyError("chunk byte mismatch/limit")
        if entry["contentId"] != f"sha256:{sha256(chunk_bytes)}":
            raise VerifyError("chunk content id mismatch")

        chunk = json.loads(chunk_bytes)
        if canonical_bytes(chunk) != chunk_bytes:
            raise VerifyError("chunk not canonical")
        if chunk.get("profile") != PROFILE or chunk.get("sourceArtifact") != SOURCE_ARTIFACT:
            raise VerifyError("chunk profile/source mismatch")

        chunk_address = chunk.get("address", {})
        if address != f"f{chunk_address.get('floor')}/x{chunk_address.get('cx')}/y{chunk_address.get('cy')}":
            raise VerifyError("logical address mismatch")

        tiles = chunk.get("tiles")
        if not isinstance(tiles, list) or len(tiles) != entry["tiles"] or len(tiles) > MAX_TILES_PER_CHUNK:
            raise VerifyError("chunk tile count mismatch")

        previous_position: tuple[int, int] | None = None
        for tile in tiles:
            if not isinstance(tile, list) or len(tile) != 8:
                raise VerifyError("invalid compact tile shape")
            x, y, floor, source_x, source_y, source_z, tile_id, presentations = tile
            if (source_x, source_y, source_z) != (x, y, 7) or floor != -7:
                raise VerifyError("tile semantics mismatch")
            if not isinstance(tile_id, str) or not tile_id.startswith("tile:"):
                raise VerifyError("invalid tile identity")
            if previous_position is not None and (y, x) <= previous_position:
                raise VerifyError("tile ordering mismatch")
            previous_position = (y, x)

            if not isinstance(presentations, list) or len(presentations) > MAX_PRESENTATIONS_PER_TILE:
                raise VerifyError("presentation limit")

            for expected_order, presentation in enumerate(presentations):
                if not isinstance(presentation, list) or len(presentation) != 7:
                    raise VerifyError("presentation shape")
                record_id, appearance_id, identity_state, plane, order, role, primitives = presentation
                if identity_state != 0 or plane != 0 or order != expected_order or role not in (0, 1):
                    raise VerifyError("presentation semantics")
                if not isinstance(record_id, str) or not record_id.startswith("presentation:") or not isinstance(appearance_id, int):
                    raise VerifyError("presentation identity/ref")
                if not isinstance(primitives, list) or not primitives or len(primitives) > MAX_PRIMITIVES_PER_PRESENTATION:
                    raise VerifyError("primitive limit")

                for expected_layer, primitive in enumerate(primitives):
                    if not isinstance(primitive, list) or len(primitive) != 13:
                        raise VerifyError("primitive shape")
                    sprite_id, _frame_group_id, _frame_group_type, phase, layer, px, py, pz, width, height, dx, dy, coverage = primitive
                    if layer != expected_layer or not all(isinstance(value, int) for value in (sprite_id, phase, px, py, pz, width, height, dx, dy)):
                        raise VerifyError("primitive values")
                    if width <= 0 or height <= 0 or width % 32 or height % 32:
                        raise VerifyError("primitive dimensions")
                    if not isinstance(coverage, list) or len(coverage) % 2:
                        raise VerifyError("coverage shape")
                    primitive_total += 1
                presentation_total += 1
            tile_total += 1

    reconciled = {
        "tiles": tile_total,
        "presentationRecords": presentation_total,
        "resolvedPrimitives": primitive_total,
    }
    if reconciled != EXPECTED_COUNTS:
        raise VerifyError("reconciled totals mismatch")

    return {"rootContentId": root_content_id, "chunks": len(chunks), **EXPECTED_COUNTS}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    try:
        result = verify(args.root)
    except (VerifyError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
