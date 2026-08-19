#!/usr/bin/env python3
"""Verify the pinned legacy Atlas selective-extraction provenance map."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from collections import Counter
from pathlib import Path, PurePosixPath

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


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"git {' '.join(args)} failed in {repo}: {result.stderr.strip() or result.stdout.strip()}"
        )
    return result.stdout.strip()


def target_git_blob(path: str) -> str:
    candidate = ROOT / path
    if not candidate.is_file():
        raise AssertionError(f"mapped target path missing: {path}")
    return git(ROOT, "hash-object", path)


def verify_source_row(row: dict, source_root: Path, source_sha: str) -> None:
    path = row["source_path"]
    pure = PurePosixPath(path)
    assert ".." not in pure.parts, f"source path traversal is forbidden: {path}"
    assert path.startswith(SOURCE_PREFIXES), path
    assert HEX40.fullmatch(row["source_blob"]), path

    actual_type = git(source_root, "cat-file", "-t", f"{source_sha}:{path}")
    assert actual_type == "blob", f"source path is not a blob: {path}: {actual_type}"
    actual_blob = git(source_root, "rev-parse", f"{source_sha}:{path}")
    assert actual_blob == row["source_blob"], (
        f"source blob drift: {path}: {actual_blob} != {row['source_blob']}"
    )
    actual_size = int(git(source_root, "cat-file", "-s", actual_blob))
    assert actual_size == row["source_size"], (
        f"source size drift: {path}: {actual_size} != {row['source_size']}"
    )


def verify_source_repository(source_root: Path, source_sha: str) -> None:
    assert source_root.is_dir(), f"source checkout missing: {source_root}"
    assert HEX40.fullmatch(source_sha), source_sha
    resolved = git(source_root, "rev-parse", f"{source_sha}^{{commit}}")
    assert resolved == source_sha, f"source commit mismatch: {resolved} != {source_sha}"


def verify(map_path: Path, source_root: Path | None = None) -> dict[str, int]:
    data = json.loads(map_path.read_text(encoding="utf-8"))
    assert data["schema_version"] == 1
    assert data["source"]["repository"] == "blakinio/Otheryn"
    assert data["target"]["repository"] == "Oteryn/Oteryn-Atlas"
    source_sha = data["source"]["sha"]
    if source_root is not None:
        verify_source_repository(source_root, source_sha)

    rows = data["rows"]
    assert len(rows) >= 100
    paths = [row["source_path"] for row in rows]
    assert paths == sorted(paths)
    assert len(paths) == len(set(paths))
    counts = Counter()
    for row in rows:
        path = row["source_path"]
        if source_root is not None:
            verify_source_row(row, source_root, source_sha)
        cls = row["ownership_classification"]
        assert cls in ALLOWED, (path, cls)
        counts[cls] += 1
        targets = row["target_paths"]
        if cls in {"GAME_OWNED_LEGACY_REFERENCE", "LEGACY_REFERENCE_REVIEWED"}:
            assert not targets, path
        for target in targets:
            target_path = target["path"]
            assert ".." not in PurePosixPath(target_path).parts
            assert not target_path.startswith("vendor/")
            assert not target_path.lower().endswith((".otbm", ".otb", ".spr", ".dat"))
            actual = target_git_blob(target_path)
            assert actual == target["blob"], (
                f"target blob drift: {target_path}: {actual} != {target['blob']}"
            )
    return dict(sorted(counts.items()))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        help="local inert checkout containing the exact pinned blakinio/Otheryn source commit; when supplied, every source row is cryptographically verified",
    )
    args = parser.parse_args()
    source_root = args.source_root.resolve() if args.source_root is not None else None
    counts = verify(MAP, source_root)
    rows = len(json.loads(MAP.read_text(encoding="utf-8"))["rows"])
    source_status = "verified" if source_root is not None else "not-requested"
    print(
        f"legacy extraction provenance PASS: rows={rows} source={source_status} classes={counts}"
    )


if __name__ == "__main__":
    main()
