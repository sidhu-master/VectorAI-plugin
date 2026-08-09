import { describe, expect, it } from 'vitest';

import type { FeedbackAgentDecision, FeedbackDecisionInput } from './types.js';
import {
  type GeometryId,
  type IdFactory,
  MemoryDrawingRepository,
} from '../../../src/drawing/index.js';
import { DrawingApplication } from '../drawing-application/application.js';
import { DrawingToolRegistry } from '../drawing-agent/tool-registry.js';
import type {
  CvToolExecution,
  DrawingCvToolRegistry,
} from '../drawing-cv/tool-registry.js';
import { compareDrawingRegion } from './residual-comparator.js';
import {
  DrawingFeedbackLoop,
  type DrawingFeedbackOutput,
} from './loop-controller.js';
import { DrawingFeedbackProtocolError } from './model-adapter.js';
import { MemoryObservationRegionStore } from './region-store.js';
import { renderDrawingRegion } from './source-renderer.js';
import { MemoryObservationSlotStore } from './slot-store.js';

const TRANSFORM = [1, 0, 0, -1, 0, 120] as const;
const REGION = { x: 0, y: 0, width: 120, height: 120 };

describe('DrawingFeedbackLoop', () => {
  it('commits a wrong circle, retypes it to an arc, and converges through source feedback', async () => {
    const fixture = await setup();
    const decisions: FeedbackAgentDecision[] = [
      {
        type: 'transact', toolCallId: 'create_wrong_circle', slotIds: [fixture.slotId], confidence: 0.8,
        commands: [{
          type: 'geometry.create', value: {
            id: 'circle_1' as GeometryId, type: 'circle', visible: true,
            quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
            center: [60, 60], radius: 30,
          },
        }],
      },
      {
        type: 'transact', toolCallId: 'retype_to_arc', slotIds: [fixture.slotId], confidence: 0.98,
        commands: [{ type: 'geometry.delete', id: 'circle_1' as GeometryId }, {
          type: 'geometry.create', value: {
            id: 'arc_1' as GeometryId, type: 'arc', visible: true,
            quality: { status: 'confirmed', confidence: 0.98, evidenceRefs: [] },
            center: [60, 60], radius: 30, startAngle: 20, endAngle: 160,
            counterClockwise: true,
          },
        }],
      },
      { type: 'finish', summary: '局部残差已收敛' },
    ];
    const loop = fixture.loopWith(decisions);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.filter((item) => item.kind === 'correction').map((item) => item.action))
      .toContain('retype');
    const residuals = outputs.filter(isResidual);
    expect(residuals.at(-1)!.report.geometry.edgeF1)
      .toBeGreaterThan(residuals[0].report.geometry.edgeF1);
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed', unresolvedRequired: 0 });
    expect((await fixture.application.open(fixture.input.drawingId)).document.geometry)
      .toEqual([expect.objectContaining({ id: 'arc_1', type: 'arc' })]);
  });

  it('pauses at a safe point and resumes from its checkpoint with appended instructions', async () => {
    const fixture = await setup();
    let pause = true;
    const seenInstructions: string[][] = [];
    const loop = fixture.loopWith([{ type: 'finish', summary: '等待' }], (input) => {
      seenInstructions.push([...input.pendingInstructions]);
      return { type: 'finish', summary: '完成' };
    });
    const first = await collect(loop.run({ ...fixture.input, shouldPause: () => pause }));
    const checkpoint = first.find((item) => item.kind === 'paused')?.checkpoint;
    expect(checkpoint).toBeDefined();

    pause = false;
    const resumed = await collect(loop.run({
      ...fixture.input,
      checkpoint,
      readInstructions: () => ['只处理完整圆弧'],
      shouldPause: () => pause,
    }));

    expect(seenInstructions.at(-1)).toEqual(['只处理完整圆弧']);
    expect(resumed.at(-1)?.kind).not.toBe('paused');
  });

  it('pauses one slot after three different non-improving corrections', async () => {
    const fixture = await setup();
    const unchanged = (): FeedbackAgentDecision => ({
      type: 'transact', toolCallId: `noop_${Math.random()}`, slotIds: [fixture.slotId], confidence: 0.9,
      commands: [{
        type: 'geometry.create', value: {
          type: 'point', visible: true,
          quality: { status: 'candidate', evidenceRefs: [] }, x: 0, y: 0,
        },
      }],
    });
    const loop = fixture.loopWith([unchanged(), unchanged(), unchanged()]);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.at(-1)).toMatchObject({ kind: 'slot_paused', slotId: fixture.slotId });
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('stops after three identical rejected CV calls instead of looping forever', async () => {
    const fixture = await setup();
    const bad: FeedbackAgentDecision = {
      type: 'call_tool', toolCallId: 'bad_source', capability: 'inspect_source_overview',
      input: { sourceId: 'revision_wrong', budget: {
        maxPixels: 100, maxResults: 1, maxSamplesPerResult: 1, timeoutMs: 100,
      } },
    };
    const cvTools: Pick<DrawingCvToolRegistry, 'invoke'> = {
      invoke: async (invocation): Promise<CvToolExecution> => ({
        receipt: {
          schemaVersion: 1, toolCallId: invocation.toolCallId,
          capability: invocation.capability, capabilityVersion: '1.0.0',
          runId: invocation.runId, inputDigest: 'same', slotIds: [], evidenceHandles: [],
          durationMs: 1, status: 'rejected', errorCodes: ['SOURCE_ID_INVALID'],
          retry: { allowed: true, action: 'replan' },
        },
      }),
    };
    const loop = fixture.loopWith([bad, bad, bad, bad], undefined, cvTools);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.at(-1)).toMatchObject({
      kind: 'failed', code: 'FEEDBACK_REPEATED_TOOL_FAILURE',
    });
  });

  it('carries one audit-safe crop handle into the next model decision and checkpoint', async () => {
    const fixture = await setup();
    const cropDecision: FeedbackAgentDecision = {
      type: 'call_tool', toolCallId: 'crop_target', capability: 'inspect_source_crop',
      input: { sourceId: 'source_test1', regionId: 'region_arc', budget: {
        maxPixels: 100_000, maxResults: 1, maxSamplesPerResult: 20, timeoutMs: 1_000,
      } },
    };
    const cvTools: Pick<DrawingCvToolRegistry, 'invoke'> = {
      invoke: async (invocation): Promise<CvToolExecution> => ({
        receipt: {
          schemaVersion: 1, toolCallId: invocation.toolCallId,
          capability: invocation.capability, capabilityVersion: '1.0.0',
          runId: invocation.runId, inputDigest: 'crop-input', outputDigest: 'crop-output',
          sourceId: 'source_test1', regionId: 'region_arc', slotIds: [], evidenceHandles: [],
          durationMs: 1, status: 'succeeded', errorCodes: [], retry: { allowed: false },
        },
        output: {
          mediaHandle: 'crop_0123456789abcdef01234567',
          sourceId: 'source_test1', regionId: 'region_arc', mimeType: 'image/png',
          width: 100, height: 80, sourceBounds: { x: 20, y: 20, width: 100, height: 80 },
        },
      }),
    };
    const seen: FeedbackDecisionInput['requestedCrops'][] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      seen.push(structuredClone(modelInput.requestedCrops));
      return calls === 1 ? cropDecision : { type: 'finish', summary: '已查看裁剪' };
    }, cvTools);

    const outputs = await collect(loop.run(fixture.input));

    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual([{
      mediaHandle: 'crop_0123456789abcdef01234567',
      sourceId: 'source_test1', regionId: 'region_arc',
    }]);
    expect(outputs.find((item) => item.kind === 'checkpoint')).toMatchObject({
      checkpoint: { requestedCrops: seen[1] },
    });
  });

  it('requires a visual crop of the same region before extracting its CV evidence', async () => {
    const fixture = await setup();
    let cvInvocations = 0;
    const seenFeedback: string[] = [];
    let decisions = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      decisions += 1;
      seenFeedback.push(modelInput.protocolFeedback ?? '');
      if (decisions === 1) {
        return {
          type: 'call_tool', toolCallId: 'extract_without_seeing',
          capability: 'cv_extract_evidence',
          input: { sourceId: 'source_test1', regionId: 'region_unseen', budget: {
            maxPixels: 100_000, maxResults: 10, maxSamplesPerResult: 20, timeoutMs: 1_000,
          } },
        };
      }
      return { type: 'finish', summary: '等待视觉观察' };
    }, {
      invoke: async () => {
        cvInvocations += 1;
        throw new Error('should not invoke CV before visual observation');
      },
    });

    await collect(loop.run(fixture.input));

    expect(cvInvocations).toBe(0);
    expect(seenFeedback[1]).toContain('inspect_source_crop');
    expect(seenFeedback[1]).toContain('region_unseen');
  });

  it('forces unresolved candidates to proceed from dominant contours to smaller details', async () => {
    const fixture = await setup();
    const tiny = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_tiny_glyph', kind: 'circle-candidate',
        bounds: { x: 2, y: 2, width: 8, height: 8 }, confidence: 0.9,
        touchesRegionEdge: false,
      },
      candidateTypes: [{ type: 'circle', score: 0.9 }],
    });
    let calls = 0;
    const feedback: string[] = [];
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      feedback.push(modelInput.protocolFeedback ?? '');
      if (calls === 1) {
        return {
          type: 'transact', toolCallId: 'premature_tiny', slotIds: [tiny.id], confidence: 0.9,
          commands: [{
            type: 'geometry.create', value: {
              type: 'circle', visible: true,
              quality: { status: 'candidate', evidenceRefs: [] },
              center: [4, 116], radius: 3,
            },
          }],
        };
      }
      return { type: 'finish', summary: '等待主体轮廓' };
    });

    await collect(loop.run(fixture.input));

    expect(feedback[1]).toContain('从大到小');
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('refuses to confirm a closed primitive observed only at crop edges', async () => {
    const fixture = await setup();
    const partial = fixture.slots.observe({
      sourceId: 'source_partial',
      evidence: {
        handle: 'evidence_partial_circle', kind: 'circle-candidate',
        bounds: { x: 10, y: 10, width: 100, height: 100 }, confidence: 0.9,
        touchesRegionEdge: true,
      },
      candidateTypes: [{ type: 'circle', score: 0.9 }],
    });
    const feedback: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      feedback.push(modelInput.protocolFeedback ?? '');
      if (calls === 1) {
        return {
          type: 'transact', toolCallId: 'partial_circle', slotIds: [partial.id], confidence: 0.9,
          commands: [{
            type: 'geometry.create', value: {
              type: 'circle', visible: true,
              quality: { status: 'candidate', evidenceRefs: [] },
              center: [60, 60], radius: 50,
            },
          }],
        };
      }
      return { type: 'finish', summary: '等待扩大区域' };
    });

    await collect(loop.run({ ...fixture.input, sourceId: 'source_partial' }));

    expect(feedback[1]).toContain('扩大重叠区域');
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('repairs one malformed model decision with explicit protocol feedback', async () => {
    const fixture = await setup();
    const received: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (input) => {
      calls += 1;
      if (calls === 1) throw new DrawingFeedbackProtocolError(
        'decision.commands[0].type', '不支持的命令类型 circle',
      );
      received.push(input.protocolFeedback ?? '');
      return { type: 'finish', summary: '完成' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(calls).toBe(2);
    expect(received[0]).toContain('完整 DrawingCommand 包装');
    expect(outputs.at(-1)).toMatchObject({ kind: 'failed', code: 'FEEDBACK_REQUIRED_RESIDUALS_REMAIN' });
  });

  it('verifies a transaction against the current drawing inside its padded slot bounds', async () => {
    const fixture = await setup();
    const comparedRegions: Array<{ x: number; y: number; width: number; height: number } | undefined> = [];
    let globalCalls = 0;
    const report = (edgeF1: number, residualCount: number, improved: boolean) => ({
      geometry: {
        edgePrecision: edgeF1, edgeRecall: edgeF1, edgeF1,
        fitP50: edgeF1 ? 0 : Number.POSITIVE_INFINITY,
        fitP95: edgeF1 ? 0 : Number.POSITIVE_INFINITY,
        fitMax: edgeF1 ? 0 : Number.POSITIVE_INFINITY,
      },
      topologyFailures: [], associationMismatches: [],
      residualRegions: Array.from({ length: residualCount }, () => ({ x: 25, y: 25, width: 70, height: 40 })),
      improved,
    });
    const compare = async (
      _document: Awaited<ReturnType<typeof fixture.application.open>>['document'],
      previous: Parameters<typeof compareDrawingRegion>[0]['previousGeometry'] | undefined,
      context?: { sourceId: string; region?: { x: number; y: number; width: number; height: number } },
    ) => {
      comparedRegions.push(context?.region);
      if (context?.region) return previous ? report(1, 0, true) : report(0, 1, false);
      globalCalls += 1;
      return globalCalls === 1 ? report(0, 1, false) : report(1, 0, true);
    };
    const decision: FeedbackAgentDecision = {
      type: 'transact', toolCallId: 'local_arc', slotIds: [fixture.slotId], confidence: 0.95,
      commands: [{
        type: 'geometry.create', value: {
          id: 'arc_local' as GeometryId, type: 'arc', visible: true,
          quality: { status: 'confirmed', evidenceRefs: [] },
          center: [60, 60], radius: 30, startAngle: 20, endAngle: 160,
          counterClockwise: true,
        },
      }],
    };
    const loop = fixture.loopWith([
      decision,
      { type: 'finish', summary: '局部和整图均已验证' },
    ], undefined, undefined, compare);

    const outputs = await collect(loop.run(fixture.input));

    const localRegions = comparedRegions.filter((region) => region !== undefined);
    expect(localRegions).toHaveLength(2);
    expect(localRegions[0]).toEqual(localRegions[1]);
    expect(localRegions[0]!.x).toBeLessThanOrEqual(25);
    expect(localRegions[0]!.y).toBeLessThanOrEqual(25);
    expect(localRegions[0]!.x + localRegions[0]!.width).toBeGreaterThanOrEqual(95);
    expect(localRegions[0]!.y + localRegions[0]!.height).toBeGreaterThanOrEqual(65);
    expect(comparedRegions.at(-1)).toBeUndefined();
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed', unresolvedRequired: 0 });
  });
});

