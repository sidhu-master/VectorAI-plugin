import { describe, expect, it, vi } from 'vitest';

import type {
  DrawingAgentAction,
  HumanDecisionRequest,
  PermissionGrant,
} from '../../../src/contracts/drawing-agent';
import type { DrawingId, RevisionId } from '../../../src/drawing';
import type { ModelToolReceipt } from '../drawing-tools/types';
import {
  ModelLoopActionAdapter,
  type ModelLoopCompletion,
} from './model-loop-adapter';

const drawingId = 'drawing_1' as DrawingId;
const revision = 'revision_1' as RevisionId;

describe('ModelLoopActionAdapter', () => {
  it('sends one bounded multimodal action context without a planner DAG or model name', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const complete = vi.fn<ModelLoopCompletion>(async (input) => {
      received = input;
      return JSON.stringify({
        type: 'tool', toolCallId: 'call_trace', tool: 'trace_paths',
        input: {
          seedPoints: [[10, 10]], stopPoints: [[20, 20]], directionHints: [[1, 1]],
          maxDepth: 20, maxCandidates: 4,
        },
      });
    });
    const adapter = new ModelLoopActionAdapter(complete, () => 100);

    const action = await adapter.next({
      objective: '修改目标二维形状',
      drawingId,
      revision,
      episodeId: 'episode_1',
      drawingSummary: {
        unit: 'mm', counts: { geometry: 2, annotation: 1, relation: 0, feature: 0 },
        items: [{
          id: 'line_a', plane: 'geometry', type: 'line', summary: 'line [0,0]->[10,0]',
        }],
        truncated: false,
      },
      toolCatalog: [{ name: 'trace_paths', version: '1.0.0', access: 'read', timeoutMs: 10_000 }],
      recentToolResults: [{
        schemaVersion: 1, receipt: receipt('query_nodes'), output: { items: [] },
      }],
      recentDiagnostics: [{ code: 'NEW_DANGLING_ENDPOINT', severity: 'warning', nodeIds: ['line_a'] }],
      decisions: [{ request: decisionRequest(), grants: [grant()] }],
      appendedInstructions: ['保留其他区域'],
      currentPreviewHandle: 'preview_1',
      observations: [{
        id: 'view_overview', purpose: 'overview', imageDataUrl: 'data:image/png;base64,AAAA',
        width: 100, height: 100,
        worldBounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
        worldToImage: [1, 0, 0, -1, 0, 100],
        grounding: [],
      }],
      modelName: 'private-model-name',
      attempt: 1,
      signal: new AbortController().signal,
      deadlineAt: 1_000,
    });

    expect(action).toMatchObject({ type: 'tool', tool: 'trace_paths' });
    expect(received).toMatchObject({
      modelName: 'private-model-name',
      signal: expect.any(AbortSignal),
      images: [{ id: 'view_overview', dataUrl: 'data:image/png;base64,AAAA' }],
      responseSchema: { name: 'drawing_agent_next_action' },
    });
    expect(received?.systemPrompt).toContain('Drawing IR');
    expect(received?.systemPrompt).toContain('模型拥有完整编辑能力');
    expect(received?.systemPrompt).not.toContain('超过肩膀');
    expect(received?.userPrompt).toContain('NEW_DANGLING_ENDPOINT');
    expect(received?.userPrompt).toContain('trace_paths');
    expect(received?.userPrompt).toContain('保留其他区域');
    expect(received?.userPrompt).not.toContain('private-model-name');
    expect(received?.userPrompt).not.toContain('workflow');
    expect(received?.userPrompt).not.toContain('hiddenReasoning');
  });

  it.each([
    { type: 'commit', previewHandle: 'preview_1', summary: '提交候选', confidence: 0.9 },
    { type: 'finish', summary: '分析已经完成' },
    {
      type: 'request-human-decision',
      request: {
        kind: 'confirm-intent', question: '请选择目标', reason: '存在两个同等候选',
        options: [
          { id: 'left', label: '左侧', effect: { type: 'intent', decision: 'confirm' } },
          { id: 'cancel', label: '取消', effect: { type: 'intent', decision: 'reject' } },
        ],
        affectedResources: [{ plane: 'geometry', ids: ['left', 'right'], action: 'select-target' }],
      },
    },
  ] satisfies DrawingAgentAction[])('parses the $type action from fenced JSON', async (expected) => {
    const adapter = new ModelLoopActionAdapter(async () => `\n\`\`\`json\n${JSON.stringify(expected)}\n\`\`\`\n`);
    await expect(adapter.next(input())).resolves.toEqual(expected);
  });

  it('surfaces an exact protocol error for bounded correction instead of repairing semantics', async () => {
    const adapter = new ModelLoopActionAdapter(async () => JSON.stringify({
      type: 'tool', toolCallId: 'call_bad', tool: 'trace_paths', input: {},
      reasoning: 'must not be stored',
    }));

    await expect(adapter.next(input())).rejects.toMatchObject({
      name: 'DrawingAgentProtocolError', path: 'action.reasoning',
    });
  });

  it('includes only the exact protocol correction on a retry and supports text-only calls', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (input) => {
      received = input;
      return '{"type":"finish","summary":"corrected"}';
    }, () => 100);

    await adapter.next({
      ...input(), observations: [], attempt: 2,
      protocolFeedback: 'action.tool: 不支持的工具',
    });

    expect(received?.images).toEqual([]);
    expect(received?.userPrompt).toContain('action.tool: 不支持的工具');
  });
});

function input(): Parameters<ModelLoopActionAdapter['next']>[0] {
  return {
    objective: '检查当前图纸', drawingId, revision, episodeId: 'episode_1',
    drawingSummary: {
      unit: 'mm', counts: { geometry: 0, annotation: 0, relation: 0, feature: 0 },
      items: [], truncated: false,
    },
    toolCatalog: [], recentToolResults: [], recentDiagnostics: [], decisions: [],
    appendedInstructions: [], observations: [], attempt: 1,
    modelName: 'model', signal: new AbortController().signal,
    deadlineAt: Date.now() + 1_000_000,
  };
}

function receipt(tool: string): ModelToolReceipt {
  return {
    schemaVersion: 1, runId: 'run_1', episodeId: 'episode_1', drawingId,
    toolCallId: 'call_1', tool, toolVersion: '1.0.0', access: 'read',
    status: 'succeeded', revisionBefore: revision, revisionAfter: revision,
    affectedNodeIds: [], inputDigest: 'sha256:input', outputDigest: 'sha256:output', durationMs: 2,
  };
}

function decisionRequest(): HumanDecisionRequest {
  return {
    id: 'request_1', episodeId: 'episode_1', revision,
    candidateId: 'preview_1', transactionDigest: 'a'.repeat(64),
    kind: 'grant-permission', question: '允许吗', reason: '需要权限',
    options: [{
      id: 'allow', label: '允许', effect: {
        type: 'permission', decision: 'allow', actions: ['constraint.delete'],
        resourceIds: ['constraint_1'],
      },
    }],
    affectedResources: [{ plane: 'relation', ids: ['constraint_1'], action: 'constraint.delete' }],
    previewHandle: 'preview_1', expiresWhenRevisionChanges: true,
  };
}

function grant(): PermissionGrant {
  return {
    id: 'grant_1', requestId: 'request_1', episodeId: 'episode_1', revision,
    transactionDigest: 'a'.repeat(64), actions: ['constraint.delete'],
    resourceIds: ['constraint_1'], effect: 'allow', scope: 'candidate',
  };
}
