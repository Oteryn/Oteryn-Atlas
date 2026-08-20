from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build = load_module("build_overview", ROOT / "tools/fullworld-layers/build_overview.py")
verify = load_module("verify_overview", ROOT / "tools/fullworld-layers/verify_overview.py")


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def rooted(domain: bytes, value: dict) -> str:
    core = dict(value)
    core.pop("rootContentId", None)
    return "sha256:" + hashlib.sha256(domain + canonical(core)).hexdigest()


def tile_line(floor: int, x: int, y: int, primitive_ids: list[int]) -> bytes:
    primitives = [
        {
            "displacement": {"dx_units": 0, "dy_units": 0},
            "frame_group_id": 1,
            "frame_group_type": 1,
            "height_units": 32,
            "layer_index": 0,
            "pattern": {"x": 0, "y": 0, "z": 0},
            "phase": 0,
            "source_profile_id": "fixture",
            "sprite_source_id": sprite,
            "visual_coverage_offsets": [{"dx_tiles": 0, "dy_tiles": 0}],
            "width_units": 32,
        }
        for sprite in primitive_ids
    ]
    record = {
        "position": {"floor": floor, "x": x, "y": y},
        "presentation": [
            {
                "appearance_source_id": 1,
                "canonical_entity_id": None,
                "entity_identity_state": "UNRESOLVED",
                "export_record_id": f"p:{floor}:{x}:{y}",
                "presentation_order": {"order": 0, "plane": 0},
                "resolved_primitives": primitives,
                "source_role": "ground",
            }
        ],
        "record_type": "tile",
        "source_position": {"legacy_x": x, "legacy_y": y, "legacy_z": -floor},
        "tile_record_id": f"t:{floor}:{x}:{y}",
    }
    return canonical(record)


def make_source(root: Path) -> None:
    semantic_root = root / "semantic"
    (semantic_root / "chunks").mkdir(parents=True)
    (semantic_root / "floors").mkdir(parents=True)
    source_fingerprint = "sha256:" + "11" * 32
    floor_specs = {
        -7: [
            (0, 0, [(1, 1, [10]), (2, 2, [11, 12]), (17, 1, [])]),
            (1, 0, [(257, 4, [13])]),
        ],
        -6: [
            (0, 0, [(3, 5, [20]), (3, 6, [21])]),
        ],
    }
    world_floor_entries = []
    world_counts = {"bytes": 0, "floors": 0, "resolvedPrimitives": 0, "shards": 0, "tiles": 0, "uniqueSpriteRefs": 7}
    for floor, chunks in floor_specs.items():
        floor_entries = []
        floor_counts = {"bytes": 0, "resolvedPrimitives": 0, "tiles": 0}
        xs, ys = [], []
        for rx, ry, rows in chunks:
            raw = b"".join(tile_line(floor, x, y, sprites) for x, y, sprites in rows)
            name = f"f{floor}_rx{rx}_ry{ry}.jsonl"
            path = semantic_root / "chunks" / name
            path.write_bytes(raw)
            primitive_count = sum(len(sprites) for _, _, sprites in rows)
            entry = {
                "bytes": len(raw),
                "contentId": "sha256:" + hashlib.sha256(raw).hexdigest(),
                "logicalAddress": {"floor": floor, "region_x": rx, "region_y": ry},
                "path": f"chunks/{name}",
                "resolvedPrimitives": primitive_count,
                "tiles": len(rows),
            }
            floor_entries.append(entry)
            floor_counts["bytes"] += len(raw)
            floor_counts["resolvedPrimitives"] += primitive_count
            floor_counts["tiles"] += len(rows)
            xs.extend(x for x, _, _ in rows)
            ys.extend(y for _, y, _ in rows)
        floor_manifest = {
            "bounds": {"x_max_exclusive": max(xs) + 1, "x_min": min(xs), "y_max_exclusive": max(ys) + 1, "y_min": min(ys)},
            "chunks": floor_entries,
            "counts": floor_counts,
            "floor": floor,
            "sourceFingerprint": source_fingerprint,
        }
        floor_manifest["rootContentId"] = rooted(build.SEMANTIC_FLOOR_DOMAIN, floor_manifest)
        floor_rel = f"floors/f{floor}.json"
        (semantic_root / floor_rel).write_bytes(canonical(floor_manifest))
        world_floor_entries.append({"counts": floor_counts, "floor": floor, "path": floor_rel, "rootContentId": floor_manifest["rootContentId"]})
        world_counts["bytes"] += floor_counts["bytes"]
        world_counts["floors"] += 1
        world_counts["resolvedPrimitives"] += floor_counts["resolvedPrimitives"]
        world_counts["shards"] += len(floor_entries)
        world_counts["tiles"] += floor_counts["tiles"]

    semantic = {
        "counts": world_counts,
        "fabricRoot": "sha256:" + "22" * 32,
        "floors": world_floor_entries,
        "profile": build.SEMANTIC_PROFILE,
        "sourceFingerprint": source_fingerprint,
    }
    semantic["rootContentId"] = rooted(build.SEMANTIC_DOMAIN, semantic)
    (semantic_root / "world.json").write_bytes(canonical(semantic))

    publication = {
        "pixels": {"path": "pixels/manifest.json", "rootContentId": "sha256:" + "33" * 32},
        "profile": build.PUBLICATION_PROFILE,
        "semantic": {"path": "semantic/world.json", "rootContentId": semantic["rootContentId"]},
        "serializerStatus": "PROVISIONAL_NOT_FROZEN",
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "canonicalWorldId": None,
            "canonicalWorldIdState": "UNKNOWN",
            "fabricRoot": "sha256:" + "22" * 32,
            "gameSha": "a" * 40,
            "handoffSha256": "44" * 32,
            "sourceFingerprint": source_fingerprint,
        },
    }
    publication["rootContentId"] = rooted(build.PUBLICATION_DOMAIN, publication)
    (root / "publication.json").write_bytes(canonical(publication))


