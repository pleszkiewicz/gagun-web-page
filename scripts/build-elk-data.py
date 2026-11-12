"""Build the static Ełk snapshot using only Python's standard library.

Inputs: OSM XML map extracts (including complete city/lake relations), GTFS ZIP.
Usage: python3 scripts/build-elk-data.py --osm-dir PATH --gtfs PATH
"""
import argparse
import collections
import csv
import io
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

CENTER = (22.3615813, 53.8248304)
MX = 111195.08 * math.cos(math.radians(CENTER[1]))
MY = 111195.08
CAR = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "living_street", "unclassified", "service"}
FOOT = {"footway", "pedestrian", "path", "steps", "cycleway", "track"}
PUBLIC_ACCESS = {"yes", "designated", "official", "permissive"}
SCOOTER_KEYS = ("small_electric_vehicle", "electric_scooter", "e-scooter", "bicycle", "vehicle", "access")
CYCLING_FIELDS = ["bikeRideMask", "scooterRideMask", "facilityForward", "facilityBackward", "bikePushMask", "scooterPushMask"]
ROUGH_SURFACES = {"unpaved", "ground", "dirt", "earth", "grass", "sand", "mud", "gravel", "pebblestone", "cobblestone", "sett", "woodchips", "grass_paver"}
ROUGH_SMOOTHNESS = {"bad", "very_bad", "horrible", "very_horrible", "impassable"}


def project(lon, lat):
    return [round((lon - CENTER[0]) * MX, 1), round((CENTER[1] - lat) * MY, 1)]


def simplify(points, tolerance=1.5):
    if len(points) <= 2:
        return points
    ax, ay = points[0]; bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    den = dx * dx + dy * dy
    maximum, index = 0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / den)) if den else 0
        d = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
        if d > maximum:
            maximum, index = d, i
    if maximum > tolerance * tolerance:
        return simplify(points[:index + 1], tolerance)[:-1] + simplify(points[index:], tolerance)
    return [points[0], points[-1]]


def rings(segments):
    pending = [s for s in segments if len(s) > 1]
    result = []
    while pending:
        ring = pending.pop()
        while ring[0] != ring[-1]:
            for i, s in enumerate(pending):
                if ring[-1] == s[0]: ring += s[1:]
                elif ring[-1] == s[-1]: ring += s[-2::-1]
                elif ring[0] == s[-1]: ring = s[:-1] + ring
                elif ring[0] == s[0]: ring = s[:0:-1] + ring
                else: continue
                pending.pop(i)
                break
            else: break
        if len(ring) > 3 and ring[0] == ring[-1]: result.append(ring)
    return result


def seconds(value):
    h, m, s = map(int, value.split(":"))
    return h * 3600 + m * 60 + s


