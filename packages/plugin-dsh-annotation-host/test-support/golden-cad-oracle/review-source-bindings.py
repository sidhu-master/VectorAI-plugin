#!/usr/bin/env python3
"""Independent, test-only source-feature binding audit for the golden fixture.

This does not replace or relax oracle.py. Source handles below are reviewed
initial-DXF evidence, never production lookup keys or actual-DXF matching keys.
It checks stored target ownership and native emitted witnesses separately from
label content. Reference callouts have no typed attachment and remain unsupported.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

import oracle


# Independent reviewed feature membership in initial.dxf, with end/fillet members
# admitted only where they belong to the same physical cylindrical feature.
FEATURES = {
    "bearing.left.diameter": ("212 22E", "212 22E", 17.5),
    "bearing.right.diameter": ("20C 234", "20C 234", 17.5),
    "spline.outer-span": ("237 23A", "237 23A", 22.2930523),
    "spline.root-span": ("214 22C", "214 22C", 21.104935),
    "relief.diameter38": ("216 217 218 228 229 22A", "217 229", 19),
    "shoulder.diameter51": ("21B 225", "21B 225", 25.5),
    "middle.diameter40": ("202 205 206 207 221 222", "206 221", 20),
    "relief.diameter48": ("20A 21F", "20A 21F", 24),
    "bore.diameter20": ("20F 231", "20F 231", 10),
}
SURFACES = {
    "left-bearing": "212 22E", "right-bearing": "20C 234",
    "left-shoulder-face": "219 227", "right-shoulder-face": "20B 21E 1EB",
    "left-opening": "24C", "right-opening": "253",
    "gear": "1EA 1F0 1F5 1FA 1FB 1FC 1FD 1FE 1FF",  # individual gear envelope facets
}
ANGLES = {
    "left-opening.angle60": "24A 24C", "left-opening.angle120": "24B 24D",
    "right-opening.angle60": "253 254", "right-opening.angle120": "252 255",
}


def close(a, b, tol=0.01):
    return abs(a - b) <= tol


def segment_distance(p, a, b, infinite=False):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy or 1)
    if not infinite:
        t = max(0, min(1, t))
    return math.dist(p[:2], [a[0] + t * dx, a[1] + t * dy])


def arc_contains(node, parameter):
    degree = math.degrees(parameter) % 360
    start, end = node["startAngle"] % 360, node["endAngle"] % 360
    return ((degree - start) % 360) <= ((end - start) % 360) + 0.0001


def graphic_paths(item, color=None):
    return [[p[:2] for p in g["points"]] for g in item["graphics"]
            if g["type"] == "LWPOLYLINE" and (color is None or g["color"] == color)]


def graphic_triangles(item):
    triangles = []
    for g in item["graphics"]:
        if g["type"] != "HATCH" or not g["hatch"]["solid"]:
            continue
        for path in g["hatch"]["paths"]:
            vertices = [p[:2] for p in path.get("vertices", [])]
            if not vertices:
                vertices = [e["start"][:2] for e in path.get("edges", [])]
            if len(vertices) == 3:
                triangles.append(vertices)
    return triangles


def narrow_arrow_tips(item):
    tips = []
    for vertices in graphic_triangles(item):
        base = min([(0, 1), (1, 2), (2, 0)], key=lambda pair: math.dist(vertices[pair[0]], vertices[pair[1]]))
        tips.append(vertices[3 - sum(base)])
    return tips


def source_anchor(target, geometries, xy):
    node, anchor = geometries[target["geometryId"]], target["anchor"]
    if anchor["kind"] == "nearest":
        return xy(anchor["point"])
    if anchor["kind"] == "center":
        return xy(node["center"])
    if anchor["kind"] == "curve-parameter" and node["type"] == "arc":
        return xy([node["center"][0] + node["radius"] * math.cos(anchor["parameter"]),
                   node["center"][1] + node["radius"] * math.sin(anchor["parameter"])])
    raise ValueError("Unsupported symbol source anchor " + str(anchor))


def emitted_symbol_check(item_id, emitted, targets, geometries, xy, matched_items):
    """DXF geometry checks against independently verified source targets, not scene placements."""
    anchors = [source_anchor(t, geometries, xy) for t in targets]
    anchors = list({tuple(p): p for p in anchors}.values())
    blue = graphic_paths(emitted, 4)
    near = lambda a, b: math.dist(a[:2], b[:2]) < .01
    result = {"field": "emitted-symbol-connection", "status": "failed", "sourceAnchors": anchors}
    if item_id.startswith("datum."):
        diameter_id = "dimension.bearing.right.diameter" if item_id.endswith(".A") else "dimension.bearing.left.diameter"
        dimension = matched_items[diameter_id]
        witness = min(dimension["targets"].values(), key=lambda p: p[1])[:2]
        segments = [(g["attributes"]["start"], g["attributes"]["end"]) for g in dimension["graphics"] if g["type"] == "LINE" and g["color"] == 4]
        candidates = [p for p in blue if p and any((near(a, witness) or near(b, witness)) and segment_distance(p[0], a, b) < .01 for a, b in segments)]
        triangles = graphic_triangles(emitted)
        connected = bool(candidates and triangles) and any(near(p[-1], v) for p in candidates for triangle in triangles for v in triangle)
        result.update(status="passed" if connected else "failed", route="actual diameter lower witness/extension → blue connector → datum triangle",
                      associatedActualDimension=diameter_id, actualWitness=witness, connectorPaths=candidates, triangles=triangles)
    elif item_id.startswith("detail."):
        circles = [g["attributes"] for g in emitted["graphics"] if g["type"] == "CIRCLE"]
        center_matches = len(circles) == 1 and len(anchors) == 1 and near(circles[0]["center"], anchors[0])
        # The circle must connect to the actual leader at its circumference.
        paths = graphic_paths(emitted, 31)
        leader_attached = bool(circles) and any(close(math.dist(p[0], circles[0]["center"][:2]), circles[0]["radius"]) for p in paths if p)
        result.update(status="passed" if center_matches and leader_attached else "failed", route="source upper R0.8 center → actual detail CIRCLE → leader",
                      circles=circles, leaderPaths=paths)
    elif item_id in {"roughness.left-bearing", "roughness.right-bearing"}:
        frame_id = item_id.replace("roughness.", "gdt.")
        frame = matched_items[frame_id]
        rectangles = [g["points"] for g in frame["graphics"] if g["type"] == "LWPOLYLINE" and g["color"] == 31 and g["closed"] and len(g["points"]) == 4]
        top = None
        if rectangles:
            p = rectangles[0]; top = [[min(v[0] for v in p), max(v[1] for v in p)], [max(v[0] for v in p), max(v[1] for v in p)]]
        tick = [p for p in graphic_paths(emitted, 31) if len(p) == 3]
        contacts = [v for p in tick for v in p if top and segment_distance(v, *top) < .01]
        result.update(status="passed" if contacts else "failed", route="same-feature actual GDT frame top → roughness symbol contact",
                      associatedActualFrame=frame_id, frameTop=top, contacts=contacts)
    else:
        paths_match = all(any(p and near(p[0], anchor) for p in blue) for anchor in anchors)
        if item_id.startswith("roughness."):
            tick = [p for p in graphic_paths(emitted, 31) if len(p) == 3]
            terminal_matches = any(near(path[-1], v) for path in blue for points in tick for v in points)
            result.update(status="passed" if paths_match and terminal_matches else "failed", route="source surface anchor → blue leader → roughness symbol contact", actualLeaderPaths=blue)
        else:
            tips = narrow_arrow_tips(emitted)
            tips_match = all(any(near(tip, anchor) for tip in tips) for anchor in anchors)
            result.update(status="passed" if paths_match and tips_match else "failed", route="source feature anchor → actual arrow tip and leader start", arrowTips=tips, actualLeaderPaths=blue)
    return result


def audit(directory):
    directory = Path(directory)
    document = json.loads((directory / "acceptance-document.json").read_text())
    evidence = json.loads((directory / "acceptance-input-and-grounding.json").read_text())
    matches = json.loads((directory / "oracle-report.json").read_text())
    if matches["actualSha256"] != hashlib.sha256((directory / "actual.dxf").read_bytes()).hexdigest():
        raise ValueError("Refresh oracle-report.json for the current DXF before auditing bindings")
    actual = oracle.extract(directory / "actual.dxf")
    scene_path = directory / "acceptance-paper-scene.json"
    scene = json.loads(scene_path.read_text()) if scene_path.exists() else None
    geometries = {n["id"]: n for n in document["geometry"]}
    source = {n.get("sourceRef", {}).get("objectId"): n for n in document["geometry"]}
    nodes = {n["id"]: n for n in document["annotations"]}
    plan = evidence["plan"]["confirmed"]
    initial_hash = hashlib.sha256((oracle.FIXTURE / "initial.dxf").read_bytes()).hexdigest()
    if evidence["inputSourceDigest"] != initial_hash:
        raise ValueError("Binding catalog only applies to the exact reviewed initial fixture")
    actual_by_handle = {i["actualHandle"]: i for i in actual["items"]}
    matched_items = {m["id"]: actual_by_handle[m["actualHandle"]] for m in matches["items"] if m["actualHandle"] in actual_by_handle}
    normalized_origin = actual["normalization"]["origin"]
    def xy(p):
        return [p[0] - normalized_origin[0], p[1] - normalized_origin[1]]
    def source_handles(targets):
        return [geometries.get(t["geometryId"], {}).get("sourceRef", {}).get("objectId") for t in targets]
    def node_for_requirement(name):
        grounded = next((g for g in evidence["grounding"] if g["requirement"] == name and "annotationId" in g), None)
        if grounded:
            return nodes.get(grounded["annotationId"])
        return next((n for n in nodes.values() if n.get("engineeringIntentId") == "intent:acceptance:" + name), None)
    rows = []
    for matched in matches["items"]:
        item_id = matched["id"]
        row = {"id": item_id, "oracleHandle": matched["oracleHandle"], "actualHandle": matched["actualHandle"],
               "sourceBindingStatus": "passed", "emittedBindingStatus": "unsupported", "sourceHandles": [],
               "expectedFeature": "", "checks": [], "interpretation": ""}
        emitted = actual_by_handle.get(matched["actualHandle"])
        def check(name, passed, expected, value):
            row["checks"].append({"field": name, "status": "passed" if passed else "failed", "expected": expected, "actual": value})
            if not passed:
                row["sourceBindingStatus"] = "failed"
        def membership(targets, allowed, required=""):
            handles = source_handles(targets)
            row["sourceHandles"] = handles
            check("source-feature-membership", bool(handles) and set(handles) <= set(allowed.split()) and set(required.split()) <= set(handles),
                  {"allowedSourceHandles": allowed.split(), "requiredSourceHandles": required.split()}, handles)
        if item_id.startswith("reference-callout."):
            row.update(sourceBindingStatus="unsupported", expectedFeature="associated dimension/GDT annotation",
                       interpretation="Plain TextAnnotation has no dimension/GDT attachment; geometric proximity is insufficient to prove persistent ownership.")
        elif item_id.startswith("dimension."):
            name = item_id.removeprefix("dimension.")
            node = node_for_requirement(name)
            target = emitted["targets"] if emitted else {}
            if name in FEATURES:
                allowed, required, radius = FEATURES[name]
                membership(node["targets"] if node else [], allowed, required)
                points = list(target.values())
                valid = len(points) == 2 and all(close(abs(p[1]), radius) for p in points) and points[0][1] * points[1][1] < 0
                row["expectedFeature"] = f"cylindrical feature {name}; opposed radial surfaces ±{radius}"
                row["emittedBindingStatus"] = "passed" if valid else "failed"
                row["checks"].append({"field": "native-opposed-surface-witnesses", "status": row["emittedBindingStatus"], "expected": [-radius, radius], "actual": points})
                row["interpretation"] = "Different stations along the same cylindrical surface/extension are valid; exact reference attachment remains checked separately."
            elif name in ANGLES:
                expected = ANGLES[name].split()
                side = name.startswith("left")
                nominal = 120 if "120" in name else 60
                node = next((n for n in nodes.values() if n.get("dimensionKind") == "angular" and close(n.get("computedValue", -1), nominal)
                             and (sum(xy(p)[0] for p in n["definitionPoints"][:1]) < 86.5) == side), None)
                membership(node["targets"] if node else [], ANGLES[name], ANGLES[name])
                legs = [[target.get("defpoint2"), target.get("defpoint3")], [target.get("defpoint4"), target.get("defpoint")]]
                def lies_on(leg, h):
                    return all(p is not None and segment_distance(p, xy(source[h]["start"]), xy(source[h]["end"]), True) < .01 for p in leg)
                valid = (lies_on(legs[0], expected[0]) and lies_on(legs[1], expected[1])) or (lies_on(legs[0], expected[1]) and lies_on(legs[1], expected[0]))
                row.update(expectedFeature="two inner opening slopes " + ANGLES[name], emittedBindingStatus="passed" if valid else "failed",
                           interpretation="Native legs must remain collinear with the correct source slopes, independently of arc/text placement.")
            elif "radius" in name:
                h = "207" if name.endswith("radius3") else "205"
                node = next((n for n in nodes.values() if n.get("dimensionKind") == "radius" and close(n.get("computedValue", -1), source[h]["radius"])), None)
                membership(node["targets"] if node else [], h, h)
                center, tip = target.get("defpoint"), target.get("defpoint4")
                valid = center is not None and tip is not None and math.dist(center[:2], xy(source[h]["center"])) < .01 and close(math.dist(center[:2], tip[:2]), source[h]["radius"])
                row.update(expectedFeature="source fillet " + h, emittedBindingStatus="passed" if valid else "failed")
            elif name == "gear.outer-span":
                membership(node["targets"] if node else [], "1E5 1F5 1FA 1FC 1FD 1FE 1FF")
                points = list(target.values())
                valid = len(points) == 2 and all(close(abs(p[1]), 28.51477, .002) and 92 <= p[0] <= 147 for p in points)
                row.update(expectedFeature="upper/lower envelope points of the same gear (x 92…147)", emittedBindingStatus="passed" if valid else "failed",
                           interpretation="Different tooth-envelope attachment points are valid; the reference and initial envelopes differ slightly.")
            else:
                requirement = next((r for r in evidence["requirements"]["axial"] + evidence["requirements"]["openingDepths"] if r["id"] == name), None)
                interval = requirement["interval"] if requirement else []
                if name.startswith("axial."):
                    node = next((i for i in plan["intents"] if i["kind"] == "linear" and len(i["targets"]) == 2 and
                                 all(t["anchor"]["kind"] == "nearest" for t in i["targets"]) and
                                 all(close(a, b) for a, b in zip(sorted(xy(t["anchor"]["point"])[0] for t in i["targets"] if t["anchor"]["kind"] == "nearest"), interval))), None)
                handles = source_handles(node["targets"]) if node else []
                row["sourceHandles"] = handles
                check("source-station-targets-exist", bool(handles) and all(h in source for h in handles), interval, handles)
                if node:
                    station_support = []
                    for t in node["targets"]:
                        g = geometries[t["geometryId"]]
                        station = xy(t["anchor"]["point"])[0]
                        endpoints = [g["start"], g["end"]] if g["type"] == "line" else [g["controlPoints"][0], g["controlPoints"][-1]] if g["type"] == "spline" else []
                        if g["type"] == "arc":
                            endpoints = [[g["center"][0] + g["radius"] * math.cos(math.radians(a)), g["center"][1] + g["radius"] * math.sin(math.radians(a))]
                                         for a in [g["startAngle"], g["endAngle"]]]
                        endpoint_stations = [xy(p)[0] for p in endpoints]
                        station_support.append({"sourceHandle": g.get("sourceRef", {}).get("objectId"), "targetStation": station,
                                                "sourceEndpointStations": endpoint_stations, "supportsStation": any(close(station, x) for x in endpoint_stations)})
                    check("typed-target-geometry-supports-axial-station", all(s["supportsStation"] for s in station_support),
                          "Each geometry reference must own an endpoint/face at its stated axial station; an unrelated bore/curve is insufficient.", station_support)
                coords = sorted(p[0] for p in target.values())
                valid = len(coords) == len(interval) == 2 and all(close(a, b) for a, b in zip(coords, interval))
                row.update(expectedFeature=f"source axial stations {interval}", emittedBindingStatus="passed" if valid else "failed",
                           interpretation="Attachment at another height on the same axial face/extension is valid.")
        else:
            targets, ids = [], []
            if item_id.startswith("datum."):
                datum = next(d for d in plan["datums"] if d["name"] == item_id.rsplit(".", 1)[1])
                feature = "right-bearing" if datum["name"] == "A" else "left-bearing"
                targets, ids = [{"geometryId": datum["geometryId"], "anchor": datum["anchor"]}], [datum["id"]]
                allowed = SURFACES[feature]
            elif item_id.startswith("gdt."):
                feature = item_id.removeprefix("gdt.")
                indices = [i for i, r in enumerate(evidence["requirements"]["gdt"]) if r["feature"] == feature]
                intents = [plan["geometricTolerances"][i] for i in indices]
                targets = [t for i in intents for t in i["controlledTargets"]]
                ids, allowed = [i["id"] for i in intents], SURFACES[feature]
            elif item_id.startswith("roughness."):
                feature = item_id.removeprefix("roughness.").replace("left-shoulder", "left-shoulder-face").replace("right-shoulder", "right-shoulder-face")
                index = next(i for i, r in enumerate(evidence["requirements"]["roughness"]) if r["feature"] == feature)
                intent = plan["surfaceTextures"][index]
                targets, ids, allowed = intent["controlledTargets"], [intent["id"]], SURFACES[feature]
            else:
                key = {"note.left-chamfer": "note:left-chamfer", "note.gear-chamfer-both-sides": "note:gear-chamfer-both-sides",
                       "note.spline-dual-radius1": "note:spline-dual-radius1", "detail.right.I": "detail:0", "detail.left.II": "detail:1"}[item_id]
                node = nodes["annotation:acceptance:" + key]
                targets = [node["target"]] + [b["target"] for b in node.get("branches", [])]
                allowed = {"note.left-chamfer": "21A", "note.gear-chamfer-both-sides": "1E9 244",
                           "note.spline-dual-radius1": "216 218", "detail.right.I": "20B 25B",
                           "detail.left.II": "212 15E 213 256 257"}[item_id]
                feature = item_id
                if "dual-radius" in item_id:
                    check("both-R1-tips-on-selected-arc-sectors", len(targets) == 2 and all(arc_contains(geometries[t["geometryId"]], t["anchor"]["parameter"]) for t in targets),
                          "two radians-based parameters in arcs 216/218", [t["anchor"] for t in targets])
                if item_id.startswith("detail."):
                    feature_arcs = ["25B"] if ".right." in item_id else ["257"]
                    radius = node["callout"]["radius"]
                    intersects = any(math.dist(node["points"][0], source[h]["center"]) <= radius + source[h]["radius"] for h in feature_arcs)
                    check("detail-circle-covers-bearing-relief", intersects, feature_arcs, {"center": xy(node["points"][0]), "radius": radius})
                row["emittedBindingStatus"] = "requires-rendered-review"
            membership(targets, allowed)
            anchor_evidence = []
            for t in targets:
                g = geometries[t["geometryId"]]
                p = source_anchor(t, geometries, xy)
                if t["anchor"]["kind"] == "center" and g["type"] == "arc":
                    error = math.dist(p, xy(g["center"]))
                elif g["type"] == "line":
                    error = segment_distance(p, xy(g["start"]), xy(g["end"]))
                elif g["type"] == "arc":
                    error = abs(math.dist(p, xy(g["center"])) - g["radius"])
                    if t["anchor"]["kind"] == "curve-parameter" and not arc_contains(g, t["anchor"]["parameter"]):
                        error = float("inf")
                else:
                    error = float("inf")
                anchor_evidence.append({"sourceHandle": g["sourceRef"]["objectId"], "point": p, "sourceGeometryErrorMm": error if math.isfinite(error) else "unsupported-or-outside-arc"})
            check("source-anchor-on-selected-feature", all(isinstance(a["sourceGeometryErrorMm"], (float, int)) and a["sourceGeometryErrorMm"] < .01 for a in anchor_evidence),
                  "Physical surface point, or the source arc center for a detail circle", anchor_evidence)
            row["expectedFeature"] = feature
            if ids and scene:
                placed = [p for p in scene["symbolPlacements"] if set(p["ids"]) & set(ids)]
                valid = len(placed) == 1 and set(placed[0]["geometryIds"]) == set(t["geometryId"] for t in targets)
                row["checks"].append({"field": "final-paper-controlled-feature-ownership", "status": "passed" if valid else "failed", "expected": source_handles(targets), "actual": placed})
                row["emittedBindingStatus"] = "requires-rendered-review" if valid else "failed"
            row["interpretation"] = "Same physical surface with a different direct/extension/frame attachment is distinguished from a wrong controlled feature. DXF graphic attachment still requires the strict target report and visual review."
            if emitted:
                connection = emitted_symbol_check(item_id, emitted, targets, geometries, xy, matched_items)
                row["checks"].append(connection)
                row["emittedBindingStatus"] = connection["status"]
        if any(c["status"] == "failed" and c["field"] not in {"emitted-symbol-connection", "final-paper-controlled-feature-ownership", "native-opposed-surface-witnesses"} for c in row["checks"]):
            row["sourceBindingStatus"] = "failed"
        rows.append(row)
    report = {"authority": "independent test-only reviewed source geometry; no target paper coordinates", "actualSha256": matches["actualSha256"],
              "sourceSha256": initial_hash, "summary": dict(collections.Counter(r["sourceBindingStatus"] for r in rows)), "items": rows,
              "emittedSummary": dict(collections.Counter(r["emittedBindingStatus"] for r in rows)),
              "limitations": ["Symbol DXF graphics encode lines/triangles, not semantic geometry IDs; numeric source/arrow/frame/circle connections are checked independently of text and exact reference placement. Native CAD font/glyph availability remains unverified.",
                              "Common datum A-B remains visually encoded but lacks a typed common-datum relationship."]}
    # A frame-mounted roughness symbol is only bound when that actual frame's
    # own emitted arrow/leader and independent controlled feature also pass.
    by_id = {row["id"]: row for row in rows}
    for side in ["left", "right"]:
        texture, frame = by_id[f"roughness.{side}-bearing"], by_id[f"gdt.{side}-bearing"]
        if frame["sourceBindingStatus"] != "passed" or frame["emittedBindingStatus"] != "passed":
            texture["emittedBindingStatus"] = "failed"
    report["emittedSummary"] = dict(collections.Counter(r["emittedBindingStatus"] for r in rows))
    (directory / "source-binding-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    lines = ["# Independent source binding review", "", f"Actual SHA: `{report['actualSha256']}`", "",
             "Source ownership is not proved by matching text. Native dimension witnesses and actual emitted symbol connections are checked separately. Exact reference target checks are unchanged.", "",
             "| Item | Source binding | Initial source handles | Expected physical feature | Emitted binding |", "|---|---|---|---|---|"]
    for r in rows:
        lines.append("| " + " | ".join([r["id"], r["sourceBindingStatus"], ", ".join(str(h) for h in r["sourceHandles"]), r["expectedFeature"], r["emittedBindingStatus"]]) + " |")
    lines += ["", "## Failed source fields", ""]
    for r in rows:
        for c in r["checks"]:
            if c["status"] == "failed":
                lines.append(f"- {r['id']}: `{c['field']}` expected `{json.dumps(c.get('expected', c.get('sourceAnchors')), ensure_ascii=False)}`, actual `{json.dumps(c.get('actual', c), ensure_ascii=False)}`.")
    (directory / "source-binding-review.md").write_text("\n".join(lines) + "\n")
    symbols = [r for r in rows if not r["id"].startswith(("dimension.", "reference-callout."))]
    lines = ["# Actual DXF symbol connection audit", "", f"Actual SHA: `{report['actualSha256']}`", "",
             "Numeric checks use actual DXF leader vertices, hatch arrow tips, frame edges and circle centers. Expected physical anchors come from the independently checked initial source geometry. Paper-scene metadata is not the expected geometry.", "",
             "| Symbol | Source binding | Actual emitted connection | Route and numeric evidence |", "|---|---|---|---|"]
    for r in symbols:
        c = next(c for c in r["checks"] if c["field"] == "emitted-symbol-connection")
        lines.append("| " + " | ".join([r["id"], r["sourceBindingStatus"], r["emittedBindingStatus"], json.dumps(c, ensure_ascii=False)]) + " |")
    lines += ["", "All coordinates are body-normalized millimeters; connection tolerance is 0.01 mm. Font/glyph availability in native CAD remains separate and unsupported. Exact reference placement, text rotation and graphics checks remain unchanged."]
    (directory / "emitted-symbol-binding-review.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({"directory": str(directory), **report["summary"], "emittedSummary": report["emittedSummary"]}))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    result = audit(args.directory)
    raise SystemExit(1 if result["summary"].get("failed") or result["emittedSummary"].get("failed") else 0)
