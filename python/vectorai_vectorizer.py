#!/usr/bin/env python3
"""Deterministic clean-line vectorization worker for VectorAI.

The process speaks newline-delimited JSON on stdin/stdout. Image pixels and
fit evidence stay in source-pixel coordinates (origin at the top-left).
"""

from __future__ import annotations

import base64
import hashlib
import importlib.metadata
import json
import math
import sys
from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np
from skimage.morphology import skeletonize


PIPELINE_VERSION = "clean-line-v5"
PROTOCOL_VERSION = "vectorai-vectorizer-1"
Point = tuple[int, int]


def health_metadata() -> dict:
    return {
        "protocolVersion": PROTOCOL_VERSION,
        "pipelineVersion": PIPELINE_VERSION,
        "pythonVersion": ".".join(map(str, sys.version_info[:3])),
        "dependencies": {
            "numpy": importlib.metadata.version("numpy"),
            "opencv-python-headless": importlib.metadata.version("opencv-python-headless"),
            "scikit-image": importlib.metadata.version("scikit-image"),
        },
    }


@dataclass(frozen=True)
class TracedChain:
    points: tuple[tuple[float, float], ...]
    closed: bool
    cycle_assembly: dict | None = None
    continuation_assembly: dict | None = None


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
    drawing_diagonal = math.hypot(output_width, output_height)

    skeleton = skeletonize(foreground)
    median_line_width = estimate_line_width(foreground, skeleton)
    traced = assemble_smooth_continuations(
        trace_stroke_chains(skeleton),
        median_line_width=median_line_width,
        drawing_diagonal=math.hypot(analysis_width, analysis_height),
    )
    traced = assemble_closed_cycles(
        traced,
        median_line_width=median_line_width,
        drawing_diagonal=math.hypot(analysis_width, analysis_height),
    )
    output_line_width = median_line_width * scale_mean
    minimum_length = max(output_line_width * 1.25, drawing_diagonal * 0.0003)
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
            tolerance=max(output_line_width * 0.22, drawing_diagonal * 0.00015),
        )
        if len(simplified) < 2:
            continue
        decomposition = decompose_chain(
            source_points,
            closed=chain.closed,
            median_line_width=output_line_width,
            drawing_diagonal=drawing_diagonal,
        )
        if chain.cycle_assembly is not None:
            decomposition["segmentation"]["cycleAssembly"] = chain.cycle_assembly
        if chain.continuation_assembly is not None:
            decomposition["segmentation"]["continuationAssembly"] = chain.continuation_assembly
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
                "pieces": decomposition["pieces"],
                "segmentation": decomposition["segmentation"],
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
        "medianLineWidthPx": round(output_line_width, 6),
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


def assemble_closed_cycles(
    chains: list[TracedChain],
    median_line_width: float,
    drawing_diagonal: float,
) -> list[TracedChain]:
    """Join complementary graph branches only when their union fits one circle."""
    if median_line_width <= 0 or drawing_diagonal <= 0:
        raise ValueError("CYCLE_ASSEMBLY_SCALE_INVALID")
    endpoint_tolerance = max(0.25 * median_line_width, 0.0001 * drawing_diagonal)
    fit_tolerance = adaptive_fit_tolerance(median_line_width, drawing_diagonal)
    candidates: list[tuple[float, int, int, TracedChain]] = []
    for left_index, left in enumerate(chains):
        if left.closed or len(left.points) < 3:
            continue
        for right_index in range(left_index + 1, len(chains)):
            right = chains[right_index]
            if right.closed or len(right.points) < 3:
                continue
            combined = complementary_cycle_points(left, right, endpoint_tolerance)
            if combined is None:
                continue
            fit = fit_circle(combined)
            if fit is None or fit["fitErrorP95"] > fit_tolerance:
                continue
            bounds = point_bounds(combined)
            diameter = 2.0 * float(fit["parameters"]["radius"])
            if diameter > max(bounds[2], bounds[3]) * 1.2:
                continue
            candidates.append((
                float(fit["fitErrorP95"]),
                left_index,
                right_index,
                TracedChain(
                    points=tuple(map(tuple, combined)),
                    closed=True,
                    cycle_assembly={
                        "sourceChainCount": 2,
                        "endpointTolerancePx": round(float(endpoint_tolerance), 6),
                        "fitTolerancePx": round(float(fit_tolerance), 6),
                        "fitErrorP95": round(float(fit["fitErrorP95"]), 6),
                        "reason": "shared-endpoints-circle-fit",
                    },
                ),
            ))

    consumed: set[int] = set()
    cycles: list[TracedChain] = []
    for _error, left_index, right_index, cycle in sorted(candidates):
        if left_index in consumed or right_index in consumed:
            continue
        consumed.update((left_index, right_index))
        cycles.append(cycle)
    return [chain for index, chain in enumerate(chains) if index not in consumed] + cycles


