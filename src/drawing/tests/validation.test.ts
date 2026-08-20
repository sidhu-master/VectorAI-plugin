import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../document/create';
import type {
  AnnotationId,
  DrawingDocument,
  FeatureId,
  GeometryId,
  RelationId,
} from '../document/types';
import { validateDrawingDocument } from '../validation/document';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function validDocument(): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_valid' },
    now: () => 1,
  });
  const circleId = 'circle_1' as GeometryId;
  const textId = 'text_1' as AnnotationId;
  const relationId = 'constraint_1' as RelationId;
  const featureId = 'feature_1' as FeatureId;
  document.geometry.push({
    id: circleId,
    type: 'circle',
    visible: true,
    quality: confirmed,
    center: [10, 10],
    radius: 5,
  });
  document.annotations.push({
    id: textId,
    type: 'text',
    visible: true,
    quality: confirmed,
    content: 'Ø10',
    position: [20, 20],
    height: 2.5,
    rotation: 0,
    alignment: 'left',
    verticalAlignment: 'baseline',
  });
  document.relations.push({
    id: relationId,
    type: 'constraint',
    plane: 'constraint',
    kind: 'radius',
    visible: true,
    quality: confirmed,
    geometryIds: [circleId],
    value: 5,
    status: 'satisfied',
  });
  document.features.push({
    id: featureId,
    type: 'feature',
    visible: true,
    quality: confirmed,
    semanticType: 'hole',
    geometryIds: [circleId],
    annotationIds: [textId],
    relationIds: [relationId],
    properties: {},
  });
  return document;
}

describe('validateDrawingDocument', () => {
  it('accepts a valid four-plane drawing', () => {
    expect(validateDrawingDocument(validDocument())).toEqual({ valid: true, issues: [] });
  });

  it('rejects duplicate IDs across planes', () => {
    const document = validDocument();
    document.annotations[0].id = document.geometry[0].id as unknown as AnnotationId;

    expect(validateDrawingDocument(document).issues[0].code).toBe('DUPLICATE_NODE_ID');
  });

  it('rejects invalid geometry and quality values', () => {
    const document = validDocument();
    const circle = document.geometry[0];
    if (circle.type !== 'circle') throw new Error('fixture is not a circle');
    circle.radius = -1;
    circle.quality = { status: 'candidate', confidence: 1.2, evidenceRefs: [] };

    const codes = validateDrawingDocument(document).issues.map((issue) => issue.code);
    expect(codes).toContain('INVALID_RADIUS');
    expect(codes).toContain('INVALID_CONFIDENCE');
  });

  it('rejects empty text and missing dimension targets', () => {
    const document = validDocument();
    const text = document.annotations[0];
    if (text.type !== 'text') throw new Error('fixture is not text');
    text.content = '   ';
    document.annotations.push({
      id: 'dimension_1' as AnnotationId,
      type: 'dimension',
      visible: true,
      quality: confirmed,
      dimensionKind: 'diameter',
      associationStatus: 'resolved',
      targets: [{ geometryId: 'missing' as GeometryId, anchor: { kind: 'center' } }],
      textPosition: [0, 0],
      definitionPoints: [[0, 0]],
    });

    const codes = validateDrawingDocument(document).issues.map((issue) => issue.code);
    expect(codes).toContain('EMPTY_TEXT');
    expect(codes).toContain('REFERENCE_NOT_FOUND');
  });

  it('accepts formal leader and centerline annotations and validates their geometry references', () => {
    const document = validDocument();
    const circleId = document.geometry[0].id;
    document.annotations.push({
      id: 'centerline_1' as AnnotationId,
      type: 'centerline',
      visible: true,
      quality: confirmed,
      targets: [circleId],
      start: [0, 10],
      end: [20, 10],
      extension: 2,
    }, {
      id: 'leader_1' as AnnotationId,
      type: 'leader',
      visible: true,
      quality: confirmed,
      target: { geometryId: circleId, anchor: { kind: 'center' } },
      points: [[10, 10], [20, 20]],
      content: 'C0.5',
      textHeight: 2.5,
    });

    expect(validateDrawingDocument(document)).toEqual({ valid: true, issues: [] });

    const leader = document.annotations.at(-1);
    if (leader?.type !== 'leader') throw new Error('fixture is not a leader');
    leader.target = { geometryId: 'missing' as GeometryId, anchor: { kind: 'center' } };
    expect(validateDrawingDocument(document).issues.map((issue) => issue.code)).toContain('REFERENCE_NOT_FOUND');
  });

  it('validates analytic geometry invariants', () => {
    const document = validDocument();
    document.geometry.push(
      {
        id: 'ray_bad' as GeometryId,
        type: 'ray',
        visible: true,
        quality: confirmed,
        origin: [0, 0],
        direction: [2, 0],
      },
      {
        id: 'ellipse_bad' as GeometryId,
        type: 'ellipse',
        visible: true,
        quality: confirmed,
        center: [0, 0],
        majorAxis: [10, 0],
        ratio: 2,
      },
      {
        id: 'polyline_bad' as GeometryId,
        type: 'polyline',
        visible: true,
        quality: confirmed,
        vertices: [{ point: [0, 0] }, { point: [1, 0] }],
        closed: true,
      },
      {
        id: 'spline_bad' as GeometryId,
        type: 'spline',
        visible: true,
        quality: confirmed,
        degree: 2,
        controlPoints: [[0, 0], [1, 1], [2, 0]],
        knots: [0, 1, 0],
        closed: false,
        periodic: false,
      },
    );

    const codes = validateDrawingDocument(document).issues.map((issue) => issue.code);
    expect(codes).toContain('DIRECTION_NOT_NORMALIZED');
    expect(codes).toContain('INVALID_ELLIPSE_RATIO');
    expect(codes).toContain('INVALID_POLYLINE');
    expect(codes).toContain('INVALID_SPLINE_KNOTS');
  });
});
