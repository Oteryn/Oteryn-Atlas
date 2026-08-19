#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools/fullworld-publication"
SPEC = importlib.util.spec_from_file_location("verify_publication", TOOL / "verify_publication.py")
VERIFY = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(VERIFY)
PUB = VERIFY.PUB


class PublicationContractTests(unittest.TestCase):
    def test_root_rejects_forgery(self) -> None:
        core = {"profile": "test", "value": 1}
        value = dict(core)
        value["rootContentId"] = PUB.rooted(PUB.PUBLICATION_DOMAIN, core)
        VERIFY.check_root(value, PUB.PUBLICATION_DOMAIN, "fixture")
        value["value"] = 2
        with self.assertRaises(VERIFY.VerifyError):
            VERIFY.check_root(value, PUB.PUBLICATION_DOMAIN, "fixture")

    def test_safe_join_rejects_path_escape(self) -> None:
        with self.assertRaises(VERIFY.VerifyError):
            VERIFY.safe_join(Path("/tmp/root"), "../escape")

    def test_checked_file_rejects_missing_and_corrupt(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "blob.bin"
            with self.assertRaises(VERIFY.VerifyError):
                VERIFY.checked_file(path, 3, hashlib.sha256(b"abc").hexdigest(), "fixture")
            path.write_bytes(b"xyz")
            with self.assertRaises(VERIFY.VerifyError):
                VERIFY.checked_file(path, 3, hashlib.sha256(b"abc").hexdigest(), "fixture")

    def test_pixel_identity_binds_dimensions_and_rgba(self) -> None:
        rgba = bytes([1, 2, 3, 4]) * (32 * 32)
        content_id = PUB.pixel_id(32, 32, rgba)
        self.assertTrue(content_id.startswith("sha256:"))
        self.assertNotEqual(content_id, PUB.pixel_id(32, 64, rgba + rgba))
        mutated = bytearray(rgba)
        mutated[0] ^= 0xFF
        self.assertNotEqual(content_id, PUB.pixel_id(32, 32, bytes(mutated)))

    def test_canonical_root_is_stable(self) -> None:
        left = {"b": 2, "a": 1}
        right = {"a": 1, "b": 2}
        self.assertEqual(
            PUB.rooted(PUB.SEMANTIC_DOMAIN, left),
            PUB.rooted(PUB.SEMANTIC_DOMAIN, right),
        )


if __name__ == "__main__":
    unittest.main()