def assemble_smooth_continuations(
    chains: list[TracedChain],
    median_line_width: float,
    drawing_diagonal: float,
) -> list[TracedChain]:
    """Reconnect analytic paths split only because a skeleton node has branches."""
    if median_line_width <= 0 or drawing_diagonal <= 0:
        raise ValueError("CONTINUATION_ASSEMBLY_SCALE_INVALID")
    endpoint_tolerance = max(0.25 * median_line_width, 0.0001 * drawing_diagonal)
    tangent_window = max(2.0 * median_line_width, 0.0015 * drawing_diagonal)
    minimum_span = max(2.0 * median_line_width, 0.001 * drawing_diagonal)
    minimum_cosine = math.cos(math.radians(35.0))
    fit_tolerance = adaptive_fit_tolerance(median_line_width, drawing_diagonal)
    current = list(chains)

    while True:
        candidates: list[tuple[float, int, int, TracedChain]] = []
        for left_index, left in enumerate(current):
            if left.closed or path_length(left.points) < minimum_span:
                continue
            for right_index in range(left_index + 1, len(current)):
                right = current[right_index]
                if right.closed or path_length(right.points) < minimum_span:
                    continue
                joined = join_at_shared_endpoint(left, right, endpoint_tolerance)
                if joined is None:
                    continue
                combined, shared_index = joined
                incoming = tangent_before(combined, shared_index, tangent_window)
                outgoing = tangent_after(combined, shared_index, tangent_window)
                if incoming is None or outgoing is None:
                    continue
                tangent_cosine = float(np.dot(incoming, outgoing))
                if tangent_cosine < minimum_cosine:
                    continue
                fit = fit_best_candidate(
                    combined,
                    closed=False,
                    median_line_width=median_line_width,
                    drawing_diagonal=drawing_diagonal,
                )
                if fit is None or fit["type"] not in ("line", "arc"):
                    continue
                fit_error = float(fit["fitErrorP95"])
                score = fit_error / fit_tolerance + (1.0 - tangent_cosine)
                source_count = continuation_source_count(left) + continuation_source_count(right)
                candidates.append((
                    score,
                    left_index,
                    right_index,
                    TracedChain(
                        points=tuple(map(tuple, combined)),
                        closed=False,
                        continuation_assembly={
                            "sourceChainCount": source_count,
                            "endpointTolerancePx": round(float(endpoint_tolerance), 6),
                            "fitTolerancePx": round(float(fit_tolerance), 6),
                            "fitErrorP95": round(fit_error, 6),
                            "tangentCosine": round(tangent_cosine, 6),
                            "modelType": fit["type"],
                            "reason": "shared-endpoint-smooth-analytic-fit",
                        },
                    ),
                ))

        consumed: set[int] = set()
        assembled: list[TracedChain] = []
        for _score, left_index, right_index, chain in sorted(candidates):
            if left_index in consumed or right_index in consumed:
                continue
            consumed.update((left_index, right_index))
            assembled.append(chain)
        if not assembled:
            return current
        current = [chain for index, chain in enumerate(current) if index not in consumed] + assembled


