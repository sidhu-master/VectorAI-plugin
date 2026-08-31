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
        list: () => ['local'], getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true, persona: true } }),
        start: async (_name: string, input: Record<string, unknown>) => { started = input; return { result: Promise.resolve({ stopReason: 'completed', structured: { proposals: [{ segmentIds: ['segment:1'], semanticType: 'shaft-seat', dimensionRole: 'ordinary', confidence: 0.8, reason: 'visible constant profile', visualEvidenceIds: ['observation:segment:1'] }] } }), dispose: async () => {} }; },
      },
    } as never, { renderObservation } as never);
    const result = await reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] });
    expect(renderObservation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ overlays: [expect.objectContaining({ id: 'observation:segment:1', label: 'S1' })] }), expect.any(AbortSignal));
    expect(started).toMatchObject({
      maxDepth: 1,
      toolFilter: { allow: [] },
    });
    expect(started?.persona).toMatch(/immediately|structured/i);
    expect(JSON.stringify(started?.prompt)).toContain('semanticType 必须从');
    expect(JSON.stringify(started?.prompt)).toContain('dimensionRole');
    expect(JSON.stringify(started?.prompt)).toContain('允许不覆盖全部轴段');
    expect(JSON.stringify(started?.prompt)).toContain('允许返回空 proposals');
    expect(JSON.stringify(started?.outputSchema)).not.toMatch(/maxItems|minItems|minimum|maximum|maxLength/);
    expect(result.draft.segments[0]).toMatchObject({ semanticType: 'shaft-seat' });
    expect(result.draft.semanticGroups[0]).toMatchObject({ dimensionRole: 'ordinary' });
  });

  it('shows already classified document regions as read-only visual context', async () => {
    const source = structuredClone(draft);
    source.axis.zMax = 2;
    source.segments = [
      { ...source.segments[0]!, id: 'segment:context', zStart: 0, zEnd: 1, semanticType: 'gear', name: '一级齿轮', semanticEvidenceIds: ['document:gear'] },
      { ...source.segments[0]!, id: 'segment:target', zStart: 1, zEnd: 2 },
    ];
    source.evidence = [{ id: 'document:gear', origin: 'document', label: '一级齿轮' }];
    source.semanticGroups = [{
      id: 'group:gear', segmentIds: ['segment:context'], range: { zStart: 0, zEnd: 1 },
      semanticType: 'gear', name: '一级齿轮', evidenceIds: ['document:gear'],
    }];
    const renderObservation = vi.fn(async () => ({ status: 'rendered' as const, png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 960, height: 720 }));
    let prompt: unknown;
    const reviewer = createPartitionSemanticReviewer({
      agents: { get: () => ({ id: 's' } as Agent) },
      attachments: { saveImage: async () => ({ attachmentId: 'image', mediaType: 'image/png', bytes: 1, width: 960, height: 720 }) },
      subagents: {
        list: () => ['local'], getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true } }),
        start: async (_name: string, input: Record<string, unknown>) => {
          prompt = input.prompt;
          return { result: Promise.resolve({ stopReason: 'completed', structured: { proposals: [] } }), dispose: async () => {} };
        },
      },
    } as never, { renderObservation } as never);

    await reviewer({ agent: { id: 's' } as Agent, draft: source, segmentIds: ['segment:target'] });

    expect(renderObservation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      overlays: expect.arrayContaining([
        expect.objectContaining({ id: 'context:group:gear', label: 'C1 一级齿轮' }),
        expect.objectContaining({ id: 'observation:segment:target', label: 'S1' }),
      ]),
    }), expect.any(AbortSignal));
    expect(JSON.stringify(prompt)).toContain('existingRegions');
    expect(JSON.stringify(prompt)).toContain('C 标签只作为已分类上下文');
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
            segmentIds: ['segment:1'], semanticType: 'shaft-seat', dimensionRole: 'ordinary', confidence: 2,
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

  it('reviews every target by splitting large drawings into bounded batches', async () => {
    const source = structuredClone(draft);
    source.axis.zMax = 129;
    source.segments = Array.from({ length: 129 }, (_, index) => ({
      ...source.segments[0]!, id: `segment:${index}`, zStart: index, zEnd: index + 1,
    }));
    source.segments[0]!.semanticType = 'bearing-seat';
    source.evidence = [{ id: 'document:context', origin: 'document', label: 'context' }];
    source.semanticGroups = [{
      id: 'group:context', segmentIds: ['segment:0'], range: { zStart: 0, zEnd: 1 },
      semanticType: 'bearing-seat', name: '左轴承位', evidenceIds: ['document:context'],
    }];
    const renderObservation = vi.fn(async (_agent: unknown, request: { overlays: unknown[] }) => ({
      status: 'rendered' as const, png: new Uint8Array([request.overlays.length]), contentDigest: 'sha256:image', width: 960, height: 720,
    }));
    let batch = 0;
    const start = vi.fn(async (name: string, input: Record<string, unknown>) => {
      void name;
      void input;
      const segmentIds = batch++ === 0
        ? Array.from({ length: 8 }, (_, index) => `segment:${index + 120}`)
        : Array.from({ length: 9 }, (_, index) => `segment:${index + 120}`);
      return {
        result: Promise.resolve({ stopReason: 'completed', structured: { proposals: [{
          segmentIds, semanticType: 'gear', dimensionRole: 'functional-feature', name: '跨批齿轮', confidence: 0.9,
          reason: '跨批次连续齿形', visualEvidenceIds: segmentIds.map((id) => `observation:${id}`),
        }] } }),
        dispose: async () => {},
      };
    });
    const reviewer = createPartitionSemanticReviewer({
      agents: { get: () => ({ id: 's' } as Agent) },
      attachments: { saveImage: async () => ({ attachmentId: 'image', mediaType: 'image/png', bytes: 1, width: 960, height: 720 }) },
      subagents: {
        list: () => ['local'], getProvider: () => ({ capabilities: { outputSchema: true, toolFilter: true, depthLimit: true } }), start,
      },
    } as never, { renderObservation } as never);

    const result = await reviewer({
      agent: { id: 's' } as Agent, draft: source,
      segmentIds: source.segments.slice(1).map(({ id }) => id),
    });

    expect(start).toHaveBeenCalledTimes(2);
    expect(renderObservation).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(start.mock.calls[1]?.[1])).toContain('segment:128');
    expect(renderObservation.mock.calls.every(([, request]) => request.overlays.length <= 128)).toBe(true);
    expect(result.draft.semanticGroups).toContainEqual(expect.objectContaining({
      name: '跨批齿轮', segmentIds: Array.from({ length: 9 }, (_, index) => `segment:${index + 120}`),
    }));
  });
});