def source_publication_root(root: Path) -> str:
    return json.loads((root / "publication.json").read_text())["rootContentId"]


class OverviewLayerTests(unittest.TestCase):
    def test_round_trip_reconciles_source_without_semantic_overclaim(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            world = build.build_overview(source, output, expected_publication_root=source_publication_root(source), cell_size=16, workers=1)
            checked = verify.verify_overview(output, source, source_publication_root(source))
            self.assertEqual(checked["rootContentId"], world["rootContentId"])
            self.assertEqual(checked["counts"], {"cells": 4, "chunks": 3, "floors": 2, "resolvedPrimitives": 6, "tiles": 6})
            self.assertEqual(checked["semantics"]["walkability"], "NOT_CLAIMED")
            self.assertEqual(checked["semantics"]["terrainClassification"], "NOT_CLAIMED")
            self.assertEqual(checked["semantics"]["collision"], "NOT_CLAIMED")

    def test_trusted_previous_overview_reuses_unchanged_chunks_without_rescan(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, first_output, second_output = tmp / "source", tmp / "overview-a", tmp / "overview-b"
            source.mkdir()
            make_source(source)
            first = build.build_overview(source, first_output, expected_publication_root=source_publication_root(source), cell_size=16, workers=1)
            second = build.build_overview(
                source, second_output, expected_publication_root=source_publication_root(source), cell_size=16, workers=1,
                previous_output=first_output, expected_previous_root=first["rootContentId"],
            )
            self.assertEqual(second["rootContentId"], first["rootContentId"])
            self.assertEqual(second["_buildEvidence"], {"reusedChunks": 3, "scannedChunks": 0, "trustedPreviousRootUsed": True})
            checked = verify.verify_overview(second_output, source, source_publication_root(source))
            self.assertEqual(checked["rootContentId"], first["rootContentId"])

    def test_previous_overview_reuse_requires_exact_trusted_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, first_output, second_output = tmp / "source", tmp / "overview-a", tmp / "overview-b"
            source.mkdir()
            make_source(source)
            build.build_overview(source, first_output, expected_publication_root=source_publication_root(source))
            with self.assertRaisesRegex(build.OverviewError, "trusted root"):
                build.build_overview(source, second_output, expected_publication_root=source_publication_root(source), previous_output=first_output, expected_previous_root="sha256:" + "00" * 32)

    def test_corrupt_source_chunk_is_rejected_during_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            chunk = next((source / "semantic/chunks").glob("*.jsonl"))
            chunk.write_bytes(chunk.read_bytes() + b"x")
            with self.assertRaisesRegex(build.OverviewError, "byte mismatch|digest mismatch|position prefix|unterminated semantic record"):
                build.build_overview(source, output, expected_publication_root=source_publication_root(source))

    def test_corrupt_overview_chunk_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            build.build_overview(source, output, expected_publication_root=source_publication_root(source))
            chunk = next((output / "chunks").glob("*.json"))
            chunk.write_bytes(chunk.read_bytes() + b" ")
            with self.assertRaisesRegex(verify.VerifyError, "byte mismatch|content identity mismatch"):
                verify.verify_overview(output, source, source_publication_root(source))

    def test_wrong_expected_source_publication_root_is_rejected_during_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            with self.assertRaisesRegex(build.OverviewError, "expected authoritative root"):
                build.build_overview(source, output, expected_publication_root="sha256:" + "00" * 32)

    def test_wrong_expected_source_publication_root_is_rejected_by_verifier(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            build.build_overview(source, output, expected_publication_root=source_publication_root(source))
            with self.assertRaisesRegex(verify.VerifyError, "expected authoritative root"):
                verify.verify_overview(output, source, "sha256:" + "00" * 32)

    def test_duplicate_source_logical_address_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / "source", tmp / "overview"
            source.mkdir()
            make_source(source)
            floor_path = source / "semantic/floors/f-7.json"
            floor = json.loads(floor_path.read_text())
            floor["chunks"][1]["logicalAddress"] = copy.deepcopy(floor["chunks"][0]["logicalAddress"])
            floor["rootContentId"] = rooted(build.SEMANTIC_FLOOR_DOMAIN, floor)
            floor_path.write_bytes(canonical(floor))
            semantic_path = source / "semantic/world.json"
            semantic = json.loads(semantic_path.read_text())
            for entry in semantic["floors"]:
                if entry["floor"] == -7:
                    entry["rootContentId"] = floor["rootContentId"]
            semantic["rootContentId"] = rooted(build.SEMANTIC_DOMAIN, semantic)
            semantic_path.write_bytes(canonical(semantic))
            publication_path = source / "publication.json"
            publication = json.loads(publication_path.read_text())
            publication["semantic"]["rootContentId"] = semantic["rootContentId"]
            publication["rootContentId"] = rooted(build.PUBLICATION_DOMAIN, publication)
            publication_path.write_bytes(canonical(publication))
            with self.assertRaisesRegex(build.OverviewError, "duplicate semantic logical address"):
                build.build_overview(source, output, expected_publication_root=source_publication_root(source))


if __name__ == "__main__":
    unittest.main()
