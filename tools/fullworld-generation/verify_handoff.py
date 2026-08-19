#!/usr/bin/env python3
"""Independently verify a local full-world generation handoff and every shard."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

HANDOFF_FORMAT = "oteryn-atlas-fullworld-generation-handoff-v0"
SHARD_FORMAT = "oteryn-atlas-fullworld-generation-shard-v0"


class VerifyError(RuntimeError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def hash_and_lines(path: Path) -> tuple[str, int, int]:
    digest = hashlib.sha256()
    lines = 0
    size = 0
    with path.open("rb") as handle:
        while block := handle.read(8 * 1024 * 1024):
            digest.update(block)
            lines += block.count(b"\n")
            size += len(block)
    return digest.hexdigest(), lines, size


def verify(handoff_path: Path) -> dict[str, Any]:
    root = handoff_path.parent.resolve()
    handoff = json.loads(handoff_path.read_text(encoding="utf-8"))
    if handoff.get("format") != HANDOFF_FORMAT:
        raise VerifyError("handoff format mismatch")
    shards = handoff.get("shards")
    if not isinstance(shards, list) or not shards:
        raise VerifyError("handoff contains no shards")
    if shards != sorted(shards, key=lambda item: item["shard_id"]):
        raise VerifyError("shard descriptors are not canonical shard-id order")

    total_tiles = 0
    total_bytes = 0
    verified: list[dict[str, Any]] = []
    for descriptor in shards:
        rel = descriptor.get("relative_path")
        if not isinstance(rel, str) or Path(rel).is_absolute() or ".." in Path(rel).parts:
            raise VerifyError(f"unsafe shard path {rel!r}")
        shard_root = root / rel
        manifest_path = shard_root / "manifest.json"
        tiles_path = shard_root / "tiles.jsonl"
        if not manifest_path.is_file() or not tiles_path.is_file():
            raise VerifyError(f"missing shard files for {descriptor.get('shard_id')}")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("format") != SHARD_FORMAT:
            raise VerifyError(f"shard format mismatch: {descriptor['shard_id']}")
        if manifest.get("source_fingerprint") != handoff.get("source_fingerprint"):
            raise VerifyError(f"source fingerprint mismatch: {descriptor['shard_id']}")
        for key in ("logical_address", "shard_root", "tile_count", "tiles_jsonl_bytes", "tiles_jsonl_sha256"):
            if manifest.get(key) != descriptor.get(key):
                raise VerifyError(f"descriptor/manifest {key} mismatch: {descriptor['shard_id']}")
        digest, lines, size = hash_and_lines(tiles_path)
        if digest != descriptor["tiles_jsonl_sha256"]:
            raise VerifyError(f"tiles digest mismatch: {descriptor['shard_id']}")
        if size != int(descriptor["tiles_jsonl_bytes"]):
            raise VerifyError(f"tiles size mismatch: {descriptor['shard_id']}")
        if lines != int(descriptor["tile_count"]):
            raise VerifyError(f"tile line count mismatch: {descriptor['shard_id']}")
        total_tiles += lines
        total_bytes += size
        verified.append(descriptor)

    expected_tiles = int(handoff["census"]["global"]["tiles"])
    if total_tiles != expected_tiles:
        raise VerifyError(f"global tile total mismatch: {total_tiles} != {expected_tiles}")
    if total_bytes != int(handoff["generation"]["final_jsonl_bytes"]):
        raise VerifyError("global final byte total mismatch")

    root_hash = hashlib.sha256()
    root_hash.update(b"OTERYN-ATLAS-FULLWORLD-GENERATION-HANDOFF-V0\0")
    root_hash.update(canonical_json_bytes(verified))
    computed_root = f"sha256:{root_hash.hexdigest()}"
    if computed_root != handoff.get("fabric_root"):
        raise VerifyError(f"fabric root mismatch: {computed_root}")
    return {
        "result": "PASS",
        "fabric_root": computed_root,
        "shards": len(shards),
        "tiles": total_tiles,
        "final_jsonl_bytes": total_bytes,
        "unresolved_presentations": handoff["census"]["global"].get("unresolved_presentations", 0),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("handoff", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        result = verify(args.handoff.resolve())
    except (OSError, ValueError, KeyError, json.JSONDecodeError, VerifyError) as exc:
        print(f"ERROR: {exc}")
        return 1
    payload = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
