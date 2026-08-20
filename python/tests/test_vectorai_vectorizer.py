import unittest

import cv2
import numpy as np

from python.vectorai_vectorizer import (
    TracedChain,
    assemble_closed_cycles,
    assemble_smooth_continuations,
    decompose_chain,
    fit_best_candidate,
    vectorize_mask,
)


class VectorizerTests(unittest.TestCase):
    def test_t_junction_rejoins_smooth_arc_while_preserving_branch(self):
        left_angles = np.linspace(np.pi, np.pi / 2, 80)
        right_angles = np.linspace(np.pi / 2, 0, 80)
        left = TracedChain(
            points=tuple(map(tuple, np.column_stack((50 * np.cos(left_angles), 50 * np.sin(left_angles))))),
            closed=False,
        )
        right = TracedChain(
            points=tuple(map(tuple, np.column_stack((50 * np.cos(right_angles), 50 * np.sin(right_angles))))),
            closed=False,
        )
        branch = TracedChain(points=((0, 50), (0, 70), (0, 90)), closed=False)

        assembled = assemble_smooth_continuations(
            [left, right, branch], median_line_width=4, drawing_diagonal=200,
        )

        self.assertEqual(len(assembled), 2)
        continued = max(assembled, key=lambda chain: len(chain.points))
        candidate = fit_best_candidate(
            np.asarray(continued.points), closed=False,
            median_line_width=4, drawing_diagonal=200,
        )
        self.assertEqual(candidate["type"], "arc")
        self.assertGreater(candidate["parameters"]["sweepDegrees"], 170)
        self.assertEqual(continued.continuation_assembly["sourceChainCount"], 2)
        self.assertIn(branch, assembled)

    def test_shared_endpoint_with_a_persistent_corner_stays_separate(self):
        horizontal = TracedChain(points=((-40, 0), (-20, 0), (0, 0)), closed=False)
        vertical = TracedChain(points=((0, 0), (0, 20), (0, 40)), closed=False)

        assembled = assemble_smooth_continuations(
            [horizontal, vertical], median_line_width=4, drawing_diagonal=100,
        )

        self.assertEqual(assembled, [horizontal, vertical])

    def test_two_complementary_open_branches_are_reconstructed_as_one_circle(self):
        mask = np.zeros((220, 220), dtype=np.uint8)
        cv2.circle(mask, (110, 110), 60, 255, 5)
        cv2.line(mask, (110, 10), (110, 50), 255, 5)
        cv2.line(mask, (110, 170), (110, 210), 255, 5)

        result = vectorize_mask(mask, source_id="split-ring")

        circles = [
            chain for chain in result["chains"]
            if chain["closed"]
            and chain["pieces"][0]["candidate"]
            and chain["pieces"][0]["candidate"]["type"] == "circle"
        ]
        self.assertEqual(len(circles), 1)
        self.assertAlmostEqual(circles[0]["pieces"][0]["candidate"]["parameters"]["radius"], 60, delta=2)
        self.assertEqual(circles[0]["segmentation"]["cycleAssembly"]["sourceChainCount"], 2)
        self.assertLessEqual(
            circles[0]["segmentation"]["cycleAssembly"]["fitErrorP95"],
            circles[0]["segmentation"]["fitTolerancePx"],
        )
        self.assertEqual(len(result["chains"]), 3)

    def test_open_branches_that_share_only_one_endpoint_are_not_merged(self):
        first = TracedChain(points=((0, 0), (10, 5), (20, 0)), closed=False)
        second = TracedChain(points=((20, 0), (30, -5), (40, 0)), closed=False)

        assembled = assemble_closed_cycles(
            [first, second], median_line_width=4, drawing_diagonal=100,
        )

        self.assertEqual(assembled, [first, second])

    def test_adaptive_decomposition_splits_persistent_corner_into_two_lines(self):
        horizontal = np.column_stack((np.linspace(0, 100, 101), np.zeros(101)))
        vertical = np.column_stack((np.full(301, 100), np.linspace(0, 300, 301)))
        points = np.vstack((horizontal, vertical[1:]))

        result = decompose_chain(
            points,
            closed=False,
            median_line_width=6,
            drawing_diagonal=500,
        )

        self.assertEqual(len(result["pieces"]), 2)
        self.assertEqual([piece["candidate"]["type"] for piece in result["pieces"]], ["line", "line"])
        self.assertEqual(result["pieces"][0]["sampleRange"][1], result["pieces"][1]["sampleRange"][0])
        self.assertTrue(any(decision["accepted"] for decision in result["segmentation"]["decisions"]))

    def test_adaptive_decomposition_keeps_smooth_hair_like_curve_whole(self):
        parameter = np.linspace(0, 1, 700)
        points = np.column_stack((
            100 + 800 * parameter,
            350 + 90 * np.sin(2.3 * np.pi * parameter) + 28 * np.sin(6 * np.pi * parameter),
        ))

        result = decompose_chain(
            points,
            closed=False,
            median_line_width=10,
            drawing_diagonal=np.hypot(1000, 800),
        )

        self.assertEqual(len(result["pieces"]), 1)
        self.assertIsNone(result["pieces"][0]["candidate"])

    def test_adaptive_decomposition_is_scale_invariant(self):
        first = np.column_stack((np.linspace(0, 100, 101), np.zeros(101)))
        second = np.column_stack((np.full(301, 100), np.linspace(0, 300, 301)))
        points = np.vstack((first, second[1:]))

        decisions = []
        for scale in (0.25, 0.5, 1, 2, 4):
            result = decompose_chain(
                points * scale,
                closed=False,
                median_line_width=6 * scale,
                drawing_diagonal=500 * scale,
            )
            decisions.append([piece["sampleRange"] for piece in result["pieces"]])

        self.assertTrue(all(decision == decisions[0] for decision in decisions[1:]))

    def test_adaptive_decomposition_treats_closed_chain_cyclically(self):
        vertices = np.array([[0, 0], [200, 0], [200, 100], [0, 100]], dtype=float)
        points = []
        for start, end in zip(vertices, np.vstack((vertices[1:], vertices[:1]))):
            count = int(np.linalg.norm(end - start)) + 1
            points.extend(np.linspace(start, end, count, endpoint=False))

        result = decompose_chain(
            np.asarray(points),
            closed=True,
            median_line_width=5,
            drawing_diagonal=np.hypot(200, 100),
        )

        self.assertEqual(len(result["pieces"]), 4)
        self.assertTrue(all(piece["candidate"]["type"] == "line" for piece in result["pieces"]))
        self.assertEqual(sum(1 for piece in result["pieces"] if piece["wraps"]), 1)

    def test_vectorize_mask_returns_one_centerline_for_thick_stroke(self):
        mask = np.zeros((80, 120), dtype=np.uint8)
        cv2.line(mask, (10, 40), (110, 40), 255, 9)

        result = vectorize_mask(mask, source_id="synthetic")

        long_chains = [chain for chain in result["chains"] if chain["bounds"][2] > 90]
        self.assertEqual(len(long_chains), 1)
        self.assertEqual(long_chains[0]["pieces"][0]["candidate"]["type"], "line")

    def test_closed_ring_promotes_to_circle(self):
        angles = np.linspace(0, 2 * np.pi, 240, endpoint=False)
        points = np.column_stack((60 + 25 * np.cos(angles), 50 + 25 * np.sin(angles)))

        candidate = fit_best_candidate(points, closed=True, median_line_width=5)

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["type"], "circle")
        self.assertAlmostEqual(candidate["parameters"]["radius"], 25, delta=0.5)

    def test_near_circular_raster_distortion_prefers_the_simpler_circle(self):
        angles = np.linspace(0, 2 * np.pi, 240, endpoint=False)
        points = np.column_stack((60 + 25.0 * np.cos(angles), 50 + 24.8 * np.sin(angles)))

        candidate = fit_best_candidate(
            points, closed=True, median_line_width=4, drawing_diagonal=200,
        )

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["type"], "circle")

    def test_open_semicircle_promotes_to_arc(self):
        angles = np.linspace(0, np.pi, 120)
        points = np.column_stack((60 + 25 * np.cos(angles), 50 + 25 * np.sin(angles)))

        candidate = fit_best_candidate(points, closed=False, median_line_width=5)

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["type"], "arc")
        self.assertGreater(candidate["parameters"]["sweepDegrees"], 170)

    def test_low_curvature_chain_does_not_become_huge_circle(self):
        x = np.linspace(0, 100, 100)
        points = np.column_stack((x, 20 + 0.001 * x * x))

        candidate = fit_best_candidate(points, closed=False, median_line_width=3)

        self.assertNotEqual(candidate and candidate["type"], "arc")

    def test_unfittable_curve_remains_polyline(self):
        points = np.array(
            [[0, 0], [20, 10], [5, 30], [35, 40], [10, 60]],
            dtype=float,
        )

        candidate = fit_best_candidate(points, closed=False, median_line_width=2)

        self.assertIsNone(candidate)

if __name__ == "__main__":
    unittest.main()