def join_at_shared_endpoint(
    left: TracedChain,
    right: TracedChain,
    endpoint_tolerance: float,
) -> tuple[np.ndarray, int] | None:
    left_points = np.asarray(left.points, dtype=np.float64)
    right_points = np.asarray(right.points, dtype=np.float64)
    orientations = (
        (left_points, right_points),
        (left_points, right_points[::-1]),
        (left_points[::-1], right_points),
        (left_points[::-1], right_points[::-1]),
    )
    matches: list[tuple[float, np.ndarray, int]] = []
    for before, after in orientations:
        distance = float(np.linalg.norm(before[-1] - after[0]))
        if distance > endpoint_tolerance:
            continue
        shared = (before[-1] + after[0]) / 2.0
        combined = np.vstack((before[:-1], shared, after[1:]))
        matches.append((distance, combined, len(before) - 1))
    if not matches:
        return None
    _distance, combined, shared_index = min(matches, key=lambda item: item[0])
    return combined, shared_index


def tangent_before(points: np.ndarray, index: int, window: float) -> np.ndarray | None:
    anchor = points[index]
    for candidate in range(index - 1, -1, -1):
        vector = anchor - points[candidate]
        length = float(np.linalg.norm(vector))
        if length >= window or candidate == 0:
            return vector / length if length > 1e-12 else None
    return None


def tangent_after(points: np.ndarray, index: int, window: float) -> np.ndarray | None:
    anchor = points[index]
    for candidate in range(index + 1, len(points)):
        vector = points[candidate] - anchor
        length = float(np.linalg.norm(vector))
        if length >= window or candidate == len(points) - 1:
            return vector / length if length > 1e-12 else None
    return None


def continuation_source_count(chain: TracedChain) -> int:
    if chain.continuation_assembly is None:
        return 1
    return int(chain.continuation_assembly["sourceChainCount"])


def complementary_cycle_points(
    left: TracedChain,
    right: TracedChain,
    endpoint_tolerance: float,
) -> np.ndarray | None:
    left_points = np.asarray(left.points, dtype=np.float64)
    right_points = np.asarray(right.points, dtype=np.float64)
    for oriented in (right_points[::-1], right_points):
        if (
            np.linalg.norm(left_points[0] - oriented[-1]) <= endpoint_tolerance
            and np.linalg.norm(left_points[-1] - oriented[0]) <= endpoint_tolerance
        ):
            return np.vstack((left_points, oriented[1:-1]))
    return None


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


def decompose_chain(
    points: np.ndarray,
    closed: bool,
    median_line_width: float,
    drawing_diagonal: float,
) -> dict:
    """Decompose one traced stroke without using absolute pixel thresholds."""
    samples = np.asarray(points, dtype=np.float64)
    if samples.ndim != 2 or samples.shape[1] != 2 or len(samples) < 2:
        raise ValueError("CHAIN_POINTS_INVALID")
    if not np.all(np.isfinite(samples)):
        raise ValueError("CHAIN_POINTS_NON_FINITE")
    if median_line_width <= 0 or drawing_diagonal <= 0:
        raise ValueError("CHAIN_SCALE_INVALID")

    chain_length = closed_path_length(samples, closed)
    fit_tolerance = adaptive_fit_tolerance(median_line_width, drawing_diagonal)
    near_window = max(2.0 * median_line_width, 0.0025 * drawing_diagonal)
    far_window = max(4.0 * median_line_width, 0.005 * drawing_diagonal)
    minimum_span = max(
        4.0 * median_line_width,
        0.005 * drawing_diagonal,
        0.03 * chain_length,
    )
    segmentation = {
        "algorithmVersion": PIPELINE_VERSION,
        "drawingDiagonalPx": round(float(drawing_diagonal), 6),
        "chainLengthPx": round(float(chain_length), 6),
        "fitTolerancePx": round(float(fit_tolerance), 6),
        "nearWindowPx": round(float(near_window), 6),
        "farWindowPx": round(float(far_window), 6),
        "minimumSpanPx": round(float(minimum_span), 6),
        "splitPenalty": 1.5,
        "decisions": [],
    }
    whole_candidate = fit_best_candidate(
        samples,
        closed=closed,
        median_line_width=median_line_width,
        drawing_diagonal=drawing_diagonal,
    )
    if whole_candidate is not None:
        return {
            "pieces": [build_chain_piece(
                samples,
                closed=closed,
                start_index=0,
                end_index=len(samples) - 1,
                wraps=closed,
                median_line_width=median_line_width,
                drawing_diagonal=drawing_diagonal,
                candidate=whole_candidate,
            )],
            "segmentation": segmentation,
        }

    split_indices, decisions = adaptive_split_indices(
        samples,
        closed=closed,
        median_line_width=median_line_width,
        drawing_diagonal=drawing_diagonal,
        near_window=near_window,
        far_window=far_window,
        minimum_span=minimum_span,
        fit_tolerance=fit_tolerance,
    )
    segmentation["decisions"] = decisions
    if closed and len(split_indices) < 2:
        split_indices = []
    ranges = piece_ranges(len(samples), split_indices, closed)
    pieces = []
    for start_index, end_index, wraps in ranges:
        piece_points = range_points(samples, start_index, end_index, wraps)
        candidate = fit_best_candidate(
            piece_points,
            closed=closed and len(ranges) == 1,
            median_line_width=median_line_width,
            drawing_diagonal=drawing_diagonal,
        )
        pieces.append(build_chain_piece(
            piece_points,
            closed=closed and len(ranges) == 1,
            start_index=start_index,
            end_index=end_index,
            wraps=wraps,
            median_line_width=median_line_width,
            drawing_diagonal=drawing_diagonal,
            candidate=candidate,
        ))
    return {"pieces": pieces, "segmentation": segmentation}


