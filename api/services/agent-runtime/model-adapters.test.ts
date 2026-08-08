import { describe, expect, it } from 'vitest';
import { createEmptyModel } from '../../../src/core/model';
import type { SpatialIntent } from '../../../src/core/types';
import type { TaskPlan } from '../../../src/core/agent';
import { GatewayExecutorAdapter, GatewayPlannerAdapter } from './model-adapters';

const plan: TaskPlan = {
  task: 'create_from_text', summary: '创建点',
  steps: [{ id: 1, action: 'create_entities', description: '创建点', status: 'pending' }],
};

describe('gateway runtime adapters', () => {
  it('forwards guidance and the runtime AbortSignal to planning', async () => {
    let received: Record<string, unknown> | undefined;
    const signal = new AbortController().signal;
    const adapter = new GatewayPlannerAdapter(async (input) => {
      received = input as unknown as Record<string, unknown>;
      return plan;
    });

    await adapter.plan({
      goal: '创建点', model: createEmptyModel(), instruction: '放到原点', signal, deadlineAt: 10,
    });

    expect(received).toMatchObject({ prompt: '创建点\n用户追加指令：放到原点', signal });
  });

  it('forwards validation errors and the runtime AbortSignal to execution', async () => {
    let received: Record<string, unknown> | undefined;
    const signal = new AbortController().signal;
    const response: SpatialIntent = { objects: [] };
    const adapter = new GatewayExecutorAdapter(async (input) => {
      received = input as unknown as Record<string, unknown>;
      return response;
    });

    expect(await adapter.execute({
      goal: '创建点', plan, step: plan.steps[0], model: createEmptyModel(),
      context: {
        goal: '创建点', stableRules: [], recentReceipts: [], completedStageSummaries: [],
        durableFacts: {}, transientSignals: {},
      },
      attempt: 2, previousErrors: ['radius 必须大于 0'], signal, deadlineAt: 10,
      image: 'anBlZw==', mimeType: 'image/jpeg',
    })).toBe(response);

    expect(received).toMatchObject({
      step: plan.steps[0], plan, signal, correctionErrors: ['radius 必须大于 0'],
      currentView: 'anBlZw==', currentViewMimeType: 'image/jpeg',
    });
  });
});
