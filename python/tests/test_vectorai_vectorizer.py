import unittest

import cv2
import numpy as np

from python.vectorai_vectorizer import fit_best_candidate, vectorize_mask


class VectorizerTests(unittest.TestCase):
    def test_vectorize_mask_returns_one_centerline_for_thick_stroke(self):
        mask = np.zeros((80, 120), dtype=np.uint8)
        cv2.line(mask, (10, 40), (110, 40), 255, 9)

        result = vectorize_mask(mask, source_id="synthetic")

        long_chains = [chain for chain in result["chains"] if chain["bounds"][2] > 90]
        self.assertEqual(len(long_chains), 1)
        self.assertEqual(long_chains[0]["candidate"]["type"], "line")

    def test_closed_ring_promotes_to_circle(self):
        angles = np.linspace(0, 2 * np.pi, 240, endpoint=False)
        points = np.column_stack((60 + 25 * np.cos(angles), 50 + 25 * np.sin(angles)))

        candidate = fit_best_candidate(points, closed=True, median_line_width=5)

        self.assertIsNotNone(candidate)
        self.assertEqual(candidate["type"], "circle")
        self.assertAlmostEqual(candidate["parameters"]["radius"], 25, delta=0.5)

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
