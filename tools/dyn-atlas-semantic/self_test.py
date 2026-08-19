#!/usr/bin/env python3
"""Focused tests for deterministic Atlas chunking and locality semantics."""

from __future__ import annotations

import argparse
import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

import compiler
import verify


class SyntheticTests(unittest.TestCase):
    def _tile(self, x: int, y: int, record_id: str) -> dict:
        presentation_id = f"presentation:{record_id}"
        return {
            "position": {"floor": -7, "x": x, "y": y},
            "presentation": [
                {
                    "appearance_source_id": 100,
                    "canonical_entity_id": None,
                    "entity_identity_state": "UNRESOLVED",
                    "export_record_id": presentation_id,
                    "presentation_order": {"order": 0, "plane": 0},
                    "resolved_primitives": [
                        {
                            "displacement": {"dx_units": 0, "dy_units": 0},
                            "frame_group_id": 0,
                            "frame_group_type": "OBJECT_INITIAL",
                            "height_units": 32,
                            "layer_index": 0,
                            "pattern": {"x": 0, "y": 0, "z": 0},
                            "phase": 0,
                            "source_profile_id": compiler.SOURCE_APPEARANCE_PROFILE,
                            "sprite_source_id": 200,
                            "visual_coverage_offsets": [{"dx_tiles": 0, "dy_tiles": 0}],
                            "width_units": 32,
                        }
                    ],
                    "source_role": "ground",
                }
            ],
            "record_type": "tile",
            "source_position": {"legacy_x": x, "legacy_y": y, "legacy_z": 7},
            "tile_record_id": f"tile:{record_id}",
        }

    def test_canonical_encoding(self) -> None:
        self.assertEqual(compiler.canonical_bytes({"z": 1, "a": 2}), b'{"a":2,"z":1}\n')

    def test_compact_tile_keeps_provenance_and_unresolved_identity(self) -> None:
        compact = compiler.compact_tile(self._tile(32280, 32155, "a"))
        self.assertEqual(compact[:6], [32280, 32155, -7, 32280, 32155, 7])
        self.assertEqual(compact[7][0][2], 0)
        self.assertEqual(compact[7][0][3:6], [0, 0, 0])

    def test_locality_on_bounded_synthetic_grid(self) -> None:
        original_expected = (compiler.EXPECTED_TILES, compiler.EXPECTED_PRESENTATIONS, compiler.EXPECTED_PRIMITIVES)
        try:
            compiler.EXPECTED_TILES = 2
            compiler.EXPECTED_PRESENTATIONS = 2
            compiler.EXPECTED_PRIMITIVES = 2
            tiles = [self._tile(32280, 32155, "a"), self._tile(32320, 32155, "b")]
            chunks_a, manifest_a = compiler.compile_tiles(tiles, 32)
            changed = deepcopy(tiles)
            changed[0]["presentation"][0]["export_record_id"] = "presentation:locality-probe"
            chunks_b, manifest_b = compiler.compile_tiles(changed, 32)
            changed_paths = [path for path in chunks_a if chunks_a[path] != chunks_b[path]]
            self.assertEqual(len(changed_paths), 1)
            self.assertNotEqual(manifest_a["rootContentId"], manifest_b["rootContentId"])
        finally:
            compiler.EXPECTED_TILES, compiler.EXPECTED_PRESENTATIONS, compiler.EXPECTED_PRIMITIVES = original_expected


class ExactSourceTests(unittest.TestCase):
    source: Path | None = None

    @classmethod
    def setUpClass(cls) -> None:
        if cls.source is None:
            raise unittest.SkipTest("exact Game artifact not supplied")
        _manifest, cls.tiles = compiler.load_source(cls.source)

    def test_exact_source_double_compile_is_identical(self) -> None:
        chunks_a, manifest_a = compiler.compile_tiles(self.tiles, 32)
        chunks_b, manifest_b = compiler.compile_tiles(self.tiles, 32)
        self.assertEqual(chunks_a, chunks_b)
        self.assertEqual(manifest_a, manifest_b)
        self.assertEqual(manifest_a["rootContentId"], "sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1")

    def test_exact_source_local_edit_invalidates_one_chunk_plus_root(self) -> None:
        chunks_a, manifest_a = compiler.compile_tiles(self.tiles, 32)
        changed = deepcopy(self.tiles)
        target = next(tile for tile in changed if tile["presentation"])
        target["presentation"][0]["export_record_id"] += "-locality-probe"
        chunks_b, manifest_b = compiler.compile_tiles(changed, 32)
        changed_paths = [path for path in chunks_a if chunks_a[path] != chunks_b[path]]
        self.assertEqual(len(changed_paths), 1)
        self.assertNotEqual(manifest_a["rootContentId"], manifest_b["rootContentId"])

    def test_exact_compiled_output_verifies_and_corruption_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            compiler.write_compiled(self.source, root, 32)  # type: ignore[arg-type]
            result = verify.verify(root)
            self.assertEqual(result["chunks"], 30)
            manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
            first_chunk = root / manifest["chunks"][0]["path"]
            first_chunk.write_bytes(first_chunk.read_bytes() + b" ")
            with self.assertRaises(verify.VerifyError):
                verify.verify(root)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    ExactSourceTests.source = args.source
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(SyntheticTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(ExactSourceTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
