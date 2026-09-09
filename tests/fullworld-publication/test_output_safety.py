#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PUB = load_module("f02_publication", ROOT / "tools/fullworld-publication/publication.py")
PIXEL = load_module("f02_pixel_buckets", ROOT / "tools/fullworld-runtime/build_pixel_buckets.py")
OVERVIEW = load_module("f02_overview", ROOT / "tools/fullworld-layers/build_overview.py")
FABRIC = load_module("f02_fabric", ROOT / "tools/fullworld-generation/fabric.py")


class OutputSafetyTests(unittest.TestCase):
    def test_resolved_disjointness_rejects_equal_ancestor_descendant_and_symlink_output(self) -> None:
        modules = (
            (PUB, PUB.PublicationError),
            (PIXEL, PIXEL.PixelBucketError),
            (OVERVIEW, OVERVIEW.OverviewError),
            (FABRIC, FABRIC.FabricError),
        )
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = root / "source"
            source.mkdir()
            safe_output = root / "output"
            for module, error in modules:
                self.assertEqual(
                    module._require_resolved_disjointness(safe_output, [("source", source)]),
                    safe_output.resolve(),
                )
                with self.assertRaises(error):
                    module._require_resolved_disjointness(source, [("source", source)])
                with self.assertRaises(error):
                    module._require_resolved_disjointness(source / "child", [("source", source)])
                with self.assertRaises(error):
                    module._require_resolved_disjointness(root, [("source", source)])

            symlink = root / "output-link"
            try:
                symlink.symlink_to(source, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("filesystem symlinks are unavailable")
            for module, error in modules:
                with self.assertRaises(error):
                    module._require_resolved_disjointness(symlink, [("other", root / "other")])

    def test_publication_success_replaces_last_good_only_after_complete_stage(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            repo, fabric, output = root / "repo", root / "fabric", root / "publication"
            handoff, asset = root / "handoff.json", root / "asset.zip"
            repo.mkdir(); fabric.mkdir(); output.mkdir()
            handoff.write_text("handoff")
            asset.write_bytes(b"asset")
            (output / "last-good.txt").write_text("old")
            expected = {"result": "new"}

            def fake_compile(_repo, _fabric, _handoff, _asset, staging, _sha, final_output):
                self.assertTrue(staging.name.startswith(".publication.staging-"))
                self.assertEqual(final_output, output)
                self.assertEqual((output / "last-good.txt").read_text(), "old")
                staging.mkdir()
                (staging / "new.txt").write_text("new")
                return expected

            with mock.patch.object(PUB, "_compile_into", side_effect=fake_compile):
                result = PUB.compile_all(repo, fabric, handoff, asset, output, "00" * 32)

            self.assertIs(result, expected)
            self.assertFalse((output / "last-good.txt").exists())
            self.assertEqual((output / "new.txt").read_text(), "new")

    def test_publication_failure_before_publish_preserves_last_good(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            repo, fabric, output = root / "repo", root / "fabric", root / "publication"
            handoff, asset = root / "handoff.json", root / "asset.zip"
            repo.mkdir(); fabric.mkdir(); output.mkdir()
            handoff.write_text("handoff")
            asset.write_bytes(b"asset")
            (output / "last-good.txt").write_text("old")

            def fail_compile(_repo, _fabric, _handoff, _asset, staging, _sha, _final_output):
                staging.mkdir()
                (staging / "partial.txt").write_text("partial")
                raise PUB.PublicationError("synthetic build failure")

            with mock.patch.object(PUB, "_compile_into", side_effect=fail_compile):
                with self.assertRaisesRegex(PUB.PublicationError, "synthetic build failure"):
                    PUB.compile_all(repo, fabric, handoff, asset, output, "00" * 32)

            self.assertEqual((output / "last-good.txt").read_text(), "old")
            self.assertFalse((output / "partial.txt").exists())
            self.assertFalse(any(path.name.startswith(".publication.staging-") for path in root.iterdir()))

    def test_pixel_and_overview_failures_preserve_last_good_products(self) -> None:
        cases = (
            (
                PIXEL,
                PIXEL.PixelBucketError,
                PIXEL.build,
                "_build_into",
                lambda root, output: ((root / "publication"), output, "sha256:" + "00" * 32, "sha256:" + "11" * 32),
            ),
            (
                OVERVIEW,
                OVERVIEW.OverviewError,
                OVERVIEW.build_overview,
                "_build_overview_into",
                lambda root, output: ((root / "publication"), output),
            ),
        )
        for module, error, wrapper, inner_name, args_factory in cases:
            with self.subTest(module=module.__name__), tempfile.TemporaryDirectory() as td:
                root = Path(td)
                publication = root / "publication"
                output = root / "output"
                publication.mkdir(); output.mkdir()
                (output / "last-good.txt").write_text("old")

                def fail_inner(*args, **kwargs):
                    if module is PIXEL:
                        staging = args[1]
                    else:
                        staging = args[1]
                    staging.mkdir(parents=True, exist_ok=True)
                    (staging / "partial.txt").write_text("partial")
                    raise error("synthetic build failure")

                call_args = args_factory(root, output)
                with mock.patch.object(module, inner_name, side_effect=fail_inner):
                    with self.assertRaisesRegex(error, "synthetic build failure"):
                        if module is PIXEL:
                            wrapper(*call_args)
                        else:
                            wrapper(*call_args, expected_publication_root="sha256:" + "00" * 32)

                self.assertEqual((output / "last-good.txt").read_text(), "old")
                self.assertFalse((output / "partial.txt").exists())

    def test_publish_swap_rolls_back_when_staging_promotion_fails(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            output = root / "publication"
            staging = root / ".publication.staging-test"
            output.mkdir(); staging.mkdir()
            (output / "last-good.txt").write_text("old")
            (staging / "new.txt").write_text("new")
            real_replace = os.replace
            call_count = 0

            def fail_second_replace(src, dst):
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    raise OSError("synthetic promotion failure")
                return real_replace(src, dst)

            with mock.patch.object(PUB.os, "replace", side_effect=fail_second_replace):
                with self.assertRaisesRegex(OSError, "synthetic promotion failure"):
                    PUB._publish_staged_directory(staging, output)

            self.assertEqual((output / "last-good.txt").read_text(), "old")
            self.assertFalse((output / "new.txt").exists())
            self.assertTrue(staging.exists())

    def test_fabric_preflight_rejects_source_overlap_before_any_write(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            game = root / "game"
            legacy = root / "legacy"
            assets = root / "assets"
            output = root / "output"
            game.mkdir(); legacy.mkdir(); assets.mkdir()
            map_path = root / "world.otbm"
            asset_zip = root / "assets.zip"
            map_path.write_bytes(b"map")
            asset_zip.write_bytes(b"zip")
            args = SimpleNamespace(
                game_root=game,
                legacy_root=legacy,
                map_path=map_path,
                asset_zip=asset_zip,
                assets_dir=assets,
                workdir=game,
                output=output,
            )
            with mock.patch.object(FABRIC, "git_head") as git_head:
                with self.assertRaisesRegex(FABRIC.FabricError, "writable-root overlap"):
                    FABRIC.run(args)
            git_head.assert_not_called()
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
