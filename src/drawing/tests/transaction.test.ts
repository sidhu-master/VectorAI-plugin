import { describe, expect, it, vi } from 'vitest';

import { createEmptyDrawing } from '../document/create';
import type {
  AnnotationId,
  DrawingDocument,
  EvidenceId,
  FeatureId,
  GeometryId,
  RelationId,
  RevisionId,
} from '../document/types';
import { previewTransaction } from '../transaction/execute';
import type { DrawingTransaction } from '../transaction/types';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

function fixture(): { document: DrawingDocument; transaction: DrawingTransaction } {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_transaction' },
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
  return {
    document,
    transaction: {
      id: 'tx_1',
      baseRevision: 'rev_1' as RevisionId,
      actor: { type: 'AI', id: 'agent' },
      commands: [{
        type: 'geometry.update',
        id: 'circle_1' as GeometryId,
        changes: { radius: 30 },
      }],
      preconditions: [{
        type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25,
      }],
      postconditions: [{
        type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 30,
      }],
      evidenceRefs: [],
    },
  };
}

describe('previewTransaction', () => {
  it('rejects a stale base revision before evaluating commands', () => {
    const { document, transaction } = fixture();
    const result = previewTransaction({
      document,
      currentRevision: 'rev_2' as RevisionId,
    }, transaction);

    expect(result).toMatchObject({
      status: 'rejected',
      errors: [{ code: 'STALE_REVISION', stage: 'revision', retryable: true }],
    });
  });

  it('rejects a failed explicit or command-generated precondition', () => {
    const { document, transaction } = fixture();
    transaction.preconditions[0] = {
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 24,
    };
    const explicit = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    const generated = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, {
      ...transaction,
      preconditions: [],
      commands: [{
        type: 'geometry.update', id: 'circle_1' as GeometryId,
        expected: { radius: 24 }, changes: { radius: 30 },
      }],
    });

    expect(explicit).toMatchObject({ status: 'rejected', errors: [{ stage: 'precondition' }] });
    expect(generated).toMatchObject({ status: 'rejected', errors: [{ stage: 'precondition' }] });
  });

  it('reports invalid resulting geometry at validation stage', () => {
    const { document, transaction } = fixture();
    transaction.commands = [{
      type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: -1 },
    }];
    transaction.postconditions = [];

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result).toMatchObject({
      status: 'rejected',
      errors: [{ code: 'INVALID_RADIUS', stage: 'validation', retryable: true }],
    });
  });

  it('rejects when the resulting document does not satisfy the goal', () => {
    const { document, transaction } = fixture();
    transaction.postconditions[0] = {
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 31,
    };

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result).toMatchObject({
      status: 'rejected', errors: [{ code: 'POSTCONDITION_FAILED', stage: 'postcondition' }],
    });
  });

  it('returns a reversible preview without mutating or persisting the source document', () => {
    const { document, transaction } = fixture();
    const original = structuredClone(document);

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result).toMatchObject({
      status: 'ready',
      preview: {
        transactionId: 'tx_1',
        baseRevision: 'rev_1',
        patch: { operations: [{ type: 'geometry.update', id: 'circle_1' }] },
        inversePatch: { operations: [{ type: 'geometry.update', id: 'circle_1', changes: { radius: 25 } }] },
        affectedNodeIds: ['circle_1'],
        outcomeReport: { satisfied: true },
        candidate: false,
      },
      resultingDocument: { geometry: [expect.objectContaining({ radius: 30 })] },
    });
    expect(document).toEqual(original);
  });

  it('preserves model intent and lineage for an atomic redraw across every drawing plane', () => {
    const { document, transaction } = fixture();
    document.annotations.push({
      id: 'text_1' as AnnotationId,
      type: 'text', visible: true, quality: confirmed,
      content: 'old', position: [0, 0], height: 2, rotation: 0,
      alignment: 'left', verticalAlignment: 'baseline',
    });
    document.relations.push({
      id: 'association_1' as RelationId,
      type: 'association', visible: true, quality: confirmed,
      plane: 'association', kind: 'annotation-target',
      annotationId: 'text_1' as AnnotationId,
      geometryIds: ['circle_1' as GeometryId],
    });
    document.features.push({
      id: 'feature_1' as FeatureId,
      type: 'feature', visible: true, quality: confirmed,
      semanticType: 'old-part',
      geometryIds: ['circle_1' as GeometryId],
      annotationIds: ['text_1' as AnnotationId],
      relationIds: ['association_1' as RelationId],
      properties: {},
    });
    transaction.commands = [
      { type: 'relation.delete', id: 'association_1' as RelationId },
      { type: 'feature.delete', id: 'feature_1' as FeatureId },
      { type: 'annotation.delete', id: 'text_1' as AnnotationId },
      { type: 'geometry.delete', id: 'circle_1' as GeometryId },
      {
        type: 'geometry.create',
        value: {
          id: 'line_2' as GeometryId,
          type: 'line', visible: true, quality: confirmed,
          start: [0, 0], end: [20, 10],
        },
      },
      {
        type: 'annotation.create',
        value: {
          id: 'text_2' as AnnotationId,
          type: 'text', visible: true, quality: confirmed,
          content: 'new', position: [10, 5], height: 2, rotation: 0,
          alignment: 'center', verticalAlignment: 'middle',
        },
      },
      {
        type: 'relation.create',
        value: {
          id: 'association_2' as RelationId,
          type: 'association', visible: true, quality: confirmed,
          plane: 'association', kind: 'annotation-target',
          annotationId: 'text_2' as AnnotationId,
          geometryIds: ['line_2' as GeometryId],
        },
      },
      {
        type: 'feature.create',
        value: {
          id: 'feature_2' as FeatureId,
          type: 'feature', visible: true, quality: confirmed,
          semanticType: 'redrawn-part',
          geometryIds: ['line_2' as GeometryId],
          annotationIds: ['text_2' as AnnotationId],
          relationIds: ['association_2' as RelationId],
          properties: {},
        },
      },
    ];
    transaction.preconditions = [];
    transaction.postconditions = [
      { type: 'node.absent', nodeId: 'circle_1' },
      { type: 'node.exists', nodeId: 'feature_2' },
      { type: 'document.valid' },
    ];
    const metadata = {
      episodeId: 'episode_1',
      summary: 'Replace the selected part with a newly drawn structure.',
      confidence: 0.82,
      lineage: [{
        sourceIds: ['circle_1', 'text_1', 'association_1', 'feature_1'],
        resultIds: ['line_2', 'text_2', 'association_2', 'feature_2'],
        operation: 'redraw' as const,
        evidenceRefs: ['evidence_render_1' as EvidenceId],
      }],
      decisionGrantRefs: ['grant_1'],
    };
    (transaction as DrawingTransaction & { metadata?: typeof metadata }).metadata = metadata;

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready preview');
    expect((result.preview as unknown as { metadata?: unknown }).metadata).toEqual(metadata);
    expect(result.preview.affectedNodeIds).toEqual(expect.arrayContaining([
      'circle_1', 'text_1', 'association_1', 'feature_1',
      'line_2', 'text_2', 'association_2', 'feature_2',
    ]));
  });

  it('marks previews containing candidate nodes for user-visible review', () => {
    const { document, transaction } = fixture();
    transaction.commands = [{
      type: 'geometry.create',
      value: {
        id: 'point_candidate' as GeometryId,
        type: 'point', visible: true,
        quality: { status: 'candidate', confidence: 0.4, evidenceRefs: [] },
        x: 1, y: 2,
      },
    }];
    transaction.postconditions = [{ type: 'node.exists', nodeId: 'point_candidate' }];

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result).toMatchObject({ status: 'ready', preview: { candidate: true } });
  });

  it('applies real commands even when a postcondition is already satisfied', () => {
    const { document, transaction } = fixture();
    transaction.commands = [{
      type: 'geometry.create',
      value: { type: 'point', visible: true, quality: confirmed, x: 1, y: 2 },
    }];
    transaction.postconditions = [{
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25,
    }];
    const next = vi.fn(() => 'point_1' as const);

    const result = previewTransaction(
      { document, currentRevision: 'rev_1' as RevisionId },
      transaction,
      { next },
    );

    // 有实际命令时必须真正应用,不能被"后置条件已满足"短路吞掉
    expect(result.status).toBe('ready');
    expect(next).toHaveBeenCalled();
  });

  it('short-circuits an already-satisfied goal only when there are no commands', () => {
    const { document, transaction } = fixture();
    transaction.commands = [];
    transaction.postconditions = [{
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 25,
    }];
    const next = vi.fn(() => {
      throw new Error('must not allocate');
    });

    const result = previewTransaction(
      { document, currentRevision: 'rev_1' as RevisionId },
      transaction,
      { next },
    );

    expect(result).toEqual({
      status: 'already_satisfied',
      outcome: {
        satisfied: true,
        assertions: [{ assertion: transaction.postconditions[0], satisfied: true }],
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('executes transactions without postconditions normally', () => {
    const { document, transaction } = fixture();
    transaction.postconditions = [];

    const result = previewTransaction({
      document, currentRevision: 'rev_1' as RevisionId,
    }, transaction);

    expect(result.status).toBe('ready');
  });
});
