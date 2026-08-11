import { describe, expect, it } from 'vitest';

import { compileDrawingCommands, evaluateAssertion } from '../command/compile';
import type { DrawingCommand } from '../command/types';
import { createEmptyDrawing } from '../document/create';
import type {
  AnnotationId,
  DrawingDocument,
  FeatureId,
  GeometryId,
  RelationId,
} from '../document/types';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function documentWithCircle(): DrawingDocument {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_command' },
    now: () => 1,
  });
  document.geometry.push({
    id: 'circle_1' as GeometryId,
    type: 'circle',
    visible: true,
    quality: confirmed,
    center: [0, 0],
    radius: 25,
  });
  return document;
}

describe('compileDrawingCommands', () => {
  it('compiles expected update values into explicit preconditions', () => {
    const result = compileDrawingCommands(documentWithCircle(), [{
      type: 'geometry.update',
      id: 'circle_1' as GeometryId,
      expected: { radius: 25 },
      changes: { radius: 30 },
    }]);

    expect(result).toEqual({
      success: true,
      patch: { operations: [
        { type: 'geometry.update', id: 'circle_1', changes: { radius: 30 } },
      ] },
      preconditions: [
        { type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25 },
      ],
    });
  });

  it('allocates missing create IDs through the injected factory without mutating the command', () => {
    const command: DrawingCommand = {
      type: 'geometry.create',
      value: {
        type: 'circle', visible: true, quality: confirmed, center: [5, 5], radius: 2,
      },
    };
    const result = compileDrawingCommands(
      createEmptyDrawing({ idFactory: { next: () => 'drawing_empty' }, now: () => 1 }),
      [command],
      { next: (kind) => `${kind}_generated` },
    );

    expect(result).toMatchObject({
      success: true,
      patch: { operations: [{ type: 'geometry.add', value: { id: 'geometry_generated' } }] },
    });
    expect('id' in command.value).toBe(false);
  });

  it('rejects missing targets, duplicate IDs and type changes', () => {
    const document = documentWithCircle();
    const missing = compileDrawingCommands(document, [{
      type: 'geometry.delete', id: 'missing' as GeometryId,
    }]);
    const duplicate = compileDrawingCommands(document, [{
      type: 'geometry.create',
      value: {
        id: 'circle_1' as GeometryId,
        type: 'circle', visible: true, quality: confirmed, center: [1, 1], radius: 1,
      },
    }]);
    const typeChange = compileDrawingCommands(document, [{
      type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { type: 'line' },
    }]);

    expect('errors' in missing ? missing.errors[0].code : undefined).toBe('NODE_NOT_FOUND');
    expect('errors' in duplicate ? duplicate.errors[0].code : undefined).toBe('DUPLICATE_NODE_ID');
    expect('errors' in typeChange ? typeChange.errors[0].code : undefined).toBe('TYPE_CHANGE_REQUIRES_REPLACE');
  });

  it('reserves history revert for the repository', () => {
    const result = compileDrawingCommands(documentWithCircle(), [{
      type: 'history.revert', commitId: 'commit_1' as never,
    }]);

    expect('errors' in result ? result.errors[0].code : undefined).toBe('REPOSITORY_COMMAND_REQUIRED');
  });

  it('compiles create, update and delete operations for every document plane', () => {
    const document = documentWithCircle();
    document.annotations.push({
      id: 'text_1' as AnnotationId,
      type: 'text',
      visible: true,
      quality: confirmed,
      content: 'A',
      position: [0, 0],
      height: 2,
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'baseline',
    });
    document.relations.push({
      id: 'constraint_1' as RelationId,
      type: 'constraint',
      visible: true,
      quality: confirmed,
      plane: 'constraint',
      kind: 'radius',
      geometryIds: ['circle_1' as GeometryId],
      value: 25,
      status: 'satisfied',
    });
    document.features.push({
      id: 'feature_1' as FeatureId,
      type: 'feature',
      visible: true,
      quality: confirmed,
      semanticType: 'opening',
      geometryIds: ['circle_1' as GeometryId],
      annotationIds: [],
      relationIds: [],
      properties: {},
    });

    const result = compileDrawingCommands(document, [
      { type: 'annotation.update', id: 'text_1' as AnnotationId, changes: { content: 'B' } },
      { type: 'relation.delete', id: 'constraint_1' as RelationId },
      { type: 'feature.update', id: 'feature_1' as FeatureId, changes: { semanticType: 'door' } },
      {
        type: 'annotation.create',
        value: {
          id: 'text_2' as AnnotationId,
          type: 'text', visible: true, quality: confirmed, content: 'C', position: [1, 1],
          height: 2, rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
        },
      },
    ]);

    expect(result).toEqual({
      success: true,
      patch: { operations: [
        { type: 'annotation.update', id: 'text_1', changes: { content: 'B' } },
        { type: 'relation.delete', id: 'constraint_1' },
        { type: 'feature.update', id: 'feature_1', changes: { semanticType: 'door' } },
        { type: 'annotation.add', value: expect.objectContaining({ id: 'text_2', content: 'C' }) },
      ] },
      preconditions: [],
    });
  });

  it('tracks IDs allocated earlier in the same command batch', () => {
    const result = compileDrawingCommands(
      createEmptyDrawing({ idFactory: { next: () => 'drawing_empty' }, now: () => 1 }),
      [
        {
          type: 'geometry.create',
          value: {
            id: 'point_1' as GeometryId,
            type: 'point', visible: true, quality: confirmed, x: 0, y: 0,
          },
        },
        { type: 'geometry.update', id: 'point_1' as GeometryId, changes: { x: 1 } },
        { type: 'geometry.delete', id: 'point_1' as GeometryId },
      ],
    );

    expect(result.success).toBe(true);
    expect(result.success && result.patch.operations.map((operation) => operation.type)).toEqual([
      'geometry.add', 'geometry.update', 'geometry.delete',
    ]);
  });
});

describe('evaluateAssertion', () => {
  it('evaluates existence, property, validity and selection counts against the real document', () => {
    const document = documentWithCircle();
    expect(evaluateAssertion(document, { type: 'node.exists', nodeId: 'circle_1' })).toBe(true);
    expect(evaluateAssertion(document, { type: 'node.absent', nodeId: 'missing' })).toBe(true);
    expect(evaluateAssertion(document, {
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25,
    })).toBe(true);
    expect(evaluateAssertion(document, { type: 'document.valid' })).toBe(true);
    expect(evaluateAssertion(document, {
      type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, equals: 1,
    })).toBe(true);
    // min 语义:至少 N 条,即使实际条数多于 min 也通过
    expect(evaluateAssertion(document, {
      type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, min: 1,
    })).toBe(true);
    expect(evaluateAssertion(document, {
      type: 'selection.count', selector: { plane: 'geometry', types: ['line'] }, min: 0,
    })).toBe(true);
    expect(evaluateAssertion(document, {
      type: 'selection.count', selector: { plane: 'geometry', types: ['circle'] }, min: 2,
    })).toBe(false);
  });
});
