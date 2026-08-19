#!/usr/bin/env python3
"""Verify the pinned legacy Atlas selective-extraction provenance map."""
from __future__ import annotations

import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / "docs" / "migration" / "legacy-atlas-extraction-provenance.json"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
SOURCE_PREFIXES = ("tools/otbm_atlas/", "tools/otbm_atlas_facts/", ".github/workflows/otbm-atlas-")
ALLOWED = {
    "GAME_OWNED_LEGACY_REFERENCE",
    "SPLIT_REWRITE_WORKFLOW",
    "SPLIT_REWRITE_TEST_EVIDENCE",
    "ATLAS_REIMPLEMENTED",
    "SPLIT_REIMPLEMENTED",
    "LEGACY_REFERENCE_REVIEWED",
}


def git_blob(path: str) -> str:
    candidate = ROOT / path
    if not candidate.is_file():
        raise SystemExit(f"mapped target path missing: {path}")
    return subprocess.run(
        ["git", "hash-object", path],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def main() -> None:
    data = json.loads(MAP.read_text(encoding="utf-8"))
    assert data["schema_version"] == 1
    assert data["source"]["repository"] == "blakinio/Otheryn"
    assert data["target"]["repository"] == "Oteryn/Oteryn-Atlas"
    assert HEX40.fullmatch(data["source"]["sha"])
    rows = data["rows"]
    assert len(rows) >= 100
    paths = [row["source_path"] for row in rows]
    assert paths == sorted(paths)
    assert len(paths) == len(set(paths))
    counts = Counter()
    for row in rows:
        path = row["source_path"]
        assert path.startswith(SOURCE_PREFIXES), path
        assert HEX40.fullmatch(row["source_blob"]), path
        cls = row["ownership_classification"]
        assert cls in ALLOWED, (path, cls)
        counts[cls] += 1
        targets = row["target_paths"]
        if cls in {"GAME_OWNED_LEGACY_REFERENCE", "LEGACY_REFERENCE_REVIEWED"}:
            assert not targets, path
        for target in targets:
            target_path = target["path"]
            assert ".." not in Path(target_path).parts
            assert not target_path.startswith("vendor/")
            assert not target_path.lower().endswith((".otbm", ".otb", ".spr", ".dat"))
            actual = git_blob(target_path)
            assert actual == target["blob"], f"target blob drift: {target_path}: {actual} != {target['blob']}"
    print(f"legacy extraction provenance PASS: rows={len(rows)} classes={dict(sorted(counts.items()))}")


if __name__ == "__main__":
    main()