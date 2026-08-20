#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("runtime_index", ROOT / "tools/fullworld-runtime/build_runtime_index.py")
MOD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MOD)


def write_canonical(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(MOD.canonical(value))


def fixture(root: Path) -> str:
    semantic = root / "semantic"
    chunk_rel = "chunks/fm000007_rxp000000_ryp000000.jsonl"
    chunk_path = semantic / chunk_rel
    chunk_path.parent.mkdir(parents=True, exist_ok=True)
    records = []
    for x, y, sprite in [(1, 1, 101), (2, 1, 102), (1, 5, 103)]:
        record = {
            "position": {"floor": -7, "x": x, "y": y},
            "presentation": [{
                "resolved_primitives": [{
                    "displacement": {"dx_units": -32, "dy_units": -24},
                    "height_units": 64,
                    "sprite_source_id": sprite,
                    "width_units": 64,
                }]
            }],
            "record_type": "tile",
        }
        records.append(MOD.canonical(record))
    chunk_bytes = b"".join(records)
    chunk_path.write_bytes(chunk_bytes)
    chunk_id = "sha256:" + hashlib.sha256(chunk_bytes).hexdigest()
    fingerprint = "sha256:" + "11" * 32
    chunk = {
        "bytes": len(chunk_bytes),
        "contentId": chunk_id,
        "logicalAddress": {"floor": -7, "region_x": 0, "region_y": 0},
        "path": chunk_rel,
        "resolvedPrimitives": 3,
        "tiles": 3,
    }
    floor_core = {
        "bounds": {"x_max_exclusive": 256, "x_min": 0, "y_max_exclusive": 256, "y_min": 0},
        "chunks": [chunk],
        "counts": {"bytes": len(chunk_bytes), "resolvedPrimitives": 3, "tiles": 3},
        "floor": -7,
        "profile": MOD.SEMANTIC_PROFILE,
        "sourceFingerprint": fingerprint,
    }
    floor_manifest = dict(floor_core)
    floor_manifest["rootContentId"] = MOD.rooted(MOD.FLOOR_DOMAIN, floor_core)
    write_canonical(semantic / "floors/f-7.json", floor_manifest)
    world_core = {
        "counts": {"bytes": len(chunk_bytes), "floors": 1, "resolvedPrimitives": 3, "shards": 1, "tiles": 3, "uniqueSpriteRefs": 3},
        "fabricRoot": "sha256:" + "22" * 32,
        "floors": [{"counts": floor_core["counts"], "floor": -7, "path": "floors/f-7.json", "rootContentId": floor_manifest["rootContentId"]}],
        "profile": MOD.SEMANTIC_PROFILE,
        "sourceFingerprint": fingerprint,
    }
    world = dict(world_core)
    world["rootContentId"] = MOD.rooted(MOD.SEMANTIC_DOMAIN, world_core)
    write_canonical(semantic / "world.json", world)
    pub_core = {
        "pixels": {"path": "pixels/manifest.json", "rootContentId": "sha256:" + "33" * 32},
        "profile": MOD.PUBLICATION_PROFILE,
        "semantic": {"path": "semantic/world.json", "rootContentId": world["rootContentId"]},
        "serializerStatus": "PROVISIONAL_NOT_FROZEN",
        "source": {"authority": "Oteryn/Oteryn-Game", "gameSha": "a" * 40},
    }
    pub = dict(pub_core)
    pub["rootContentId"] = MOD.rooted(MOD.PUBLICATION_DOMAIN, pub_core)
    write_canonical(root / "publication.json", pub)
    return pub["rootContentId"]


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        base = Path(td)
        publication = base / "publication"
        publication.mkdir()
        expected_root = fixture(publication)
        first = MOD.build(publication, base / "out-a", expected_root, 4)
        second = MOD.build(publication, base / "out-b", expected_root, 4, base / "out-a", first["rootContentId"])
        assert first["rootContentId"] == second["rootContentId"]
        assert first["_buildEvidence"] == {"previousOutputUsed": False, "reusedChunks": 0, "scannedChunks": 1}
        assert second["_buildEvidence"] == {"previousOutputUsed": True, "reusedChunks": 1, "scannedChunks": 0}
        assert first["counts"] == {"floors": 1, "groups": 2, "resolvedPrimitives": 3, "shards": 1, "sourceBytes": first["counts"]["sourceBytes"], "tiles": 3}
        assert first["visualBounds"]["overscanTiles"] == {"bottom": 0, "left": 2, "right": 0, "top": 2}
        floor = json.loads((base / "out-a/floors/f-7.json").read_text())
        assert len(floor["chunks"][0]["groups"]) == 2
        assert sum(group["tiles"] for group in floor["chunks"][0]["groups"]) == 3
        assert floor["chunks"][0]["visualBounds"] == {"maxWidthUnits": 64, "maxHeightUnits": 64, "minDxUnits": -32, "maxDxUnits": 0, "minDyUnits": -24, "maxDyUnits": 0}

        chunk = publication / "semantic/chunks/fm000007_rxp000000_ryp000000.jsonl"
        original = chunk.read_bytes()
        chunk.write_bytes(original[:-2] + b"X\n")
        try:
            MOD.build(publication, base / "out-corrupt", expected_root, 4)
        except MOD.RuntimeIndexError:
            pass
        else:
            raise AssertionError("corrupt source chunk was accepted")
    print("runtime-index-self-test: PASS")


if __name__ == "__main__":
    main()
