#!/usr/bin/env python3
from __future__ import annotations
import copy
import importlib.util
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("farm_bundle_builder", ROOT / "tools" / "build-farm-bundle.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)

COMPATIBILITY = {
    "world_id": "oteryn-main",
    "world_profile_revision": "profile-v1",
    "content_revision": "content-v1",
    "ruleset_revision": "rules-v1",
    "modifier_context": "base",
    "creature_identity_scheme": "monster-entity-v1",
    "creature_identity_revision": "1",
    "coordinate_profile": "oteryn-native-floor-v1",
    "creature_publication_digest": "sha256:" + "2" * 64,
}


def farm():
    return {
        "schema_version": 1,
        "product": "atlas-farm-intelligence-v1",
        "product_root": "sha256:" + "3" * 64,
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "contract_id": "oteryn-game-atlas-farm-intelligence-v1",
            "game_revision": "a" * 40,
            "semantic_digest": "sha256:" + "1" * 64,
        },
        "compatibility": copy.deepcopy(COMPATIBILITY),
        "counts": {"items": 1, "creatures": 1, "loot_relations": 1, "tasks": 0},
    }


def spatial():
    return {
        "schema_version": 1,
        "product": "atlas-farm-spatial-v1",
        "product_root": "sha256:" + "4" * 64,
        "source_creatures": {
            "contract_id": "oteryn-game-atlas-export-v1",
            "capability": "static-creatures-v1",
            "semantic_digest": COMPATIBILITY["creature_publication_digest"],
            "coordinate_profile": COMPATIBILITY["coordinate_profile"],
        },
        "farm_intelligence_root": "sha256:" + "3" * 64,
        "compatibility": copy.deepcopy(COMPATIBILITY),
        "counts": {"entities": 1, "indexed_placements": 2, "unjoinable_placements": 0},
    }


def expect_error(farm_value, spatial_value, text: str):
    try:
        module.build_manifest(farm_value, spatial_value)
    except ValueError as error:
        assert text.lower() in str(error).lower(), str(error)
    else:
        raise AssertionError(f"expected failure containing {text!r}")


def main() -> int:
    first = module.build_manifest(farm(), spatial())
    second = module.build_manifest(farm(), spatial())
    assert first == second
    assert first["schema_version"] == 1
    assert first["product"] == "atlas-farm-bundle-v1"
    assert first["farm_intelligence_root"] == farm()["product_root"]
    assert first["farm_spatial_root"] == spatial()["product_root"]
    assert first["creature_publication_digest"] == COMPATIBILITY["creature_publication_digest"]
    assert first["bundle_root"].startswith("sha256:") and len(first["bundle_root"]) == 71
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "bundle.json"
        module.write_manifest(first, path)
        assert path.read_text(encoding="utf-8").endswith("\n")

    bad_spatial = spatial(); bad_spatial["farm_intelligence_root"] = "sha256:" + "9" * 64
    expect_error(farm(), bad_spatial, "farm intelligence root")
    bad_spatial = spatial(); bad_spatial["compatibility"]["ruleset_revision"] = "rules-v2"
    expect_error(farm(), bad_spatial, "compatibility")
    bad_spatial = spatial(); bad_spatial["source_creatures"]["semantic_digest"] = "sha256:" + "9" * 64
    expect_error(farm(), bad_spatial, "creature")
    bad_farm = farm(); bad_farm["product_root"] = "not-a-digest"
    expect_error(bad_farm, spatial(), "root")
    print("farm atomic bundle: PASS")
    return 0


if __name__ == "__main__": raise SystemExit(main())
