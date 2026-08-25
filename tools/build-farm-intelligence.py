#!/usr/bin/env python3
"""Compile a bounded Atlas farm-intelligence product from an accepted Game publication."""
from __future__ import annotations

import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import re

EXPECTED_CONTRACT = "oteryn-game-atlas-farm-intelligence-v1"
PRODUCT = "atlas-farm-intelligence-v1"
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
DIGEST_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
IDENTITY_RE = re.compile(r"^[^\\/\x00-\x1f\x7f]{1,256}$")
CAPABILITY_STATES = {"SUPPORTED", "PARTIAL", "UNSUPPORTED"}
CAPABILITY_KEYS = (
    "items", "loot_relations", "loot_probability", "loot_quantity_model",
    "item_delivery_tasks", "kill_tasks", "weekly_task_semantics", "respawn_cadence",
)
COMPATIBILITY_KEYS = (
    "world_id", "world_profile_revision", "content_revision", "ruleset_revision",
    "modifier_context", "creature_identity_scheme", "creature_identity_revision",
    "coordinate_profile", "creature_publication_digest",
)
MAX_ITEMS = 100_000
MAX_CREATURES = 100_000
MAX_RELATIONS = 1_000_000
MAX_TASKS = 100_000
MAX_REQUIREMENTS = 64


