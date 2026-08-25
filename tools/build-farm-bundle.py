#!/usr/bin/env python3
"""Create one atomic content-addressed Farm Explorer bundle manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

PRODUCT = "atlas-farm-bundle-v1"
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def require_digest(value: object, label: str) -> str:
    require(isinstance(value, str) and DIGEST_RE.fullmatch(value), f"invalid {label}")
    return value


def build_manifest(farm: dict[str, object], spatial: dict[str, object]) -> dict[str, object]:
    require(isinstance(farm, dict), "farm intelligence product must be an object")
    require(farm.get("schema_version") == 1 and farm.get("product") == "atlas-farm-intelligence-v1", "unsupported farm intelligence product")
    farm_root = require_digest(farm.get("product_root"), "farm intelligence root")
    require(isinstance(spatial, dict), "farm spatial product must be an object")
    require(spatial.get("schema_version") == 1 and spatial.get("product") == "atlas-farm-spatial-v1", "unsupported farm spatial product")
    spatial_root = require_digest(spatial.get("product_root"), "farm spatial root")
    require(spatial.get("farm_intelligence_root") == farm_root, "farm intelligence root mismatch")

    farm_compat = farm.get("compatibility")
    spatial_compat = spatial.get("compatibility")
    require(isinstance(farm_compat, dict) and isinstance(spatial_compat, dict), "compatibility tuple missing")
    require(farm_compat == spatial_compat, "farm/spatial compatibility tuple mismatch")
    creature_digest = require_digest(farm_compat.get("creature_publication_digest"), "creature publication digest")
    source_creatures = spatial.get("source_creatures")
    require(isinstance(source_creatures, dict), "creature source metadata missing")
    require(source_creatures.get("semantic_digest") == creature_digest, "creature publication digest mismatch")
    require(source_creatures.get("coordinate_profile") == farm_compat.get("coordinate_profile"), "creature coordinate profile mismatch")

    source = farm.get("source")
    require(isinstance(source, dict) and source.get("authority") == "Oteryn/Oteryn-Game", "farm source authority invalid")
    game_revision = source.get("game_revision")
    require(isinstance(game_revision, str) and SHA_RE.fullmatch(game_revision), "farm Game revision invalid")
    farm_semantic_digest = require_digest(source.get("semantic_digest"), "farm source semantic digest")

    manifest = {
        "schema_version": 1,
        "product": PRODUCT,
        "source_game_revision": game_revision,
        "source_farm_semantic_digest": farm_semantic_digest,
        "farm_intelligence_root": farm_root,
        "farm_spatial_root": spatial_root,
        "creature_publication_digest": creature_digest,
        "compatibility": farm_compat,
        "counts": {
            "farm": farm.get("counts", {}),
            "spatial": spatial.get("counts", {}),
        },
    }
    manifest["bundle_root"] = sha256(canonical(manifest))
    return manifest


def write_manifest(manifest: dict[str, object], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(canonical(manifest) + b"\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("farm_index", type=Path)
    parser.add_argument("spatial_index", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    farm = json.loads(args.farm_index.read_text(encoding="utf-8"))
    spatial = json.loads(args.spatial_index.read_text(encoding="utf-8"))
    manifest = build_manifest(farm, spatial)
    write_manifest(manifest, args.output)
    print(json.dumps({"bundle_root": manifest["bundle_root"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
