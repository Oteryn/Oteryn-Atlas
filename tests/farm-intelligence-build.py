#!/usr/bin/env python3
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("farm_intelligence_builder", ROOT / "tools" / "build-farm-intelligence.py")
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)

DIGEST = "sha256:" + "1" * 64
CREATURE_DIGEST = "sha256:" + "2" * 64
GAME_SHA = "a" * 40
ITEM_A = "item:alpha"
ITEM_B = "item:beta"
CREATURE_A = "monster-entity:" + "b" * 32


def rational(numerator: int, denominator: int = 1000):
    return {"numerator": numerator, "denominator": denominator}


def source():
    return {
        "contract_id": "oteryn-game-atlas-farm-intelligence-v1",
        "schema_version": 1,
        "game_revision": GAME_SHA,
        "semantic_digest": DIGEST,
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
        "capabilities": {
            "items": "SUPPORTED",
            "loot_relations": "SUPPORTED",
            "loot_probability": "SUPPORTED",
            "loot_quantity_model": "SUPPORTED",
            "item_delivery_tasks": "SUPPORTED",
            "kill_tasks": "SUPPORTED",
            "weekly_task_semantics": "UNSUPPORTED",
            "respawn_cadence": "UNSUPPORTED",
        },
        "items": [
            {"item_id": ITEM_B, "name": "Beta Item"},
            {"item_id": ITEM_A, "name": "Alpha Item"},
        ],
        "creatures": [{"creature_id": CREATURE_A, "name": "Alpha Monster"}],
        "loot_relations": [{
            "relation_id": "loot:alpha",
            "item_id": ITEM_A,
            "creature_id": CREATURE_A,
            "probability_scope": "published_base",
            "process": {
                "kind": "stationary_iid_per_qualifying_kill",
                "quantity_model": {
                    "kind": "bernoulli_fixed",
                    "success_probability": rational(125),
                    "success_quantity": 2,
                },
            },
        }],
        "tasks": [{
            "task_id": "task:multi",
            "name": "Multi requirement test",
            "kind": "item_delivery",
            "requirements": [
                {"kind": "item", "target_id": ITEM_A, "quantity": 10},
                {"kind": "item", "target_id": ITEM_B, "quantity": 5},
            ],
            "weekly": None,
        }],
    }


def expect_error(value, text: str):
    try:
        module.validate_source(value)
    except ValueError as error:
        assert text.lower() in str(error).lower(), str(error)
    else:
        raise AssertionError(f"expected failure containing {text!r}")


def main() -> int:
    with tempfile.TemporaryDirectory() as first_tmp, tempfile.TemporaryDirectory() as second_tmp:
        first = Path(first_tmp); second = Path(second_tmp)
        index_a = module.build(source(), first)
        index_b = module.build(source(), second)
        assert index_a["product"] == "atlas-farm-intelligence-v1"
        assert index_a["product_root"] == index_b["product_root"]
        assert index_a["source"]["semantic_digest"] == DIGEST
        assert index_a["compatibility"]["creature_publication_digest"] == CREATURE_DIGEST
        assert index_a["counts"] == {"items": 2, "creatures": 1, "loot_relations": 1, "tasks": 1}
        search = json.loads((first / index_a["item_search"]["path"]).read_text(encoding="utf-8"))
        assert [record["item_id"] for record in search["records"]] == [ITEM_A, ITEM_B]
        alpha_entry = next(entry for entry in index_a["item_shards"] if entry["item_id"] == ITEM_A)
        alpha = json.loads((first / alpha_entry["path"]).read_text(encoding="utf-8"))
        relation = alpha["loot_relations"][0]
        assert relation["process"]["quantity_model"]["success_probability"] == rational(125)
        assert relation["probability_scope"] == "published_base"
        tasks = json.loads((first / index_a["tasks"]["path"]).read_text(encoding="utf-8"))
        assert len(tasks["records"][0]["requirements"]) == 2
        serialized = json.dumps(index_a, sort_keys=True).lower()
        assert "average_drop" not in serialized and "average chance" not in serialized

    reordered = source()
    reordered["compatibility"] = dict(reversed(list(reordered["compatibility"].items())))
    reordered["capabilities"] = dict(reversed(list(reordered["capabilities"].items())))
    module.validate_source(reordered)

    bad = source(); bad["items"].append(copy.deepcopy(bad["items"][0])); expect_error(bad, "duplicate item")
    bad = source(); bad["loot_relations"][0]["item_id"] = "item:missing"; expect_error(bad, "unknown item")
    bad = source(); bad["loot_relations"][0]["process"]["quantity_model"]["success_probability"] = rational(1, 0); expect_error(bad, "denominator")
    bad = source(); bad["capabilities"]["loot_probability"] = "MAGIC"; expect_error(bad, "capability")
    bad = source(); bad["tasks"][0]["requirements"] = [bad["tasks"][0]["requirements"][0], bad["tasks"][0]["requirements"][0]]; expect_error(bad, "duplicate task requirement")
    print("farm intelligence builder: PASS")
    return 0


if __name__ == "__main__": raise SystemExit(main())
