from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
VERIFY_PATH = ROOT / "tools" / "fullworld-layers" / "verify_authority_registry.py"
REGISTRY_PATH = ROOT / "docs" / "evidence" / "fullworld-layers" / "layer-authority-registry.json"

spec = importlib.util.spec_from_file_location("verify_authority_registry", VERIFY_PATH)
assert spec is not None and spec.loader is not None
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class AuthorityRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    def test_committed_registry_is_valid_and_fully_disabled(self) -> None:
        counts = verify.validate_registry(self.registry)
        self.assertEqual(counts, {"PROVEN": 0, "BLOCKED": 12, "UNKNOWN": 3})
        self.assertTrue(all(layer["enabled"] is False for layer in self.registry["layers"]))

    def test_duplicate_layer_id_is_rejected(self) -> None:
        broken = copy.deepcopy(self.registry)
        broken["layers"][1]["id"] = broken["layers"][0]["id"]
        with self.assertRaisesRegex(verify.RegistryError, "duplicate layer ids|coverage changed"):
            verify.validate_registry(broken)

    def test_blocked_layer_cannot_be_enabled(self) -> None:
        broken = copy.deepcopy(self.registry)
        broken["layers"][0]["enabled"] = True
        with self.assertRaisesRegex(verify.RegistryError, "must remain disabled"):
            verify.validate_registry(broken)

    def test_unapproved_game_capability_forces_reaudit(self) -> None:
        broken = copy.deepcopy(self.registry)
        broken["game"]["audited_producer"]["capabilities"].append("towns-v1")
        with self.assertRaisesRegex(verify.RegistryError, "capabilities changed"):
            verify.validate_registry(broken)

    def test_proven_claim_is_rejected_on_blocked_snapshot(self) -> None:
        broken = copy.deepcopy(self.registry)
        broken["layers"][0]["status"] = "PROVEN"
        with self.assertRaisesRegex(verify.RegistryError, "PROVEN requires"):
            verify.validate_registry(broken)


if __name__ == "__main__":
    unittest.main()
