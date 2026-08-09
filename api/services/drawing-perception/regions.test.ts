import { describe, expect, it } from 'vitest';

import {
  deduplicateGeometryObservations,
  projectGlobalContoursToRegion,
  planPerceptionRegions,
  stitchAnnotationObservation,
  stitchContourEvidence,
  stitchGeometryObservation,
  stitchGlobalContour,
} from './regions.js';
import type {
  AnnotationObservation,
  ContourEvidence,
  DrawingView,
  GeometryObservation,
  GlobalContour,
} from './types.js';

const primaryView: DrawingView = {
  id: 'view_primary', kind: 'primary', imageBounds: [0.02, 0.02, 0.96, 0.96], confidence: 0.95,
};

describe('drawing perception regions', () => {
  it('tiles a page-sized portrait view along its long axis without semantic assumptions', () => {
    const regions = planPerceptionRegions(primaryView, { heightToWidthRatio: 1.5 });

    expect(regions).toHaveLength(3);
    expect(regions.map((region) => region.id)).toEqual([
      'view_primary_region_1', 'view_primary_region_2', 'view_primary_region_3',
    ]);
    expect(regions.every((region) => region.viewId === 'view_primary')).toBe(true);
    expect(regions[0].pageBounds[1]).toBe(0.02);
    expect(regions[0].pageBounds[1] + regions[0].pageBounds[3])
      .toBeGreaterThan(regions[1].pageBounds[1]);
    expect(regions.at(-1)!.pageBounds[1] + regions.at(-1)!.pageBounds[3]).toBeCloseTo(0.98);
  });

  it('keeps already segmented views as one perception region', () => {
    const regions = planPerceptionRegions({
      id: 'view_detail', kind: 'detail', imageBounds: [0.1, 0.2, 0.4, 0.3], confidence: 0.9,
    }, { heightToWidthRatio: 1.5 });

    expect(regions).toEqual([{
      id: 'view_detail_region_1', viewId: 'view_detail', pageBounds: [0.1, 0.2, 0.4, 0.3],
    }]);
  });

  it('stitches crop-local geometry and OCR evidence into page/CAD coordinates', () => {
    const region = {
      id: 'view_primary_region_2', viewId: 'view_primary',
      pageBounds: [0.1, 0.4, 0.8, 0.2] as [number, number, number, number],
    };
    const geometry: GeometryObservation = {
      id: 'geom_001', viewId: region.id, type: 'circle', imageBounds: [0.25, 0.25, 0.5, 0.5],
      measuredParams: { center: [0.5, 0.5], radius: 0.1 }, confidence: 0.9,
    };
    const annotation: AnnotationObservation = {
      id: 'ann_001', viewId: region.id, kind: 'diameter', rawText: 'Ø10', value: 10,
      imageBounds: [0.25, 0.25, 0.5, 0.5], arrowheads: [[0.5, 0.5]], confidence: 0.8,
    };

    expect(stitchGeometryObservation(geometry, region, 1.5)).toMatchObject({
      id: 'view_primary_region_2__geom_001', viewId: 'view_primary',
      imageBounds: [0.3, 0.45, 0.4, 0.1],
      measuredParams: { center: [250, 375], radius: 40 },
    });
    expect(stitchAnnotationObservation(annotation, region)).toMatchObject({
      id: 'view_primary_region_2__ann_001', viewId: 'view_primary',
      imageBounds: [0.3, 0.45, 0.4, 0.1], arrowheads: [[0.5, 0.5]],
    });
  });

  it('converts image-down points, vectors, and arc winding into CAD Y-up coordinates', () => {
    const region = {
      id: 'view_orientation_region_1', viewId: 'view_orientation',
      pageBounds: [0.1, 0.2, 0.4, 0.4] as [number, number, number, number],
    };

    expect(stitchGeometryObservation({
      id: 'point_top', viewId: region.id, type: 'point', imageBounds: [0.4, 0.2, 0.1, 0.1],
      measuredParams: { x: 0.5, y: 0.25 }, confidence: 0.9,
    }, region, 2)).toMatchObject({
      measuredParams: { x: 150, y: 700 },
    });
    expect(stitchGeometryObservation({
      id: 'vertical_axis', viewId: region.id, type: 'xline', imageBounds: [0.5, 0, 0.01, 1],
      measuredParams: { origin: [0.5, 0.25], direction: [0, 1] }, confidence: 0.9,
    }, region, 2)).toMatchObject({
      measuredParams: { origin: [150, 700], direction: [0, -1] },
    });
    expect(stitchGeometryObservation({
      id: 'upper_arc', viewId: region.id, type: 'arc', imageBounds: [0.2, 0.1, 0.4, 0.2],
      measuredParams: {
        center: [0.5, 0.25], radius: 0.2,
        startAngle: 0, endAngle: 90, counterClockwise: true,
      },
      confidence: 0.9,
    }, region, 2)).toMatchObject({
      measuredParams: {
        center: [150, 700], radius: 40,
        startAngle: 0, endAngle: 270, counterClockwise: false,
      },
    });
  });

  it('deduplicates overlapping crop detections but preserves distinct concentric circles', () => {
    const observations: GeometryObservation[] = [
      circle('region_1_circle', [0.4, 0.3, 0.2, 0.2], [0.5, 0.6], 0.1, 0.84),
      circle('region_2_circle', [0.405, 0.305, 0.2, 0.2], [0.501, 0.601], 0.101, 0.92),
      circle('concentric_feature', [0.43, 0.33, 0.14, 0.14], [0.5, 0.6], 0.07, 0.88),
    ];

    expect(deduplicateGeometryObservations(observations).map((item) => item.id)).toEqual([
      'region_2_circle', 'concentric_feature',
    ]);
  });

  it('keeps whole-view contour identity while projecting it into regional reads', () => {
    const wholeView = {
      id: 'view_primary_global', viewId: 'view_primary',
      pageBounds: [0.1, 0.2, 0.8, 0.6] as [number, number, number, number],
    };
    const contour: GlobalContour = {
      id: 'outer', viewId: wholeView.id, geometryFamily: 'circle',
      imageBounds: [0.1, 0.1, 0.8, 0.8], closed: true, confidence: 0.92,
      coarseParams: { center: [0.5, 0.5], radius: 0.4 },
    };
    const stitched = stitchGlobalContour(contour, wholeView, 1.5);
    const region = {
      id: 'view_primary_region_1', viewId: 'view_primary',
      pageBounds: [0.1, 0.2, 0.4, 0.6] as [number, number, number, number],
    };

    expect(stitched).toMatchObject({
      id: 'view_primary_global__outer', viewId: 'view_primary',
      imageBounds: [0.18, 0.26, 0.64, 0.48],
      coarseParams: { center: [250, 375], radius: 160 },
    });
    expect(projectGlobalContoursToRegion([stitched], region)).toEqual([{
      id: 'view_primary_global__outer', geometryFamily: 'circle',
      imageBounds: [0.2, 0.1, 0.8, 0.8],
    }]);
  });

  it('stitches regional contour samples without changing their global contour id', () => {
    const region = {
      id: 'view_primary_region_2', viewId: 'view_primary',
      pageBounds: [0.5, 0.2, 0.4, 0.6] as [number, number, number, number],
    };
    const evidence: ContourEvidence = {
      id: 'right_arc', viewId: region.id, globalContourId: 'view_primary_global__outer',
      imageBounds: [0, 0.1, 0.8, 0.8], samplePoints: [[0, 0.5], [0.5, 0.1]],
      confidence: 0.88, touchesCropEdge: true,
    };

    expect(stitchContourEvidence(evidence, region)).toMatchObject({
      id: 'view_primary_region_2__right_arc', viewId: 'view_primary',
      globalContourId: 'view_primary_global__outer',
      imageBounds: [0.5, 0.26, 0.32, 0.48],
      samplePoints: [[0.5, 0.5], [0.7, 0.26]],
    });
  });
});

function circle(
  id: string,
  imageBounds: [number, number, number, number],
  center: [number, number],
  radius: number,
  confidence: number,
): GeometryObservation {
  return {
    id, viewId: 'view_primary', type: 'circle', imageBounds,
    measuredParams: { center, radius }, confidence,
  };
}