def canonical(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def require_identity(value: object, label: str) -> str:
    require(isinstance(value, str) and bool(IDENTITY_RE.fullmatch(value)), f"invalid {label}")
    return value


def require_text(value: object, label: str, limit: int = 512) -> str:
    require(isinstance(value, str) and 0 < len(value) <= limit and not re.search(r"[\x00-\x1f\x7f]", value), f"invalid {label}")
    return value


def validate_rational(value: object, label: str) -> Fraction:
    require(isinstance(value, dict) and set(value) == {"numerator", "denominator"}, f"invalid {label}")
    numerator, denominator = value["numerator"], value["denominator"]
    require(isinstance(numerator, int) and isinstance(denominator, int), f"invalid {label} rational")
    require(denominator > 0, f"{label} denominator must be positive")
    require(0 <= numerator <= denominator, f"{label} must be between zero and one")
    return Fraction(numerator, denominator)


def validate_quantity_model(model: object) -> None:
    require(isinstance(model, dict) and isinstance(model.get("kind"), str), "invalid loot quantity model")
    kind = model["kind"]
    if kind == "bernoulli_fixed":
        require(set(model) == {"kind", "success_probability", "success_quantity"}, "invalid bernoulli_fixed quantity model")
        validate_rational(model["success_probability"], "success probability")
        require(isinstance(model["success_quantity"], int) and model["success_quantity"] > 0, "success quantity must be positive")
        return
    if kind == "exact_quantity_pmf":
        require(set(model) == {"kind", "outcomes"}, "invalid exact quantity PMF")
        outcomes = model["outcomes"]
        require(isinstance(outcomes, list) and 0 < len(outcomes) <= 4096, "invalid exact quantity PMF outcomes")
        seen: set[int] = set(); total = Fraction(0, 1)
        for outcome in outcomes:
            require(isinstance(outcome, dict) and set(outcome) == {"quantity", "probability"}, "invalid PMF outcome")
            quantity = outcome["quantity"]
            require(isinstance(quantity, int) and quantity >= 0 and quantity not in seen, "invalid or duplicate PMF quantity")
            seen.add(quantity); total += validate_rational(outcome["probability"], "PMF probability")
        require(total == 1, "exact quantity PMF probabilities must sum to one")
        return
    if kind == "bounded_unknown":
        require(set(model) == {"kind", "min_quantity", "max_quantity"}, "invalid bounded quantity model")
        minimum, maximum = model["min_quantity"], model["max_quantity"]
        require(isinstance(minimum, int) and isinstance(maximum, int) and 0 <= minimum <= maximum, "invalid bounded quantity limits")
        return
    if kind == "unsupported":
        require(set(model) == {"kind"}, "invalid unsupported quantity model")
        return
    raise ValueError("unsupported loot quantity model kind")


def validate_process(process: object) -> None:
    require(isinstance(process, dict) and set(process) == {"kind", "quantity_model"}, "invalid loot process")
    require(process["kind"] in {"stationary_iid_per_qualifying_kill", "exact_non_iid", "unsupported"}, "unsupported loot process kind")
    validate_quantity_model(process["quantity_model"])
    if process["kind"] != "stationary_iid_per_qualifying_kill":
        require(process["quantity_model"]["kind"] in {"bounded_unknown", "unsupported"}, "non-IID process must not claim IID target math")


def validate_source(source: dict[str, object]) -> dict[str, object]:
    require(isinstance(source, dict), "farm source must be an object")
    required = {"contract_id", "schema_version", "game_revision", "semantic_digest", "compatibility", "capabilities", "items", "creatures", "loot_relations", "tasks"}
    require(set(source) == required, "farm source fields do not match schema v1")
    require(source["contract_id"] == EXPECTED_CONTRACT and source["schema_version"] == 1, "unsupported farm Game contract")
    require(isinstance(source["game_revision"], str) and SHA_RE.fullmatch(source["game_revision"]), "invalid Game revision")
    require(isinstance(source["semantic_digest"], str) and DIGEST_RE.fullmatch(source["semantic_digest"]), "invalid farm semantic digest")

    compatibility = source["compatibility"]
    require(isinstance(compatibility, dict) and set(compatibility) == set(COMPATIBILITY_KEYS), "invalid farm compatibility tuple")
    for key in COMPATIBILITY_KEYS[:-1]:
        require_text(compatibility[key], f"compatibility {key}", 256)
    require(compatibility["creature_identity_scheme"] == "monster-entity-v1", "unsupported creature identity scheme")
    require(compatibility["coordinate_profile"] == "oteryn-native-floor-v1", "unsupported coordinate profile")
    require(isinstance(compatibility["creature_publication_digest"], str) and DIGEST_RE.fullmatch(compatibility["creature_publication_digest"]), "invalid creature publication digest")

    capabilities = source["capabilities"]
    require(isinstance(capabilities, dict) and set(capabilities) == set(CAPABILITY_KEYS), "invalid farm capability set")
    require(all(value in CAPABILITY_STATES for value in capabilities.values()), "invalid farm capability state")

    items = source["items"]; creatures = source["creatures"]
    relations = source["loot_relations"]; tasks = source["tasks"]
    require(isinstance(items, list) and len(items) <= MAX_ITEMS, "invalid item catalogue")
    require(isinstance(creatures, list) and len(creatures) <= MAX_CREATURES, "invalid creature catalogue")
    require(isinstance(relations, list) and len(relations) <= MAX_RELATIONS, "invalid loot relation catalogue")
    require(isinstance(tasks, list) and len(tasks) <= MAX_TASKS, "invalid task catalogue")
    if capabilities["items"] == "UNSUPPORTED": require(not items, "unsupported item capability must be empty")
    if capabilities["loot_relations"] == "UNSUPPORTED": require(not relations, "unsupported loot relation capability must be empty")

    item_ids: set[str] = set()
    for item in items:
        require(isinstance(item, dict) and set(item) == {"item_id", "name"}, "invalid item record")
        item_id = require_identity(item["item_id"], "item id")
        require(item_id not in item_ids, "duplicate item id")
        item_ids.add(item_id)
        require_text(item["name"], "item name", 256)

    creature_ids: set[str] = set()
    for creature in creatures:
        require(isinstance(creature, dict) and set(creature) == {"creature_id", "name"}, "invalid creature record")
        creature_id = require_identity(creature["creature_id"], "creature id")
        require(creature_id.startswith("monster-entity:"), "creature id does not match identity scheme")
        require(creature_id not in creature_ids, "duplicate creature id")
        creature_ids.add(creature_id)
        require_text(creature["name"], "creature name", 256)

    relation_ids: set[str] = set()
    for relation in relations:
        expected = {"relation_id", "item_id", "creature_id", "probability_scope", "process"}
        require(isinstance(relation, dict) and set(relation) == expected, "invalid loot relation")
        relation_id = require_identity(relation["relation_id"], "loot relation id")
        require(relation_id not in relation_ids, "duplicate loot relation id")
        relation_ids.add(relation_id)
        require(relation["item_id"] in item_ids, "loot relation references unknown item")
        require(relation["creature_id"] in creature_ids, "loot relation references unknown creature")
        require(relation["probability_scope"] in {"published_base", "published_context"}, "invalid probability scope")
        validate_process(relation["process"])

    task_ids: set[str] = set()
    for task in tasks:
        expected = {"task_id", "name", "kind", "requirements", "weekly"}
        require(isinstance(task, dict) and set(task) == expected, "invalid task record")
        task_id = require_identity(task["task_id"], "task id")
        require(task_id not in task_ids, "duplicate task id")
        task_ids.add(task_id)
        require_text(task["name"], "task name", 256)
        require(task["kind"] in {"item_delivery", "kill"}, "unsupported task kind")
        require(task["weekly"] is None or isinstance(task["weekly"], bool), "invalid weekly task state")
        if task["weekly"] is True:
            require(capabilities["weekly_task_semantics"] == "SUPPORTED", "weekly task requires supported weekly semantics")
        requirements = task["requirements"]
        require(isinstance(requirements, list) and 0 < len(requirements) <= MAX_REQUIREMENTS, "invalid task requirements")
        seen_requirements: set[tuple[str, str]] = set()
        for requirement in requirements:
            expected_requirement = {"kind", "target_id", "quantity"}
            require(isinstance(requirement, dict) and set(requirement) == expected_requirement, "invalid task requirement")
            kind = requirement["kind"]
            target = requirement["target_id"]
            require(kind in {"item", "creature"}, "unsupported task requirement kind")
            require((kind, target) not in seen_requirements, "duplicate task requirement")
            seen_requirements.add((kind, target))
            require(isinstance(requirement["quantity"], int) and requirement["quantity"] > 0, "task requirement quantity must be positive")
            require(target in (item_ids if kind == "item" else creature_ids), "task requirement references unknown target")
        item_task = task["kind"] == "item_delivery" and all(r["kind"] == "item" for r in requirements)
        kill_task = task["kind"] == "kill" and all(r["kind"] == "creature" for r in requirements)
        require(item_task or kill_task, "task requirement kind does not match task kind")
    return source


def _write_payload(output: Path, relative: str, payload: object) -> dict[str, object]:
    data = canonical(payload) + b"\n"
    path = output / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"path": relative, "bytes": len(data), "digest": sha256(data)}


