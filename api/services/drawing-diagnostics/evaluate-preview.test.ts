import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../../../src/drawing/document/create';
import type {
  AnnotationId,
  GeometryId,
  RelationId,
  RevisionId,
} from '../../../src/drawing/document/types';
import { previewTransaction } from '../../../src/drawing/transaction/execute';
import type { DrawingTransaction } from '../../../src/drawing/transaction/types';
import { evaluateDrawingPreview } from './evaluate-preview';

const revision = 'revision_1' as RevisionId;
const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };

describe('evaluateDrawingPreview', () => {
  it('keeps invalid references in the hard transaction boundary', () => {
    const document = fixture();
    const transaction = candidate([{
      type: 'relation.create',
      value: {
        id: 'constraint_missing' as RelationId,
        type: 'constraint', plane: 'constraint', kind: 'radius',
        visible: true, quality: confirmed,
        geometryIds: ['geometry_missing' as GeometryId], status: 'defined',
      },
    }]);

    const preview = previewTransaction({ document, currentRevision: revision }, transaction);

    expect(preview).toMatchObject({
      status: 'rejected', errors: [{ code: 'REFERENCE_NOT_FOUND', stage: 'validation' }],
    });
  });

  it('reports topology, annotation, constraint, scope, and confidence facts without rejecting', () => {
    const before = fixture();
    const transaction = candidate([
      {
        type: 'geometry.update', id: 'line_left' as GeometryId,
        changes: { end: [10, 5] },
      },
      {
        type: 'annotation.update', id: 'text_1' as AnnotationId,
        changes: { content: '已更新' },
      },
      {
        type: 'relation.update', id: 'constraint_1' as RelationId,
        changes: { status: 'violated' },
      },
    ], 0.42);
    const preview = previewTransaction({ document: before, currentRevision: revision }, transaction);
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') throw new Error('expected ready preview');

    const report = evaluateDrawingPreview({
      before,
      after: preview.resultingDocument,
      transaction,
      tolerance: 0.01,
    });

    expect(report.changedNodeIds).toEqual(['constraint_1', 'line_left', 'text_1']);
    expect(report.unexpectedDanglingEndpoints).toEqual(expect.arrayContaining([
      [10, 0], [10, 5],
    ]));
    expect(report.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NEW_DANGLING_ENDPOINT', severity: 'warning' }),
      expect.objectContaining({
        code: 'ANNOTATION_CHANGED', severity: 'warning', nodeIds: ['text_1'],
      }),
      expect.objectContaining({
        code: 'CONSTRAINT_VIOLATED', severity: 'warning',
        nodeIds: expect.arrayContaining(['constraint_1']),
      }),
      expect.objectContaining({ code: 'LOW_CONFIDENCE_CANDIDATE', severity: 'candidate' }),
    ]));
    expect(report.hardValid).toBe(true);
    expect(preview.preview.validationReport.valid).toBe(true);
  });

  it('reports an existing constraint meaning change as decision-required, not invalid geometry', () => {
    const before = fixture();
    const transaction = candidate([{
      type: 'relation.delete', id: 'constraint_1' as RelationId,
    }]);
    const preview = previewTransaction({ document: before, currentRevision: revision }, transaction);
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') throw new Error('expected ready preview');

    const report = evaluateDrawingPreview({
      before, after: preview.resultingDocument, transaction, tolerance: 0.01,
    });

    expect(report.hardValid).toBe(true);
    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      code: 'CONSTRAINT_PERMISSION_REQUIRED',
      severity: 'decision_required',
      nodeIds: ['constraint_1'],
      action: 'constraint.delete',
    }));
  });

  it('does not mutate either document while evaluating the same candidate twice', () => {
    const before = fixture();
    const transaction = candidate([{
      type: 'geometry.update', id: 'line_left' as GeometryId, changes: { end: [9, 4] },
    }]);
    const preview = previewTransaction({ document: before, currentRevision: revision }, transaction);
    if (preview.status !== 'ready') throw new Error('expected ready preview');
    const beforeCopy = structuredClone(before);
    const afterCopy = structuredClone(preview.resultingDocument);

    const first = evaluateDrawingPreview({
      before, after: preview.resultingDocument, transaction, tolerance: 0.01,
    });
    const second = evaluateDrawingPreview({
      before, after: preview.resultingDocument, transaction, tolerance: 0.01,
    });

    expect(second).toEqual(first);
    expect(before).toEqual(beforeCopy);
    expect(preview.resultingDocument).toEqual(afterCopy);
  });

  it('reports changes outside the declared command set without rejecting them', () => {
    const before = fixture();
    const transaction = candidate([{
      type: 'geometry.update', id: 'line_left' as GeometryId, changes: { end: [9, 1] },
    }]);
    const preview = previewTransaction({ document: before, currentRevision: revision }, transaction);
    if (preview.status !== 'ready') throw new Error('expected ready preview');
    const after = structuredClone(preview.resultingDocument);
    const unrelated = after.geometry.find((node) => node.id === 'line_right');
    if (!unrelated || unrelated.type !== 'line') throw new Error('missing line');
    unrelated.end = [25, 0];

    const report = evaluateDrawingPreview({ before, after, transaction, tolerance: 0.01 });

    expect(report.hardValid).toBe(true);
    expect(report.diagnostics).toContainEqual(expect.objectContaining({
      code: 'UNDECLARED_NODE_CHANGE', severity: 'warning', nodeIds: ['line_right'],
    }));
  });
});

function fixture() {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_diagnostic' }, now: () => 1,
  });
  document.geometry.push({
    id: 'line_left' as GeometryId,
    type: 'line', visible: true, quality: confirmed,
    start: [0, 0], end: [10, 0],
  }, {
    id: 'line_right' as GeometryId,
    type: 'line', visible: true, quality: confirmed,
    start: [10, 0], end: [20, 0],
  });
  document.annotations.push({
    id: 'text_1' as AnnotationId,
    type: 'text', visible: true, quality: confirmed,
    content: '原始', position: [10, 2], height: 2, rotation: 0,
    alignment: 'center', verticalAlignment: 'baseline',
  });
  document.relations.push({
    id: 'constraint_1' as RelationId,
    type: 'constraint', plane: 'constraint', kind: 'horizontal',
    visible: true, quality: confirmed,
    geometryIds: ['line_left' as GeometryId], status: 'satisfied',
  });
  return document;
}

function candidate(
  commands: DrawingTransaction['commands'],
  confidence = 0.9,
): DrawingTransaction {
  return {
    id: 'transaction_diagnostic', baseRevision: revision,
    actor: { type: 'AI', id: 'drawing-agent' }, commands,
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
    metadata: {
      episodeId: 'episode_diagnostic', summary: 'Evaluate candidate diagnostics.', confidence,
    },
  };
}
