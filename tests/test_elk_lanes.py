import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("elk_builder", Path(__file__).parents[1] / "scripts/build-elk-data.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class LaneDataTests(unittest.TestCase):
    def test_missing_tags_use_one_lane_per_legal_direction(self):
        self.assertEqual(builder.lane_info({}, 3), ([1, 1, 0], [[15], [15]]))
        self.assertEqual(builder.lane_info({}, 1)[0], [1, 0, 0])
        self.assertEqual(builder.lane_info({}, 2)[0], [0, 1, 0])

    def test_even_total_is_mapped_but_directional_split_is_assumed(self):
        self.assertEqual(builder.lane_info({"lanes": "4"}, 3)[0], [2, 2, 4])

    def test_directional_tags_and_derived_complement_are_retained(self):
        self.assertEqual(builder.lane_info({"lanes": "3", "lanes:forward": "2"}, 3)[0], [2, 1, 7])
        self.assertEqual(builder.lane_info({"lanes:forward": "1", "lanes:backward": "2"}, 3)[0], [1, 2, 3])

    def test_center_turn_lane_does_not_add_through_capacity(self):
        self.assertEqual(builder.lane_info({"lanes": "3", "lanes:both_ways": "1"}, 3)[0], [1, 1, 4])

    def test_single_track_bidirectional_road_is_shared(self):
        self.assertEqual(builder.lane_info({"lanes": "1"}, 3)[0], [1, 1, 20])

    def test_one_way_counts_never_open_an_illegal_direction(self):
        self.assertEqual(builder.lane_info({"lanes": "2"}, 1)[0], [2, 0, 5])
        self.assertEqual(builder.lane_info({"lanes": "2"}, 2)[0], [0, 2, 6])
        counts, _ = builder.lane_info({"lanes": "2", "lanes:forward": "1", "lanes:backward": "1"}, 1)
        self.assertEqual(counts[:2], [1, 0])
        self.assertTrue(counts[2] & 8)

    def test_inconsistent_or_invalid_tags_are_marked_or_use_defaults(self):
        for tags in ({"lanes": "3"}, {"lanes:forward": "0"}, {"lanes": "1", "lanes:forward": "2"}):
            self.assertTrue(builder.lane_info(tags, 3)[0][2] & 8)
        self.assertEqual(builder.lane_info({"lanes": "unknown"}, 3)[0], [1, 1, 0])
        self.assertEqual(builder.lane_info({"lanes": "2;3"}, 3)[0], [1, 1, 0])

    def test_turn_lanes_are_numbered_from_the_right_in_each_travel_direction(self):
        counts, turns = builder.lane_info({"lanes": "3", "lanes:forward": "2", "turn:lanes:forward": "left;through|right"}, 3)
        self.assertEqual(counts, [2, 1, 7])
        self.assertEqual(turns, [[4, 3], [15]])
        self.assertEqual(builder.lane_info({"lanes": "2", "turn:lanes": "left|through"}, 2)[1], [[], [2, 1]])

    def test_incomplete_turn_markings_and_footways_do_not_invent_vehicle_lanes(self):
        self.assertEqual(builder.lane_info({"lanes": "2", "turn:lanes": "left"}, 1)[1], [[15, 15], []])
        self.assertEqual(builder.lane_info({"lanes": "4"}, 0), ([0, 0, 0], [[], []]))


if __name__ == "__main__":
    unittest.main()
