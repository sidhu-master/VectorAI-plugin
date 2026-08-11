import { describe, expect, it, vi } from 'vitest';

import { createEmptyDrawing } from '../document/create';
import type { DrawingDocument, GeometryId, RevisionId } from '../document/types';
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
