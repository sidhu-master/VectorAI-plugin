#!/usr/bin/env python3
"""Deterministic clean-line vectorization worker for VectorAI.

The process speaks newline-delimited JSON on stdin/stdout. Image pixels and
fit evidence stay in source-pixel coordinates (origin at the top-left).
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import sys
from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np
from skimage.morphology import skeletonize


PIPELINE_VERSION = "clean-line-v1"
Point = tuple[int, int]


@dataclass(frozen=True)
class TracedChain:
    points: tuple[tuple[float, float], ...]
    closed: bool


def vectorize_image_bytes(
    image_bytes: bytes,
    source_id: str,
    max_pixels: int = 4_000_000,
) -> dict:
    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_UNCHANGED)
    if image is None or image.size == 0:
        raise ValueError("IMAGE_DECODE_FAILED")
    if image.ndim == 2:
        gray = image
    elif image.shape[2] == 4:
        alpha = image[:, :, 3].astype(np.float32) / 255.0
        color = image[:, :, :3].astype(np.float32)
        composited = color * alpha[:, :, None] + 255.0 * (1.0 - alpha[:, :, None])
        gray = cv2.cvtColor(composited.astype(np.uint8), cv2.COLOR_BGR2GRAY)
    else:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    source_height, source_width = gray.shape
    if max_pixels < 1:
        raise ValueError("MAX_PIXELS_INVALID")
    factor = min(1.0, math.sqrt(max_pixels / float(source_width * source_height)))
    if factor < 1.0:
        analysis_width = max(1, int(round(source_width * factor)))
        analysis_height = max(1, int(round(source_height * factor)))
        gray = cv2.resize(gray, (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)

    _threshold, foreground = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU
    )
    if np.count_nonzero(foreground) > foreground.size * 0.5:
        foreground = cv2.bitwise_not(foreground)
    return vectorize_mask(
        foreground,
        source_id=source_id,
        source_size=(source_width, source_height),
    )


def vectorize_mask(
    mask: np.ndarray,
    source_id: str,
    source_size: tuple[int, int] | None = None,
) -> dict:
    if mask.ndim != 2 or mask.size == 0:
        raise ValueError("MASK_INVALID")
    foreground = mask.astype(bool)
    analysis_height, analysis_width = foreground.shape
    output_width, output_height = source_size or (analysis_width, analysis_height)
    scale_x = output_width / analysis_width
    scale_y = output_height / analysis_height
    scale_mean = (scale_x + scale_y) / 2.0

    skeleton = skeletonize(foreground)
    median_line_width = estimate_line_width(foreground, skeleton)
    traced = trace_stroke_chains(skeleton)
    minimum_length = max(3.0, median_line_width * 1.25)
    chains: list[dict] = []
    for chain in traced:
        if path_length(chain.points) < minimum_length:
            continue
        source_points = np.asarray(
            [(x * scale_x, y * scale_y) for x, y in chain.points],
            dtype=np.float64,
        )
        simplified = simplify_points(
            source_points,
            closed=chain.closed,
            tolerance=max(0.75, median_line_width * scale_mean * 0.22),
        )
        if len(simplified) < 2:
            continue
        candidate = fit_best_candidate(
            source_points,
            closed=chain.closed,
            median_line_width=median_line_width * scale_mean,
        )
        bounds = point_bounds(source_points)
        stable_geometry = {
            "closed": chain.closed,
            "simplified": [[round(x, 3), round(y, 3)] for x, y in simplified],
        }
        chain_id = "chain_" + hashlib.sha256(
            json.dumps(stable_geometry, separators=(",", ":"), sort_keys=True).encode("utf-8")
        ).hexdigest()[:20]
        chains.append(
            {
                "id": chain_id,
                "closed": chain.closed,
                "samples": [[round(float(x), 6), round(float(y), 6)] for x, y in source_points],
                "simplified": [[round(float(x), 6), round(float(y), 6)] for x, y in simplified],
                "bounds": [round(value, 6) for value in bounds],
                "candidate": candidate,
            }
        )
    chains.sort(
        key=lambda chain: (
            -(chain["bounds"][2] * chain["bounds"][3]),
            chain["bounds"][1],
            chain["bounds"][0],
            chain["id"],
        )
    )
    return {
        "sourceId": source_id,
        "pipelineVersion": PIPELINE_VERSION,
        "width": output_width,
        "height": output_height,
        "analysisScale": round(scale_mean, 9),
        "medianLineWidthPx": round(median_line_width * scale_mean, 6),
        "chains": chains,
    }


def estimate_line_width(foreground: np.ndarray, skeleton: np.ndarray) -> float:
    if not np.any(foreground) or not np.any(skeleton):
        return 1.0
    distance = cv2.distanceTransform(foreground.astype(np.uint8), cv2.DIST_L2, 5)
    widths = distance[skeleton] * 2.0
    positive = widths[widths > 0]
    return max(1.0, float(np.median(positive))) if positive.size else 1.0


def trace_stroke_chains(skeleton: np.ndarray) -> list[TracedChain]:
    pixels: set[Point] = {
        (int(x), int(y)) for y, x in np.argwhere(skeleton)
    }
    if not pixels:
        return []
    adjacency = {point: tuple(sorted(pixel_neighbors(point, pixels))) for point in pixels}
    node_pixels = {point for point, neighbors in adjacency.items() if len(neighbors) != 2}
    clusters = connected_clusters(node_pixels, adjacency)
    cluster_by_pixel = {
        point: index for index, cluster in enumerate(clusters) for point in cluster
    }
    centroids = [
        (
            sum(point[0] for point in cluster) / len(cluster),
            sum(point[1] for point in cluster) / len(cluster),
        )
        for cluster in clusters
    ]
    visited_edges: set[tuple[Point, Point]] = set()
    chains: list[TracedChain] = []

    for cluster_index, cluster in enumerate(clusters):
        for start_pixel in sorted(cluster):
            for neighbor in adjacency[start_pixel]:
                if cluster_by_pixel.get(neighbor) == cluster_index:
                    continue
                edge = canonical_edge(start_pixel, neighbor)
                if edge in visited_edges:
                    continue
                visited_edges.add(edge)
                points: list[tuple[float, float]] = [centroids[cluster_index]]
                previous = start_pixel
                current = neighbor
                end_cluster: int | None = None
                while True:
                    current_cluster = cluster_by_pixel.get(current)
                    if current_cluster is not None:
                        end_cluster = current_cluster
                        points.append(centroids[current_cluster])
                        break
                    points.append((float(current[0]), float(current[1])))
                    options = [candidate for candidate in adjacency[current] if candidate != previous]
                    if not options:
                        break
                    unvisited = [
                        candidate
                        for candidate in options
                        if canonical_edge(current, candidate) not in visited_edges
                    ]
                    next_pixel = min(unvisited or options)
                    next_edge = canonical_edge(current, next_pixel)
                    if next_edge in visited_edges and not unvisited:
                        break
                    visited_edges.add(next_edge)
                    previous, current = current, next_pixel
                if len(points) >= 2:
                    chains.append(
                        TracedChain(
                            points=tuple(deduplicate_consecutive(points)),
                            closed=end_cluster == cluster_index and len(points) > 3,
                        )
                    )

    for start in sorted(pixels):
        remaining = [
            neighbor
            for neighbor in adjacency[start]
            if canonical_edge(start, neighbor) not in visited_edges
        ]
        for first in remaining:
            edge = canonical_edge(start, first)
            if edge in visited_edges:
                continue
            visited_edges.add(edge)
            points: list[tuple[float, float]] = [(float(start[0]), float(start[1]))]
            previous = start
            current = first
            closed = False
            while True:
                points.append((float(current[0]), float(current[1])))
                if current == start:
                    closed = True
                    break
                options = [candidate for candidate in adjacency[current] if candidate != previous]
                unvisited = [
                    candidate
                    for candidate in options
                    if canonical_edge(current, candidate) not in visited_edges
                ]
                if not unvisited:
                    break
                next_pixel = min(unvisited)
                visited_edges.add(canonical_edge(current, next_pixel))
                previous, current = current, next_pixel
            if len(points) >= 3:
                if closed and points[-1] == points[0]:
                    points.pop()
                chains.append(TracedChain(tuple(deduplicate_consecutive(points)), closed))

    return chains


def pixel_neighbors(point: Point, pixels: set[Point]) -> Iterable[Point]:
    x, y = point
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            candidate = (x + dx, y + dy)
            if candidate not in pixels:
                continue
            if dx != 0 and dy != 0:
                if (x + dx, y) in pixels or (x, y + dy) in pixels:
                    continue
            yield candidate


def connected_clusters(
    points: set[Point],
    adjacency: dict[Point, tuple[Point, ...]],
) -> list[tuple[Point, ...]]:
    remaining = set(points)
    clusters: list[tuple[Point, ...]] = []
    while remaining:
        seed = min(remaining)
        queue = [seed]
        remaining.remove(seed)
        cluster: list[Point] = []
        for current in queue:
            cluster.append(current)
            for neighbor in adjacency[current]:
                if neighbor in remaining and neighbor in points:
                    remaining.remove(neighbor)
                    queue.append(neighbor)
        clusters.append(tuple(sorted(cluster)))
    return clusters


def fit_best_candidate(
    points: np.ndarray,
    closed: bool,
    median_line_width: float,
) -> dict | None:
    samples = np.asarray(points, dtype=np.float64)
    if samples.ndim != 2 or samples.shape[1] != 2 or len(samples) < 2:
        return None
    threshold = max(1.5, 0.5 * float(median_line_width))
    bounds = point_bounds(samples)
    diagonal = math.hypot(bounds[2], bounds[3])

    if not closed:
        line = fit_line(samples)
        if line["fitErrorP95"] <= threshold:
            return with_confidence(line, threshold)

    circle = fit_circle(samples)
    circle_allowed = (
        circle is not None
        and circle["fitErrorP95"] <= threshold
        and diagonal > 0
        and circle["parameters"]["radius"] <= diagonal * 4.0
    )
    if closed:
        ellipse = fit_ellipse(samples) if len(samples) >= 5 else None
        ellipse_allowed = ellipse is not None and ellipse["fitErrorP95"] <= threshold
        if circle_allowed and (
            not ellipse_allowed or circle["fitErrorP95"] <= ellipse["fitErrorP95"] * 1.08
        ):
            return with_confidence(circle, threshold)
        if ellipse_allowed:
            return with_confidence(ellipse, threshold)
        return None

    if circle_allowed:
        angles = np.unwrap(
            np.arctan2(
                samples[:, 1] - circle["parameters"]["center"][1],
                samples[:, 0] - circle["parameters"]["center"][0],
            )
        )
        sweep_radians = float(angles[-1] - angles[0])
        sweep_degrees = abs(math.degrees(sweep_radians))
        if 5.0 <= sweep_degrees <= 330.0:
            start_degrees = normalize_degrees(math.degrees(float(angles[0])))
            end_degrees = normalize_degrees(math.degrees(float(angles[-1])))
            arc = {
                **circle,
                "type": "arc",
                "parameters": {
                    **circle["parameters"],
                    "startAngle": start_degrees,
                    "endAngle": end_degrees,
                    "counterClockwise": sweep_radians > 0,
                    "sweepDegrees": sweep_degrees,
                },
            }
            return with_confidence(arc, threshold)
    return None


def fit_line(points: np.ndarray) -> dict:
    center = np.mean(points, axis=0)
    _, _, vectors = np.linalg.svd(points - center, full_matrices=False)
    direction = vectors[0]
    projections = (points - center) @ direction
    start = center + direction * float(np.min(projections))
    end = center + direction * float(np.max(projections))
    errors = np.abs((points - center)[:, 0] * direction[1] - (points - center)[:, 1] * direction[0])
    return fit_record(
        "line",
        {"start": point_json(start), "end": point_json(end)},
        errors,
    )


def fit_circle(points: np.ndarray) -> dict | None:
    if len(points) < 3:
        return None
    matrix = np.column_stack((2 * points[:, 0], 2 * points[:, 1], np.ones(len(points))))
    target = points[:, 0] ** 2 + points[:, 1] ** 2
    solution, _, rank, _ = np.linalg.lstsq(matrix, target, rcond=None)
    if rank < 3:
        return None
    center = solution[:2]
    radius_squared = solution[2] + float(center @ center)
    if radius_squared <= 0 or not np.isfinite(radius_squared):
        return None
    radius = math.sqrt(radius_squared)
    errors = np.abs(np.linalg.norm(points - center, axis=1) - radius)
    return fit_record(
        "circle",
        {"center": point_json(center), "radius": round(radius, 6)},
        errors,
    )


def fit_ellipse(points: np.ndarray) -> dict | None:
    if len(points) < 5:
        return None
    try:
        (cx, cy), (diameter_a, diameter_b), angle_degrees = cv2.fitEllipse(
            points.astype(np.float32).reshape(-1, 1, 2)
        )
    except cv2.error:
        return None
    if diameter_a <= 0 or diameter_b <= 0:
        return None
    major_radius = max(diameter_a, diameter_b) / 2.0
    minor_radius = min(diameter_a, diameter_b) / 2.0
    major_angle = angle_degrees + (90.0 if diameter_b > diameter_a else 0.0)
    radians = math.radians(major_angle)
    cosine, sine = math.cos(radians), math.sin(radians)
    translated = points - np.array([cx, cy])
    local_x = translated[:, 0] * cosine + translated[:, 1] * sine
    local_y = -translated[:, 0] * sine + translated[:, 1] * cosine
    radial = np.sqrt((local_x / major_radius) ** 2 + (local_y / minor_radius) ** 2)
    errors = np.abs(radial - 1.0) * major_radius
    return fit_record(
        "ellipse",
        {
            "center": [round(float(cx), 6), round(float(cy), 6)],
            "majorAxis": [
                round(cosine * major_radius, 6),
                round(sine * major_radius, 6),
            ],
            "ratio": round(minor_radius / major_radius, 9),
        },
        errors,
    )


def fit_record(candidate_type: str, parameters: dict, errors: np.ndarray) -> dict:
    finite_errors = np.asarray(errors, dtype=np.float64)
    return {
        "type": candidate_type,
        "parameters": parameters,
        "fitErrorMean": round(float(np.mean(finite_errors)), 6),
        "fitErrorP95": round(float(np.percentile(finite_errors, 95)), 6),
        "fitErrorMax": round(float(np.max(finite_errors)), 6),
        "confidence": 0.0,
    }


def with_confidence(candidate: dict, threshold: float) -> dict:
    score = 1.0 - candidate["fitErrorP95"] / max(threshold * 2.0, 1e-9)
    return {**candidate, "confidence": round(min(0.995, max(0.6, score)), 6)}


def simplify_points(points: np.ndarray, closed: bool, tolerance: float) -> list[list[float]]:
    contour = points.astype(np.float32).reshape(-1, 1, 2)
    simplified = cv2.approxPolyDP(contour, tolerance, closed).reshape(-1, 2)
    if len(simplified) > 256:
        indices = np.linspace(0, len(simplified) - 1, 256).astype(int)
        simplified = simplified[indices]
    return [[float(point[0]), float(point[1])] for point in simplified]


def point_bounds(points: np.ndarray) -> list[float]:
    minimum = np.min(points, axis=0)
    maximum = np.max(points, axis=0)
    return [
        float(minimum[0]),
        float(minimum[1]),
        max(0.5, float(maximum[0] - minimum[0])),
        max(0.5, float(maximum[1] - minimum[1])),
    ]


def path_length(points: Iterable[tuple[float, float]]) -> float:
    values = list(points)
    return sum(
        math.hypot(current[0] - previous[0], current[1] - previous[1])
        for previous, current in zip(values, values[1:])
    )


def deduplicate_consecutive(points: Iterable[tuple[float, float]]) -> list[tuple[float, float]]:
    output: list[tuple[float, float]] = []
    for point in points:
        if not output or point != output[-1]:
            output.append(point)
    return output


def canonical_edge(first: Point, second: Point) -> tuple[Point, Point]:
    return (first, second) if first <= second else (second, first)


def point_json(point: np.ndarray) -> list[float]:
    return [round(float(point[0]), 6), round(float(point[1]), 6)]


def normalize_degrees(value: float) -> float:
    return round((value % 360.0 + 360.0) % 360.0, 6)


def serve() -> None:
    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            operation = request.get("operation")
            if not isinstance(request_id, str) or not request_id:
                raise ValueError("REQUEST_ID_INVALID")
            if operation == "health":
                value = {"pipelineVersion": PIPELINE_VERSION}
            elif operation == "vectorize":
                image_base64 = request.get("imageBase64")
                source_id = request.get("sourceId")
                if not isinstance(image_base64, str) or not isinstance(source_id, str):
                    raise ValueError("VECTORIZATION_INPUT_INVALID")
                value = vectorize_image_bytes(
                    base64.b64decode(image_base64, validate=True),
                    source_id=source_id,
                    max_pixels=int(request.get("maxPixels", 4_000_000)),
                )
            else:
                raise ValueError("OPERATION_UNSUPPORTED")
            response = {"id": request_id, "ok": True, "value": value}
        except Exception as error:  # protocol boundary intentionally catches all
            response = {
                "id": request.get("id") if isinstance(locals().get("request"), dict) else None,
                "ok": False,
                "code": str(error)[:120] or "PYTHON_VECTORIZATION_ERROR",
            }
        sys.stdout.write(json.dumps(response, separators=(",", ":"), allow_nan=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    serve()
