#!/usr/bin/env python3
"""Generate the bundled 0 < D <= 500 mm GB/T 1800.2-2020 table.

Development-only provenance tool. Runtime code consumes the generated TypeScript
file and never imports Python, pdfplumber, or the source PDF.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber

MAX_SIZE = 500.0


# Explicit column maps avoid treating printed footnote letters as tolerance positions.
CONFIGS = [
    (8, 0, 2, "internal", [("A", 2, [9,10,11,12,13]), ("B", 7, [8,9,10,11,12,13]), ("C", 13, [8,9,10,11,12,13])]),
    (9, 0, 2, "internal", [("A", 2, [9,10,11,12,13]), ("B", 7, [8,9,10,11,12,13]), ("C", 13, [8,9,10,11,12,13])]),
    (9, 1, 2, "internal", [("CD", 2, [6,7,8,9,10]), ("D", 7, [6,7,8,9,10,11,12,13]), ("E", 15, [5,6,7,8,9,10])]),
    (10, 0, 2, "internal", [("CD", 2, [6,7,8,9,10]), ("D", 7, [6,7,8,9,10,11,12,13]), ("E", 15, [5,6,7,8,9,10])]),
    (11, 0, 2, "internal", [("EF", 2, [3,4,5,6,7,8,9,10]), ("F", 10, [3,4,5,6,7,8,9,10])]),
    (12, 0, 2, "internal", [("FG", 2, [3,4,5,6,7,8,9,10]), ("G", 10, [3,4,5,6,7,8,9,10])]),
    (13, 0, 4, "internal", [("H", 2, list(range(1,19)))]),
    (14, 0, 4, "internal", [("JS", 2, list(range(1,19)))]),
    (15, 0, 2, "internal", [("J", 2, [6,7,8,9]), ("K", 6, [3,4,5,6,7,8,9,10])]),
    (16, 0, 2, "internal", [("M", 2, [3,4,5,6,7,8,9,10]), ("N", 10, [3,4,5,6,7,8,9,10,11])]),
    (17, 0, 2, "internal", [("P", 2, [3,4,5,6,7,8,9,10])]),
    (18, 0, 2, "internal", [("R", 2, [3,4,5,6,7,8,9,10])]),
    (19, 0, 2, "internal", [("R", 2, [3,4,5,6,7,8,9,10])]),
    (20, 0, 2, "internal", [("S", 2, [3,4,5,6,7,8,9,10])]),
    (21, 0, 2, "internal", [("S", 2, [3,4,5,6,7,8,9,10])]),
    (22, 0, 2, "internal", [("T", 2, [5,6,7,8]), ("U", 6, [5,6,7,8,9,10])]),
    (23, 0, 2, "internal", [("T", 2, [5,6,7,8]), ("U", 6, [5,6,7,8,9,10])]),
    (24, 0, 2, "internal", [("V", 2, [5,6,7,8]), ("X", 6, [5,6,7,8,9,10]), ("Y", 12, [6,7,8,9,10])]),
    (25, 0, 2, "internal", [("Z", 2, [6,7,8,9,10,11]), ("ZA", 8, [6,7,8,9,10,11])]),
    (26, 0, 2, "internal", [("ZB", 2, [7,8,9,10,11]), ("ZC", 7, [7,8,9,10,11])]),
    (27, 0, 2, "external", [("a", 2, [9,10,11,12,13]), ("b", 7, [8,9,10,11,12,13]), ("c", 13, [8,9,10,11,12])]),
    (28, 0, 2, "external", [("cd", 2, [5,6,7,8,9,10]), ("d", 8, [5,6,7,8,9,10,11,12,13])]),
    (29, 0, 2, "external", [("e", 2, [5,6,7,8,9,10]), ("ef", 8, [3,4,5,6,7,8,9,10])]),
    (30, 0, 2, "external", [("f", 2, [3,4,5,6,7,8,9,10]), ("fg", 10, [3,4,5,6,7,8,9,10])]),
    (31, 0, 2, "external", [("g", 2, [3,4,5,6,7,8,9,10])]),
    (32, 0, 4, "external", [("h", 2, list(range(1,19)))]),
    (33, 0, 4, "external", [("js", 2, list(range(1,19)))]),
    (34, 0, 2, "external", [("j", 2, [5,6,7,8]), ("k", 6, [3,4,5,6,7,8,9,10,11,12,13])]),
    (35, 0, 2, "external", [("m", 2, [3,4,5,6,7,8,9]), ("n", 9, [3,4,5,6,7,8,9])]),
    (36, 0, 2, "external", [("p", 2, [3,4,5,6,7,8,9,10])]),
    (37, 0, 2, "external", [("r", 2, [3,4,5,6,7,8,9,10])]),
    (38, 0, 2, "external", [("r", 2, [3,4,5,6,7,8,9,10])]),
    (39, 0, 2, "external", [("s", 2, [3,4,5,6,7,8,9,10])]),
    (40, 0, 2, "external", [("s", 2, [3,4,5,6,7,8,9,10])]),
    (41, 0, 2, "external", [("t", 2, [5,6,7,8]), ("u", 6, [5,6,7,8,9])]),
    (42, 0, 2, "external", [("t", 2, [5,6,7,8]), ("u", 6, [5,6,7,8,9])]),
    (43, 0, 2, "external", [("v", 2, [5,6,7,8]), ("x", 6, [5,6,7,8,9,10]), ("y", 12, [6,7,8,9,10])]),
    (44, 0, 2, "external", [("v", 2, [5,6,7,8]), ("x", 6, [5,6,7,8,9,10]), ("y", 12, [6,7,8,9,10])]),
    (44, 1, 2, "external", [("z", 2, [6,7,8,9,10,11]), ("za", 8, [6,7,8,9,10,11])]),
    (45, 0, 2, "external", [("z", 2, [6,7,8,9,10,11]), ("za", 8, [6,7,8,9,10,11])]),
    (46, 0, 2, "external", [("zb", 2, [7,8,9,10,11]), ("zc", 7, [7,8,9,10,11])]),
    (47, 0, 2, "external", [("zb", 2, [7,8,9,10,11]), ("zc", 7, [7,8,9,10,11])]),
]


def number(text: str | None) -> float | None:
    if not text:
        return None
    cleaned = text.replace("—", "0").replace("−", "-").replace("–", "-")
    match = re.search(r"[-+]?\d+(?:\.\d+)?", cleaned)
    return float(match.group()) if match else None


def row_range(row: list[str | None]) -> tuple[float, float] | None:
    over = number(row[0] if row else None)
    through = number(row[1] if len(row) > 1 else None)
    if over is None or through is None or through <= over or over >= MAX_SIZE:
        return None
    return over, min(through, MAX_SIZE)


def numeric_tokens(cell: str, grade: int) -> list[float]:
    clean = cell.replace("−", "-").replace("–", "-").replace("μ", "").replace("m", "")
    values = [float(value) for value in re.findall(r"[-+]?\d+(?:\.\d+)?", clean)]
    if len(values) >= 3 and values[0] == grade:
        values = values[1:]
    return values


def convert_large_grade_units(values: list[float], position: str, grade: int) -> list[float]:
    if position.lower() in {"h", "js"} and grade >= 12:
        return [value * 1000 for value in values]
    return values


def build_it_widths(pdf) -> list[tuple[float, float, dict[int, float]]]:
    table = pdf.pages[13].extract_tables()[0]
    result = []
    for row in table[4:]:
        bounds = row_range(row)
        if bounds is None:
            continue
        widths = {}
        for grade, cell in zip(range(1, 19), row[2:20]):
            values = convert_large_grade_units(numeric_tokens(cell or "", grade), "H", grade)
            if values:
                widths[grade] = max(values) - min(values + [0.0])
        result.append((*bounds, widths))
    return result


def it_width(it_rows, over: float, through: float, grade: int) -> float:
    midpoint = (over + through) / 2
    for low, high, widths in it_rows:
        if midpoint > low and midpoint <= high and grade in widths:
            return widths[grade]
    raise ValueError(f"missing IT{grade} width for ({over}, {through}]")


def deviations(values: list[float], feature: str, position: str, width: float):
    if not values:
        return None
    value = values[0]
    pos = position.upper()
    if position in {"JS", "js"}:
        return [-abs(value), abs(value)]
    if feature == "internal":
        return [value, value + width] if pos in {"A","B","C","CD","D","E","EF","F","FG","G","H"} else [value - width, value]
    return [value - width, value] if position in {"a","b","c","cd","d","e","ef","f","fg","g","h"} else [value, value + width]


def pair_with_width(values: list[float], width: float):
    """Choose an extracted upper/lower pair whose span is exactly the IT width."""
    candidates = []
    for first_index, first in enumerate(values):
        for second in values[first_index + 1:]:
            pair = [min(first, second), max(first, second)]
            if abs((pair[1] - pair[0]) - width) < 1e-6:
                candidates.append(pair)
    return candidates[-1] if candidates else None


def parse_cell(cell: str | None, next_cell: str | None, feature: str, position: str, grade: int, width: float):
    if not cell or not cell.strip():
        return None
    # JS/js is defined symmetrically around the zero line. Deriving it from the
    # independently extracted IT width also avoids decimal-point loss in PDF text.
    if position.lower() == "js":
        return [-width / 2, width / 2]
    values = convert_large_grade_units(numeric_tokens(cell, grade), position, grade)
    next_values = convert_large_grade_units(numeric_tokens(next_cell or "", grade), position, grade)
    pair = pair_with_width(values, width)
    if pair is None and values and next_values:
        # Several printed tables place the lower deviation below the nominal-size
        # rule. pdfplumber therefore attaches it to the next extracted row.
        pair = pair_with_width([values[-1], next_values[0]], width)
    if pair is not None:
        return pair
    return deviations(values, feature, position, width)


def extract(pdf):
    it_rows = build_it_widths(pdf)
    records = []
    for page_index, table_index, first_row, feature, segments in CONFIGS:
        tables = pdf.pages[page_index].extract_tables()
        if table_index >= len(tables):
            raise ValueError(f"missing table {table_index} on PDF page {page_index + 1}")
        table = tables[table_index]
        data_rows = table[first_row:]
        for row_index, row in enumerate(data_rows):
            bounds = row_range(row)
            if bounds is None:
                continue
            over, through = bounds
            for position, start, grades in segments:
                for offset, grade in enumerate(grades):
                    cell = row[start + offset] if start + offset < len(row) else None
                    if not cell or not cell.strip():
                        continue
                    next_row = data_rows[row_index + 1] if row_index + 1 < len(data_rows) else []
                    next_cell = next_row[start + offset] if start + offset < len(next_row) else None
                    width = it_width(it_rows, over, through, grade)
                    pair = parse_cell(cell, next_cell, feature, position, grade, width)
                    if pair is None:
                        continue
                    if abs((pair[1] - pair[0]) - width) > 1e-6:
                        raise ValueError(
                            f"invalid {feature} {position}{grade} width in ({over}, {through}]: "
                            f"expected {width}, got {pair} from {cell!r} / {next_cell!r}"
                        )
                    records.append({"over": over, "through": through, "feature": feature,
                                    "designation": f"{position}{grade}", "deviations": pair})
    return records


def normalize(records):
    boundaries = sorted({0.0, MAX_SIZE, *[r["over"] for r in records], *[r["through"] for r in records]})
    intervals = []
    for over, through in zip(boundaries, boundaries[1:]):
        if through <= 0 or over >= MAX_SIZE:
            continue
        midpoint = (over + through) / 2
        maps = {"internal": {}, "external": {}}
        for record in records:
            if midpoint > record["over"] and midpoint <= record["through"]:
                target = maps[record["feature"]]
                designation = record["designation"]
                pair = record["deviations"]
                if designation in target and target[designation] != pair:
                    raise ValueError(f"conflicting {designation} values in ({over}, {through}]: {target[designation]} vs {pair}")
                target[designation] = pair
        intervals.append({"over": over, "through": through, **maps})
    return intervals


def emit(intervals, output: Path):
    payload = json.dumps(intervals, ensure_ascii=False, separators=(",", ":"))
    output.write_text(
        "// SPDX-License-Identifier: Apache-2.0\n"
        "// Generated by scripts/extract-gbt1800-2020.py; do not edit manually.\n"
        "export const GBT_1800_2020_GENERATED_INTERVALS: unknown = " + payload + ";\n",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with pdfplumber.open(args.pdf) as pdf:
        intervals = normalize(extract(pdf))
    emit(intervals, args.output)
    print(f"generated {len(intervals)} intervals and {sum(len(i['internal']) + len(i['external']) for i in intervals)} cells")


if __name__ == "__main__":
    main()
