#!/usr/bin/env python3
"""Fetch the exact public Game-owned DYN-ATLAS-001 semantic artifact.

This is build/test tooling only. It never downloads OTBM or source sprite pixels.
The browser consumes only the derived Atlas projection generated from this
pinned semantic artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import urllib.request
import zipfile

ARTIFACT_ID = 9318268404
ARTIFACT_URL = f"https://api.github.com/repos/blakinio/Oteryn-v2/actions/artifacts/{ARTIFACT_ID}/zip"
EXPECTED_ZIP_SHA256 = "ec05e39be62d6826d27be19ff9c33c6cba7d1c835f79d02b8ad303b073c1ef40"
EXPECTED_SEMANTIC_DIGEST = "sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e"
EXPECTED_PRODUCER_SHA = "8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0"
EXPECTED_TILES_SHA256 = "ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984"
EXPECTED_DIAGNOSTICS_SHA256 = "60326e4e048106d4366a2fd8fe472ccfdf06667fcd0f234977febfeaa38f31b8"
MAX_DOWNLOAD_BYTES = 4 * 1024 * 1024
MAX_TILES_BYTES = 32 * 1024 * 1024

REQUIRED_MEMBERS = {
    "thais-a/manifest.json": "manifest.json",
    "thais-a/tiles.jsonl": "tiles.jsonl",
    "thais-a/diagnostics.json": "diagnostics.json",
    "thais-a/artifact.sha256": "artifact.sha256",
}


class FetchError(RuntimeError):
    pass


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _download() -> bytes:
    request = urllib.request.Request(
        ARTIFACT_URL,
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Oteryn-Atlas-DYN-ATLAS-001",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            declared = response.headers.get("Content-Length")
            if declared is not None and int(declared) > MAX_DOWNLOAD_BYTES:
                raise FetchError("artifact download exceeds proof cap")
            payload = response.read(MAX_DOWNLOAD_BYTES + 1)
    except (OSError, ValueError) as exc:
        raise FetchError(f"unable to download exact Game artifact: {exc}") from exc
    if len(payload) > MAX_DOWNLOAD_BYTES:
        raise FetchError("artifact download exceeds proof cap")
    return payload


def _read_local(path: Path) -> bytes:
    if not path.is_file():
        raise FetchError(f"local artifact does not exist: {path}")
    payload = path.read_bytes()
    if len(payload) > MAX_DOWNLOAD_BYTES:
        raise FetchError("local artifact exceeds proof cap")
    return payload


def extract(payload: bytes, output: Path) -> dict[str, object]:
    actual_zip_sha = _sha256(payload)
    if actual_zip_sha != EXPECTED_ZIP_SHA256:
        raise FetchError(f"workflow artifact ZIP digest mismatch: {actual_zip_sha}")

    try:
        archive = zipfile.ZipFile(io.BytesIO(payload))
    except zipfile.BadZipFile as exc:
        raise FetchError("workflow artifact is not a valid ZIP") from exc

    names = set(archive.namelist())
    missing = sorted(set(REQUIRED_MEMBERS) - names)
    if missing:
        raise FetchError(f"workflow artifact is missing required members: {missing}")

    output.mkdir(parents=True, exist_ok=True)
    for source_name, target_name in REQUIRED_MEMBERS.items():
        info = archive.getinfo(source_name)
        if info.is_dir():
            raise FetchError(f"required member is a directory: {source_name}")
        if info.file_size > MAX_TILES_BYTES:
            raise FetchError(f"required member exceeds proof cap: {source_name}")
        data = archive.read(source_name)
        (output / target_name).write_bytes(data)

    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("artifact_digest") != EXPECTED_SEMANTIC_DIGEST:
        raise FetchError("semantic artifact digest mismatch")
    if manifest.get("producer_repository_sha") != EXPECTED_PRODUCER_SHA:
        raise FetchError("producer SHA mismatch")
    if _sha256((output / "tiles.jsonl").read_bytes()) != EXPECTED_TILES_SHA256:
        raise FetchError("tiles.jsonl digest mismatch")
    if _sha256((output / "diagnostics.json").read_bytes()) != EXPECTED_DIAGNOSTICS_SHA256:
        raise FetchError("diagnostics.json digest mismatch")
    if json.loads((output / "diagnostics.json").read_text(encoding="utf-8")) != {"diagnostics": []}:
        raise FetchError("source diagnostics are not empty")
    if (output / "artifact.sha256").read_text(encoding="ascii").strip() != EXPECTED_SEMANTIC_DIGEST.removeprefix("sha256:"):
        raise FetchError("artifact.sha256 does not match semantic digest")

    return {
        "artifactId": ARTIFACT_ID,
        "semanticArtifactDigest": EXPECTED_SEMANTIC_DIGEST,
        "tilesBytes": (output / "tiles.jsonl").stat().st_size,
        "workflowArtifactZipSha256": actual_zip_sha,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--zip", dest="local_zip", type=Path)
    args = parser.parse_args()
    try:
        if args.output.exists():
            shutil.rmtree(args.output)
        payload = _read_local(args.local_zip) if args.local_zip else _download()
        result = extract(payload, args.output)
    except (FetchError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
