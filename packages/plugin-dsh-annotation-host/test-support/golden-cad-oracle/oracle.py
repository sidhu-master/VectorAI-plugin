#!/usr/bin/env python3
"""Read-only CAD acceptance oracle. Never imported by production code.

Requires ezdxf. `freeze` records the reviewed reference, `check` compares an
independently produced DXF. No command rewrites an input DXF or creates one.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import re
import sys
from pathlib import Path

import ezdxf
from ezdxf import bbox
from ezdxf.math import Vec3

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
FIXTURE = ROOT / "packages/engineering-annotation/test/fixtures/golden-shaft-001"
MANIFEST = HERE / "manifest.json"
BODY_LAYER = "1轮廓实线层"

# Reviewed semantic identities, deliberately local to this acceptance fixture.
# Handles identify reference evidence only; actual matching never uses handles.
DIMENSION_IDS = {
    "35D": "dimension.gear.outer-span", "36D": "dimension.bearing.right.diameter",
    "377": "dimension.middle.diameter40", "387": "dimension.shoulder.diameter51",
    "391": "dimension.relief.diameter38", "3A1": "dimension.bearing.left.diameter",
    "3B1": "dimension.spline.outer-span", "3C1": "dimension.axial.overall",
    "3CB": "dimension.axial.gear-width", "3DB": "dimension.axial.main-stack",
    "3E5": "dimension.axial.spline-width", "3F5": "dimension.axial.left-stack",
    "401": "dimension.axial.shoulder-width", "411": "dimension.axial.left-bearing-width",
    "423": "dimension.spline.root-span", "51B": "dimension.left-opening.depth1",
    "527": "dimension.left-opening.depth3", "532": "dimension.left-opening.angle60",
    "53D": "dimension.left-opening.angle120", "55A": "dimension.right-opening.angle60",
    "566": "dimension.right-opening.depth1", "572": "dimension.right-opening.depth3",
    "58C": "dimension.bore.diameter20", "5B4": "dimension.right-opening.angle120",
    "657": "dimension.gear-transition.radius3", "65E": "dimension.shoulder-transition.radius2",
    "67F": "dimension.axial.relief-width", "689": "dimension.relief.diameter48",
}
SYMBOL_IDS = {
    "424": ("datum.right-bearing.A", "datum"), "42C": ("datum.left-bearing.B", "datum"),
    "434": ("gdt.right-bearing", "gdt-frame"), "456": ("gdt.left-bearing", "gdt-frame"),
    "481": ("roughness.left-bearing", "roughness"), "488": ("roughness.right-bearing", "roughness"),
    "48F": ("roughness.right-shoulder", "roughness"), "4AB": ("gdt.left-shoulder-face", "gdt-frame"),
    "4BF": ("roughness.left-shoulder", "roughness"), "4CF": ("detail.right.I", "detail"),
    "4D7": ("detail.left.II", "detail"), "4DE": ("note.left-chamfer", "feature-note"),
    "57B": ("note.gear-chamfer-both-sides", "feature-note"),
    "630": ("roughness.left-opening", "roughness"), "640": ("roughness.right-opening", "roughness"),
    "65F": ("gdt.right-shoulder-face", "gdt-frame"), "68C": ("roughness.gear", "roughness"),
    "693": ("note.spline-dual-radius1", "feature-note"),
}
GDT_GLYPHS = {"e": "circularity", "g": "cylindricity", "t": "total-runout", "h": "circular-runout"}
IGNORED_ATTRS = {"handle", "owner", "paperspace", "material_handle", "plotstyle_handle", "visualstyle_handle"}
POINT_ATTRS = {"start", "end", "center", "insert", "align_point", "defpoint", "text_midpoint", "defpoint2", "defpoint3", "defpoint4", "defpoint5"}


def clean(value):
    if isinstance(value, (str, bool)) or value is None:
        return value
    if isinstance(value, (int, float)):
        return round(float(value), 7) if isinstance(value, float) else value
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    try:
        return [clean(v) for v in value]
    except TypeError:
        return str(value)


def point(value, origin):
    return clean(Vec3(value) - origin)


def angle(value):
    normalized = float(value) % 360
    return 0.0 if abs(normalized - 360) < 0.0000001 else clean(normalized)


def bounds(entities, origin):
    box = bbox.extents(entities, fast=False)
    return {"min": point(box.extmin, origin), "max": point(box.extmax, origin)} if box.has_data else None


def flatten(entities):
    for entity in entities:
        if entity.dxftype() == "INSERT":
            yield from flatten(entity.virtual_entities())
        else:
            yield entity


def effective_style(entity, inherited=None):
    inherited = inherited or {}
    layer = entity.doc.layers.get(entity.dxf.layer) if entity.doc and entity.dxf.layer in entity.doc.layers else None
    raw_color = entity.dxf.get("color", 256)
    color = inherited.get("color", abs(layer.dxf.color) if layer else 7) if raw_color == 0 else abs(layer.dxf.color) if raw_color == 256 and layer else raw_color
    raw_weight = entity.dxf.get("lineweight", -1)
    weight = inherited.get("lineweight", layer.dxf.lineweight if layer else -3) if raw_weight == -2 else layer.dxf.lineweight if raw_weight == -1 and layer else raw_weight
    if weight == -3:
        weight = entity.doc.header.get("$LWDEFAULT", 25) if entity.doc else 25
    raw_linetype = entity.dxf.get("linetype", "BYLAYER")
    linetype = inherited.get("linetype", layer.dxf.linetype if layer else "Continuous") if raw_linetype.upper() == "BYBLOCK" else layer.dxf.linetype if raw_linetype.upper() == "BYLAYER" and layer else raw_linetype
    return {"color": color, "lineweight": weight, "linetype": linetype.lower()}


def text_record(entity, origin, inherited=None):
    is_mtext = entity.dxftype() == "MTEXT"
    raw = entity.text if is_mtext else entity.dxf.text
    style = entity.doc.styles.get(entity.dxf.get("style", "Standard")) if entity.doc else None
    inline_fonts = re.findall(r"\\[fF]([^;]+);", raw)
    inline_width = re.findall(r"\\W([0-9.]+);", raw)
    return {
        "raw": raw, "plain": entity.plain_text(), "position": point(entity.dxf.insert, origin),
        "height": clean(entity.dxf.char_height if is_mtext else entity.dxf.height),
        "rotation": clean(entity.get_rotation() if is_mtext else entity.dxf.get("rotation", 0)),
        "style": entity.dxf.get("style", "Standard"),
        "font": style.dxf.font if style else None, "bigfont": style.dxf.bigfont if style else None,
        "inlineFonts": inline_fonts, "inlineWidthFactors": inline_width,
        "widthFactor": clean(style.dxf.width if is_mtext and style else entity.dxf.get("width", 1)),
        "attachment": entity.dxf.get("attachment_point", 1) if is_mtext else [entity.dxf.get("halign", 0), entity.dxf.get("valign", 0)],
        "layer": entity.dxf.layer, "color": effective_style(entity, inherited)["color"],
    }


def hatch_record(entity, origin):
    paths = []
    for path in entity.paths:
        record = {"flags": path.path_type_flags}
        if hasattr(path, "vertices"):
            record.update(closed=path.is_closed, vertices=[point((x, y, 0), origin) + [clean(bulge)] for x, y, bulge in path.vertices])
        else:
            edges = []
            for edge in path.edges:
                data = {"type": edge.EDGE_TYPE}
                for key, value in vars(edge).items():
                    if key in {"start", "end", "center"}:
                        data[key] = point(value, origin)
                    elif key in {"control_points", "fit_points"}:
                        data[key] = [point(p, origin) for p in value]
                    elif key in {"start_angle", "end_angle"}:
                        data[key] = angle(value)
                    elif key in {"start_tangent", "end_tangent"}:
                        data[key] = None if value is None or all(abs(v) < 1e-12 for v in value) else clean(value)
                    else:
                        data[key] = clean(value)
                edges.append(data)
            record["edges"] = edges
        paths.append(record)
    pattern = []
    if entity.pattern:
        for line in entity.pattern.lines:
            # Pattern base is a lattice phase, not a body feature position.
            pattern.append({"angle": clean(line.angle), "base": clean(line.base_point), "offset": clean(line.offset), "dashes": clean(line.dash_length_items)})
    return {"pattern": entity.dxf.pattern_name, "solid": entity.dxf.solid_fill,
            "angle": clean(entity.dxf.pattern_angle), "scale": clean(entity.dxf.pattern_scale),
            "style": entity.dxf.hatch_style, "paths": paths, "patternLines": pattern}


def primitive_record(entity, origin, inherited=None):
    result = {"type": entity.dxftype(), "layer": entity.dxf.layer,
              **effective_style(entity, inherited)}
    kind = entity.dxftype()
    if kind in {"TEXT", "MTEXT"}:
        result["text"] = text_record(entity, origin, inherited)
    elif kind == "HATCH":
        result["hatch"] = hatch_record(entity, origin)
    elif kind == "LWPOLYLINE":
        result.update(closed=entity.closed, points=[point((x, y, entity.dxf.elevation), origin) + clean([sw, ew, bulge]) for x, y, sw, ew, bulge in entity.get_points()])
    elif kind == "SPLINE":
        result.update(degree=entity.dxf.degree, flags=entity.dxf.flags, knots=clean(entity.knots), weights=clean(entity.weights),
                      controlPoints=[point(p, origin) for p in entity.control_points], fitPoints=[point(p, origin) for p in entity.fit_points])
    else:
        result["attributes"] = {k: point(v, origin) if k in POINT_ATTRS else angle(v) if k in {"start_angle", "end_angle", "rotation"} else clean(v)
                                for k, v in entity.dxf.all_existing_dxf_attribs().items()
                                if k not in IGNORED_ATTRS | {"layer", "color", "lineweight", "linetype", "extrusion"}}
    return result


def tolerance(text):
    stack = re.search(r"\\S\s*([+-]?[\d.]+)\^\s*([+-]?[\d.]+);", text)
    if stack:
        return {"mode": "bilateral", "upper": float(stack[1]), "lower": float(stack[2])}
    symmetric = re.search(r"(?:%%[pP]|±)([\d.]+)", text)
    return {"mode": "symmetric", "upper": float(symmetric[1]), "lower": -float(symmetric[1])} if symmetric else None


def raw_nominal(text):
    without_stack = re.sub(r"\\S[^;]*;", "", text)
    without_controls = re.sub(r"\\[A-Za-z][^;]*;", "", without_stack)
    without_codes = re.sub(r"%%[cCdD]", "", re.sub(r"%%[pP]", "±", without_controls))
    found = re.search(r"[+-]?\d+(?:\.\d+)?", without_codes)
    return float(found[0]) if found else None


def shape_kind(texts, primitives):
    if any("amgdt" in t["raw"] for t in texts):
        return "gdt-frame"
    plain = [t["plain"] for t in texts]
    if len(plain) == 1 and plain[0] in {"A", "B"}:
        return "datum"
    if len(plain) == 1 and plain[0] in {"Ⅰ", "Ⅱ"}:
        return "detail"
    if len(plain) == 1 and re.fullmatch(r"\d+(?:\.\d+)?", plain[0]):
        return "roughness"
    return "feature-note"


def symbol_content(kind, texts):
    result = {"texts": [t["plain"] for t in texts]}
    if kind == "gdt-frame":
        glyphs = [t for t in texts if "amgdt" in t["raw"]]
        rows = []
        for glyph in sorted(glyphs, key=lambda t: -t["position"][1]):
            cells = sorted([t for t in texts if t not in glyphs and abs(t["position"][1] - glyph["position"][1]) < 1.2], key=lambda t: t["position"][0])
            rows.append({"characteristic": GDT_GLYPHS.get(glyph["plain"], "unsupported:" + glyph["plain"]),
                         "fontGlyph": glyph["plain"], "cells": [t["plain"] for t in cells],
                         "datumReferenceMode": "common-datum" if any(t["plain"] == "A-B" for t in cells) else None})
        result["rows"] = rows
    elif kind == "roughness":
        result.update(value=float(texts[0]["plain"]), unit="micrometre", parameter="unspecified-in-DXF")
    return result


def extract(path, reference=False):
    doc = ezdxf.readfile(path)
    body = [e for e in doc.modelspace() if e.dxf.layer == BODY_LAYER and e.dxftype() not in {"DIMENSION", "INSERT", "TEXT", "MTEXT"}]
    box = bbox.extents(body, fast=False)
    if not box.has_data:
        raise ValueError(f"No contour geometry in required layer {BODY_LAYER}")
    end_faces = [e for e in body if e.dxftype() == "LINE" and abs(e.dxf.end.x - e.dxf.start.x) < 0.000001 and abs(e.dxf.end.y - e.dxf.start.y) > 0.00001]
    if not end_faces:
        raise ValueError("Golden shaft normalization requires vertical contour end-face lines")
    origin = Vec3(min(e.dxf.start.x for e in end_faces), (box.extmin.y + box.extmax.y) / 2, 0)
    items, geometry, hatches = [], [], []
    for entity in doc.modelspace():
        kind, handle = entity.dxftype(), entity.dxf.handle
        if kind == "DIMENSION":
            primitives = list(flatten(doc.blocks[entity.dxf.geometry])) if entity.dxf.geometry in doc.blocks else []
            texts = [text_record(p, origin, effective_style(entity)) for p in primitives if p.dxftype() in {"TEXT", "MTEXT"}]
            base = entity.dxf.dimtype & 7
            semantic_kind = "angular" if base in {2, 5} else "radial" if base == 4 else "diameter" if base == 3 or any("%%c" in t["raw"].lower() or "⌀" in t["plain"] for t in texts) else "linear"
            target_keys = ["defpoint", "defpoint4"] if base in {3, 4} else ["defpoint2", "defpoint3", "defpoint4", "defpoint"] if base == 2 else ["defpoint2", "defpoint3"]
            targets = {key: point(entity.dxf.get(key), origin) for key in target_keys if entity.dxf.hasattr(key)}
            placement = {key: point(entity.dxf.get(key), origin) for key in ["defpoint", "text_midpoint", "defpoint5"] if entity.dxf.hasattr(key)}
            placement.update(angle=entity.dxf.get("angle", 0), renderedTextPositions=[t["position"] for t in texts], bounds=bounds(primitives, origin))
            content = {"kind": semantic_kind, "nativeType": base, "measurement": clean(entity.get_measurement()),
                       "override": entity.dxf.get("text", "<>"), "renderedTexts": [t["plain"] for t in texts],
                       "nominal": raw_nominal(texts[0]["raw"]) if texts else None,
                       "tolerance": tolerance(entity.dxf.get("text", "")) or tolerance(" ".join(t["raw"] for t in texts))}
            item = {"id": DIMENSION_IDS[handle] if reference else "actual.dimension." + handle, "kind": "dimension",
                    "content": content, "targets": targets, "placement": placement,
                    "typography": [{k: v for k, v in t.items() if k not in {"position", "plain"}} for t in texts],
                    "dimensionStyle": entity.dxf.dimstyle, "graphics": [primitive_record(p, origin, effective_style(entity)) for p in primitives]}
            try:
                entity.render()
                regenerated_text = [p for p in flatten(doc.blocks[entity.dxf.geometry]) if p.dxftype() in {"TEXT", "MTEXT"}]
                regenerated_raw = [p.text if p.dxftype() == "MTEXT" else p.dxf.text for p in regenerated_text]
                item["regeneration"] = {"status": "available", "renderedTexts": [p.plain_text() for p in regenerated_text],
                                        "nominal": raw_nominal(regenerated_raw[0]) if regenerated_raw else None,
                                        "tolerance": tolerance(" ".join(regenerated_raw))}
            except Exception as error:
                item["regeneration"] = {"status": "unsupported", "reason": str(error)}
        elif kind == "INSERT":
            primitives = list(flatten(entity.virtual_entities()))
            texts = [text_record(p, origin, effective_style(entity)) for p in primitives if p.dxftype() in {"TEXT", "MTEXT"}]
            semantic_kind = SYMBOL_IDS[handle][1] if reference else shape_kind(texts, primitives)
            leader_paths = [clean([point((x, y, 0), origin) for x, y in p.get_points("xy")]) for p in primitives if p.dxftype() == "LWPOLYLINE" and p.dxf.get("color", 256) == 4]
            # Preserve all triangle vertices so arrow tips cannot silently move.
            arrowheads = [hatch_record(p, origin)["paths"] for p in primitives if p.dxftype() == "HATCH" and p.dxf.solid_fill]
            item = {"id": SYMBOL_IDS[handle][0] if reference else "actual.symbol." + handle, "kind": semantic_kind,
                    "content": symbol_content(semantic_kind, texts),
                    "targets": {"leaderPaths": leader_paths, "arrowheads": arrowheads},
                    "placement": {"textPositions": [t["position"] for t in texts], "bounds": bounds(primitives, origin)},
                    "typography": [{k: v for k, v in t.items() if k not in {"position", "plain"}} for t in texts],
                    "graphics": [primitive_record(p, origin, effective_style(entity)) for p in primitives]}
        elif kind in {"TEXT", "MTEXT"}:
            record = text_record(entity, origin)
            item = {"id": "reference-callout." + record["plain"] if reference else "actual.text." + handle,
                    "kind": "reference-callout", "content": {"text": record["plain"]}, "targets": {},
                    "placement": {"position": record["position"]},
                    "typography": {k: v for k, v in record.items() if k not in {"position", "plain"}},
                    "graphics": []}
        elif kind == "HATCH":
            hatches.append({"oracleHandle" if reference else "actualHandle": handle, "record": primitive_record(entity, origin)})
            continue
        else:
            geometry.append({"oracleHandle" if reference else "actualHandle": handle, "record": primitive_record(entity, origin)})
            continue
        item["oracleHandle" if reference else "actualHandle"] = handle
        item["layer"] = entity.dxf.layer
        items.append(item)
    layers = {e.dxf.name: {k: clean(e.dxf.get(k)) for k in ["color", "linetype", "lineweight", "flags"]} for e in doc.layers}
    styles = {e.dxf.name: {k: clean(e.dxf.get(k)) for k in ["font", "bigfont", "width", "oblique", "height"]} for e in doc.styles}
    used_dimstyles = {e.dxf.dimstyle for e in doc.modelspace().query("DIMENSION")}
    dimstyles = {name: {k: "" if k in {"dimblk", "dimblk1", "dimblk2", "dimldrblk"} and v == "0" and "0" not in doc.blocks else clean(v)
                       for k, v in doc.dimstyles.get(name).dxf.all_existing_dxf_attribs().items() if k not in IGNORED_ATTRS} for name in sorted(used_dimstyles)}
    return {"version": doc.dxfversion, "normalization": {"method": "leftmost-vertical-contour-face-and-contour-bbox-mid-y", "layer": BODY_LAYER, "origin": clean(origin), "bodyBounds": bounds(body, origin)},
            "items": items, "geometry": geometry, "hatches": hatches, "layers": layers, "textStyles": styles, "dimensionStyles": dimstyles}


def freeze(output):
    result = extract(FIXTURE / "target.dxf", reference=True)
    initial = extract(FIXTURE / "initial.dxf")
    initial_shapes = [(g["actualHandle"], geometry_shape(g["record"])) for g in initial["geometry"]]
    for geometry in result["geometry"]:
        matches = [handle for handle, shape in initial_shapes if not differences(shape, geometry_shape(geometry["record"]), tolerance=0.00001)]
        geometry["sourcePresence"] = {"status": "present-in-initial" if matches else "reference-only-or-modified", "initialHandles": matches}
    result["initialGeometry"] = [{"initialHandle": g["actualHandle"], "record": geometry_shape(g["record"])} for g in initial["geometry"]]
    result["initialBodyBounds"] = initial["normalization"]["bodyBounds"]
    result.update(schemaVersion=1, fixtureId="golden-shaft-001", authority="user-provided acceptance reference only; never production defaults",
                  source={name: {"path": str((FIXTURE / name).relative_to(ROOT)), "sha256": hashlib.sha256((FIXTURE / name).read_bytes()).hexdigest()} for name in ["initial.dxf", "engineering-data.ini", "target.dxf"]},
                  acceptance={"coordinateToleranceMm": 0.05, "numericTolerance": 0.00001, "rotationToleranceDegrees": 0.01,
                              "matching": "one-to-one semantic kind/content plus nearest normalized target/placement; handles never used"},
                  limitations=["Native DXF has no domain geometry IDs. Leader paths and dimension definition points are authoritative targets; domain intent is a reviewed fixture interpretation.",
                               "Roughness parameter (Ra/Rz) is not explicit in the DXF text. The numeric values are asserted without inventing the parameter.",
                               "Contour bounds start 5 mm left of the nominal 173 mm overall-dimension start. These are both recorded, not silently reconciled.",
                               "Glyph rasterization and CAD application availability of isocp/GBCBIG/amgdt fonts need an independent rendered-image inspection; file metadata is checked here.",
                               "A-B is a common datum, not two sequential A and B datum cells.",
                               "Reference-callout [B]1 through [B]9 are explicit reference items; their manufacturing role is not defined by the INI."])
    # Relationships make tier ordering and spacing independently inspectable.
    dimensions = [i for i in result["items"] if i["kind"] == "dimension" and i["content"]["kind"] == "linear" and i["placement"]["angle"] == 0 and i["placement"]["text_midpoint"][1] > 25]
    ordered = sorted(dimensions, key=lambda i: (i["placement"]["defpoint"][1], i["placement"]["text_midpoint"][0]))
    result["layoutRelations"] = [{"id": f"axial-tier-gap.{a['id']}.{b['id']}", "from": a["id"], "to": b["id"],
                                  "axis": 1, "field": "defpoint", "gap": clean(b["placement"]["defpoint"][1] - a["placement"]["defpoint"][1])} for a, b in zip(ordered, ordered[1:])]
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return result


def geometry_shape(record):
    return {k: v for k, v in record.items() if k not in {"layer", "color", "lineweight", "linetype"}}


def differences(expected, actual, path="", tolerance=0.00001):
    if isinstance(expected, (int, float)) and not isinstance(expected, bool) and isinstance(actual, (int, float)):
        return [] if abs(expected - actual) <= tolerance else [{"path": path, "expected": expected, "actual": actual}]
    if type(expected) is not type(actual):
        return [{"path": path, "expected": expected, "actual": actual}]
    if isinstance(expected, dict):
        result = []
        for key in expected:
            result += differences(expected[key], actual.get(key), f"{path}.{key}" if path else key, tolerance)
        return result
    if isinstance(expected, list):
        if len(expected) != len(actual):
            return [{"path": path + ".length", "expected": len(expected), "actual": len(actual)}]
        return [d for index, (e, a) in enumerate(zip(expected, actual)) for d in differences(e, a, f"{path}[{index}]", tolerance)]
    return [] if expected == actual else [{"path": path, "expected": expected, "actual": actual}]


def coordinates(value):
    if isinstance(value, dict):
        return [p for key, item in value.items() if key != "bounds" for p in coordinates(item)]
    if isinstance(value, list):
        if len(value) == 3 and all(isinstance(v, (int, float)) for v in value):
            return [value]
        return [p for item in value for p in coordinates(item)]
    return []


def match_score(expected, actual):
    if expected["kind"] != actual["kind"]:
        return math.inf
    if expected["kind"] == "dimension":
        if expected["content"]["kind"] != actual["content"]["kind"]:
            return math.inf
        expected_nominal = dimension_nominal(expected["content"])
        actual_nominal = dimension_nominal(actual["content"])
        if expected_nominal is None or actual_nominal is None or abs(expected_nominal - actual_nominal) > 0.02:
            return math.inf
    if expected["kind"] == "reference-callout" and expected["content"] != actual["content"]:
        return math.inf
    ep, ap = coordinates(expected["targets"]), coordinates(actual["targets"])
    if not ep or not ap:
        ep, ap = coordinates(expected["placement"]), coordinates(actual["placement"])
    spatial = sum(min(math.dist(p, q) for q in ap) for p in ep) / len(ep) if ep and ap else 500
    content = len(differences(expected["content"], actual["content"]))
    return spatial + min(content, 10) * 8


def dimension_nominal(content):
    if "nominal" in content:
        return content["nominal"]
    texts = content.get("renderedTexts", [])
    if not texts:
        return None
    text = re.sub(r"%%[cCdDpP]", "", texts[0])
    found = re.search(r"[+-]?\d+(?:\.\d+)?", text)
    return float(found[0]) if found else None


def status_check(category, expected, actual, tolerance=0.00001):
    delta = differences(expected, actual, tolerance=tolerance)
    return {"category": category, "status": "failed" if delta else "passed", "differenceCount": len(delta), "differences": delta}


def engineering_content(item):
    content = item["content"]
    if item["kind"] == "dimension":
        tol = content["tolerance"]
        return {"kind": content["kind"], "nominal": content["nominal"],
                "deviations": [tol["upper"], tol["lower"]] if tol else None}
    if item["kind"] == "gdt-frame":
        return {"rows": content.get("rows", [])}
    if item["kind"] == "roughness":
        return {"value": content["value"], "unit": content["unit"]}
    return content


def primary_position(item):
    points = coordinates(item["placement"])
    if item["kind"] == "dimension":
        rendered = item["placement"].get("renderedTextPositions", [])
        return rendered[0] if rendered else item["placement"].get("text_midpoint")
    return points[0] if points else None


def placement_side(item, body_bounds):
    p = primary_position(item)
    if p is None:
        return "unavailable"
    # Both drawings use the original physical body end (x=0), not target-only
    # extension lines. Classification is categorical; exact coordinates remain
    # separate strict-reference checks.
    return {"axial": "left" if p[0] < -0.05 else "right" if p[0] > body_bounds["max"][0] + 0.05 else "within-body-span",
            "radial": "above" if p[1] > body_bounds["max"][1] + 0.05 else "below" if p[1] < body_bounds["min"][1] - 0.05 else "within-body-height"}


def nominal_text_height(item):
    texts = item["typography"] if isinstance(item["typography"], list) else [item["typography"]]
    return max((t["height"] for t in texts), default=None)


def effective_fonts(item):
    texts = item["typography"] if isinstance(item["typography"], list) else [item["typography"]]
    result = []
    for text in texts:
        fonts = text.get("inlineFonts") or [text.get("font") or ""]
        result += [font.split(",")[0].split("|")[0].lower().removesuffix(".shx").removesuffix(".ttf") for font in fonts]
    return sorted(set(result))


def arrow_shapes(item):
    shapes = []
    for graphic in item["graphics"]:
        if graphic["type"] != "HATCH" or not graphic["hatch"]["solid"]:
            continue
        for path in graphic["hatch"]["paths"]:
            vertices = [v[:3] for v in path.get("vertices", [])]
            if not vertices:
                vertices = [e["start"] for e in path.get("edges", []) if "start" in e]
            if len(vertices) > 1 and math.dist(vertices[0], vertices[-1]) < 0.00001:
                vertices.pop()
            if len(vertices) == 3:
                shapes.append(sorted(clean(math.dist(vertices[i], vertices[(i + 1) % 3])) for i in range(3)))
    return sorted(shapes)


def engineering_checks(expected, actual, body_bounds):
    checks = [status_check("semantic-content", engineering_content(expected), engineering_content(actual)),
              status_check("layout-zone", placement_side(expected, body_bounds), placement_side(actual, body_bounds)),
              status_check("nominal-text-height", nominal_text_height(expected), nominal_text_height(actual)),
              status_check("effective-font-families", effective_fonts(expected), effective_fonts(actual))]
    expected_arrows = arrow_shapes(expected)
    if expected_arrows:
        checks.append(status_check("arrowhead-shape-and-size", expected_arrows, arrow_shapes(actual), 0.05))
    if expected["kind"] == "dimension":
        regenerated = actual.get("regeneration", {})
        if regenerated.get("status") == "available":
            checks.append(status_check("native-regenerated-visible-nominal", expected["content"]["nominal"], regenerated.get("nominal")))
            expected_tolerance, actual_tolerance = expected["content"]["tolerance"], regenerated.get("tolerance")
            checks.append(status_check("native-regenerated-tolerance", [expected_tolerance["upper"], expected_tolerance["lower"]] if expected_tolerance else None,
                                       [actual_tolerance["upper"], actual_tolerance["lower"]] if actual_tolerance else None))
        else:
            checks.append({"category": "native-regenerated-visible-content", "status": "unsupported", "reason": regenerated.get("reason", "No native regeneration result")})
    return checks


def compare_records(expected, actual, category, tolerance):
    # Allocate exact equivalent geometry before comparing unmatched additions.
    # A target-only extension must not consume a preserved source edge and then
    # falsely report that edge as lost later in model-space order.
    pairs = sorted((len(differences(e["record"], a["record"], tolerance=tolerance)), ei, ai)
                   for ei, e in enumerate(expected) for ai, a in enumerate(actual)
                   if a["record"]["type"] == e["record"]["type"] and a["record"]["layer"] == e["record"]["layer"])
    matches, used = {}, set()
    for _, ei, ai in pairs:
        if ei not in matches and ai not in used:
            matches[ei] = ai
            used.add(ai)
    checks = []
    for index, e in enumerate(expected):
        a = actual[matches[index]] if index in matches else None
        check = status_check(category, e["record"], a["record"] if a else None, tolerance)
        check.update(oracleHandle=e["oracleHandle"], actualHandle=a["actualHandle"] if a else None)
        if "sourcePresence" in e:
            check["sourcePresence"] = e["sourcePresence"]
        checks.append(check)
    for index, a in enumerate(actual):
        if index in used:
            continue
        checks.append({"category": category, "status": "failed", "actualHandle": a["actualHandle"], "reason": "Unexpected extra entity", "differences": []})
    return checks


def check(actual_path, manifest_path, output):
    expected = json.loads(manifest_path.read_text())
    actual = extract(actual_path)
    coordinate_tolerance = expected["acceptance"]["coordinateToleranceMm"]
    candidates = sorted((match_score(e, a), ei, ai) for ei, e in enumerate(expected["items"]) for ai, a in enumerate(actual["items"]))
    matches, used = {}, set()
    for score, ei, ai in candidates:
        if ei not in matches and ai not in used and math.isfinite(score):
            matches[ei] = ai
            used.add(ai)
    item_reports, matched_by_id = [], {}
    for index, item in enumerate(expected["items"]):
        a = actual["items"][matches[index]] if index in matches else None
        if a is None:
            item_reports.append({"id": item["id"], "oracleHandle": item["oracleHandle"], "status": "failed", "reason": "Missing semantic item", "checks": [],
                                 "engineeringStatus": "failed", "engineeringChecks": [{"category": "semantic-item-presence", "status": "failed", "reason": "Missing semantic item"}]})
            continue
        matched_by_id[item["id"]] = a
        checks = [status_check(field, item[field], a[field], coordinate_tolerance if field in {"targets", "placement", "graphics"} else 0.00001) for field in ["content", "targets", "placement", "typography", "graphics", "layer"]]
        if item["kind"] == "dimension":
            checks.append(status_check("dimensionStyle", item["dimensionStyle"], a["dimensionStyle"]))
        engineering = engineering_checks(item, a, expected["initialBodyBounds"])
        item_reports.append({"id": item["id"], "oracleHandle": item["oracleHandle"], "actualHandle": a["actualHandle"], "status": "passed" if all(c["status"] == "passed" for c in checks) else "failed", "checks": checks,
                             "engineeringStatus": "passed" if all(c["status"] == "passed" for c in engineering) else "failed", "engineeringChecks": engineering})
    unexpected = [a for index, a in enumerate(actual["items"]) if index not in used]
    globals_ = [status_check("dxfVersion", expected["version"], actual["version"]), status_check("bodyBounds", expected["normalization"]["bodyBounds"], actual["normalization"]["bodyBounds"], coordinate_tolerance)]
    # Only reference styles/layers that are actually used are requirements.
    required_layers = {r["record"]["layer"] for r in expected["geometry"] + expected["hatches"]} | {i["layer"] for i in expected["items"]}
    for name in sorted(required_layers):
        globals_.append(status_check("layer." + name, expected["layers"][name], actual["layers"].get(name)))
    for name, value in expected["dimensionStyles"].items():
        globals_.append(status_check("dimensionStyle." + name, value, actual["dimensionStyles"].get(name)))
    engineering_relations = []
    for relation in expected["layoutRelations"]:
        a, b = matched_by_id.get(relation["from"]), matched_by_id.get(relation["to"])
        try:
            gap = b["placement"][relation["field"]][relation["axis"]] - a["placement"][relation["field"]][relation["axis"]]
        except (TypeError, KeyError):
            gap = None
        globals_.append(status_check(relation["id"], relation["gap"], gap, coordinate_tolerance))
        tier = lambda value: "unavailable" if value is None else "same-tier" if abs(value) < 3.5 else "above" if value > 0 else "below"
        engineering_relations.append(status_check(relation["id"] + ".tier-order", tier(relation["gap"]), tier(gap)))
    reference_discrepancies = [{"id": item["id"], "oracleHandle": item["oracleHandle"], "category": "target-native-dimension-regeneration",
                               "visibleNominal": item["content"]["nominal"], "nativeRegeneratedNominal": item["regeneration"]["nominal"],
                               "reason": "Reference cached picture and ezdxf native regeneration disagree; actual regenerated nominal is checked against reference visible content."}
                              for item in expected["items"] if item.get("regeneration", {}).get("status") == "available" and item["regeneration"].get("nominal") != item["content"].get("nominal")]
    globals_ += compare_records(expected["geometry"], actual["geometry"], "geometry", coordinate_tolerance)
    globals_ += compare_records(expected["hatches"], actual["hatches"], "sectionHatch", coordinate_tolerance)
    source_preservation = []
    available_shapes = [(g["actualHandle"], geometry_shape(g["record"])) for g in actual["geometry"]]
    for geometry in expected["initialGeometry"]:
        candidates = [(len(differences(geometry["record"], shape, tolerance=coordinate_tolerance)), index) for index, (_, shape) in enumerate(available_shapes) if shape["type"] == geometry["record"]["type"]]
        selected = min(candidates)[1] if candidates else None
        handle, shape = available_shapes.pop(selected) if selected is not None else (None, None)
        entry = status_check("initial-source-geometry-preservation", geometry["record"], shape, coordinate_tolerance)
        entry.update(initialHandle=geometry["initialHandle"], actualHandle=handle)
        source_preservation.append(entry)
    unsupported = [{"category": "native-CAD-rendered-fonts-and-glyphs", "status": "unsupported", "reason": "Requires independent inspection in target CAD application; matching metadata does not prove glyph availability or rendering."}]
    strict_failed = sum(i["status"] == "failed" for i in item_reports) + sum(c["status"] == "failed" for c in globals_) + len(unexpected) + sum(c["status"] == "failed" for c in source_preservation)
    engineering_failed = sum(c["status"] == "failed" for i in item_reports for c in i.get("engineeringChecks", [])) + sum(c["status"] == "failed" for c in engineering_relations)
    failed = strict_failed + engineering_failed
    report = {"schemaVersion": 1, "fixtureId": expected["fixtureId"], "actualPath": str(actual_path.resolve()),
              "actualSha256": hashlib.sha256(actual_path.read_bytes()).hexdigest(), "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
              "status": "failed" if strict_failed else "reference-discrepancy" if engineering_failed else "requires-rendered-review",
              "strictReferenceChecksStatus": "failed" if strict_failed else "passed", "automatedChecksStatus": "failed" if failed else "passed",
              "summary": {"expectedItems": len(item_reports), "passedItems": sum(i["status"] == "passed" for i in item_reports), "failedItems": sum(i["status"] == "failed" for i in item_reports), "unexpectedItems": len(unexpected), "failedGlobalChecks": sum(c["status"] == "failed" for c in globals_), "failedSourcePreservationChecks": sum(c["status"] == "failed" for c in source_preservation), "unsupportedChecks": len(unsupported)},
              "items": item_reports, "unexpectedItems": unexpected, "globalChecks": globals_, "sourcePreservationChecks": source_preservation, "unsupportedChecks": unsupported,
              "referenceDiscrepancies": reference_discrepancies,
              "engineeringLayoutRelations": engineering_relations,
              "engineeringSummary": dict(collections.Counter(check["status"] for item in item_reports for check in item.get("engineeringChecks", [])))}
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": report["status"], **report["summary"], "report": str(output)}, ensure_ascii=False))
    return 1 if failed else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    freezing = commands.add_parser("freeze", help="Explicitly regenerate reviewed fixture manifest; never run during check")
    freezing.add_argument("--output", type=Path, default=MANIFEST)
    checking = commands.add_parser("check", help="Compare an independently produced DXF item by item")
    checking.add_argument("actual", type=Path)
    checking.add_argument("--manifest", type=Path, default=MANIFEST)
    checking.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "freeze":
        result = freeze(args.output)
        print(json.dumps({"manifest": str(args.output), "items": len(result["items"]), "inventory": dict(collections.Counter(i["kind"] for i in result["items"]))}))
        return 0
    return check(args.actual, args.manifest, args.report)


if __name__ == "__main__":
    sys.exit(main())
