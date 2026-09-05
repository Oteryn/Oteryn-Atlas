#!/usr/bin/env python3
"""Verify the pinned legacy Atlas selective-extraction provenance map."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / "docs" / "migration" / "legacy-atlas-extraction-provenance.json"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
SOURCE_REPOSITORY = "https://github.com/blakinio/Otheryn.git"
SOURCE_PREFIXES = ("tools/otbm_atlas/", "tools/otbm_atlas_facts/", ".github/workflows/otbm-atlas-")
MERGE_GROUP_GATE_PATH = ".github/workflows/merge-group-gate.yml"
MERGE_GROUP_GATE_BLOB = "2b3332c19fb7a75dafdf63e730927d736aa29fb7"
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


def verify_control_plane_pin(path: str, expected_blob: str) -> None:
    assert HEX40.fullmatch(expected_blob), f"invalid expected control-plane blob: {expected_blob}"
    actual = target_git_blob(path)
    assert actual == expected_blob, f"control-plane blob drift: {path}: {actual} != {expected_blob}"


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


def verify_source_coverage(rows: list[dict], source_root: Path, source_sha: str) -> int:
    raw = git(source_root, "ls-tree", "-r", "--name-only", source_sha)
    selected = sorted(path for path in raw.splitlines() if path.startswith(SOURCE_PREFIXES))
    mapped = sorted(row["source_path"] for row in rows)
    missing = sorted(set(selected) - set(mapped))
    extra = sorted(set(mapped) - set(selected))
    assert not missing and not extra, f"bounded source coverage mismatch: missing={missing}, extra={extra}"
    return len(selected)


def verify_terminal_lifecycle(data: dict) -> None:
    assert data["schema_version"] == 2
    source = data["source"]
    assert source["repository"] == "blakinio/Otheryn"
    assert HEX40.fullmatch(source["sha"]) and HEX40.fullmatch(source["tree_sha"])
    work = data["source_work"]
    assert work["pull_request"] == 447
    assert work["state"] == "CLOSED_UNMERGED" and work["merged"] is False
    assert work["disposition"] == "CLOSED_UNMERGED_HISTORICAL_PROVENANCE"
    assert work["authority"] == "NON_AUTHORITATIVE_READ_ONLY"
    assert work["retention"] == "RETAIN_HISTORICAL_SOURCE_BRANCH"
    target = data["target"]
    merge = target["immutable_extraction_closeout"]
    assert merge == {"pull_request": 4, "merge_sha": "750ecab7b600ea078a832f5f95059f08ce57a06a"}
    coverage = data["bounded_source_coverage"]
    assert coverage["source_commit_sha"] == source["sha"]
    assert coverage["source_tree_sha"] == source["tree_sha"]
    assert coverage["selected_blob_count"] == 144
    assert coverage["manifest_row_count"] == 144
    assert coverage["missing_manifest_paths"] == 0
    assert coverage["blob_identity_mismatches"] == 0
    assert coverage["extra_manifest_rows"] == 0


def verify(map_path: Path, source_root: Path | None = None) -> dict[str, int]:
    data = json.loads(map_path.read_text(encoding="utf-8"))
    verify_terminal_lifecycle(data)
    verify_control_plane_pin(MERGE_GROUP_GATE_PATH, MERGE_GROUP_GATE_BLOB)
    assert data["source"]["repository"] == "blakinio/Otheryn"
    assert data["target"]["repository"] == "Oteryn/Oteryn-Atlas"
    source_sha = data["source"]["sha"]
    if source_root is not None:
        verify_source_repository(source_root, source_sha)
        actual_tree = git(source_root, "rev-parse", f"{source_sha}^{{tree}}")
        assert actual_tree == data["source"]["tree_sha"], f"source tree mismatch: {actual_tree} != {data['source']['tree_sha']}"

    rows = data["rows"]
    assert len(rows) >= 100
    paths = [row["source_path"] for row in rows]
    assert paths == sorted(paths)
    assert len(paths) == len(set(paths))
    assert data["bounded_source_coverage"]["manifest_row_count"] == len(rows)
    if source_root is not None:
        selected_count = verify_source_coverage(rows, source_root, source_sha)
        assert data["bounded_source_coverage"]["selected_blob_count"] == selected_count
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


def fetch_pinned_source(source_sha: str, destination: Path) -> None:
    assert HEX40.fullmatch(source_sha), source_sha
    destination.mkdir(parents=True, exist_ok=False)
    subprocess.run(["git", "init", "--quiet", str(destination)], check=True)
    git(destination, "remote", "add", "origin", SOURCE_REPOSITORY)
    git(destination, "fetch", "--quiet", "--depth=1", "origin", source_sha)
    git(destination, "checkout", "--quiet", "--detach", source_sha)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        help="optional inert checkout containing the exact pinned blakinio/Otheryn source commit; when omitted, the verifier materializes that exact public source into a disposable temporary repository",
    )
    args = parser.parse_args()
    data = json.loads(MAP.read_text(encoding="utf-8"))
    source_sha = data["source"]["sha"]
    if args.source_root is not None:
        source_root = args.source_root.resolve()
        counts = verify(MAP, source_root)
    else:
        with tempfile.TemporaryDirectory(prefix="atlas-pinned-source-") as tmp:
            source_root = Path(tmp) / "source"
            fetch_pinned_source(source_sha, source_root)
            counts = verify(MAP, source_root)
    rows = len(data["rows"])
    print(f"legacy extraction provenance PASS: rows={rows} source=verified classes={counts}")


if __name__ == "__main__":
    main()
