#!/usr/bin/env python3
"""Test-only, read-only checks of explicitly reviewed rendered DXF details.

Complements, and never rewrites, the frozen oracle. Uses actual anonymous-block
entities for BYBLOCK color, actual TEXT glyph outlines for collision, and actual
roughness line segments for dimensions. No production scene is expected data.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path

import ezdxf
from ezdxf import bbox
from ezdxf.addons import text2path
from ezdxf.addons.drawing.properties import RenderContext

import oracle

EPS = 1e-5


def sub(a, b):
    return [a[0] - b[0], a[1] - b[1]]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def parallel(a, b):
    return abs(cross(a, b)) <= EPS * math.hypot(*a) * math.hypot(*b)


def witness_entities(doc, dim):
    base = dim.dxf.dimtype & 7
    if base in (0, 1):
        angle = math.radians(dim.dxf.get("angle", 0))
        directions = [[-math.sin(angle), math.cos(angle)]]
    elif base == 2:
        directions = [sub(dim.dxf.defpoint3, dim.dxf.defpoint2), sub(dim.dxf.defpoint, dim.dxf.defpoint4)]
    else:
        return []
    return [e for e in oracle.flatten(doc.blocks[dim.dxf.geometry])
            if e.dxftype() == "LINE" and math.dist(e.dxf.start, e.dxf.end) > EPS
            and any(parallel(sub(e.dxf.end, e.dxf.start), d) for d in directions)]


def rendered_witnesses(doc, dim):
    # DIMENSION is a virtual-entity composite, not INSERT. Drawing Frontend does
    # not push block-reference properties for it, so BYBLOCK uses layout default.
    ctx = RenderContext(doc)
    return [{"handle": e.dxf.handle, "rawColor62": e.dxf.get("color", 256),
             "renderedColor": ctx.resolve_color(e)} for e in witness_entities(doc, dim)]


def roughness_measurements(item):
    paths = [g for g in item["graphics"] if g["type"] == "LWPOLYLINE" and g["color"] == 31]
    tick = next(g for g in paths if len(g["points"]) == 3)
    p0, tip, p2 = [p[:2] for p in tick["points"]]
    if tick["closed"]:
        bar = [p0, p2]
        continuations = [g["attributes"] for g in item["graphics"] if g["type"] == "LINE" and g["color"] == 31]
        ends = [p2]
        for line in continuations:
            a, b = line["start"][:2], line["end"][:2]
            if math.dist(a, p2) < EPS and parallel(sub(b, a), sub(p2, tip)):
                ends.append(b)
            elif math.dist(b, p2) < EPS and parallel(sub(a, b), sub(p2, tip)):
                ends.append(a)
        end = max(ends, key=lambda p: math.dist(p, tip))
    else:
        end = p2
        bar = next(g["points"] for g in paths if len(g["points"]) == 2)
    a, b = sub(p0, tip), sub(end, tip)
    angle = math.degrees(math.acos(max(-1, min(1, sum(x*y for x, y in zip(a, b)) / math.hypot(*a) / math.hypot(*b)))))
    text = next(g["text"] for g in item["graphics"] if g["type"] == "MTEXT")
    rotation = math.radians(text["rotation"])
    normal = [-math.sin(rotation), math.cos(rotation)]
    baseline = sum(x*y for x, y in zip(sub(text["position"], bar[0]), normal))
    attachment_row = (text["attachment"] - 1) // 3
    # The target's right-shoulder and left-opening glyphs face the opposite side
    # of the readable text normal. Their bottom baseline is -4.55 mm from the
    # bar; the nearest nominal text edge is -4.55 + 3.5 = -1.05 mm.
    lower = baseline - (2 - attachment_row) * text["height"] / 2
    upper = lower + text["height"]
    gap = 0.0 if lower <= 0 <= upper else min(abs(lower), abs(upper))
    bar_mid = [(bar[0][i] + bar[1][i]) / 2 for i in (0, 1)]
    facing = sub(bar_mid, tip)
    return {"shortArmMm": math.hypot(*a), "longArmMm": math.hypot(*b), "barMm": math.dist(bar[0][:2], bar[1][:2]),
            "includedAngleDeg": angle, "textHeightMm": text["height"], "textBottomAboveBarMm": gap,
            "textRotationDeg": text["rotation"], "signedInsertionFromBarMm": baseline,
            "tipToBarMidMm": facing, "glyphFacingDeg": math.degrees(math.atan2(facing[1], facing[0])) % 360,
            "tip": tip, "bar": bar,
            "representation": "closed triangle plus collinear long-arm continuation" if tick["closed"] else "open V plus bar"}


def inside(p, polygon):
    hit = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0]-a[0]) * (p[1]-a[1]) / (b[1]-a[1]) + a[0]:
            hit = not hit
    return hit


def intersect(a, b, c, d):
    r, s = sub(b, a), sub(d, c)
    divisor = cross(r, s)
    if abs(divisor) < 1e-12:
        return None
    t, u = cross(sub(c, a), s) / divisor, cross(sub(c, a), r) / divisor
    return [a[0] + t*r[0], a[1] + t*r[1]] if -EPS <= t <= 1+EPS and -EPS <= u <= 1+EPS else None


def clipped_length(a, b, bounds):
    lo, hi = 0.0, 1.0
    for axis in (0, 1):
        delta = b[axis] - a[axis]
        if abs(delta) < 1e-12:
            if not bounds["min"][axis] + EPS < a[axis] < bounds["max"][axis] - EPS:
                return 0.0
        else:
            limits = [(bounds[k][axis] - a[axis]) / delta for k in ("min", "max")]
            lo, hi = max(lo, min(limits)), min(hi, max(limits))
    return max(0, hi-lo) * math.dist(a, b)


def b8_collisions(doc, items, matched, origin):
    entity = doc.entitydb[matched["reference-callout.[B]8"]["actualHandle"]]
    box = bbox.extents([entity], fast=False)
    norm = lambda p: [float(p[i]) - origin[i] for i in (0, 1)]
    bounds = {"min": norm(box.extmin), "max": norm(box.extmax)}
    loops = []
    for path in text2path.make_paths_from_entity(entity):
        for part in path.sub_paths():
            points = [norm(p) for p in part.flattening(.002)]
            if len(points) > 2:
                loops.append(points)
    glyph_edges = [(a, b) for points in loops for a, b in zip(points, points[1:] + points[:1])]
    filled_glyph = lambda p: sum(inside(p, polygon) for polygon in loops) % 2 == 1
    box_polygon = [[bounds["min"][0], bounds["min"][1]], [bounds["max"][0], bounds["min"][1]],
                   [bounds["max"][0], bounds["max"][1]], [bounds["min"][0], bounds["max"][1]]]
    collisions, checked = [], collections.Counter()
    for semantic_id, record in matched.items():
        if semantic_id.startswith("reference-callout."):
            continue
        item = items[record["actualHandle"]]
        for index, g in enumerate(item["graphics"]):
            segments, polygons = [], []
            if g["type"] == "LINE":
                segments = [(g["attributes"]["start"][:2], g["attributes"]["end"][:2])]
            elif g["type"] == "LWPOLYLINE":
                points = [p[:2] for p in g["points"]]
                segments = list(zip(points, points[1:] + (points[:1] if g["closed"] else [])))
            elif g["type"] == "HATCH" and g["hatch"]["solid"]:
                for path in g["hatch"]["paths"]:
                    points = [p[:2] for p in path.get("vertices", [])] or [e["start"][:2] for e in path.get("edges", [])]
                    if points:
                        polygons.append(points)
                        segments += list(zip(points, points[1:] + points[:1]))
            else:
                continue
            checked[g["type"]] += 1
            lengths = [clipped_length(a, b, bounds) for a, b in segments]
            box_hit = sum(lengths) > EPS or any(inside(p, poly) for poly in polygons for p in box_polygon)
            if not box_hit:
                continue
            intersections = [p for a, b in segments for c, d in glyph_edges if (p := intersect(a, b, c, d)) is not None]
            glyph_hit = bool(intersections) or any(filled_glyph([(a[0]+b[0])/2, (a[1]+b[1])/2]) for a, b in segments)
            glyph_hit |= any(inside(p, poly) for poly in polygons for loop in loops for p in loop)
            collisions.append({"ownerId": semantic_id, "actualHandle": record["actualHandle"], "graphicIndex": index,
                               "type": g["type"], "bboxIntersectionLengthMm": sum(lengths),
                               "glyphIntersection": glyph_hit, "glyphIntersectionPoints": intersections,
                               "segments": segments, "filledPolygons": polygons})
    return {"id": "reference-callout.[B]8", "actualHandle": entity.dxf.handle,
            "status": "failed" if collisions else "passed", "bounds": bounds,
            "font": doc.styles.get(entity.dxf.style).dxf.font, "textWidth41": entity.dxf.get("width", 1),
            "glyphOutlineFlatteningMm": .002, "glyphOutlineCount": len(loops),
            "checkedActualPrimitives": dict(checked), "collisions": collisions,
            "nativeCadFontAvailability": "unsupported; measurements use locally resolved ezdxf font glyphs"}


def audit(directory):
    actual_path = directory / "actual.dxf"
    digest = hashlib.sha256(actual_path.read_bytes()).hexdigest()
    strict = json.loads((directory / "oracle-report.json").read_text())
    if strict["actualSha256"] != digest:
        raise ValueError("Stale oracle report; run the read-only oracle check first")
    matched = {r["id"]: r for r in strict["items"] if r.get("actualHandle")}
    actual_doc, reference_doc = ezdxf.readfile(actual_path), ezdxf.readfile(oracle.FIXTURE / "target.dxf")
    actual = oracle.extract(actual_path)
    items = {r["actualHandle"]: r for r in actual["items"]}
    reference = {r["id"]: r for r in json.loads(oracle.MANIFEST.read_text())["items"]}
    report = {"actualSha256": digest, "scope": "Independent supplemental rendering evidence; frozen strict manifest and tolerances are unchanged.",
              "witnessPictureColors": [], "referenceTextWidths": [], "roughnessGeometry": [], "orientations": []}
    for handle, semantic_id in oracle.DIMENSION_IDS.items():
        if (reference_doc.entitydb[handle].dxf.dimtype & 7) == 4:
            continue
        row = matched[semantic_id]
        expected = rendered_witnesses(reference_doc, reference_doc.entitydb[handle])
        actual_rows = rendered_witnesses(actual_doc, actual_doc.entitydb[row["actualHandle"]])
        good = bool(expected and actual_rows) and {e["renderedColor"] for e in expected} == {e["renderedColor"] for e in actual_rows}
        report["witnessPictureColors"].append({"id": semantic_id, "status": "passed" if good else "failed",
                                             "oracleHandle": handle, "actualHandle": row["actualHandle"], "expected": expected, "actual": actual_rows})
    for semantic_id, row in matched.items():
        item, expected_item = items[row["actualHandle"]], reference[semantic_id]
        if semantic_id.startswith("reference-callout."):
            entity, expected = actual_doc.entitydb[row["actualHandle"]], reference_doc.entitydb[row["oracleHandle"]]
            actual_width, expected_width = entity.dxf.get("width", 1), expected.dxf.get("width", 1)
            box = bbox.extents([entity], fast=False)
            profile_width = actual_doc.styles.get(entity.dxf.style).dxf.width
            report["referenceTextWidths"].append({"id": semantic_id, "actualHandle": row["actualHandle"],
                "status": "passed" if abs(actual_width-expected_width) < EPS else "failed", "expectedWidth41": expected_width,
                "actualWidth41": actual_width, "selectedStyleWidthFactor": profile_width,
                "profileConsistencyStatus": "passed" if abs(actual_width-profile_width) < EPS else "failed",
                "actualFontBoundsWidthMm": box.extmax.x-box.extmin.x})
        if semantic_id.startswith("roughness."):
            expected, measured = roughness_measurements(expected_item), roughness_measurements(item)
            fields = ["shortArmMm", "longArmMm", "barMm", "includedAngleDeg", "textHeightMm", "textBottomAboveBarMm"]
            differences = [{"field": k, "expected": expected[k], "actual": measured[k]} for k in fields if abs(expected[k]-measured[k]) > EPS]
            if abs((expected["glyphFacingDeg"] - measured["glyphFacingDeg"] + 180) % 360 - 180) > EPS:
                differences.append({"field": "glyphFacingDeg", "expected": expected["glyphFacingDeg"], "actual": measured["glyphFacingDeg"]})
            report["roughnessGeometry"].append({"id": semantic_id, "actualHandle": row["actualHandle"],
                "status": "failed" if differences else "passed", "expected": expected, "actual": measured, "differences": differences})
        if semantic_id.startswith("roughness.") or ".angle" in semantic_id:
            expected = [t["rotation"] for t in expected_item["typography"]]
            measured = [t["rotation"] for t in item["typography"]]
            good = len(set(expected)) == len(set(measured)) == 1 and abs((expected[0]-measured[0]+180)%360-180) < EPS
            report["orientations"].append({"id": semantic_id, "status": "passed" if good else "failed", "expectedDeg": expected, "actualDeg": measured})
    report["b8ActualGeometryClearance"] = b8_collisions(actual_doc, items, matched, actual["normalization"]["origin"])
    report["summary"] = {k: dict(collections.Counter(r["status"] for r in report[k]))
                         for k in ("witnessPictureColors", "referenceTextWidths", "roughnessGeometry", "orientations")}
    report["summary"]["b8ActualGeometryClearance"] = report["b8ActualGeometryClearance"]["status"]
    report["normalizationNotes"] = ["DIMENSION BYBLOCK color is evaluated outside an INSERT context, matching ezdxf drawing Frontend; target white witnesses are not inherited cyan.",
        "Equivalent open-V/bar and closed triangle/collinear-continuation roughness encodings are measured as the same physical segments.",
        "Actual TEXT group 41 controls glyph width; STYLE width alone does not override it.",
        "Roughness text gap is the nearest nominal text edge to the bar, accounting for bottom attachment and text height when the readable text normal faces the opposite side.",
        "Strict exact-reference differences remain in oracle-report.json. This report adds engineering checks; it does not replace them."]
    (directory / "additional-render-audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    lines = ["# Independent actual DXF render details", "", f"Actual SHA: `{digest}`", "", "| Check | Result |", "|---|---|"]
    for key, value in report["summary"].items():
        lines.append(f"| {key} | {json.dumps(value)} |")
    for key in ("witnessPictureColors", "referenceTextWidths", "roughnessGeometry", "orientations"):
        lines += ["", f"## {key}", "", "| Item | Status | Numeric evidence |", "|---|---|---|"]
        for row in report[key]:
            lines.append(f"| {row['id']} | {row['status']} | {json.dumps(row, ensure_ascii=False)} |")
    lines += ["", "## [B]8 actual geometry", "", "```json", json.dumps(report["b8ActualGeometryClearance"], indent=2, ensure_ascii=False), "```", ""]
    lines += ["- " + note for note in report["normalizationNotes"]]
    (directory / "additional-render-audit.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({"actualSha256": digest, **report["summary"]}))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    report = audit(parser.parse_args().directory)
    raise SystemExit(1 if report["b8ActualGeometryClearance"]["status"] == "failed" or any(v.get("failed") for v in report["summary"].values() if isinstance(v, dict)) else 0)