def adaptive_split_indices(
    points: np.ndarray,
    closed: bool,
    median_line_width: float,
    drawing_diagonal: float,
    near_window: float,
    far_window: float,
    minimum_span: float,
    fit_tolerance: float,
) -> tuple[list[int], list[dict]]:
    chain_length = closed_path_length(points, closed)
    locations = vertex_locations(points, closed)
    proposals: list[dict] = []
    for index in range(len(points)):
        if not closed and (
            locations[index] < minimum_span
            or chain_length - locations[index] < minimum_span
        ):
            continue
        near_angle = tangent_change(points, index, near_window, closed)
        far_angle = tangent_change(points, index, far_window, closed)
        maximum_angle = max(near_angle, far_angle)
        stability = min(near_angle, far_angle) / max(maximum_angle, 1e-12)
        if min(near_angle, far_angle) < 28.0 or stability < 0.78:
            continue
        proposals.append({
            "sampleIndex": index,
            "nearAngleDegrees": near_angle,
            "farAngleDegrees": far_angle,
            "stability": stability,
            "cornerScore": min(near_angle, far_angle) + 0.25 * maximum_angle,
        })

    corner_zone = max(median_line_width, 0.001 * drawing_diagonal)
    proposals = non_maximum_suppression(
        proposals,
        locations,
        chain_length,
        corner_zone,
        closed,
    )
    refined: list[dict] = []
    refinement_radius = 2.0 * median_line_width
    support = max(8.0 * median_line_width, 0.01 * drawing_diagonal, 0.08 * chain_length)
    for proposal in proposals:
        candidates = nearby_indices(
            locations,
            proposal["sampleIndex"],
            refinement_radius,
            chain_length,
            closed,
        )
        best: dict | None = None
        for index in candidates:
            if not closed and (
                locations[index] < minimum_span
                or chain_length - locations[index] < minimum_span
            ):
                continue
            before = directional_window(points, index, support, -1, closed)
            after = directional_window(points, index, support, 1, closed)
            if len(before) < 4 or len(after) < 4:
                continue
            combined = np.vstack((before[:-1], after))
            left_candidate = fit_best_candidate(
                before,
                closed=False,
                median_line_width=median_line_width,
                drawing_diagonal=drawing_diagonal,
            )
            right_candidate = fit_best_candidate(
                after,
                closed=False,
                median_line_width=median_line_width,
                drawing_diagonal=drawing_diagonal,
            )
            child_errors = [
                candidate["fitErrorP95"]
                for candidate in (left_candidate, right_candidate)
                if candidate is not None
            ]
            if len(child_errors) != 2:
                continue
            combined_error = best_open_fit_error(combined)
            child_error = sum(child_errors) / 2.0
            split_gain = (combined_error - child_error) / fit_tolerance
            accept_score = split_gain - 1.5
            result = {
                **proposal,
                "sampleIndex": index,
                "combinedFitErrorP95": combined_error,
                "childFitErrorP95": child_errors,
                "splitGain": split_gain,
                "acceptScore": accept_score,
                "accepted": accept_score > 0,
                "reason": "accepted" if accept_score > 0 else "complexity-penalty",
            }
            if best is None or result["acceptScore"] > best["acceptScore"]:
                best = result
        if best is None:
            best = {
                **proposal,
                "combinedFitErrorP95": None,
                "childFitErrorP95": [],
                "splitGain": None,
                "acceptScore": None,
                "accepted": False,
                "reason": "child-fit-rejected",
            }
        refined.append(best)

    accepted = [item for item in refined if item["accepted"]]
    accepted = non_maximum_suppression(
        accepted,
        locations,
        chain_length,
        minimum_span,
        closed,
        score_key="acceptScore",
    )
    accepted_indices = {item["sampleIndex"] for item in accepted}
    decisions = []
    for item in refined:
        value = {**item, "accepted": item["sampleIndex"] in accepted_indices}
        if item["accepted"] and not value["accepted"]:
            value["reason"] = "minimum-span"
        decisions.append(round_decision(value))
    return sorted(accepted_indices), decisions


