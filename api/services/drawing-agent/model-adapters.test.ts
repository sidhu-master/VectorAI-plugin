import { describe, expect, it, vi } from 'vitest';

import type { DrawingAgentPlan } from '../../../src/contracts/drawing-agent';
import type { DrawingId, RevisionId } from '../../../src/drawing/index';
import type { DrawingToolReceipt } from './types';
import {
  DrawingDecisionAdapter,
  DrawingPlannerAdapter,
  type DrawingAgentCompletion,
} from './model-adapters';

const revision = 'revision_1' as RevisionId;
const drawingId = 'drawing_1' as DrawingId;

const validPlan: DrawingAgentPlan = {
  goal: {
    id: 'goal_1',
    objective: '把圆半径改为 10',
    scope: { plane: 'geometry', types: ['circle'], limit: 20 },
    acceptanceCriteria: [{
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 10,
    }],
    riskPolicy: { candidateAllowed: true, maxCommits: 2 },
  },
  workflow: [{
    id: 'inspect_circle', capability: 'inspect_entity', dependsOn: [],
    completionCriteria: [], status: 'pending',
  }, {
    id: 'edit_circle', capability: 'edit_entities', dependsOn: ['inspect_circle'],
    completionCriteria: [{
      type: 'property.equals', nodeId: 'circle_1', path: 'radius', value: 10,
    }],
    status: 'pending',
  }],
  summary: '检查圆并修改半径',
};