def build(source: dict[str, object], output: Path) -> dict[str, object]:
    validate_source(source)
    output.mkdir(parents=True, exist_ok=True)
    items = sorted(source["items"], key=lambda item: (item["name"].casefold(), item["item_id"]))
    creatures = sorted(source["creatures"], key=lambda creature: (creature["name"].casefold(), creature["creature_id"]))
    relations = sorted(source["loot_relations"], key=lambda relation: (relation["item_id"], relation["creature_id"], relation["relation_id"]))
    tasks = sorted(source["tasks"], key=lambda task: (task["name"].casefold(), task["task_id"]))
    by_item: dict[str, list[dict[str, object]]] = {item["item_id"]: [] for item in items}
    for relation in relations:
        by_item[relation["item_id"]].append(relation)

    search_descriptor = _write_payload(output, "item-search.json", {"schema_version": 1, "records": items})
    creature_descriptor = _write_payload(output, "creatures.json", {"schema_version": 1, "records": creatures})
    task_descriptor = _write_payload(output, "tasks.json", {"schema_version": 1, "records": tasks})
    item_shards = []
    for item in items:
        shard_key = hashlib.sha256(item["item_id"].encode("utf-8")).hexdigest()
        relative = f"items/{shard_key}.json"
        descriptor = _write_payload(
            output, relative,
            {"schema_version": 1, "item": item, "loot_relations": by_item[item["item_id"]]},
        )
        item_shards.append({"item_id": item["item_id"], **descriptor})

    source_metadata = {
        "authority": "Oteryn/Oteryn-Game",
        "contract_id": source["contract_id"],
        "schema_version": source["schema_version"],
        "game_revision": source["game_revision"],
        "semantic_digest": source["semantic_digest"],
    }
    index = {
        "schema_version": 1,
        "product": PRODUCT,
        "source": source_metadata,
        "compatibility": source["compatibility"],
        "capabilities": source["capabilities"],
        "counts": {
            "items": len(items),
            "creatures": len(creatures),
            "loot_relations": len(relations),
            "tasks": len(tasks),
        },
        "item_search": search_descriptor,
        "creatures": creature_descriptor,
        "tasks": task_descriptor,
        "item_shards": item_shards,
    }
    index["product_root"] = sha256(canonical(index))
    (output / "index.json").write_bytes(canonical(index) + b"\n")
    return index


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))
    result = build(source, args.output)
    print(json.dumps({"product_root": result["product_root"], **result["counts"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