def non_maximum_suppression(
    candidates: list[dict],
    locations: np.ndarray,
    chain_length: float,
    minimum_distance: float,
    closed: bool,
    score_key: str = "cornerScore",
) -> list[dict]:
    selected: list[dict] = []
    for candidate in sorted(candidates, key=lambda item: item[score_key], reverse=True):
        location = locations[candidate["sampleIndex"]]
        if any(
            path_distance(
                location,
                locations[item["sampleIndex"]],
                chain_length,
                closed,
            ) < minimum_distance
            for item in selected
        ):
            continue
        selected.append(candidate)
    return sorted(selected, key=lambda item: item["sampleIndex"])


def tangent_change(points: np.ndarray, index: int, radius: float, closed: bool) -> float:
    before = directional_window(points, index, radius, -1, closed)
    after = directional_window(points, index, radius, 1, closed)
    if len(before) < 3 or len(after) < 3:
        return 0.0
    incoming = pca_direction(before)
    outgoing = pca_direction(after)
    cosine = float(np.clip(np.dot(incoming, outgoing), -1.0, 1.0))
    return math.degrees(math.acos(cosine))


def directional_window(
    points: np.ndarray,
    index: int,
    radius: float,
    direction: int,
    closed: bool,
) -> np.ndarray:
    indices = [index]
    distance_sum = 0.0
    current = index
    maximum_steps = len(points) - 1 if closed else len(points)
    for _step in range(maximum_steps):
        following = current + direction
        if closed:
            following %= len(points)
        elif following < 0 or following >= len(points):
            break
        distance_sum += float(np.linalg.norm(points[following] - points[current]))
        indices.append(following)
        current = following
        if distance_sum >= radius:
            break
    if direction < 0:
        indices.reverse()
    return points[indices]


def pca_direction(points: np.ndarray) -> np.ndarray:
    centered = points - np.mean(points, axis=0)
    _left, _values, vectors = np.linalg.svd(centered, full_matrices=False)
    direction = vectors[0]
    if float(np.dot(direction, points[-1] - points[0])) < 0:
        direction = -direction
    length = float(np.linalg.norm(direction))
    return direction / max(length, 1e-12)