describe('drawing-native model adapters', () => {
  it('sends the planner only a bounded Drawing IR summary and parses its strict result', async () => {
    let received: Parameters<DrawingAgentCompletion>[0] | undefined;
    const signal = new AbortController().signal;
    const complete: DrawingAgentCompletion = vi.fn(async (input) => {
      received = input;
      return JSON.stringify(validPlan);
    });
    const adapter = new DrawingPlannerAdapter(complete, () => 100);

    const result = await adapter.plan({
      objective: '把圆半径改为 10',
      instruction: '只修改选中的圆',
      drawingId,
      revision,
      summary: {
        unit: 'mm',
        counts: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
        bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
        items: [{
          id: 'circle_1', plane: 'geometry', type: 'circle',
          summary: 'circle center=[0,0] radius=5',
        }],
        truncated: false,
      },
      modelName: 'internal-model-name',
      signal,
      deadlineAt: 1_000,
      document: { sentinel: 'FULL_DOCUMENT_MUST_NOT_LEAK' },
      history: ['HISTORY_MUST_NOT_LEAK'],
    } as never);

    expect(result).toEqual(validPlan);
    expect(received).toMatchObject({ role: 'planner', modelName: 'internal-model-name', signal });
    expect(received?.systemPrompt).toContain('Drawing IR');
    expect(received?.systemPrompt).toContain('不得输出 commit');
    expect(received?.userPrompt).toContain('circle_1');
    expect(received?.userPrompt).not.toContain('FULL_DOCUMENT_MUST_NOT_LEAK');
    expect(received?.userPrompt).not.toContain('HISTORY_MUST_NOT_LEAK');
    expect(received?.userPrompt).not.toContain('internal-model-name');
  });

  it('gives the decision role bounded tool evidence and never asks it to commit', async () => {
    let received: Parameters<DrawingAgentCompletion>[0] | undefined;
    const complete: DrawingAgentCompletion = vi.fn(async (input) => {
      received = input;
      return '```json\n{"type":"inspect","toolCallId":"call_2","nodeId":"circle_1"}\n```';
    });
    const adapter = new DrawingDecisionAdapter(complete, () => 100);
    const receipt = toolReceipt();

    const decision = await adapter.decide({
      plan: validPlan,
      currentWorkflowNodeId: 'inspect_circle',
      revision,
      pendingInstructions: ['不要移动圆心'],
      recentReceipts: [receipt],
      toolEvidence: [{
        receipt,
        output: {
          items: [{
            id: 'circle_1', plane: 'geometry', type: 'circle',
            summary: 'circle center=[0,0] radius=5',
          }],
          truncated: false,
        },
      }],
      attempt: 1,
      modelName: 'decision-model',
      signal: new AbortController().signal,
      deadlineAt: 1_000,
      document: { sentinel: 'DRAWING_DOCUMENT' },
      commits: [{ sentinel: 'DRAWING_HISTORY' }],
    } as never);

    expect(decision).toEqual({ type: 'inspect', toolCallId: 'call_2', nodeId: 'circle_1' });
    expect(received).toMatchObject({ role: 'decision', modelName: 'decision-model' });
    expect(received?.systemPrompt).toContain('只能输出一个决策');
    expect(received?.systemPrompt).toContain('提交由运行时');
    expect(received?.userPrompt).toContain('circle_1');
    expect(received?.userPrompt).not.toContain('DRAWING_DOCUMENT');
    expect(received?.userPrompt).not.toContain('DRAWING_HISTORY');
    expect(received?.userPrompt).not.toContain('decision-model');
  });

  it('propagates strict parser failures instead of accepting a legacy Spatial Intent', async () => {
    const adapter = new DrawingPlannerAdapter(async () => JSON.stringify({
      operation: 'modify', objects: [], spatialModel: { entities: [] },
    }));

    await expect(adapter.plan(plannerInput())).rejects.toMatchObject({
      name: 'DrawingAgentProtocolError', path: 'plan.operation',
    });
  });

  it('forwards AbortSignal and refuses calls after the runtime deadline', async () => {
    const complete = vi.fn<DrawingAgentCompletion>(async () => JSON.stringify(validPlan));
    const signal = new AbortController().signal;
    const active = new DrawingPlannerAdapter(complete, () => 100);
    await active.plan({ ...plannerInput(), signal, deadlineAt: 101 });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ signal }));

    const expired = new DrawingPlannerAdapter(complete, () => 200);
    await expect(expired.plan({ ...plannerInput(), deadlineAt: 200 })).rejects.toThrow(
      'planner deadline exceeded',
    );
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('bounds oversized tool evidence before it enters the model context', async () => {
    let received: Parameters<DrawingAgentCompletion>[0] | undefined;
    const complete: DrawingAgentCompletion = vi.fn(async (input) => {
      received = input;
      return '{"type":"finish","summary":"完成"}';
    });
    const adapter = new DrawingDecisionAdapter(complete);
    const receipt = toolReceipt();

    await adapter.decide({
      plan: validPlan,
      currentWorkflowNodeId: 'inspect_circle', revision,
      pendingInstructions: Array.from({ length: 50 }, (_, index) => `instruction_${index}`),
      recentReceipts: Array.from({ length: 50 }, () => receipt),
      toolEvidence: Array.from({ length: 50 }, () => ({
        receipt,
        output: {
          node: {
            id: 'spline_1', type: 'spline', visible: true,
            quality: { status: 'confirmed', evidenceRefs: [] },
            degree: 3,
            controlPoints: Array.from({ length: 200 }, (_, index) => [index, index]),
            knots: Array.from({ length: 200 }, (_, index) => index),
            closed: false, periodic: false,
          },
          relations: [], features: [],
        },
      })) as never,
      attempt: 2, modelName: 'model', signal: new AbortController().signal,
      deadlineAt: Date.now() + 10_000,
    });

    const payload = JSON.parse(received!.userPrompt);
    expect(payload.pendingInstructions).toHaveLength(8);
    expect(payload.recentReceipts).toHaveLength(8);
    expect(payload.toolEvidence).toHaveLength(8);
    expect(payload.toolEvidence[0].output.node.controlPoints).toHaveLength(32);
  });
});

function plannerInput() {
  return {
    objective: '检查图纸', drawingId, revision,
    summary: {
      unit: 'mm' as const,
      counts: { geometry: 0, annotation: 0, relation: 0, feature: 0 },
      items: [], truncated: false,
    },
    modelName: 'model', signal: new AbortController().signal,
    deadlineAt: Date.now() + 10_000,
  };
}

function toolReceipt(): DrawingToolReceipt {
  return {
    toolCallId: 'call_1', capability: 'query_entities', version: '1.0.0', access: 'read',
    inputDigest: 'a'.repeat(64), revisionBefore: revision, revisionAfter: revision,
    affectedNodeIds: ['circle_1'], outcome: { kind: 'query', count: 1, truncated: false },
    durationMs: 5, status: 'succeeded', retry: { allowed: false },
  };
}
