from __future__ import annotations
import unittest


class BlockingPromotionControlledNegative(unittest.TestCase):
    def test_required_verification_blocks_known_failure(self):
        self.fail("controlled blocking-promotion negative canary")


if __name__ == "__main__":
    unittest.main()
