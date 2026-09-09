from __future__ import annotations
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
VERIFY_PATH=ROOT/'tools/fullworld-layers/verify_authority_registry.py'
spec=importlib.util.spec_from_file_location('verify_authority_registry',VERIFY_PATH); assert spec and spec.loader
verify=importlib.util.module_from_spec(spec); spec.loader.exec_module(verify)

class AuthorityRegistryInputTests(unittest.TestCase):
    def test_non_utf8_registry_is_reported_as_registry_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'registry.json'
            path.write_bytes(b'\xff')
            with self.assertRaisesRegex(verify.RegistryError,'UTF-8 JSON'):
                verify.load_registry(path)

if __name__=='__main__': unittest.main()
