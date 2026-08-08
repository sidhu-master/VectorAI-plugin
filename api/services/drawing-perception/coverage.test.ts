import { describe, expect, it } from 'vitest';

import type { GeometryObservation } from './types.js';
import {
  createCoverageRegion,
  createTargetedRefinementRegion,
  decideRegionRefinement,
  splitPerceptionRegion,
  type DrawingCoverageAssessment,
} from './coverage.js';

const complete: DrawingCoverageAssessment = {
  complete: true,
  confidence: 0.95,
  unreadBounds: [],
  reasons: [],
};

describe('drawing perception coverage policy', () => {
  it('accepts a simple region when model and deterministic signals agree', () => {
    const decision = decideRegionRefinement({
      region: region(), viewBounds: [0, 0, 1, 1], assessment: complete,
      geometry: [circle('center', [0.4, 0.4, 0.2, 0.2])], annotationCount: 2,
      extractionErrorCount: 0, currentRegionCount: 1,
      limits: { maxDepth: 1, maxRegions: 12 },
    });

    expect(decision).toEqual({ refine: false, budgetExhausted: false, reasons: [] });
  });

  it('forces refinement for incomplete assessment, extraction errors, or saturated output', () => {
    const base = {
      region: region(), viewBounds: [0, 0, 1, 1] as [number, number, number, number],
      geometry: [] as GeometryObservation[], annotationCount: 0,
      extractionErrorCount: 0, currentRegionCount: 1,
      limits: { maxDepth: 1, maxRegions: 12 },
    };

    expect(decideRegionRefinement({
      ...base,
      assessment: { complete: false, confidence: 0.8, unreadBounds: [[0.2, 0.2, 0.3, 0.3]], reasons: ['轮廓未读完'] },
    })).toMatchObject({ refine: true, reasons: expect.arrayContaining(['model_incomplete']) });
    expect(decideRegionRefinement({
      ...base, assessment: complete, extractionErrorCount: 1,
    })).toMatchObject({ refine: true, reasons: expect.arrayContaining(['extraction_error']) });
    expect(decideRegionRefinement({
      ...base, assessment: complete, annotationCount: 24,
    })).toMatchObject({ refine: true, reasons: expect.arrayContaining(['annotation_saturated']) });
  });

  it('detects geometry clipped by an internal crop boundary', () => {
    const decision = decideRegionRefinement({
      region: region([0, 0, 0.5, 1]), viewBounds: [0, 0, 1, 1], assessment: complete,
      geometry: [circle('clipped', [0.45, 0.4, 0.05, 0.1])], annotationCount: 0,
      extractionErrorCount: 0, currentRegionCount: 1,
      limits: { maxDepth: 1, maxRegions: 12 },
    });

    expect(decision).toMatchObject({
      refine: true,
      reasons: expect.arrayContaining(['internal_edge_clipped']),
    });
  });

  it('reports budget exhaustion instead of pretending requested refinement completed', () => {
    const decision = decideRegionRefinement({
      region: { ...region(), depth: 1 }, viewBounds: [0, 0, 1, 1],
      assessment: { ...complete, complete: false }, geometry: [], annotationCount: 0,
      extractionErrorCount: 0, currentRegionCount: 3,
      limits: { maxDepth: 1, maxRegions: 12 },
    });

    expect(decision).toEqual({
      refine: false,
      budgetExhausted: true,
      reasons: ['model_incomplete', 'max_depth'],
    });
  });

  it('splits a portrait region along its physical long axis with stable overlapping children', () => {
    const children = splitPerceptionRegion({
      region: region([0.1, 0.1, 0.8, 0.8]),
      pageHeightToWidthRatio: 1.5,
    });

    expect(children.map((child) => child.id)).toEqual([
      'view_1_region_1_child_1', 'view_1_region_1_child_2',
    ]);
    expect(children.every((child) => child.parentId === 'view_1_region_1')).toBe(true);
    expect(children.every((child) => child.depth === 1)).toBe(true);
    expect(children[0].pageBounds[1] + children[0].pageBounds[3])
      .toBeGreaterThan(children[1].pageBounds[1]);
  });

  it('creates one focused reread around model-reported unread bounds', () => {
    const parent = region([0.1, 0.2, 0.8, 0.6]);

    expect(createTargetedRefinementRegion({
      region: parent,
      unreadBounds: [[0.2, 0.3, 0.1, 0.1], [0.6, 0.5, 0.1, 0.2]],
      paddingFraction: 0.05,
    })).toMatchObject({
      id: 'view_1_region_1_focus_1', parentId: 'view_1_region_1', depth: 1,
      pageBounds: [0.22, 0.35, 0.48, 0.3],
    });
  });
});

function region(pageBounds: [number, number, number, number] = [0, 0, 1, 1]) {
  return createCoverageRegion({ id: 'view_1_region_1', viewId: 'view_1', pageBounds });
}

function circle(
  id: string,
  imageBounds: [number, number, number, number],
): GeometryObservation {
  return {
    id, viewId: 'view_1', type: 'circle', imageBounds,
    measuredParams: { center: [0.5, 0.5], radius: 0.1 }, confidence: 0.9,
  };
}