def best_open_fit_error(points: np.ndarray) -> float:
    line_error = float(fit_line(points)["fitErrorP95"])
    circle = fit_circle_through_endpoints(points)
    if circle is None:
        return line_error
    bounds = point_bounds(points)
    diagonal = math.hypot(bounds[2], bounds[3])
    radius = circle["parameters"]["radius"]
    if diagonal <= 0 or radius > diagonal * 4.0:
        return line_error
    angles = np.unwrap(np.arctan2(
        points[:, 1] - circle["parameters"]["center"][1],
        points[:, 0] - circle["parameters"]["center"][0],
    ))
    sweep = abs(math.degrees(float(angles[-1] - angles[0])))
    return min(line_error, float(circle["fitErrorP95"])) if 5.0 <= sweep <= 330.0 else line_error


def piece_ranges(
    sample_count: int,
    split_indices: list[int],
    closed: bool,
) -> list[tuple[int, int, bool]]:
    if not split_indices:
        return [(0, sample_count - 1, closed)]
    ordered = sorted(set(split_indices))
    if not closed:
        boundaries = [0, *ordered, sample_count - 1]
        return [
            (start, end, False)
            for start, end in zip(boundaries, boundaries[1:])
            if end > start
        ]
    return [
        (start, ordered[(index + 1) % len(ordered)], index == len(ordered) - 1)
        for index, start in enumerate(ordered)
    ]


def range_points(
    points: np.ndarray,
    start_index: int,
    end_index: int,
    wraps: bool,
) -> np.ndarray:
    if not wraps:
        return points[start_index:end_index + 1]
    if start_index == 0 and end_index == len(points) - 1:
        return points
    return np.vstack((points[start_index:], points[:end_index + 1]))


