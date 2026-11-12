import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("elk_cycling_builder", Path(__file__).parents[1] / "scripts/build-elk-data.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class CyclingAccessTests(unittest.TestCase):
    def info(self, highway="residential", **tags):
        return builder.cycling_info({"highway": highway, **tags})

    def test_ordinary_road_is_not_invented_as_a_cycle_track(self):
        self.assertEqual(self.info(), [3, 0, 0, 0, 3, 3])

    def test_service_road_assumed_car_speed_is_not_a_confirmed_scooter_limit(self):
        self.assertEqual(self.info("service")[1], 0)
        self.assertEqual(self.info("service", maxspeed="30")[1], 3)
        self.assertEqual(self.info("service", maxspeed="40")[1], 0)
        self.assertEqual(self.info("living_street")[1], 3)
        self.assertEqual(self.info("living_street", maxspeed="50")[1], 0)

    def test_tagged_speed_limits_are_parsed_conservatively_per_direction(self):
        for value in ("PL:zone30", "PL:zone:30", "PL:30", "30 km/h", "20;30", "10 mph", "walk"):
            self.assertEqual(self.info(maxspeed=value)[1], 3, value)
        for value in ("PL:urban", "unknown", "signals", "30;50", "30 mph", "0"):
            self.assertEqual(self.info(maxspeed=value)[1], 0, value)
        self.assertEqual(self.info(**{"maxspeed:forward": "30", "maxspeed:backward": "50"})[1], 1)
        self.assertEqual(self.info(maxspeed="30", **{"maxspeed:conditional": "50 @ (daytime)"})[1], 0)
        self.assertEqual(self.info(**{"maxspeed:type": "PL:zone30"})[1], 3)

    def test_cycle_only_geometry_keeps_ride_access_when_foot_is_forbidden(self):
        self.assertEqual(self.info("cycleway", foot="no"), [3, 3, 2, 2, 0, 0])

    def test_private_track_keeps_facility_metadata_but_denies_public_routing(self):
        self.assertEqual(self.info("cycleway", access="private"), [0, 0, 2, 2, 0, 0])
        self.assertEqual(self.info("cycleway", access="no", bicycle="yes", foot="no"), [3, 3, 2, 2, 0, 0])

    def test_footways_need_permission_for_riding_and_designation_for_track_rendering(self):
        for highway in ("footway", "pedestrian"):
            self.assertEqual(self.info(highway), [0, 0, 0, 0, 3, 3])
            self.assertEqual(self.info(highway, bicycle="yes"), [3, 0, 0, 0, 3, 3])
            self.assertEqual(self.info(highway, bicycle="designated"), [3, 3, 2, 2, 3, 3])
        self.assertEqual(self.info("path"), [3, 0, 0, 0, 3, 3])

    def test_no_dismount_and_use_sidepath_require_pushing_where_foot_is_public(self):
        for value in ("no", "private", "dismount", "use_sidepath"):
            modes = self.info("cycleway", bicycle=value)
            self.assertEqual(modes[:2], [0, 0], value)
            self.assertEqual(modes[2:4], [2, 2], value)
            self.assertEqual(modes[4:], [3, 3], value)
        self.assertEqual(self.info("track", bicycle="no"), [0, 0, 0, 0, 3, 3])

    def test_steps_motorways_and_trunks_are_not_used_for_riding_or_pushing(self):
        for highway in ("steps", "motorway", "motorway_link", "trunk", "trunk_link"):
            modes = self.info(highway, bicycle="yes", foot="yes", maxspeed="20")
            self.assertEqual([modes[i] for i in (0, 1, 4, 5)], [0, 0, 0, 0], highway)

    def test_oneway_bicycle_and_push_directions_are_independent(self):
        self.assertEqual(self.info(oneway="yes", maxspeed="30"), [1, 1, 0, 0, 3, 3])
        self.assertEqual(self.info(oneway="-1", maxspeed="30"), [2, 2, 0, 0, 3, 3])
        self.assertEqual(self.info(oneway="yes", maxspeed="30", **{"oneway:bicycle": "no"}), [3, 1, 0, 0, 3, 3])
        self.assertEqual(self.info(oneway="yes", **{"oneway:bicycle": "-1"})[0], 2)
        self.assertEqual(self.info(**{"bicycle:backward": "no", "oneway:foot": "-1"}), [1, 0, 0, 0, 2, 2])
        self.assertEqual(self.info(oneway="-1", **{"bicycle:forward": "yes"})[0], 3)

    def test_side_facilities_are_directional_and_overrides_take_precedence(self):
        self.assertEqual(self.info(**{"cycleway:right": "lane", "cycleway:left": "track"}), [3, 3, 1, 2, 3, 3])
        self.assertEqual(self.info(**{"cycleway:both": "lane", "cycleway:left": "no"})[2:4], [1, 0])
        self.assertEqual(self.info(oneway="yes", **{"cycleway:left": "lane"})[2:4], [1, 0])
        self.assertEqual(self.info(oneway="yes", **{"cycleway:left": "lane", "cycleway:left:oneway": "-1"}), [3, 2, 0, 1, 3, 3])

    def test_contraflow_and_bidirectional_tracks_are_retained(self):
        self.assertEqual(self.info(oneway="yes", cycleway="opposite_lane"), [3, 2, 0, 1, 3, 3])
        self.assertEqual(self.info(oneway="yes", cycleway="opposite_track"), [3, 2, 0, 2, 3, 3])
        self.assertEqual(self.info(oneway="yes", **{"cycleway:right": "track", "cycleway:right:oneway": "no"}), [3, 3, 2, 2, 3, 3])
        self.assertEqual(self.info(oneway="yes", cycleway="opposite"), [3, 0, 0, 0, 3, 3])

    def test_shared_lane_and_separate_tags_do_not_create_extra_infrastructure(self):
        for value in ("shared_lane", "separate", "no", "crossing", "shoulder"):
            self.assertEqual(self.info(cycleway=value)[2:4], [0, 0], value)
        self.assertEqual(self.info(cycleway="separate", bicycle="use_sidepath")[:2], [0, 0])

    def test_mode_specific_scooter_permissions_do_not_change_bike_access(self):
        for key in ("small_electric_vehicle", "electric_scooter", "e-scooter"):
            self.assertEqual(self.info("cycleway", **{key: "no"})[:4], [3, 0, 2, 2], key)
            self.assertEqual(self.info("cycleway", bicycle="no", **{key: "yes"})[:4], [0, 3, 2, 2], key)
        self.assertEqual(self.info(maxspeed="50", small_electric_vehicle="yes")[1], 0)
        self.assertEqual(self.info("footway", scooter="yes")[1], 0)
        self.assertEqual(self.info("cycleway", **{"small_electric_vehicle:backward": "no"})[1], 1)

    def test_rough_surfaces_and_tracks_require_pushing_scooters(self):
        for tags in ({"surface": "gravel"}, {"surface": "ground"}, {"smoothness": "bad"}, {"tracktype": "grade4"}):
            modes = self.info("cycleway", **tags)
            self.assertEqual(modes, [3, 0, 2, 2, 3, 3])
        self.assertEqual(self.info("track", maxspeed="20", surface="asphalt")[1], 0)
        self.assertEqual(self.info("service", surface="ground", **{"cycleway:right": "track", "cycleway:right:surface": "asphalt"})[1], 1)

    def test_unknown_or_conditional_restrictions_are_not_treated_as_permission(self):
        self.assertEqual(self.info(bicycle="unknown")[0], 0)
        self.assertEqual(self.info("cycleway", oneway="reversible"), [0, 0, 2, 2, 3, 3])
        self.assertEqual(self.info("cycleway", **{"bicycle:conditional": "no @ (wet)"})[:4], [0, 0, 2, 2])

    def test_bollards_and_cycle_barriers_do_not_automatically_block_cycles(self):
        for barrier in ("bollard", "cycle_barrier", "gate"):
            self.assertEqual(builder.barrier_masks({"barrier": barrier}), [3, 3, 3, 3])
        self.assertEqual(builder.barrier_masks({"barrier": "gate", "locked": "yes"}), [0, 0, 0, 0])
        self.assertEqual(builder.barrier_masks({"barrier": "gate", "access": "private", "foot": "yes"}), [0, 0, 3, 3])
        self.assertEqual(builder.barrier_masks({"barrier": "bollard", "access": "no", "bicycle": "yes", "foot": "yes"}), [3, 3, 3, 3])

    def test_circle_clipping_counts_only_geometry_inside_the_study_area(self):
        self.assertAlmostEqual(builder.circle_length([-6000, 0, 6000, 0]), 10000)
        self.assertAlmostEqual(builder.circle_length([4000, 0, 6000, 0]), 1000)
        self.assertAlmostEqual(builder.circle_length([-100, 100, 100, 100]), 200)
        self.assertEqual(builder.circle_length([-6000, 6000, 6000, 6000]), 0)
        self.assertEqual(builder.circle_length([-6000, 5000, 6000, 5000]), 0)

    def test_statistics_count_both_directions_once_per_mapped_geometry(self):
        edge = [0, 1, 0, 4, 0, 1, 5, [-6000, 0, 6000, 0], [0, 0, 0], [[], []], 1, [3, 3, 2, 2, 3, 3]]
        stats = builder.cycling_stats([edge], {1: ([], {"highway": "cycleway", "surface": "asphalt"})}, [], set())
        self.assertEqual(stats["dedicatedTrackMeters"], 10000)
        self.assertEqual(stats["infrastructureMeters"], 10000)
        self.assertEqual(stats["infrastructureCoveragePercent"], 100)
        self.assertEqual(stats["surfaceCoveragePercent"], 100)


class CyclingImportTests(unittest.TestCase):
    def build_snapshot(self, gated=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            gate = '<node id="5" lat="53.8248304" lon="22.3615813"><tag k="barrier" v="gate"/><tag k="locked" v="yes"/></node>' if gated else ""
            middle = '<nd ref="5"/>' if gated else ""
            (root / "map.osm").write_text('<?xml version="1.0"?><osm>'
                '<node id="1" lat="53.8248304" lon="22.3565813"/>'
                '<node id="2" lat="53.8248304" lon="22.3665813"/>'
                '<node id="3" lat="53.8228304" lon="22.3615813"/>'
                '<node id="4" lat="53.8268304" lon="22.3615813"/>' + gate +
                '<way id="11"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="name" v="Wojska Polskiego"/></way>'
                '<way id="22"><nd ref="3"/>' + middle + '<nd ref="4"/><tag k="highway" v="cycleway"/><tag k="foot" v="no"/></way></osm>')
            files = {
                "routes.txt": "agency_id,route_id,route_short_name,route_long_name,route_type\n0,12,12,Test line,3\n",
                "trips.txt": "trip_id,route_id,shape_id,service_id\nt,12,s,weekday\n",
                "shapes.txt": "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled\ns,53.8248304,22.3565813,1,0\ns,53.8248304,22.3665813,2,0.66\n",
                "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\na,Origin,53.8248304,22.3565813\nb,Destination,53.8248304,22.3665813\n",
                "stop_times.txt": "trip_id,stop_id,arrival_time,departure_time,shape_dist_traveled,stop_sequence\nt,a,07:00:00,07:00:00,0,1\nt,b,07:02:00,07:02:00,0.66,2\n",
                "calendar_dates.txt": "service_id,date,exception_type\nweekday,20261112,1\n",
            }
            with zipfile.ZipFile(root / "gtfs.zip", "w") as archive:
                for name, content in files.items(): archive.writestr(name, content)
            with contextlib.redirect_stdout(io.StringIO()):
                builder.build(argparse.Namespace(osm_dir=root, gtfs=root / "gtfs.zip", output=root / "data.js"))
            return json.loads((root / "data.js").read_text().split("=", 1)[1].rstrip(";\n"))

    def test_import_retains_cycle_only_ways_without_inventing_crossing_connections(self):
        data = self.build_snapshot()
        self.assertEqual(data["version"], 4)
        cycle = next(edge for edge in data["edges"] if edge[10] == 22)
        road = next(edge for edge in data["edges"] if edge[10] == 11)
        self.assertEqual(cycle[4:6], [0, 0])
        self.assertEqual(cycle[11], [3, 3, 2, 2, 0, 0])
        self.assertTrue(set(cycle[:2]).isdisjoint(road[:2]), "geometric crossing without a shared OSM node was incorrectly connected")

    def test_locked_gate_is_split_and_excluded_without_removing_the_visible_track(self):
        data = self.build_snapshot(gated=True)
        cycle = [edge for edge in data["edges"] if edge[10] == 22]
        self.assertEqual(len(cycle), 2)
        self.assertTrue(all(edge[11] == [0, 0, 2, 2, 0, 0] for edge in cycle))
        self.assertEqual(data["cyclingStats"]["restrictedBarrierNodes"], 1)
        self.assertEqual(data["cyclingStats"]["barrierRestrictedEdges"], 2)


if __name__ == "__main__":
    unittest.main()
