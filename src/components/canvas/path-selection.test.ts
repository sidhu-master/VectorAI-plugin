import { describe, expect, it } from 'vitest';

import type { AnnotationId, GeometryId, GeometryNode } from '@/drawing';
import { geometryIntersectsSelectionBox, selectGeometryIdsInBox } from './path-selection';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };
const box = { minX: -1, minY: -1, maxX: 1, maxY: 1 };
const view = { minX: -100, minY: -100, maxX: 100, maxY: 100 };

describe('path-accurate canvas selection', () => {
  it('selects lines that enter or cross the box', () => {
    const crossing: GeometryNode = {
      id: 'crossing' as GeometryId, type: 'line', visible: true, quality,
      start: [-3, 0], end: [3, 0],
    };
    const outside: GeometryNode = {
      id: 'outside' as GeometryId, type: 'line', visible: true, quality,
      start: [-3, 3], end: [3, 3],
    };

    expect(geometryIntersectsSelectionBox(crossing, box, view)).toBe(true);
    expect(geometryIntersectsSelectionBox(outside, box, view)).toBe(false);
  });

  it('does not select a large circle only because the box lies inside its bounds', () => {
    const enclosing: GeometryNode = {
      id: 'head' as GeometryId, type: 'circle', visible: true, quality,
      center: [0, 0], radius: 20,
    };
    const crossing: GeometryNode = {
      id: 'edge' as GeometryId, type: 'circle', visible: true, quality,
      center: [20, 0], radius: 20,
    };

    expect(geometryIntersectsSelectionBox(enclosing, box, view)).toBe(false);
    expect(geometryIntersectsSelectionBox(crossing, box, view)).toBe(true);
  });

  it('respects an arc sweep instead of its full parent circle', () => {
    const upperArc: GeometryNode = {
      id: 'upper' as GeometryId, type: 'arc', visible: true, quality,
      center: [0, 0], radius: 10, startAngle: 0, endAngle: 180, counterClockwise: true,
    };

    expect(geometryIntersectsSelectionBox(
      upperArc,
      { minX: -1, minY: 9, maxX: 1, maxY: 11 },
      view,
    )).toBe(true);
    expect(geometryIntersectsSelectionBox(
      upperArc,
      { minX: -1, minY: -11, maxX: 1, maxY: -9 },
      view,
    )).toBe(false);
  });

  it('checks every polyline segment and excludes annotations from returned IDs', () => {
    const polyline: GeometryNode = {
      id: 'polyline' as GeometryId, type: 'polyline', visible: true, quality, closed: false,
      vertices: [{ point: [-4, 4] }, { point: [0, 0] }, { point: [4, 4] }],
    };
    const annotation = {
      id: 'dimension' as AnnotationId, type: 'text' as const, visible: true, quality,
      content: '10', position: [0, 0] as const, height: 2, rotation: 0,
      alignment: 'center' as const, verticalAlignment: 'middle' as const,
    };
    const hatch = {
      id: 'hatch' as AnnotationId, type: 'section-hatch' as const, visible: true, quality,
      pattern: 'ANSI31', angle: 45, spacing: 3,
      segments: [{ start: [-4, -4] as const, end: [4, 4] as const }],
    };

    expect(selectGeometryIdsInBox([polyline, annotation, hatch], box, view)).toEqual(['polyline']);
  });
});