async function setup() {
  const idFactory = ids();
  const repository = new MemoryDrawingRepository({ idFactory, now: () => 100 });
  const application = new DrawingApplication({ repository, idFactory, now: () => 1 });
  const workspace = await application.create();
  const drawingTools = new DrawingToolRegistry({ application, idFactory });
  const regions = new MemoryObservationRegionStore({
    resolveSourceSize: () => ({ width: 120, height: 120 }),
  });
  const slots = new MemoryObservationSlotStore();
  const slot = slots.observe({
    sourceId: 'source_test1',
    evidence: {
      handle: 'evidence_arc', kind: 'arc-candidate',
      bounds: { x: 25, y: 25, width: 70, height: 40 }, confidence: 0.9,
      touchesRegionEdge: false,
    },
    candidateTypes: [{ type: 'arc', score: 0.9 }],
  });
  const sourceDocument = structuredClone(workspace.document);
  sourceDocument.geometry = [{
    id: 'source_arc' as GeometryId, type: 'arc', visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    center: [60, 60], radius: 30, startAngle: 20, endAngle: 160, counterClockwise: true,
  }];
  const source = renderDrawingRegion(sourceDocument, {
    region: REGION, documentToSource: TRANSFORM, strokeWidthPixels: 1,
  });
  const compare = async (document: typeof workspace.document, previous?: Parameters<typeof compareDrawingRegion>[0]['previousGeometry']) => {
    const rendered = renderDrawingRegion(document, {
      region: REGION, documentToSource: TRANSFORM, strokeWidthPixels: 1,
    });
    return compareDrawingRegion({
      sourceEdges: source.combined, rendered, region: REGION, tolerancePixels: 1,
      ...(previous ? { previousGeometry: previous } : {}),
    });
  };
  const input = {
    runId: 'run_feedback',
    sourceId: 'source_test1',
    drawingId: workspace.document.id,
    revision: workspace.revision,
    goal: '重建来源图纸',
    modelProfile: {
      planner: 'doubao-seed-2.0-lite', decision: 'doubao-seed-2.0-lite', repair: 'doubao-seed-2.1-turbo',
    },
    signal: new AbortController().signal,
  };
  return {
    application,
    slots,
    input,
    slotId: slot.id,
    loopWith(
      decisions: FeedbackAgentDecision[],
      decideOverride?: (input: Parameters<ConstructorParameters<typeof DrawingFeedbackLoop>[0]['model']['decide']>[0]) => FeedbackAgentDecision,
      cvTools?: Pick<DrawingCvToolRegistry, 'invoke'>,
      compareOverride?: ConstructorParameters<typeof DrawingFeedbackLoop>[0]['compare'],
    ) {
      let index = 0;
      return new DrawingFeedbackLoop({
        application,
        drawingTools,
        ...(cvTools ? { cvTools } : {}),
        model: { decide: async (modelInput) => decideOverride?.(modelInput) ?? decisions[index++] },
        regions,
        slots,
        compare: compareOverride ?? compare,
        maxIterations: 10,
      });
    },
  };
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}

async function collect(iterable: AsyncIterable<DrawingFeedbackOutput>): Promise<DrawingFeedbackOutput[]> {
  const output: DrawingFeedbackOutput[] = [];
  for await (const item of iterable) output.push(item);
  return output;
}

function isResidual(output: DrawingFeedbackOutput): output is Extract<DrawingFeedbackOutput, { kind: 'residual' }> {
  return output.kind === 'residual';
}
