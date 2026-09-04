// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it, vi } from 'vitest';
import {
  RecognitionPipelineRunner,
  type RecognitionModelPort,
  type RecognitionModelRequest,
} from './recognition-runtime';
import { createPartitionSemanticPipeline, createPartitionSemanticReviewer } from './semantic-reviewer';

const draft: PartitionDraft = {
  version: 1,
  drawingRef: { drawingId: 'd', revision: 1 },
  axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 1, orientation: 'forward' },
  segments: [{
    id: 'segment:1', zStart: 0, zEnd: 1,
    profile: { minRadius: 1, maxRadius: 2, sampleCount: 3 },
    boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [],
  }],
  semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
};

describe('partition semantic reviewer', () => {
  it('uses the first-layer numbered observation and a bounded model request', async () => {
    const renderObservation = vi.fn(async () => ({
      status: 'rendered' as const, png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 960, height: 720,
    }));
    const review = vi.fn(async (_request: RecognitionModelRequest<unknown>) => modelResult({ proposals: [{
      segmentIds: ['segment:1'], semanticType: 'shaft-seat', dimensionRole: 'ordinary', confidence: 0.8,
      reason: 'visible constant profile', visualEvidenceIds: ['observation:segment:1'],
    }] }));
    const reviewer = reviewerWith(review, renderObservation);

    const result = await reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] });

    expect(renderObservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ overlays: [expect.objectContaining({ id: 'observation:segment:1', label: 'S1' })] }),
      expect.any(AbortSignal),
    );
    expect(review).toHaveBeenCalledWith(expect.objectContaining({
      pipelineId: 'partition-semantic-review', pipelineVersion: '1', parentSessionId: 's', maxDepth: 1,
      prompt: expect.arrayContaining([
        expect.objectContaining({ type: 'image', data: new Uint8Array([1]), mediaType: 'image/png' }),
      ]),
    }));
    const request = review.mock.calls[0]![0];
    expect(request.persona).toMatch(/immediately|structured/i);
    expect(JSON.stringify(request.prompt)).toContain('semanticType 必须从');
    expect(JSON.stringify(request.prompt)).toContain('dimensionRole');
    expect(JSON.stringify(request.prompt)).toContain('允许不覆盖全部轴段');
    expect(JSON.stringify(request.prompt)).toContain('允许返回空 proposals');
    expect(JSON.stringify(request.outputSchema)).not.toMatch(/maxItems|minItems|minimum|maximum|maxLength/);
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
    const renderObservation = vi.fn(async () => ({
      status: 'rendered' as const, png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 960, height: 720,
    }));
    const review = vi.fn(async (_request: RecognitionModelRequest<unknown>) => modelResult({ proposals: [] }));
    const reviewer = reviewerWith(review, renderObservation);

    await reviewer({ agent: { id: 's' } as Agent, draft: source, segmentIds: ['segment:target'] });

    expect(renderObservation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      overlays: expect.arrayContaining([
        expect.objectContaining({ id: 'context:group:gear', label: 'C1 一级齿轮' }),
        expect.objectContaining({ id: 'observation:segment:target', label: 'S1' }),
      ]),
    }), expect.any(AbortSignal));
    expect(JSON.stringify(review.mock.calls[0]![0].prompt)).toContain('existingRegions');
    expect(JSON.stringify(review.mock.calls[0]![0].prompt)).toContain('C 标签只作为已分类上下文');
  });

  it('rejects proposal constraints that are enforced outside the DSH schema subset', async () => {
    const reviewer = reviewerWith(
      async () => modelResult({ proposals: [{
        segmentIds: ['segment:1'], semanticType: 'shaft-seat', dimensionRole: 'ordinary', confidence: 2,
        reason: 'x'.repeat(501), visualEvidenceIds: ['observation:segment:1'],
      }] }),
      async () => ({ status: 'rendered', png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 1, height: 1 }),
    );
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] }))
      .rejects.toThrow('AI_SEMANTIC_PROPOSAL_INVALID');
  });

  it('times out a reviewer while rendering the observation', async () => {
    const reviewer = reviewerWith(
      async () => modelResult({ proposals: [] }),
      () => new Promise(() => {}),
      { timeoutMs: 5 },
    );
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] }))
      .rejects.toThrow('AI_SEMANTIC_REVIEW_TIMEOUT');
  });

  it('applies the same deadline while waiting for the model adapter', async () => {
    const reviewer = reviewerWith(
      () => new Promise(() => {}),
      async () => ({ status: 'rendered', png: new Uint8Array([1]), contentDigest: 'sha256:image', width: 1, height: 1 }),
      { timeoutMs: 5 },
    );
    await expect(reviewer({ agent: { id: 's' } as Agent, draft, segmentIds: ['segment:1'] }))
      .rejects.toThrow('AI_SEMANTIC_REVIEW_TIMEOUT');
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
      status: 'rendered' as const, png: new Uint8Array([request.overlays.length]),
      contentDigest: 'sha256:image', width: 960, height: 720,
    }));
    let batch = 0;
    const review = vi.fn(async (_request: RecognitionModelRequest<unknown>) => {
      const segmentIds = batch++ === 0
        ? Array.from({ length: 8 }, (_, index) => `segment:${index + 120}`)
        : Array.from({ length: 9 }, (_, index) => `segment:${index + 120}`);
      return modelResult({ proposals: [{
        segmentIds, semanticType: 'gear', dimensionRole: 'functional-feature', name: '跨批齿轮', confidence: 0.9,
        reason: '跨批次连续齿形', visualEvidenceIds: segmentIds.map((id) => `observation:${id}`),
      }] });
    });
    const reviewer = reviewerWith(review, renderObservation);

    const result = await reviewer({
      agent: { id: 's' } as Agent, draft: source,
      segmentIds: source.segments.slice(1).map(({ id }) => id),
    });

    expect(review).toHaveBeenCalledTimes(2);
    expect(renderObservation).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(review.mock.calls[1]![0])).toContain('segment:128');
    expect(renderObservation.mock.calls.every(([, request]) => request.overlays.length <= 128)).toBe(true);
    expect(result.draft.semanticGroups).toContainEqual(expect.objectContaining({
      name: '跨批齿轮', segmentIds: Array.from({ length: 9 }, (_, index) => `segment:${index + 120}`),
    }));
  });
});

function reviewerWith(
  review: (...args: any[]) => Promise<any>,
  renderObservation: (...args: any[]) => Promise<any>,
  options: { timeoutMs?: number } = {},
) {
  const runner = new RecognitionPipelineRunner({ review } as RecognitionModelPort);
  runner.register(createPartitionSemanticPipeline({ renderObservation } as never, options));
  return createPartitionSemanticReviewer(runner);
}

function modelResult(structured: unknown) {
  return {
    stopReason: 'completed',
    structured,
    observations: [{
      provider: 'fixture', model: 'fixture', messageCount: 2,
      systemDigest: 'sha256:system', toolNames: ['structured_output'], requestDigest: 'sha256:request',
    }],
  };
}
