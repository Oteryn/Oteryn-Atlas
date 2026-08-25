#!/usr/bin/env python3
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("farm_spatial_builder", ROOT / "tools" / "build-farm-spatial-index.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)

CREATURE_DIGEST = "sha256:" + "2" * 64
ENTITY = "monster-entity:" + "b" * 32


def farm_index():
    return {
        "schema_version": 1,
        "product": "atlas-farm-intelligence-v1",
        "product_root": "sha256:" + "3" * 64,
        "compatibility": {
            "world_id": "oteryn-main",
            "world_profile_revision": "profile-v1",
            "content_revision": "content-v1",
            "ruleset_revision": "rules-v1",
            "modifier_context": "base",
            "creature_identity_scheme": "monster-entity-v1",
            "creature_identity_revision": "1",
            "coordinate_profile": "oteryn-native-floor-v1",
            "creature_publication_digest": CREATURE_DIGEST,
        },
    }


def source():
    base = {
        "contract_id": "oteryn-game-atlas-export-v1",
        "capability": "static-creatures-v1",
        "semantic_revision": 1,
        "semantic_digest": CREATURE_DIGEST,
        "npc_role_schema_version": 1,
        "coordinate_profile": "oteryn-native-floor-v1",
        "npcs": [],
        "monster_spawns": [
            {
                "kind": "monster", "name": "Alpha", "record_id": "monster:" + "1" * 32,
                "entity_id": ENTITY, "position": {"x": 100, "y": 200, "floor": -7},
                "spawn_area": {"center": {"x": 100, "y": 200, "floor": -7}, "radius": 3},
                "spawn_time_seconds": 60, "weight": None, "origin": "base-map", "resolution_state": "RESOLVED",
            },
            {
                "kind": "monster", "name": "Alpha", "record_id": "monster:" + "2" * 32,
                "entity_id": ENTITY, "position": {"x": 101, "y": 200, "floor": -7},
                "spawn_area": {"center": {"x": 100, "y": 200, "floor": -7}, "radius": 3},
                "spawn_time_seconds": 75, "weight": 50, "origin": "annual-event-map", "resolution_state": "RESOLVED",
            },
            {
                "kind": "monster", "name": "Unknown", "record_id": "monster:" + "4" * 32,
                "position": {"x": 102, "y": 200, "floor": -7}, "origin": "UNKNOWN", "resolution_state": "UNRESOLVED",
            },
        ],
    }
    return base


def expect_error(creatures, farm, text: str):
    try:
        module.validate_inputs(creatures, farm)
    except ValueError as error:
        assert text.lower() in str(error).lower(), str(error)
    else:
        raise AssertionError(f"expected failure containing {text!r}")


def main() -> int:
    with tempfile.TemporaryDirectory() as first_tmp, tempfile.TemporaryDirectory() as second_tmp:
        first = Path(first_tmp); second = Path(second_tmp)
        index_a = module.build(source(), farm_index(), first)
        index_b = module.build(source(), farm_index(), second)
        assert index_a["product"] == "atlas-farm-spatial-v1"
        assert index_a["product_root"] == index_b["product_root"]
        assert index_a["source_creatures"]["semantic_digest"] == CREATURE_DIGEST
        assert index_a["counts"]["indexed_placements"] == 2
        assert index_a["counts"]["unjoinable_placements"] == 1
        assert len(index_a["entities"]) == 1
        entity = json.loads((first / index_a["entities"][0]["path"]).read_text(encoding="utf-8"))
        assert len(entity["placements"]) == 2, "equal spawn_area geometry must not be deduplicated"
        base = next(record for record in entity["placements"] if record["origin"] == "base-map")
        event = next(record for record in entity["placements"] if record["origin"] == "annual-event-map")
        assert base["default_placement_eligible"] is True
        assert event["default_placement_eligible"] is False
        assert event["weight"] == 50
        assert base["spawn_time_seconds"] == 60
        assert entity["spawn_time_semantics"] == "published_static_field_only"
        assert entity["static_clear_yield_state"] == "UNAVAILABLE"

    bad = source(); bad["semantic_digest"] = "sha256:" + "9" * 64; expect_error(bad, farm_index(), "digest")
    bad = source(); bad["coordinate_profile"] = "other-profile"; expect_error(bad, farm_index(), "coordinate")
    bad = source(); bad["monster_spawns"][0]["origin"] = "invented"; expect_error(bad, farm_index(), "origin")
    bad_farm = copy.deepcopy(farm_index()); bad_farm["compatibility"]["creature_identity_scheme"] = "name-v1"; expect_error(source(), bad_farm, "identity")
    print("farm spatial index: PASS")
    return 0


if __name__ == "__main__": raise SystemExit(main())
