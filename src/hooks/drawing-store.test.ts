import { describe, expect, it } from 'vitest';
import type {
  AnnotationId,
  CommitId,
  DrawingCommit,
  DrawingDocument,
  DrawingId,
  FeatureId,
  GeometryId,
  RelationId,
  RepositoryCommitResult,
  RevisionId,
} from '@/drawing';
import {
  applyWorkspaceResult,
  buildClearCommands,
  buildDeleteCommand,
  buildUpdateCommand,
  createWorkspaceTransaction,
  locateDrawingNode,
} from './drawing-store';

const drawingId = 'drawing_test' as DrawingId;
const geometryId = 'geometry_circle' as GeometryId;
const annotationId = 'annotation_text' as AnnotationId;
const relationId = 'relation_constraint' as RelationId;
const featureId = 'feature_room' as FeatureId;
const revision = 'revision_1' as RevisionId;

function document(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: drawingId,
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [{
      id: geometryId,
      type: 'circle',
      center: [10, 20],
      radius: 5,
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }],
    annotations: [{
      id: annotationId,
      type: 'text',
      content: 'A',
      position: [0, 0],
      height: 3,
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'baseline',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }],
    relations: [{
      id: relationId,
      type: 'constraint',
      plane: 'constraint',
      kind: 'radius',
      geometryIds: [geometryId],
      value: 5,
      status: 'satisfied',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }],
    features: [{
      id: featureId,
      type: 'feature',
      semanticType: 'room',
      geometryIds: [geometryId],
      annotationIds: [annotationId],
      relationIds: [relationId],
      properties: {},
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }],
  };
}

describe('drawing workspace pure state helpers', () => {
  it('locates nodes in the canonical document planes', () => {
    expect(locateDrawingNode(document(), geometryId)?.plane).toBe('geometry');
    expect(locateDrawingNode(document(), annotationId)?.plane).toBe('annotation');
    expect(locateDrawingNode(document(), 'missing')).toBeNull();
  });

  it('builds an optimistic update command with the exact current values', () => {
    expect(buildUpdateCommand(document(), geometryId, {
      radius: 8,
      center: [12, 20],
    })).toEqual({
      type: 'geometry.update',
      id: geometryId,
      changes: { radius: 8, center: [12, 20] },
      expected: { radius: 5, center: [10, 20] },
    });
  });

  it('rejects immutable identity and discriminator updates locally', () => {
    expect(() => buildUpdateCommand(document(), geometryId, { type: 'arc' }))
      .toThrow('不可修改节点字段 type');
    expect(() => buildUpdateCommand(document(), geometryId, { id: 'other' }))
      .toThrow('不可修改节点字段 id');
  });

  it('builds plane-specific deletes and clears dependent planes first', () => {
    expect(buildDeleteCommand(document(), annotationId)).toEqual({
      type: 'annotation.delete', id: annotationId,
    });
    expect(buildDeleteCommand(document(), 'missing')).toBeNull();
    expect(buildClearCommands(document()).map((command) => command.type)).toEqual([
      'relation.delete',
      'feature.delete',
      'annotation.delete',
      'geometry.delete',
    ]);
  });

  it('creates a user transaction against the visible revision', () => {
    const transaction = createWorkspaceTransaction({
      revision,
      commands: [{ type: 'geometry.delete', id: geometryId }],
      actor: { type: 'user', id: 'local-user' },
      idFactory: { next: (kind) => `${kind}_1` },
    });

    expect(transaction).toEqual({
      id: 'transaction_1',
      baseRevision: revision,
      actor: { type: 'user', id: 'local-user' },
      commands: [{ type: 'geometry.delete', id: geometryId }],
      preconditions: [],
      postconditions: [{ type: 'document.valid' }],
      evidenceRefs: [],
    });
  });

  it('applies committed results without mutating the existing workspace', () => {
    const current = { document: document(), revision, commits: [] as DrawingCommit[] };
    const nextDocument = document();
    const circle = nextDocument.geometry[0];
    if (circle.type !== 'circle') throw new Error('fixture must be a circle');
    circle.radius = 8;
    const commit = {
      id: 'commit_1' as CommitId,
      drawingId,
      parentRevision: revision,
      resultingRevision: 'revision_2' as RevisionId,
    } as DrawingCommit;
    const result: RepositoryCommitResult = {
      status: 'committed',
      commit,
      document: nextDocument,
      revision: 'revision_2' as RevisionId,
    };

    const applied = applyWorkspaceResult(current, result);

    expect(applied.error).toBeNull();
    expect(applied.workspace.revision).toBe('revision_2');
    expect(applied.workspace.commits).toEqual([commit]);
    expect(applied.workspace.document.geometry[0]).toMatchObject({ radius: 8 });
    expect(current.document.geometry[0]).toMatchObject({ radius: 5 });
  });

  it('keeps the workspace unchanged when the repository rejects a transaction', () => {
    const current = { document: document(), revision, commits: [] as DrawingCommit[] };
    const result: RepositoryCommitResult = {
      status: 'rejected',
      errors: [{
        code: 'STALE_REVISION', stage: 'revision', retryable: true, nodeIds: [],
        message: '版本已变化', suggestedAction: 'requery',
      }],
    };

    const applied = applyWorkspaceResult(current, result);

    expect(applied.workspace).toBe(current);
    expect(applied.error).toBe('版本已变化');
  });
});
