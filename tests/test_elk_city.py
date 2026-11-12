import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).parents[1]
spec = importlib.util.spec_from_file_location("elk_city_builder", ROOT / "scripts/build-elk-city-data.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CityBaselineTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = json.loads((ROOT / "assets/traffic/gus-2025.json").read_text())

    def test_bundled_values_match_the_frozen_official_observations(self):
        actual = json.loads((ROOT / "assets/traffic/city-data.js").read_text().split("=", 1)[1].strip().rstrip(";"))
        self.assertEqual(actual, builder.baseline(self.snapshot))
        self.assertEqual(actual["population"], 58889)
        self.assertEqual(actual["passengerCars"], 28054)
        self.assertTrue(actual["passengerCarsEstimated"])

    def test_rural_elk_cannot_be_substituted_for_the_city(self):
        self.snapshot["series"]["cityPopulation"]["unitId"] = "042815505032"
        with self.assertRaisesRegex(ValueError, "Wrong territorial unit"):
            builder.baseline(self.snapshot)

    def test_county_and_city_values_must_keep_their_geographic_scope(self):
        self.snapshot["series"]["countyPassengerCars"]["unitId"] = "042815505011"
        with self.assertRaisesRegex(ValueError, "Wrong territorial unit"):
            builder.baseline(self.snapshot)

    def test_missing_or_qualified_source_values_do_not_turn_into_estimates(self):
        for invalid in (None, 0, -1, 12.5):
            snapshot = copy.deepcopy(self.snapshot)
            snapshot["series"]["countyPassengerCars"]["results"][0]["values"][0]["val"] = invalid
            with self.assertRaises(ValueError):
                builder.baseline(snapshot)
        self.snapshot["series"]["cityPopulation"]["results"][0]["values"][0]["attrId"] = 3
        with self.assertRaises(ValueError):
            builder.baseline(self.snapshot)


if __name__ == "__main__":
    unittest.main()
