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
  modelLoopActionSchema,
  type ModelLoopCompletion,
} from './model-loop-adapter';
import { MODEL_DRAWING_TOOL_GUIDES } from '../drawing-tools/catalog';

const drawingId = 'drawing_1' as DrawingId;
const revision = 'revision_1' as RevisionId;

describe('ModelLoopActionAdapter', () => {
  it('keeps the default spatial-edit response contract compact through shared schema definitions', () => {
    const names = [
      'measure_geometry', 'build_world_slice', 'preview_spatial_program', 'preview_transaction',
    ];
    const schema = modelLoopActionSchema(names.map((name) => ({
      name,
      version: '1.0.0',
      access: name.startsWith('preview_') ? 'write' as const : 'read' as const,
      timeoutMs: 15_000,
      ...MODEL_DRAWING_TOOL_GUIDES[name],
    })));

    expect(schema.schema).toHaveProperty('$defs.spatialPointRef');
    expect(schema.schema).toHaveProperty('$defs.drawingCommand');
    expect(Buffer.byteLength(JSON.stringify(schema))).toBeLessThan(12_000);
  });

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
      toolCatalog: [
        {
          name: 'trace_paths', version: '1.0.0', access: 'read', timeoutMs: 10_000,
          ...MODEL_DRAWING_TOOL_GUIDES.trace_paths,
        },
        {
          name: 'preview_spatial_program', version: '1.0.0', access: 'write', timeoutMs: 15_000,
          ...MODEL_DRAWING_TOOL_GUIDES.preview_spatial_program,
        },
        {
          name: 'preview_transaction', version: '1.0.0', access: 'write', timeoutMs: 15_000,
          ...MODEL_DRAWING_TOOL_GUIDES.preview_transaction,
        },
      ],
      recentToolResults: [{
        schemaVersion: 1, receipt: receipt('query_nodes'), output: {
          items: [], previewHandle: 'preview_from_result',
          observation: {
            revision: 'revision_old',
            views: [{ grounding: ['duplicated_observation_payload_must_be_removed'] }],
          },
        },
      }],
      recentDiagnostics: [{ code: 'NEW_DANGLING_ENDPOINT', severity: 'warning', nodeIds: ['line_a'] }],
      decisions: [{ request: decisionRequest(), grants: [grant()] }],
      appendedInstructions: ['保留其他区域'],
      stableRules: ['保持已有连接关系'],
      source: {
        sourceId: 'source_aaaaaaaaaaaaaaaaaaaaaaaa',
        mimeType: 'image/png', byteLength: 1024, page: 1,
      },
      sourceImage: {
        id: 'source_page_1',
        imageDataUrl: 'data:image/png;base64,SOURCE',
        width: 1360,
        height: 2048,
      },
      currentPreview: {
        previewHandle: 'preview_1', transactionDigest: 'sha256:preview-one',
        affectedNodeIds: ['line_a'],
      },
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
      images: [
        {
          id: 'source_page_1', dataUrl: 'data:image/png;base64,SOURCE',
          width: 1360, height: 2048,
        },
      ],
      responseSchema: { name: 'drawing_agent_next_action' },
    });
    const traceActionSchema = (received?.responseSchema?.schema.oneOf as Array<{
      properties?: { tool?: { const?: string }; input?: Record<string, unknown> };
    }>).find((candidate) => candidate.properties?.tool?.const === 'trace_paths');
    expect(traceActionSchema?.properties?.input).toMatchObject({
      type: 'object', additionalProperties: false,
      required: ['seedPoints', 'stopPoints', 'directionHints', 'maxDepth', 'maxCandidates'],
    });
    expect(received?.systemPrompt).toContain('Drawing IR');
    expect(received?.systemPrompt).toContain('模型拥有完整编辑能力');
    expect(received?.systemPrompt).toContain('Y 正方向在屏幕上始终向上');
    expect(received?.systemPrompt).toContain('editBaseOptions');
    expect(received?.systemPrompt).toContain('revise_preview');
    expect(received?.systemPrompt).toContain('excludedSupports');
    expect(received?.systemPrompt).toContain('不得通过包围区域相交');
    expect(received?.systemPrompt).toContain('语义方位必须绑定明确坐标框架');
    expect(received?.systemPrompt).toContain('对象的左/右/前/后');
    expect(received?.systemPrompt).toContain('画面/屏幕的左/右/上/下');
    expect(received?.systemPrompt).toContain('SpatialEditProgram');
    expect(received?.systemPrompt).toContain('preview_spatial_program');
    expect(received?.systemPrompt).toContain('默认快速入口');
    expect(received?.systemPrompt).toContain('不要为了表达“其他内容不变”');
    expect(received?.systemPrompt).toContain('revise_preview.corrections');
    expect(received?.systemPrompt).toContain('DrawingAssertion');
    expect(received?.systemPrompt).toContain('不要手算 worldToImage 的逆矩阵');
    expect(received?.systemPrompt).toContain('只有目标确有歧义');
    expect(received?.systemPrompt).not.toContain('超过肩膀');
    expect(received?.systemPrompt).not.toContain('当一个闭合 Circle/Ellipse');
    expect(received?.userPrompt).toContain('NEW_DANGLING_ENDPOINT');
    expect(received?.userPrompt).toContain('trace_paths');
    expect(received?.userPrompt).toContain('preview_transaction');
    expect(received?.userPrompt).toContain('preview_spatial_program');
    expect(received?.userPrompt).toContain('source_aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(received?.userPrompt).toContain('source_page_1');
    expect(received?.userPrompt).toContain('source-pixel');
    const publicContext = JSON.parse(received!.userPrompt);
    expect(publicContext.coordinateContract).toMatchObject({
      worldSpace: { xPositive: 'visual-right', yPositive: 'visual-up' },
      imageSpace: { xPositive: 'visual-right', yPositive: 'visual-down' },
      conversion: {
        authoritativeTransform: 'observationIndex[].worldToImage',
        resolvedBy: 'backend',
        preferredPointReference: 'observation-normalized',
        modelRule: expect.stringContaining('不要手算'),
      },
      pointReferences: {
        visualPoint: { kind: 'observation', normalizedRange: [0, 1] },
        exactGeometryPoint: { kind: 'node_anchor' },
        documentPoint: { kind: 'world', frameId: 'document' },
      },
      semanticDirections: {
        ownedDirections: 'object-local',
        screenDirections: 'observation',
        frontFacingLateralRelation: 'mirrored',
      },
    });
    expect(publicContext.observationIndex).toEqual([]);
    expect(received?.userPrompt).not.toContain('view_overview');
    expect(received?.userPrompt).not.toContain('base64');
    expect(received?.userPrompt).toContain('保留其他区域');
    expect(received?.userPrompt).toContain('保持已有连接关系');
    expect(received?.userPrompt).toContain('preview_from_result');
    expect(received?.userPrompt).not.toContain('duplicated_observation_payload_must_be_removed');
    expect(received?.userPrompt).not.toContain('private-model-name');
    expect(received?.userPrompt).not.toContain('workflow');
    expect(received?.userPrompt).not.toContain('hiddenReasoning');
  });

  it('binds redraw_region to its nested polygon input schema', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"schema inspected"}';
    });

    await adapter.next({
      ...input(),
      toolCatalog: [{
        name: 'redraw_region', version: '1.0.0', access: 'write', timeoutMs: 120_000,
        ...MODEL_DRAWING_TOOL_GUIDES.redraw_region,
      }],
    });

    const branches = received?.responseSchema?.schema.oneOf as Array<{
      properties?: { tool?: { const?: string }; input?: Record<string, unknown> };
    }>;
    const redraw = branches.find((branch) => branch.properties?.tool?.const === 'redraw_region');
    expect(redraw?.properties?.input).toMatchObject({
      required: ['prompt', 'contours', 'holes'],
      properties: {
        contours: {
          type: 'array', minItems: 1,
          items: { type: 'array', minItems: 3, items: { minItems: 2, maxItems: 2 } },
        },
      },
    });
  });

  it.each([
    {
      type: 'commit', previewHandle: 'preview_1', summary: '提交候选', confidence: 0.9,
    },
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

  it('projects the computed World Model and audited decision evidence into the model context', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"world received"}';
    });

    await adapter.next({
      ...input(),
      spatialContext: {
        globalMap: {
          unit: 'mm', counts: { geometry: 1, annotation: 0, relation: 0, feature: 0 },
          geometryTypes: { line: 1 }, regions: [],
          topology: { relationCount: 0, connectedComponentCount: 1, largestComponentSize: 1 },
        },
        workingSet: { nodes: [] },
        evidenceLedger: { revision, receipts: [], nodeFacts: [] },
        worldModelSlice: {
          compilerVersion: 'world-model-0.1.0', inputDigest: 'sha256:world',
          knowledge: { state: 'resolved', unresolvedBoundaryRefs: [] },
          primitiveColumns: ['ref', 'type', 'parameters', 'quality', 'sourceSpanRefs'],
          primitiveRows: [['g1', 'line', [0, 0, 10, 10], 'confirmed', ['span_1']]],
        },
        actionFacts: [{ method: 'raw', feasibility: 'ready', affectedNodeRefs: ['g1'] }],
        connectedCarrierFacts: [{
          carrierNodeRef: 'g2', carrierType: 'circle',
          contactedOpenConnectorCount: 2, contactedPortCount: 2,
          preferredTool: 'preview_connected_transform',
        }],
      },
      decisionContext: {
        sequence: 1, phase: 'initial',
        evidenceDelta: {
          evidenceRefs: ['world:sha256:world'], diagnosticCodes: [], digest: 'sha256:evidence',
        },
      },
    });

    const context = JSON.parse(received!.userPrompt);
    expect(context.drawing.worldModelSlice).toMatchObject({
      compilerVersion: 'world-model-0.1.0',
      primitiveRows: [['g1', 'line', [0, 0, 10, 10], 'confirmed', ['span_1']]],
    });
    expect(context.drawing.actionFacts).toEqual([
      expect.objectContaining({ method: 'raw', feasibility: 'ready' }),
    ]);
    expect(context.drawing.connectedCarrierFacts).toEqual([{
      carrierNodeRef: 'g2', carrierType: 'circle',
      contactedOpenConnectorCount: 2, contactedPortCount: 2,
      preferredTool: 'preview_connected_transform',
    }]);
    expect(context.decisionContext).toMatchObject({
      sequence: 1, phase: 'initial',
      evidenceDelta: { evidenceRefs: ['world:sha256:world'] },
    });
  });

  it('keeps world orientation explicit while delegating observation coordinate inversion to code', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"coordinate contract inspected"}';
    });

    await adapter.next({
      ...input(),
      observations: [{
        id: 'view_coordinate', purpose: 'overview',
        imageDataUrl: 'data:image/png;base64,AAAA', width: 200, height: 100,
        worldBounds: { minX: -10, minY: -5, maxX: 10, maxY: 5 },
        worldToImage: [10, 0, 0, -10, 100, 50], grounding: [],
      }],
    });

    const context = JSON.parse(received!.userPrompt);
    expect(context.observationIndex[0].coordinateContract).toEqual({
      worldSpace: {
        name: 'drawing-cartesian', xPositive: 'visual-right', yPositive: 'visual-up',
        units: 'drawing.unitSystem',
      },
      imageSpace: {
        name: 'image-pixel', xPositive: 'visual-right', yPositive: 'visual-down', units: 'pixel',
      },
      transform: { notation: '[m0,m1,m2,m3,m4,m5]', worldToImage: [10, 0, 0, -10, 100, 50] },
      resolution: {
        owner: 'backend', pointReference: 'observationId + normalized [u,v]',
      },
    });
    expect(received?.userPrompt).not.toContain('px = m0*x');
    expect(received?.userPrompt).not.toContain('py = m1*x');
  });

  it('projects the current independent Preview review into the main model context', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"review received"}';
    });

    await adapter.next({
      ...input(),
      currentPreviewHandle: 'preview_1',
      currentPreviewReview: {
        revision,
        previewHandle: 'preview_1',
        transactionDigest: 'sha256:reviewed',
        status: 'needs_revision',
        reason: '右侧候选没有满足用户要求',
        defects: [],
        reviewedAt: 100,
      },
      candidateBudget: { attempt: 2, max: 3 },
    } as Parameters<ModelLoopActionAdapter['next']>[0]);

    expect(JSON.parse(received!.userPrompt).currentPreviewReview).toEqual({
      revision,
      previewHandle: 'preview_1',
      transactionDigest: 'sha256:reviewed',
      status: 'needs_revision',
      reason: '右侧候选没有满足用户要求',
      defects: [],
      reviewedAt: 100,
    });
    expect(JSON.parse(received!.userPrompt).candidateBudget).toEqual({ attempt: 2, max: 3 });
  });

  it('uses a runtime-owned token for the canonical edit base', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"base received"}';
    });

    await adapter.next(input());

    expect(JSON.parse(received!.userPrompt).editBaseOptions).toEqual({
      taskDrivenProgram: {
        tool: 'preview_spatial_program',
        baseRevision: '$current',
        effect: 'create-current-preview',
      },
      startFromCanonical: {
        tool: 'preview_transaction',
        baseRevision: '$current',
        effect: 'create-current-preview',
      },
    });
  });

  it('makes restart and current-candidate revision explicit independent choices', async () => {
    let received: Parameters<ModelLoopCompletion>[0] | undefined;
    const adapter = new ModelLoopActionAdapter(async (request) => {
      received = request;
      return '{"type":"finish","summary":"bases received"}';
    });

    await adapter.next({
      ...input(),
      currentPreview: {
        previewHandle: 'preview_2',
        transactionDigest: 'sha256:preview-two',
        affectedNodeIds: ['line_a', 'line_b'],
      },
    } as Parameters<ModelLoopActionAdapter['next']>[0]);

    expect(JSON.parse(received!.userPrompt).editBaseOptions).toEqual({
      continueWithTaskProgram: {
        tool: 'preview_spatial_program',
        baseRevision: '$current',
        replacesPreviewHandle: 'preview_2',
        effect: 'preserve-current-preview-and-append-program',
      },
      startFromCanonical: {
        tool: 'preview_transaction',
        baseRevision: '$current',
        replacesPreviewHandle: 'preview_2',
        effect: 'discard-current-preview-and-replace',
      },
      reviseCurrentPreview: {
        tool: 'revise_preview',
        basePreviewHandle: 'preview_2',
        baseTransactionDigest: 'sha256:preview-two',
        affectedNodeIds: ['line_a', 'line_b'],
        postconditionContract: 'DrawingAssertion only; omit SpatialEditProgram anchor conditions',
        effect: 'preserve-current-preview-and-apply-corrections',
      },
    });
  });

  it('locally recovers one trailing closing delimiter instead of spending another model turn', async () => {
    const adapter = new ModelLoopActionAdapter(async () => (
      '{"type":"finish","summary":"recoverable response"}}'
    ));

    await expect(adapter.next(input())).resolves.toEqual({
      type: 'finish', summary: 'recoverable response',
    });
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
