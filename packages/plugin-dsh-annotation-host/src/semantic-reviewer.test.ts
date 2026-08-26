// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it, vi } from 'vitest';
import { createPartitionSemanticReviewer } from './semantic-reviewer';

const draft: PartitionDraft = {
  version: 1, drawingRef: { drawingId: 'd', revision: 1 }, axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 1, orientation: 'forward' },
  segments: [{ id: 'segment:1', zStart: 0, zEnd: 1, profile: { minRadius: 1, maxRadius: 2, sampleCount: 3 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] }],
  semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
};

describe('partition semantic reviewer', () => {
  it('uses the first-layer numbered observation and a tool-free bounded child', async () => {
    const renderObservation = vi.fn(async () => ({ status: 'rendered' as const, png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 960, height: 720 }));
    let started: Record<string, unknown> | undefined;
    const reviewer = createPartitionSemanticReviewer({
      agents: { get: () => ({ id: 's' } as Agent) },
      attachments: { saveImage: async () => ({ attachmentId: 'image', mediaType: 'image/png', bytes: 1, width: 960, height: 720 }) },
      tools: { schemas: () => [{ name: 'drawing_observe' }, { name: 'structured_output' }, { name: 'drawing_select_parts' }] },
      subagents: {
        list: () => ['local'], getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true } }),
        start: async (_name: string, input: Record<string, unknown>) => { started = input; return { result: Promise.resolve({ stopReason: 'completed', structured: { proposals: [{ segmentIds: ['segment:1'], semanticType: 'shaft-seat', confidence: 0.8, reason: 'visible constant profile', visualEvidenceIds: ['observation:segment:1'] }] } }), dispose: async () => {} }; },
      },
    } as never, { renderObservation } as never);
    const result = await reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] });
    expect(renderObservation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ overlays: [expect.objectContaining({ id: 'observation:segment:1', label: 'S1' })] }), expect.any(AbortSignal));
    expect(started).toMatchObject({
      maxDepth: 1,
      toolFilter: { deny: ['drawing_observe', 'drawing_select_parts'] },
    });
    expect(JSON.stringify(started?.prompt)).toContain('名称、语义类型和理由必须使用简短中文');
    expect(JSON.stringify(started?.outputSchema)).not.toMatch(/maxItems|minItems|minimum|maximum|maxLength/);
    expect(result.draft.segments[0]).toMatchObject({ semanticType: 'shaft-seat' });
  });

  it('rejects proposal constraints that are enforced outside the DSH schema subset', async () => {
    const reviewer = createPartitionSemanticReviewer({
      agents: { get: () => ({ id: 's' } as Agent) },
      attachments: { saveImage: async () => ({ attachmentId: 'image', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }) },
      tools: { schemas: () => [{ name: 'drawing_observe' }] },
      subagents: {
        list: () => ['local'], getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true } }),
        start: async () => ({
          result: Promise.resolve({ stopReason: 'completed', structured: { proposals: [{
            segmentIds: ['segment:1'], semanticType: 'shaft-seat', confidence: 2,
            reason: 'x'.repeat(501), visualEvidenceIds: ['observation:segment:1'],
          }] } }),
          dispose: async () => {},
        }),
      },
    } as never, {
      renderObservation: async () => ({ status: 'rendered', png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 1, height: 1 }),
    } as never);
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] }))
      .rejects.toThrow('AI_SEMANTIC_PROPOSAL_INVALID');
  });

  it('times out a reviewer that does not return', async () => {
    const reviewer = createPartitionSemanticReviewer({} as never, {
      renderObservation: () => new Promise(() => {}),
    } as never, { timeoutMs: 5 });
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] })).rejects.toThrow('AI_SEMANTIC_REVIEW_TIMEOUT');
  });

  it('applies the same deadline while saving the observation attachment', async () => {
    const reviewer = createPartitionSemanticReviewer({
      attachments: { saveImage: () => new Promise(() => {}) },
    } as never, {
      renderObservation: async () => ({ status: 'rendered', png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 1, height: 1 }),
    } as never, { timeoutMs: 5 });
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] })).rejects.toThrow('AI_SEMANTIC_REVIEW_TIMEOUT');
  });
});
