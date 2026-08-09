import { describe, expect, it } from 'vitest';

import { createEmptyDrawing, type GeometryId } from '../../../src/drawing/index.js';
import { projectFeedbackTransactionPreview, feedbackPreviewNodeId } from './preview-projector.js';

describe('feedback preview projector', () => {
  it('projects only the affected model transaction node under stable slot identity', () => {
    const document = createEmptyDrawing();
    document.geometry = [{
      id: 'existing_line' as GeometryId, type: 'line', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      start: [0, 0], end: [10, 10],
    }, {
      id: 'generated_circle' as GeometryId, type: 'circle', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      center: [200, 300], radius: 24,
    }];

    const projected = projectFeedbackTransactionPreview({
      document,
      affectedNodeIds: ['generated_circle'],
      slotId: 'slot_eye',
      confidence: 0.91,
      evidenceRefs: ['evidence_eye'],
    });

    expect(projected.nodes).toEqual([expect.objectContaining({
      id: feedbackPreviewNodeId('slot_eye'), type: 'circle',
      center: [200, 300], radius: 24,
      quality: {
        status: 'candidate', confidence: 0.91, evidenceRefs: ['evidence_eye'],
      },
    })]);
    expect(projected.labelsByNodeId).toEqual({
      [feedbackPreviewNodeId('slot_eye')]: '模型提案 1',
    });
  });

  it('does not invent a preview node for an affected deletion', () => {
    const projected = projectFeedbackTransactionPreview({
      document: createEmptyDrawing(),
      affectedNodeIds: ['deleted_circle'],
      slotId: 'slot_deleted',
      confidence: 0.8,
      evidenceRefs: ['evidence_deleted'],
    });

    expect(projected.nodes).toEqual([]);
  });
});