def build_chain_piece(
    points: np.ndarray,
    closed: bool,
    start_index: int,
    end_index: int,
    wraps: bool,
    median_line_width: float,
    drawing_diagonal: float,
    candidate: dict | None,
) -> dict:
    tolerance = max(median_line_width * 0.22, drawing_diagonal * 0.00015)
    simplified = simplify_points(points, closed=closed, tolerance=tolerance)
    stable = {
        "closed": closed,
        "sampleRange": [start_index, end_index],
        "wraps": wraps,
        "simplified": [[round(x, 3), round(y, 3)] for x, y in simplified],
    }
    piece_id = "piece_" + hashlib.sha256(
        json.dumps(stable, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).hexdigest()[:20]
    return {
        "id": piece_id,
        "sampleRange": [start_index, end_index],
        "wraps": wraps,
        "closed": closed,
        "simplified": [[round(float(x), 6), round(float(y), 6)] for x, y in simplified],
        "bounds": [round(value, 6) for value in point_bounds(points)],
        "candidate": candidate,
    }


def vertex_locations(points: np.ndarray, closed: bool) -> np.ndarray:
    distances = np.linalg.norm(np.diff(points, axis=0), axis=1)
    return np.concatenate(([0.0], np.cumsum(distances)))


def closed_path_length(points: np.ndarray, closed: bool) -> float:
    length = float(np.sum(np.linalg.norm(np.diff(points, axis=0), axis=1)))
    return length + (float(np.linalg.norm(points[0] - points[-1])) if closed else 0.0)


def path_distance(
    left: float,
    right: float,
    chain_length: float,
    closed: bool,
) -> float:
    direct = abs(left - right)
    return min(direct, chain_length - direct) if closed else direct


def nearby_indices(
    locations: np.ndarray,
    center_index: int,
    radius: float,
    chain_length: float,
    closed: bool,
) -> list[int]:
    center = float(locations[center_index])
    return [
        index
        for index, location in enumerate(locations)
        if path_distance(center, float(location), chain_length, closed) <= radius
    ]


def round_decision(value: dict) -> dict:
    rounded = {}
    for key, item in value.items():
        if isinstance(item, (float, np.floating)):
            rounded[key] = round(float(item), 6)
        elif isinstance(item, list):
            rounded[key] = [
                round(float(entry), 6) if isinstance(entry, (float, np.floating)) else entry
                for entry in item
            ]
        else:
            rounded[key] = item
    return rounded


def adaptive_fit_tolerance(median_line_width: float, drawing_diagonal: float) -> float:
    return max(0.5 * float(median_line_width), 0.0003 * float(drawing_diagonal))


def fit_best_candidate(
    points: np.ndarray,
    closed: bool,
    median_line_width: float,
    drawing_diagonal: float | None = None,
) -> dict | None:
    samples = np.asarray(points, dtype=np.float64)
    if samples.ndim != 2 or samples.shape[1] != 2 or len(samples) < 2:
        return None
    source_diagonal = drawing_diagonal if drawing_diagonal is not None else math.hypot(
        *point_bounds(samples)[2:]
    )
    threshold = adaptive_fit_tolerance(median_line_width, source_diagonal)
    bounds = point_bounds(samples)
    diagonal = math.hypot(bounds[2], bounds[3])

    if not closed:
        line = fit_line(samples)
        if line["fitErrorP95"] <= threshold:
            return with_confidence(line, threshold)

    circle = fit_circle(samples) if closed else fit_circle_through_endpoints(samples)
    circle_allowed = (
        circle is not None
        and circle["fitErrorP95"] <= threshold
        and diagonal > 0
        and circle["parameters"]["radius"] <= diagonal * 4.0
    )
    if closed:
        ellipse = fit_ellipse(samples) if len(samples) >= 5 else None
        ellipse_allowed = ellipse is not None and ellipse["fitErrorP95"] <= threshold
        ellipse_deviation = None if ellipse is None else (
            float(np.linalg.norm(ellipse["parameters"]["majorAxis"]))
            * (1.0 - float(ellipse["parameters"]["ratio"]))
        )
        circle_is_indistinguishable = (
            circle_allowed
            and ellipse_allowed
            and ellipse_deviation is not None
            and ellipse_deviation <= threshold
        )
        if circle_allowed and (
            not ellipse_allowed
            or circle_is_indistinguishable
            or circle["fitErrorP95"] <= ellipse["fitErrorP95"] * 1.08
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
    """Fit the best supporting line; compound-path junctions are resolved later."""
    return fit_unconstrained_line(points)


def fit_unconstrained_line(points: np.ndarray) -> dict:
    center = np.mean(points, axis=0)
    _, _, vectors = np.linalg.svd(points - center, full_matrices=False)
    direction = vectors[0]
    if float(np.dot(direction, points[-1] - points[0])) < 0:
        direction = -direction
    projections = (points - center) @ direction
    start = center + direction * float(np.min(projections))
    end = center + direction * float(np.max(projections))
    errors = np.abs(
        (points - center)[:, 0] * direction[1]
        - (points - center)[:, 1] * direction[0]
    )
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
        {"center": point_json(center), "radius": round(radius, 9)},
        errors,
    )


def fit_circle_through_endpoints(points: np.ndarray) -> dict | None:
    """Fit an open circular segment constrained through both source endpoints."""
    if len(points) < 3:
        return None
    start = points[0]
    end = points[-1]
    chord = end - start
    chord_length = float(np.linalg.norm(chord))
    if chord_length <= 1e-12:
        return None
    midpoint = (start + end) / 2.0
    normal = np.array([-chord[1], chord[0]], dtype=np.float64) / chord_length
    local = points - midpoint
    coefficient = 2.0 * (local @ normal)
    target = np.sum(local * local, axis=1) - chord_length * chord_length / 4.0
    denominator = float(coefficient @ coefficient)
    if denominator <= 1e-12:
        return None
    offset = float(coefficient @ target) / denominator
    center = midpoint + offset * normal
    radius = math.hypot(chord_length / 2.0, offset)
    if radius <= 0 or not np.isfinite(radius):
        return None
    errors = np.abs(np.linalg.norm(points - center, axis=1) - radius)
    return fit_record(
        "circle",
        {"center": point_json(center), "radius": round(radius, 9)},
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
    return [round(float(point[0]), 9), round(float(point[1]), 9)]


def normalize_degrees(value: float) -> float:
    return round((value % 360.0 + 360.0) % 360.0, 9)


def serve() -> None:
    for raw_line in sys.stdin:
        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            operation = request.get("operation")
            if not isinstance(request_id, str) or not request_id:
                raise ValueError("REQUEST_ID_INVALID")
            if operation == "health":
                value = health_metadata()
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
