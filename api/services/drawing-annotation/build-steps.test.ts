import { describe, expect, it } from 'vitest';

import { createEmptyDrawing, type DrawingId, type GeometryId, type GeometryNode } from '../../../src/drawing/index.js';
import { buildAutomaticAnnotationSteps, withoutAutomaticAnnotations } from './build-steps.js';

const quality = { status: 'confirmed' as const, confidence: 0.95, evidenceRefs: [] };
const geometry: GeometryNode[] = [
  {
    id: 'line_base' as GeometryId,
    type: 'line', visible: true, quality,
    start: [0, 0], end: [100, 0],
  },
  {
    id: 'circle_eye' as GeometryId,
    type: 'circle', visible: true, quality,
    center: [30, 40], radius: 10,
  },
  {
    id: 'arc_head' as GeometryId,
    type: 'arc', visible: true, quality,
    center: [70, 40], radius: 20,
    startAngle: 0, endAngle: 90, counterClockwise: true,
  },
];

describe('buildAutomaticAnnotationSteps', () => {
  it('builds resolved CAD dimensions from analytic geometry without inventing line semantics', () => {
    const steps = buildAutomaticAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      geometry,
      existingAnnotationIds: [],
    });

    expect(steps.map((step) => ({
      kind: step.annotation.dimensionKind,
      value: step.annotation.computedValue,
      text: step.annotation.displayText,
      targetIds: step.annotation.targets.map((target) => target.geometryId),
    }))).toEqual([
      { kind: 'linear', value: 100, text: '100', targetIds: ['line_base', 'line_base'] },
      { kind: 'linear', value: 60, text: '60', targetIds: ['line_base', 'arc_head'] },
      { kind: 'diameter', value: 20, text: 'Ø20', targetIds: ['circle_eye'] },
      { kind: 'radius', value: 20, text: 'R20', targetIds: ['arc_head'] },
    ]);
    expect(steps.every((step) => step.commands[0]?.type === 'annotation.create')).toBe(true);
    expect(steps.every((step) => step.annotation.associationStatus === 'resolved')).toBe(true);
  });

  it('uses stable IDs and skips annotations already committed before pause', () => {
    const first = buildAutomaticAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      geometry,
      existingAnnotationIds: [],
    });
    const resumed = buildAutomaticAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      geometry,
      existingAnnotationIds: [first[0].annotation.id, first[2].annotation.id],
    });

    expect(buildAutomaticAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      geometry,
      existingAnnotationIds: [],
    }).map((step) => step.annotation.id)).toEqual(first.map((step) => step.annotation.id));
    expect(resumed.map((step) => step.annotation.id)).toEqual([
      first[1].annotation.id,
      first[3].annotation.id,
    ]);
  });

  it('does not emit invalid dimensions for empty or zero-size drawings', () => {
    expect(buildAutomaticAnnotationSteps({
      drawingId: 'drawing_empty' as DrawingId,
      geometry: [],
      existingAnnotationIds: [],
    })).toEqual([]);
    expect(buildAutomaticAnnotationSteps({
      drawingId: 'drawing_point' as DrawingId,
      geometry: [{
        id: 'point_only' as GeometryId,
        type: 'point', visible: true, quality, x: 4, y: 7,
      }],
      existingAnnotationIds: [],
    })).toEqual([]);
  });

  it('excludes derived overlays from source reconstruction comparisons', () => {
    const document = createEmptyDrawing({ idFactory: { next: (kind) => `${kind}_fixture` } });
    const generated = buildAutomaticAnnotationSteps({
      drawingId: document.id,
      geometry,
      existingAnnotationIds: [],
    })[0].annotation;
    document.annotations = [generated, {
      ...generated,
      id: 'annotation_observed' as typeof generated.id,
      displayText: 'source label',
    }];

    const compared = withoutAutomaticAnnotations(document);

    expect(compared.annotations.map((annotation) => annotation.id)).toEqual(['annotation_observed']);
    expect(document.annotations).toHaveLength(2);
  });
});
