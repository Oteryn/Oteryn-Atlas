from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
VERIFY_PATH=ROOT/'tools/fullworld-layers/verify_authority_registry.py'
REGISTRY_PATH=ROOT/'docs/evidence/fullworld-layers/layer-authority-registry.json'
spec=importlib.util.spec_from_file_location('verify_authority_registry',VERIFY_PATH); assert spec and spec.loader
verify=importlib.util.module_from_spec(spec); spec.loader.exec_module(verify)

class AuthorityRegistryPriorityTypeTests(unittest.TestCase):
    def test_boolean_priority_is_rejected(self):
        registry=json.loads(REGISTRY_PATH.read_text(encoding='utf-8'))
        broken=copy.deepcopy(registry)
        broken['layers'][0]['priority']=True
        with self.assertRaisesRegex(verify.RegistryError,'invalid priority'):
            verify.validate_registry(broken)

if __name__=='__main__': unittest.main()
