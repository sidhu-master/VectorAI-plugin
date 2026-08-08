import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../document/create';
import type {
  AnnotationId,
  DrawingDocument,
  FeatureId,
  GeometryId,
  RelationId,
} from '../document/types';
import { applyDrawingPatch } from '../patch/apply';
import type { DrawingPatch } from '../patch/types';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function populatedDocument(): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_patch' },
    now: () => 1,
  });
  const geometryId = 'circle_1' as GeometryId;
  const annotationId = 'text_1' as AnnotationId;
  const relationId = 'radius_1' as RelationId;
  document.geometry.push({
    id: geometryId,
    type: 'circle',
    visible: true,
    quality: confirmed,
    center: [0, 0],
    radius: 5,
  });
  document.annotations.push({
    id: annotationId,
    type: 'text',
    visible: true,
    quality: confirmed,
    content: 'R5',
    position: [6, 0],
    height: 2,
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
    geometryIds: [geometryId],
    value: 5,
    status: 'satisfied',
  });
  document.features.push({
    id: 'hole_1' as FeatureId,
    type: 'feature',
    visible: true,
    quality: confirmed,
    semanticType: 'hole',
    geometryIds: [geometryId],
    annotationIds: [annotationId],
    relationIds: [relationId],
    properties: { nominalDiameter: 10 },
  });
  return document;
}

describe('applyDrawingPatch', () => {
  it('adds nodes across all four planes and generates an exact inverse', () => {
    const document = createEmptyDrawing({
      idFactory: { next: () => 'drawing_empty' },
      now: () => 1,
    });
    const patch: DrawingPatch = { operations: [
      {
        type: 'geometry.add',
        value: {
          id: 'circle_1' as GeometryId,
          type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 5,
        },
      },
      {
        type: 'annotation.add',
        value: {
          id: 'text_1' as AnnotationId,
          type: 'text', visible: true, quality: confirmed, content: 'R5', position: [6, 0],
          height: 2, rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
        },
      },
      {
        type: 'relation.add',
        value: {
          id: 'radius_1' as RelationId,
          type: 'constraint', plane: 'constraint', kind: 'radius', visible: true,
          quality: confirmed, geometryIds: ['circle_1' as GeometryId], value: 5,
          status: 'satisfied',
        },
      },
      {
        type: 'feature.add',
        value: {
          id: 'hole_1' as FeatureId,
          type: 'feature', visible: true, quality: confirmed, semanticType: 'hole',
          geometryIds: ['circle_1' as GeometryId], annotationIds: ['text_1' as AnnotationId],
          relationIds: ['radius_1' as RelationId], properties: {},
        },
      },
    ] };

    const applied = applyDrawingPatch(document, patch);
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    const reverted = applyDrawingPatch(applied.document, applied.inversePatch);
    expect(reverted.success && reverted.document).toEqual(document);
  });

  it('updates every plane and restores absent optional fields exactly', () => {
    const document = populatedDocument();
    const patch: DrawingPatch = { operations: [
      { type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 6 } },
      { type: 'annotation.update', id: 'text_1' as AnnotationId, changes: { maxWidth: 20 } },
      { type: 'relation.update', id: 'radius_1' as RelationId, changes: { value: 6 } },
      { type: 'feature.update', id: 'hole_1' as FeatureId, changes: { properties: { nominalDiameter: 12 } } },
    ] };

    const applied = applyDrawingPatch(document, patch);
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    const reverted = applyDrawingPatch(applied.document, applied.inversePatch);
    expect(reverted.success && reverted.document).toEqual(document);
  });

  it('cascades geometry deletion through relations and feature membership', () => {
    const document = populatedDocument();
    const applied = applyDrawingPatch(document, {
      operations: [{ type: 'geometry.delete', id: 'circle_1' as GeometryId }],
    });

    expect(applied.success).toBe(true);
    if (!applied.success) return;
    expect(applied.document.geometry).toEqual([]);
    expect(applied.document.relations).toEqual([]);
    expect(applied.document.features[0].geometryIds).toEqual([]);
    expect(applied.document.features[0].relationIds).toEqual([]);
    const reverted = applyDrawingPatch(applied.document, applied.inversePatch);
    expect(reverted.success && reverted.document).toEqual(document);
  });

  it('rejects an invalid patch atomically', () => {
    const document = populatedDocument();
    const applied = applyDrawingPatch(document, {
      operations: [{ type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: -1 } }],
    });

    expect(applied).toMatchObject({ success: false });
    expect(applied.document).toBe(document);
    if ('errors' in applied) expect(applied.errors[0].code).toBe('INVALID_RADIUS');
  });

  it('rejects updates to immutable identity fields', () => {
    const document = populatedDocument();
    const applied = applyDrawingPatch(document, {
      operations: [{ type: 'relation.update', id: 'radius_1' as RelationId, changes: { plane: 'topology' } }],
    });

    expect(applied).toMatchObject({ success: false });
    if ('errors' in applied) expect(applied.errors[0].code).toBe('IMMUTABLE_FIELD');
  });
});
