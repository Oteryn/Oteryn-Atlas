#!/usr/bin/env python3
"""Build the bounded Atlas search index from Game semantic-search-source-v1."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

EXPECTED_CONTRACT = "oteryn-game-atlas-export-v1"
EXPECTED_CAPABILITY = "semantic-search-source-v1"
EXPECTED_PROFILE = "oteryn-game-atlas-semantic-search-v1"
MAX_RECORDS = 250_000
MAX_ALIASES = 32
MAX_CAPABILITIES = 32
SHA = re.compile(r"^[0-9a-f]{40}$")
ALLOWED_KINDS = {"npc", "monster", "town", "waypoint", "poi", "teleport", "house", "quest_area", "mechanic"}
RANKING = {
    "exact_id": 1100,
    "exact_label": 1000,
    "exact_alias": 900,
    "prefix_id": 850,
    "prefix_label": 800,
    "prefix_alias": 700,
    "contains_label": 600,
    "contains_alias": 500,
}


def canonical(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def normalize(value: str) -> str:
    # Match browser String.toLocaleLowerCase('en-US') for the public labels we
    # index. Python casefold() is intentionally avoided because it expands
    # some Unicode code points (for example ß -> ss) that JS lowercasing does not.
    return " ".join(value.lower().strip().split())


def validate_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    if source.get("contract_id") != EXPECTED_CONTRACT:
        raise ValueError("unsupported Game export contract")
    if source.get("capability") != EXPECTED_CAPABILITY or source.get("profile_id") != EXPECTED_PROFILE:
        raise ValueError("unsupported Game semantic search profile")
    if source.get("coordinate_profile") != "oteryn-world-spatial-v1":
        raise ValueError("unsupported coordinate profile")
    expected_digest = source.get("semantic_digest")
    if not isinstance(expected_digest, str) or not expected_digest.startswith("sha256:"):
        raise ValueError("missing Game semantic digest")
    unsigned = dict(source)
    unsigned.pop("semantic_digest", None)
    actual_digest = "sha256:" + hashlib.sha256(canonical(unsigned)).hexdigest()
    if actual_digest != expected_digest:
        raise ValueError("Game semantic source digest mismatch")
    aliases = source.get("input_floor_aliases")
    if not isinstance(aliases, dict) or len(aliases) > 64:
        raise ValueError("invalid input floor aliases")
    for key, value in aliases.items():
        if not re.fullmatch(r"-?\d+", str(key)) or not isinstance(value, int):
            raise ValueError("invalid input floor alias")
    records = source.get("records")
    if not isinstance(records, list) or len(records) > MAX_RECORDS:
        raise ValueError("semantic record collection invalid or too large")
    seen: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or record.get("kind") not in ALLOWED_KINDS:
            raise ValueError("unsupported semantic record kind")
        record_id, label = record.get("id"), record.get("label")
        if not isinstance(record_id, str) or not record_id or len(record_id) > 128 or record_id in seen:
            raise ValueError("invalid/duplicate semantic record id")
        seen.add(record_id)
        if not isinstance(label, str) or not label or len(label) > 256:
            raise ValueError("invalid semantic label")
        record_aliases = record.get("aliases")
        capabilities = record.get("capabilities")
        if not isinstance(record_aliases, list) or len(record_aliases) > MAX_ALIASES or not all(isinstance(value, str) and len(value) <= 256 for value in record_aliases):
            raise ValueError("invalid semantic aliases")
        if not isinstance(capabilities, list) or len(capabilities) > MAX_CAPABILITIES or not all(isinstance(value, str) and len(value) <= 64 for value in capabilities):
            raise ValueError("invalid semantic capabilities")
        position = record.get("position")
        if not isinstance(position, dict) or set(position) != {"x", "y", "floor"} or not all(isinstance(position[key], int) for key in position):
            raise ValueError("invalid semantic position")
        bounds = record.get("bounds")
        if bounds is not None:
            keys = {"x_min", "y_min", "x_max_exclusive", "y_max_exclusive", "floor"}
            if not isinstance(bounds, dict) or set(bounds) != keys or not all(isinstance(bounds[key], int) for key in keys):
                raise ValueError("invalid semantic bounds")
            if bounds["x_min"] >= bounds["x_max_exclusive"] or bounds["y_min"] >= bounds["y_max_exclusive"]:
                raise ValueError("empty semantic bounds")
        if not isinstance(record.get("provenance"), dict):
            raise ValueError("semantic provenance required")
    return records


def build(source: dict[str, Any], game_revision: str) -> dict[str, Any]:
    if SHA.fullmatch(game_revision) is None:
        raise ValueError("game revision must be an exact 40-character SHA")
    records = validate_source(source)
    indexed: list[dict[str, Any]] = []
    by_kind: dict[str, list[str]] = {}
    for record in records:
        value = dict(record)
        value["search_terms"] = {
            "label": normalize(record["label"]),
            "aliases": sorted({normalize(alias) for alias in record["aliases"] if normalize(alias)}),
        }
        indexed.append(value)
        by_kind.setdefault(record["kind"], []).append(record["id"])
    indexed.sort(key=lambda value: (value["search_terms"]["label"], value["kind"], value["id"]))
    for ids in by_kind.values():
        ids.sort()
    output: dict[str, Any] = {
        "schema_version": 1,
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "repository": "Oteryn/Oteryn-Game",
            "game_revision": game_revision,
            "contract_id": source["contract_id"],
            "capability": source["capability"],
            "profile_id": source["profile_id"],
            "semantic_digest": source["semantic_digest"],
        },
        "input_floor_aliases": source["input_floor_aliases"],
        "ranking": RANKING,
        "kind_filters": sorted(by_kind),
        "by_kind": {kind: by_kind[kind] for kind in sorted(by_kind)},
        "records": indexed,
        "counts": {"records": len(indexed), "kinds": len(by_kind)},
    }
    output["index_digest"] = "sha256:" + hashlib.sha256(canonical(output)).hexdigest()
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--game-revision", required=True)
    args = parser.parse_args()
    source = json.loads(args.source.read_text(encoding="utf-8"))
    result = build(source, args.game_revision)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"index_digest": result["index_digest"], **result["counts"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
