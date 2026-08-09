import { describe, expect, it, vi } from 'vitest';

import type { DrawingAgentCompletion } from '../drawing-agent/model-adapters.js';
import { DrawingFeedbackModelAdapter } from './model-adapter.js';
import type { FeedbackDecisionInput } from './types.js';

describe('DrawingFeedbackModelAdapter', () => {
  it('parses a strict CV tool decision', async () => {
    const adapter = new DrawingFeedbackModelAdapter(async () => JSON.stringify({
      type: 'call_tool',
      toolCallId: 'call_overview',
      capability: 'inspect_source_overview',
      input: { sourceId: 'source_test1', budget: budget() },
    }));

    await expect(adapter.decide(input())).resolves.toMatchObject({
      type: 'call_tool', capability: 'inspect_source_overview',
    });
  });

  it('rejects unknown capabilities, raw samples, empty transactions, and premature finish', async () => {
    const replies = [
      { type: 'call_tool', toolCallId: 'bad', capability: 'run_shell', input: {} },
      {
        type: 'call_tool', toolCallId: 'raw', capability: 'cv_fit_primitive',
        input: { samples: [[1, 2]] },
      },
      { type: 'transact', toolCallId: 'empty', slotIds: ['slot_1'], commands: [], confidence: 0.8 },
      { type: 'finish', summary: '完成' },
    ];
    for (const reply of replies) {
      const adapter = new DrawingFeedbackModelAdapter(async () => JSON.stringify(reply));
      await expect(adapter.decide(input())).rejects.toMatchObject({
        name: 'DrawingFeedbackProtocolError',
      });
    }
  });

  it('bounds receipts, regions, slots, Drawing items and crop context', async () => {
    let received: Parameters<DrawingAgentCompletion>[0] | undefined;
    const complete = vi.fn<DrawingAgentCompletion>(async (request) => {
      received = request;
      return JSON.stringify({
        type: 'call_tool', toolCallId: 'call_next', capability: 'inspect_source_overview',
        input: { sourceId: 'source_test1', budget: budget() },
      });
    });
    const adapter = new DrawingFeedbackModelAdapter(complete);
    const oversized = input();
    oversized.recentReceipts = Array.from({ length: 30 }, (_, index) => ({
      id: `receipt_${index}`, samples: [[index, index]],
    })) as never;
    oversized.regions = Array.from({ length: 70 }, (_, index) => ({
      id: `region_${index}`, sourceId: 'source_test1',
      bounds: { x: 0, y: 0, width: 10, height: 10 }, purpose: 'geometry',
      targetSlotIds: [], resolutionLevel: 1, attempt: 1,
    }));
    oversized.slots = Array.from({ length: 70 }, (_, index) => ({
      id: `slot_${index}`, sourceId: 'source_test1', evidenceRefs: [], evidence: [],
      candidateTypes: [{ type: 'line', score: 0.8 }], drawingEntityIds: [],
      status: 'candidate', revision: 1, lineage: [],
    }));
    oversized.drawingItems = Array.from({ length: 180 }, (_, index) => ({
      id: `line_${index}`, type: 'line', summary: `line ${index}`,
    }));
    oversized.requestedCrops = [
      { sourceId: 'source_test1', regionId: 'region_1', mediaHandle: 'crop_1' },
      { sourceId: 'source_test1', regionId: 'region_2', mediaHandle: 'crop_2' },
    ];

    await adapter.decide(oversized);

    const context = JSON.parse(received!.userPrompt);
    expect(context.recentReceipts).toHaveLength(8);
    expect(context.regions).toHaveLength(32);
    expect(context.slots).toHaveLength(32);
    expect(context.drawingItems).toHaveLength(100);
    expect(context.requestedCrop).toEqual(oversized.requestedCrops[0]);
    expect(context.droppedContext).toMatchObject({ receipts: 22, regions: 38, slots: 38, drawingItems: 80, crops: 1 });
    expect(received!.userPrompt).not.toContain('samples');
    expect(received!.userPrompt).not.toContain('feedback-model');
  });
});

function input(): FeedbackDecisionInput {
  return {
    goal: '完整重建 test1',
    revision: 'revision_1',
    unresolvedRequired: 1,
    pendingInstructions: [],
    recentReceipts: [],
    regions: [],
    slots: [],
    drawingItems: [],
    requestedCrops: [],
    residual: null,
    modelName: 'feedback-model',
    signal: new AbortController().signal,
    deadlineAt: Date.now() + 10_000,
  };
}

function budget() {
  return { maxPixels: 1_000_000, maxResults: 32, maxSamplesPerResult: 2_000, timeoutMs: 10_000 };
}
