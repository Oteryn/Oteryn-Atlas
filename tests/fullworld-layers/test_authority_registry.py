from __future__ import annotations
import copy, importlib.util, json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
VERIFY_PATH=ROOT/'tools/fullworld-layers/verify_authority_registry.py'
REGISTRY_PATH=ROOT/'docs/evidence/fullworld-layers/layer-authority-registry.json'
spec=importlib.util.spec_from_file_location('verify_authority_registry',VERIFY_PATH); assert spec and spec.loader
verify=importlib.util.module_from_spec(spec); spec.loader.exec_module(verify)
class AuthorityRegistryTests(unittest.TestCase):
    def setUp(self): self.registry=json.loads(REGISTRY_PATH.read_text())
    def test_committed_registry_is_valid_with_only_overview_proven(self):
        self.assertEqual(verify.validate_registry(self.registry), {'PROVEN':1,'BLOCKED':11,'UNKNOWN':3})
        enabled={x['id'] for x in self.registry['layers'] if x['enabled']}; self.assertEqual(enabled, {'minimap-overview'})
    def test_duplicate_layer_id_rejected(self):
        broken=copy.deepcopy(self.registry); broken['layers'][1]['id']=broken['layers'][0]['id']
        with self.assertRaisesRegex(verify.RegistryError,'duplicate layer ids|coverage changed'): verify.validate_registry(broken)
    def test_blocked_layer_cannot_be_enabled(self):
        broken=copy.deepcopy(self.registry); broken['layers'][0]['enabled']=True
        with self.assertRaisesRegex(verify.RegistryError,'must remain disabled'): verify.validate_registry(broken)
    def test_unapproved_game_capability_forces_reaudit(self):
        broken=copy.deepcopy(self.registry); broken['game']['audited_producer']['capabilities'].append('towns-v1')
        with self.assertRaisesRegex(verify.RegistryError,'capabilities changed'): verify.validate_registry(broken)
    def test_non_overview_proven_claim_is_rejected(self):
        broken=copy.deepcopy(self.registry); broken['layers'][0]['status']='PROVEN'; broken['layers'][0]['enabled']=True
        with self.assertRaisesRegex(verify.RegistryError,'only overview is proven'): verify.validate_registry(broken)
    def test_overview_cannot_claim_game_emission(self):
        broken=copy.deepcopy(self.registry); layer=next(x for x in broken['layers'] if x['id']=='minimap-overview'); layer['current_export_presence']=True
        with self.assertRaisesRegex(verify.RegistryError,'Atlas-derived'): verify.validate_registry(broken)
    def test_g3_root_mismatch_rejected(self):
        broken=copy.deepcopy(self.registry); broken['publication_dependency']['semantic_root']='sha256:'+'00'*32
        with self.assertRaisesRegex(verify.RegistryError,'semantic_root mismatch'): verify.validate_registry(broken)
if __name__=='__main__': unittest.main()
