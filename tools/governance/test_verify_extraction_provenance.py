#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("verify_extraction_provenance.py")
spec = importlib.util.spec_from_file_location("verify_extraction_provenance", SCRIPT)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()


class PinnedSourceVerificationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = Path(tempfile.mkdtemp(prefix="atlas-provenance-source-"))
        git(self.repo, "init")
        git(self.repo, "config", "user.email", "test@example.invalid")
        git(self.repo, "config", "user.name", "test")
        path = self.repo / "tools/otbm_atlas/example.py"
        path.parent.mkdir(parents=True)
        path.write_text("print('pinned')\n", encoding="utf-8")
        git(self.repo, "add", ".")
        git(self.repo, "commit", "-m", "pinned source")
        self.sha = git(self.repo, "rev-parse", "HEAD")
        self.blob = git(self.repo, "rev-parse", f"{self.sha}:tools/otbm_atlas/example.py")
        self.size = int(git(self.repo, "cat-file", "-s", self.blob))
        self.row = {
            "source_path": "tools/otbm_atlas/example.py",
            "source_blob": self.blob,
            "source_size": self.size,
        }

    def test_exact_pinned_source_row_passes(self) -> None:
        m.verify_source_repository(self.repo, self.sha)
        m.verify_source_row(self.row, self.repo, self.sha)

    def test_altered_source_blob_is_rejected(self) -> None:
        bad = dict(self.row)
        bad["source_blob"] = "0" * 40
        with self.assertRaises(AssertionError):
            m.verify_source_row(bad, self.repo, self.sha)

    def test_altered_source_path_is_rejected(self) -> None:
        bad = dict(self.row)
        bad["source_path"] = "tools/otbm_atlas/missing.py"
        with self.assertRaises(AssertionError):
            m.verify_source_row(bad, self.repo, self.sha)

    def test_source_path_traversal_is_rejected(self) -> None:
        bad = dict(self.row)
        bad["source_path"] = "tools/otbm_atlas/../example.py"
        with self.assertRaises(AssertionError):
            m.verify_source_row(bad, self.repo, self.sha)

    def test_wrong_source_commit_is_rejected(self) -> None:
        with self.assertRaises(AssertionError):
            m.verify_source_repository(self.repo, "0" * 40)


if __name__ == "__main__":
    unittest.main(verbosity=2)
