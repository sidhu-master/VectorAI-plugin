import { describe, expect, it } from 'vitest';

import { projectFeedbackCandidates, feedbackPreviewNodeId } from './preview-projector.js';

describe('feedback preview projector', () => {
  it('projects bounded document-space fits into provisional Drawing nodes by slot identity', () => {
    const projected = projectFeedbackCandidates({
      evidence: [{
        handle: 'evidence_outline', sourceId: 'source_test1', regionId: 'region_head',
        kind: 'contour', bounds: { x: 100, y: 80, width: 900, height: 850 },
        confidence: 0.82, touchesRegionEdge: false, sampleCount: 512,
      }, {
        handle: 'evidence_eye', sourceId: 'source_test1', regionId: 'region_head',
        kind: 'circle-candidate', bounds: { x: 400, y: 300, width: 120, height: 120 },
        confidence: 0.91, touchesRegionEdge: false, sampleCount: 128,
      }],
      suggestedFits: [{
        evidenceHandle: 'evidence_outline', primitiveType: 'polyline',
        documentParameters: {
          vertices: [{ point: [40, 60] }, { point: [400, 60] }, { point: [400, 500] }],
          closed: false,
        },
      }, {
        evidenceHandle: 'evidence_eye', primitiveType: 'circle',
        documentParameters: { center: [200, 300], radius: 24 },
      }],
      slotIdsByEvidence: {
        evidence_outline: 'slot_outline',
        evidence_eye: 'slot_eye',
      },
    });

    expect(projected.nodes).toEqual([
      expect.objectContaining({
        id: feedbackPreviewNodeId('slot_outline'), type: 'polyline',
        vertices: [{ point: [40, 60] }, { point: [400, 60] }, { point: [400, 500] }],
        quality: expect.objectContaining({ status: 'candidate', confidence: 0.82 }),
      }),
      expect.objectContaining({
        id: feedbackPreviewNodeId('slot_eye'), type: 'circle',
        center: [200, 300], radius: 24,
      }),
    ]);
    expect(projected.labelsByNodeId[feedbackPreviewNodeId('slot_outline')]).toBe('轮廓 1');
    expect(JSON.stringify(projected)).not.toMatch(/sourceParameters|samples|base64/);
  });

  it('drops malformed and unsupported fits instead of inventing geometry', () => {
    const projected = projectFeedbackCandidates({
      evidence: [{
        handle: 'evidence_bad', sourceId: 'source_test1', regionId: 'region_bad',
        kind: 'circle-candidate', bounds: { x: 0, y: 0, width: 10, height: 10 },
        confidence: 0.2, touchesRegionEdge: false, sampleCount: 5,
      }],
      suggestedFits: [{
        evidenceHandle: 'evidence_bad', primitiveType: 'circle',
        documentParameters: { center: ['bad', 1], radius: -1 },
      }],
      slotIdsByEvidence: { evidence_bad: 'slot_bad' },
    });

    expect(projected.nodes).toEqual([]);
  });
});