def lane_info(tags, drive):
    """Directional lanes; flags: forward/backward known, total known, conflict, shared."""
    if not drive:
        return [0, 0, 0], [[], []]
    def count(key):
        value = tags.get(key, "")
        return int(value) if value.isdigit() and 0 <= int(value) <= 8 else None
    total, forward, backward = count("lanes"), count("lanes:forward"), count("lanes:backward")
    center = count("lanes:both_ways") or 0
    flags = (1 if forward is not None else 0) | (2 if backward is not None else 0) | (4 if total else 0)
    if drive in (1, 2):
        value = forward if drive == 1 else backward
        opposite = backward if drive == 1 else forward
        if opposite or (total and value and value != total):
            value = value or 1
            flags = (flags & 4) | 8
        else:
            value = value or total or 1
            if total: flags |= drive
        forward, backward = (value, 0) if drive == 1 else (0, value)
    elif total == 1:
        forward, backward, flags = 1, 1, flags | 16
        if center or any(count(key) not in (None, 1) for key in ("lanes:forward", "lanes:backward")): flags |= 8
    else:
        if forward == 0 or backward == 0: flags |= 8
        if forward is not None and backward is None and total and total - center - forward > 0:
            backward = total - center - forward
            flags |= 2
        if backward is not None and forward is None and total and total - center - backward > 0:
            forward = total - center - backward
            flags |= 1
        if total and forward is None and backward is None:
            forward = backward = max(1, (total - center) // 2)
        forward, backward = max(1, forward or 1), max(1, backward or 1)
        if total and forward + backward + center != total: flags |= 8
    turns = []
    for suffix, n in (("forward", forward), ("backward", backward)):
        value = tags.get("turn:lanes:" + suffix, tags.get("turn:lanes", "") if drive in (1, 2) else "")
        markings = value.split("|") if value else []
        masks = []
        for marking in reversed(markings):
            bits = 0
            for turn in marking.split(";"):
                bits |= 1 if turn in {"left", "slight_left", "sharp_left"} else 4 if turn in {"right", "slight_right", "sharp_right"} else 2 if turn == "through" else 8 if turn == "reverse" else 15
            masks.append(bits)
        turns.append(masks if len(masks) == n else [15] * n)
    return [forward, backward, flags], turns


def oneway_mask(value, default=3):
    if value is None: return default
    value = value.strip().lower()
    if value in {"no", "0", "false"}: return 3
    if value in {"yes", "1", "true"}: return 1
    if value == "-1": return 2
    return 0


def access_mask(tags, keys, default=3):
    """Specific mode tags override vehicle/access; unknown restrictions stay closed."""
    mask = 0
    for bit, suffix in ((1, "forward"), (2, "backward")):
        value = next((tags[key] for mode in keys for key in (mode + ":" + suffix, mode) if key in tags), None)
        allowed = bool(default & bit) if value is None else value.strip().lower() in PUBLIC_ACCESS
        for mode in keys:
            for key in (mode + ":conditional", mode + ":" + suffix + ":conditional"):
                if key in tags and re.search(r"\b(no|private|use_sidepath|dismount|destination|customers|delivery)\b", tags[key]): allowed = False
        if allowed: mask |= bit
    return mask


def road_direction(tags):
    return oneway_mask(tags.get("oneway"), 1 if tags.get("junction") == "roundabout" or tags.get("highway") in {"motorway", "motorway_link"} else 3)


def cycling_facilities(tags):
    """Return directional facility types and actual tagged side descriptors."""
    highway = tags.get("highway")
    direction = road_direction(tags)
    if highway == "cycleway" or (highway in {"footway", "path", "pedestrian"} and tags.get("bicycle") == "designated"):
        cycle_direction = oneway_mask(tags.get("oneway:bicycle"), direction)
        displayed_direction = cycle_direction or 3
        return [2 if displayed_direction & 1 else 0, 2 if displayed_direction & 2 else 0], [(cycle_direction, 2, "")]
    facilities, descriptors = [0, 0], []
    for side, usual in (("right", 1), ("left", 2)):
        value = tags.get("cycleway:" + side, tags.get("cycleway:both", tags.get("cycleway", "")))
        kind = 1 if value in {"lane", "opposite_lane"} else 2 if value in {"track", "opposite_track"} else 0
        if not kind: continue
        default = direction if direction in (1, 2) else usual
        if value.startswith("opposite_"): default = 1 if direction == 2 else 2
        explicit = tags.get("cycleway:" + side + ":oneway", tags.get("cycleway:both:oneway", tags.get("cycleway:oneway")))
        allowed = oneway_mask(explicit, default)
        descriptors.append((allowed, kind, "cycleway:" + side))
        for i, bit in enumerate((1, 2)):
            if (allowed or 3) & bit: facilities[i] = max(facilities[i], kind)
    return facilities, descriptors


def confirmed_speed_limit(tags, direction):
    """Only a tagged limit or Poland's living-street class, never car-model defaults."""
    suffix = "forward" if direction == 1 else "backward"
    value = tags.get("maxspeed:" + suffix, tags.get("maxspeed"))
    if value is None:
        value = next((tags[k] for k in ("maxspeed:type", "zone:maxspeed", "source:maxspeed") if k in tags), None)
        if value is None and tags.get("highway") == "living_street": return 20
    if value is None: return None
    values = []
    for part in value.lower().split(";"):
        part = part.strip()
        numeric = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(km/h|kmh|kph|mph)?", part)
        zone = re.fullmatch(r"pl:(?:zone:?)?(\d+)", part)
        if numeric: values.append(float(numeric[1]) * (1.609344 if numeric[2] == "mph" else 1))
        elif zone: values.append(float(zone[1]))
        elif part in {"pl:living_street", "pl:livingstreet"}: values.append(20)
        elif part == "walk": values.append(5)
        else: return None
    conditional = tags.get("maxspeed:" + suffix + ":conditional", tags.get("maxspeed:conditional"))
    if conditional:
        for part in conditional.split(";"):
            limit = confirmed_speed_limit({"maxspeed": part.split("@", 1)[0].strip()}, direction)
            if limit is None: return None
            values.append(limit)
    return max(values) if values and min(values) > 0 else None


def scooter_surface_ok(tags, prefix=""):
    def attribute(name):
        keys = (prefix + ":" + name, "cycleway:both:" + name, "cycleway:" + name, name) if prefix else (name,)
        return next((tags[key] for key in keys if key in tags), "")
    return attribute("surface") not in ROUGH_SURFACES and attribute("smoothness") not in ROUGH_SMOOTHNESS and tags.get("tracktype") not in {"grade3", "grade4", "grade5"}


def cycling_info(tags):
    """[bike ride, scooter ride, facility forward/backward, bike/scooter push]."""
    highway = tags.get("highway", "")
    facilities, descriptors = cycling_facilities(tags)
    if highway not in CAR | FOOT or highway.startswith(("motorway", "trunk")) or highway == "steps":
        return [0, 0, *facilities, 0, 0]
    base_direction = road_direction(tags)
    bike_direction = oneway_mask(tags.get("oneway:bicycle"), base_direction)
    facility_directions = 0
    for mask, _, _ in descriptors: facility_directions |= mask
    if "oneway:bicycle" not in tags and base_direction:
        bike_direction |= facility_directions
        for bit, suffix in ((1, "forward"), (2, "backward")):
            if tags.get("bicycle:" + suffix) in PUBLIC_ACCESS: bike_direction |= bit
        if tags.get("cycleway") == "opposite": bike_direction = 3
    default_bike = 3 if highway in CAR | {"cycleway", "path", "track"} else facility_directions
    bike = bike_direction & access_mask(tags, ("bicycle", "vehicle", "access"), default_bike)
    if tags.get("smoothness") == "impassable": bike = 0
    push = access_mask(tags, ("foot", "access")) & oneway_mask(tags.get("oneway:foot"))
    scooter_oneway = next((tags[k] for k in ("oneway:small_electric_vehicle", "oneway:electric_scooter", "oneway:e-scooter") if k in tags), None)
    scooter_access = access_mask(tags, SCOOTER_KEYS)
    scooter = 0
    for i, bit in enumerate((1, 2)):
        direction = oneway_mask(scooter_oneway, bike_direction if facilities[i] else base_direction)
        if not direction & scooter_access & bit: continue
        if facilities[i]:
            if any(mask & bit and scooter_surface_ok(tags, prefix) for mask, kind, prefix in descriptors if kind == facilities[i]): scooter |= bit
        elif highway in CAR and (limit := confirmed_speed_limit(tags, bit)) is not None and limit <= 30 and scooter_surface_ok(tags):
            scooter |= bit
    return [bike, scooter, *facilities, push, push]


def barrier_masks(tags):
    """Gate/obstacle presence alone is not a ban; explicit access/locks are."""
    if not tags.get("barrier"): return [3, 3, 3, 3]
    if tags.get("locked") in {"yes", "1", "true"}: return [0, 0, 0, 0]
    return [access_mask(tags, ("bicycle", "vehicle", "access")), access_mask(tags, SCOOTER_KEYS), access_mask(tags, ("foot", "access")), access_mask(tags, ("foot", "access"))]


def circle_length(points, radius=5000):
    length = 0
    for i in range(0, len(points) - 2, 2):
        ax, ay, bx, by = points[i:i + 4]
        dx, dy = bx - ax, by - ay
        a = dx * dx + dy * dy
        if not a: continue
        b, c = 2 * (ax * dx + ay * dy), ax * ax + ay * ay - radius * radius
        discriminant = b * b - 4 * a * c
        if discriminant < 0: continue
        root = math.sqrt(discriminant)
        start, end = max(0, (-b - root) / (2 * a)), min(1, (-b + root) / (2 * a))
        length += max(0, end - start) * math.sqrt(a)
    return length


def cycling_stats(edges, road_ways, barrier_nodes, restricted_edges):
    stats = {"radiusMeters": 5000, "networkMeters": 0, "dedicatedTrackMeters": 0, "paintedLaneMeters": 0, "infrastructureMeters": 0, "bikeRideMeters": 0, "scooterRideMeters": 0, "bikePushOnlyMeters": 0, "scooterPushOnlyMeters": 0, "roadMeters": 0, "speedLimitTaggedRoadMeters": 0, "surfaceTaggedRideMeters": 0, "rideNetworkMeters": 0, "barrierRestrictedEdges": 0}
    for i, edge in enumerate(edges):
        length = circle_length(edge[7])
        if not length: continue
        modes, tags = edge[11], road_ways[edge[10]][1]
        stats["networkMeters"] += length
        for key, condition in (("dedicatedTrackMeters", 2 in modes[2:4]), ("paintedLaneMeters", 1 in modes[2:4]), ("infrastructureMeters", any(modes[2:4])), ("bikeRideMeters", modes[0]), ("scooterRideMeters", modes[1]), ("bikePushOnlyMeters", modes[4] and not modes[0]), ("scooterPushOnlyMeters", modes[5] and not modes[1])):
            if condition: stats[key] += length
        if edge[4]:
            stats["roadMeters"] += length
            tagged = any(k in tags for k in ("maxspeed", "maxspeed:forward", "maxspeed:backward", "maxspeed:type", "zone:maxspeed", "source:maxspeed"))
            if tagged and all(confirmed_speed_limit(tags, bit) is not None for bit in (1, 2) if edge[4] & bit): stats["speedLimitTaggedRoadMeters"] += length
        if modes[0] or modes[1]:
            stats["rideNetworkMeters"] += length
            if any((key == "surface" or key.startswith("cycleway:") and key.endswith(":surface")) and value not in {"unknown", "no", "yes", ""} for key, value in tags.items()): stats["surfaceTaggedRideMeters"] += length
        if i in restricted_edges: stats["barrierRestrictedEdges"] += 1
    for numerator, denominator, key in (("infrastructureMeters", "networkMeters", "infrastructureCoveragePercent"), ("speedLimitTaggedRoadMeters", "roadMeters", "speedLimitCoveragePercent"), ("surfaceTaggedRideMeters", "rideNetworkMeters", "surfaceCoveragePercent")):
        stats[key] = round(100 * stats[numerator] / stats[denominator], 1) if stats[denominator] else 0
    for key in stats:
        if key.endswith("Meters"): stats[key] = round(stats[key])
    stats["restrictedBarrierNodes"] = sum(math.hypot(*point) <= 5000 for point in barrier_nodes)
    stats["edgeFields"] = CYCLING_FIELDS
    stats["facilityCodes"] = {"sharedRoad": 0, "paintedLane": 1, "dedicatedTrack": 2}
    stats["lengthMethod"] = "OSM edge centreline geometry clipped to the 5 km circle; each edge once per category, not directional lane-km. Infrastructure coverage uses all retained road/path geometry. Speed coverage requires a recognized tagged limit in every permitted car direction; surface coverage is tagged geometry of the ride network."
    stats["accessPolicy"] = "Bikes may ride public ordinary roads/path/track; footway/pedestrian needs bicycle permission. Scooters use tagged cycle infrastructure or confirmed <=30 km/h roads; assumed service-road speed is not evidence. Rough surfaces, bad smoothness and unmapped track infrastructure are push-only for scooters. More-specific small-electric-vehicle tags override bicycle/vehicle/access. Conditional bans are conservatively closed."
    stats["barrierPolicy"] = "Bollards/cycle barriers and unlabelled gates do not imply a ban. Explicit node access restrictions and locked gates restrict adjoining edges; pedestrian permissions can retain push access. Barrier dimensions, gate-opening times and carrying cycles over steps are not modelled."
    return stats


def build(args):
    raw_nodes, ways, relations = {}, {}, {}
    for path in sorted(args.osm_dir.rglob("*.osm")):
        if not path.read_bytes()[:100].startswith(b"<?xml"): continue
        for _, e in ET.iterparse(path, events=("end",)):
            if e.tag not in {"node", "way", "relation"}: continue
            tags = {t.get("k"): t.get("v") for t in e.findall("tag")}
            ident = int(e.get("id"))
            if e.tag == "node":
                raw_nodes[ident] = (project(float(e.get("lon")), float(e.get("lat"))), tags)
            elif e.tag == "way" and any(k in tags for k in ("highway", "natural", "landuse", "waterway", "railway")):
                ways[ident] = ([int(n.get("ref")) for n in e.findall("nd")], tags)
            elif e.tag == "way":
                ways[ident] = ([int(n.get("ref")) for n in e.findall("nd")], tags)
            elif e.tag == "relation" and (tags.get("natural") == "water" or tags.get("type") == "restriction" or ident == 2984674):
                relations[ident] = ([(m.get("type"), int(m.get("ref")), m.get("role")) for m in e.findall("member")], tags)
            e.clear()
    visible = lambda p: abs(p[0]) <= 6500 and abs(p[1]) <= 6500
    road_ways = {}
    degree = collections.Counter()
    cuts = set()
    for ident, (refs, tags) in ways.items():
        highway = tags.get("highway")
        if highway not in CAR | FOOT: continue
        refs = [n for n in refs if n in raw_nodes]
        if len(refs) < 2 or not any(visible(raw_nodes[n][0]) for n in refs): continue
        road_ways[ident] = (refs, tags)
        degree.update(set(refs))
        cuts.update([refs[0], refs[-1]])
    cuts.update(n for n, count in degree.items() if count > 1)
    cuts.update(n for n in degree if raw_nodes[n][1].get("highway") == "traffic_signals")
    restricted_barriers = {n: barrier_masks(raw_nodes[n][1]) for n in degree if raw_nodes[n][1].get("barrier") and barrier_masks(raw_nodes[n][1]) != [3, 3, 3, 3]}
    cuts.update(restricted_barriers)
    barrier_restricted_edges = set()
    node_ids, nodes, edges, edge_ways, names = {}, [], [], [], [""]
    def node(ident):
        if ident not in node_ids:
            node_ids[ident] = len(nodes)
            p, tags = raw_nodes[ident]
            nodes.append(p + [int(tags.get("highway") == "traffic_signals")])
        return node_ids[ident]
    for ident, (refs, tags) in road_ways.items():
        h = tags["highway"]
        access = tags.get("motor_vehicle", tags.get("vehicle", tags.get("access", "yes")))
        drive = 3 if h in CAR and access not in {"no", "private"} else 0
        if tags.get("oneway") == "-1": drive &= 2
        elif tags.get("oneway") in {"yes", "1", "true"} or (tags.get("oneway") not in {"no", "0", "false"} and (tags.get("junction") == "roundabout" or h in {"motorway", "motorway_link"})): drive &= 1
        walk = tags.get("foot", tags.get("access", "yes")) not in {"no", "private"} and (not h.startswith(("motorway", "trunk")) or tags.get("foot") == "yes")
        cycling = cycling_info(tags)
        if not drive and not walk and not any(cycling): continue
        kind = 0 if h.startswith(("motorway", "trunk", "primary", "secondary")) else 1 if h.startswith("tertiary") else 2 if h in {"residential", "unclassified", "living_street"} else 3 if h == "service" else 4
        speed = 20 if h in {"service", "living_street"} else 90 if h.startswith(("motorway", "trunk")) else 50
        try: speed = float(tags.get("maxspeed", speed))
        except ValueError: pass
        name = tags.get("name", tags.get("ref", ""))
        lane_counts, lane_turns = lane_info(tags, drive)
        if name not in names: names.append(name)
        chunk = []
        for ref in refs:
            if not visible(raw_nodes[ref][0]):
                chunk = []
                continue
            chunk.append(ref)
            if (ref in cuts or ref == refs[-1]) and len(chunk) > 1:
                points = simplify([raw_nodes[n][0] for n in chunk])
                if math.dist(points[0], points[-1]) > .1 or len(points) > 2:
                    modes = cycling[:]
                    for endpoint in (chunk[0], chunk[-1]):
                        if endpoint not in restricted_barriers: continue
                        for field, allowed in zip((0, 1, 4, 5), restricted_barriers[endpoint]): modes[field] &= allowed
                    if modes != cycling: barrier_restricted_edges.add(len(edges))
                    edges.append([node(chunk[0]), node(chunk[-1]), names.index(name), kind, drive, int(walk), round(speed / 3.6, 2), [v for p in points for v in p], lane_counts, lane_turns, ident, modes])
                    edge_ways.append(ident)
                chunk = [ref]
    incoming, outgoing = collections.defaultdict(list), collections.defaultdict(list)
    for i, e in enumerate(edges):
        if e[4] & 1: outgoing[e[0]].append(i * 2); incoming[e[1]].append(i * 2)
        if e[4] & 2: outgoing[e[1]].append(i * 2 + 1); incoming[e[0]].append(i * 2 + 1)
    turns = set()
    for members, tags in relations.values():
        if tags.get("type") != "restriction": continue
        via = next((ref for typ, ref, role in members if typ == "node" and role == "via"), None)
        fr = {ref for typ, ref, role in members if typ == "way" and role == "from"}
        to = {ref for typ, ref, role in members if typ == "way" and role == "to"}
        if via not in node_ids: continue
        junction = node_ids[via]
        restriction = tags.get("restriction", "")
        for a in incoming[junction]:
            if edge_ways[a // 2] not in fr: continue
            for b in outgoing[junction]:
                if (restriction.startswith("no_") and edge_ways[b // 2] in to) or (restriction.startswith("only_") and edge_ways[b // 2] not in to): turns.add((a, b))
    water, land, boundary, places = [], [], [], []
    water_members = set()
    def points(refs): return [raw_nodes[n][0] for n in refs if n in raw_nodes]
    for ident, (members, tags) in relations.items():
        if tags.get("natural") != "water" and ident != 2984674: continue
        outer, inner = [], []
        for typ, ref, role in members:
            if typ != "way" or ref not in ways: continue
            (inner if role == "inner" else outer).append(points(ways[ref][0]))
            if tags.get("natural") == "water": water_members.add(ref)
        outer_rings = rings(outer)
        if ident == 2984674: boundary.extend([simplify(r) for r in outer_rings])
        elif outer_rings: water.append([simplify(r, 3) for r in outer_rings + rings(inner)])
    for ident, (refs, tags) in ways.items():
        ps = points(refs)
        if len(ps) < 4 or ps[0] != ps[-1] or not any(visible(p) for p in ps): continue
        if tags.get("natural") == "water" and ident not in water_members: water.append([simplify(ps, 3)])
        elif tags.get("landuse") in {"residential", "industrial", "commercial", "retail", "forest"}:
            land.append([int(tags["landuse"] == "forest"), simplify(ps, 4)])
    for p, tags in raw_nodes.values():
        if visible(p) and tags.get("place") in {"town", "village", "suburb", "neighbourhood"} and tags.get("name"):
            places.append([tags["name"], *p, int(tags["place"] in {"town", "village"})])
    for ident, (refs, tags) in ways.items():
        if tags.get("natural") == "water" and tags.get("name"):
            ps = points(refs)
            if ps: places.append([tags["name"], round(sum(p[0] for p in ps) / len(ps), 1), round(sum(p[1] for p in ps) / len(ps), 1), 2])
    # Spatial buckets keep matching GTFS geometry to roads bounded and reproducible.
    grid = collections.defaultdict(list)
    lengths = []
    for i, e in enumerate(edges):
        length = 0
        for j in range(0, len(e[7]) - 2, 2):
            a, b = e[7][j:j + 2], e[7][j + 2:j + 4]
            seglen = math.dist(a, b)
            if e[4] and seglen:
                record = (i, a, b, length, seglen)
                for x in range(math.floor(min(a[0], b[0]) / 80) - 1, math.floor(max(a[0], b[0]) / 80) + 2):
                    for y in range(math.floor(min(a[1], b[1]) / 80) - 1, math.floor(max(a[1], b[1]) / 80) + 2): grid[(x, y)].append(record)
            length += seglen
        lengths.append(length)
    def match(p, tangent):
        best, matched = 40, [-1, 0]
        for i, a, b, offset, length in grid[(math.floor(p[0] / 80), math.floor(p[1] / 80))]:
            dx, dy = b[0] - a[0], b[1] - a[1]
            t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length)))
            distance = math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
            dot = tangent[0] * dx + tangent[1] * dy
            reverse = dot < 0
            if not edges[i][4] & (2 if reverse else 1): continue
            score = distance + (8 if abs(dot) < .4 * math.hypot(*tangent) * length else 0)
            if score < best:
                best = score
                pos = offset + t * length
                matched = [i * 2 + int(reverse), round(lengths[i] - pos if reverse else pos, 1)]
        return matched
    z = zipfile.ZipFile(args.gtfs)
    def rows(n): return list(csv.DictReader(io.StringIO(z.read(n).decode("utf-8-sig"))))
    bus_routes = [r for r in rows("routes.txt") if r["agency_id"] == "0" and r["route_type"] == "3"]
    def route_order(route):
        return [(0, int(part)) if part.isdigit() else (1, part.casefold()) for part in re.split(r"(\d+)", route["route_short_name"] or route["route_id"])]
    bus_routes.sort(key=route_order)
    route_ids = {r["route_id"] for r in bus_routes}
    source_trips = [t for t in rows("trips.txt") if t["route_id"] in route_ids]
    shape_ids = sorted({t["shape_id"] for t in source_trips})
    shape_index = {ident: i for i, ident in enumerate(shape_ids)}
    shapes = []
    source_shapes = collections.defaultdict(list)
    for p in rows("shapes.txt"): source_shapes[p["shape_id"]].append(p)
    for sid in shape_ids:
        ps = sorted(source_shapes[sid], key=lambda p: int(p["shape_pt_sequence"]))
        xy = [project(float(p["shape_pt_lon"]), float(p["shape_pt_lat"])) for p in ps]
        shape = []
        for i, p in enumerate(ps):
            a, b = xy[max(0, i - 1)], xy[min(len(xy) - 1, i + 1)]
            shape.append(xy[i] + [round(float(p["shape_dist_traveled"]) * 1000, 2)] + match(xy[i], (b[0] - a[0], b[1] - a[1])))
        shapes.append(shape)
    times = collections.defaultdict(list)
    trip_ids = {t["trip_id"] for t in source_trips}
    for s in rows("stop_times.txt"):
        if s["trip_id"] in trip_ids: times[s["trip_id"]].append(s)
    stop_ids = sorted({s["stop_id"] for tt in times.values() for s in tt})
    stop_index = {ident: i for i, ident in enumerate(stop_ids)}
    source_stops = {s["stop_id"]: s for s in rows("stops.txt")}
    stops = [[source_stops[s]["stop_name"], *project(float(source_stops[s]["stop_lon"]), float(source_stops[s]["stop_lat"]))] for s in stop_ids]
    trips = [[t["trip_id"], shape_index[t["shape_id"]], [[stop_index[s["stop_id"]], seconds(s["arrival_time"]), seconds(s["departure_time"]), round(float(s["shape_dist_traveled"]) * 1000, 2)] for s in sorted(times[t["trip_id"]], key=lambda s: int(s["stop_sequence"]))], t["route_id"]] for t in source_trips]
    palette = ["#b94e35", "#237b58", "#8052a7", "#a77512", "#168493", "#b04478", "#677a2c", "#c4631c", "#526d9b", "#945f38", "#6246a0", "#387347", "#b52d4f", "#347c96", "#81751d"]
    colors = {r["route_id"]: palette[i % len(palette)] for i, r in enumerate(r for r in bus_routes if r["route_id"] != "12")}
    colors["12"] = "#3268d4"
    lines = []
    for route in bus_routes:
        line_trips = [trip for trip in trips if trip[3] == route["route_id"]]
        lines.append({"id": route["route_id"], "number": route["route_short_name"] or route["route_id"], "name": " ".join(route["route_long_name"].split()), "color": colors[route["route_id"]], "shapes": sorted({trip[1] for trip in line_trips}), "stops": sorted({stop[0] for trip in line_trips for stop in trip[2]})})
    dates = {}
    calendars = rows("calendar_dates.txt")
    for date in sorted({r["date"] for r in calendars}):
        active = {r["service_id"] for r in calendars if r["date"] == date and r["exception_type"] == "1"}
        key = date[:4] + "-" + date[4:6] + "-" + date[6:]
        dates[key] = [i for i, t in enumerate(source_trips) if t["service_id"] in active]
    pilot_shapes = next(line["shapes"] for line in lines if line["id"] == "12")
    bus_edges = {p[3] // 2 for i in pilot_shapes for p in shapes[i] if p[3] >= 0}
    selected = next((i for i, e in enumerate(edges) if i in bus_edges and names[e[2]] == "Wojska Polskiego" and e[4] and math.hypot(*nodes[e[0]][:2]) < 1600 and lengths[i] > 80), 0)
    road_length = sum(lengths[i] for i, e in enumerate(edges) if e[4])
    tagged_length = sum(lengths[i] for i, e in enumerate(edges) if e[4] and e[8][2] & 4)
    lane_stats = {"roadMeters": round(road_length), "taggedMeters": round(tagged_length), "taggedPercent": round(100 * tagged_length / road_length, 1), "taggedWays": len({edge_ways[i] for i, e in enumerate(edges) if e[4] and e[8][2] & 4}), "roadWays": len({edge_ways[i] for i, e in enumerate(edges) if e[4]})}
    cycling = cycling_stats(edges, road_ways, [raw_nodes[n][0] for n in restricted_barriers if n in node_ids], barrier_restricted_edges)
    data = {"version": 4, "center": CENTER, "radius": 5000, "snapshot": "2026-11-11", "nodes": nodes, "names": names, "edges": edges, "turns": sorted(turns), "laneStats": lane_stats, "cyclingStats": cycling, "water": water, "land": land, "boundary": boundary, "places": places, "selected": selected, "transit": {"lines": lines, "stops": stops, "shapes": shapes, "trips": trips, "dates": dates}, "sources": {"map": "https://www.openstreetmap.org/copyright", "gtfs": "https://mkuran.pl/gtfs/elk.zip", "operator": "https://rozklady.mzk.elk.pl/", "cyclingTags": "https://wiki.openstreetmap.org/wiki/Key:cycleway"}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("window.gagunTrafficData=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    unmatched_inside = sum(p[3] < 0 and math.hypot(*p[:2]) <= 5000 for shape in shapes for p in shape)
    unmatched_outside = sum(p[3] < 0 and math.hypot(*p[:2]) > 5000 for shape in shapes for p in shape)
    print(json.dumps({"nodes": len(nodes), "edges": len(edges), "turn_restrictions": len(turns), "bus_lines": len(lines), "bus_trips": len(trips), "bus_shapes": len(shapes), "bus_stops": len(stops), "unmapped_shape_points_inside_5km": unmatched_inside, "unmapped_shape_points_outside_5km": unmatched_outside, "lanes": lane_stats, "cycling": cycling, "bytes": args.output.stat().st_size}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--osm-dir", type=Path, required=True)
    parser.add_argument("--gtfs", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("assets/traffic/elk-data.js"))
    build(parser.parse_args())
