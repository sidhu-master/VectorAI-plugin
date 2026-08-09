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
import type { PersistedCleanLineVectorizationResult } from '../drawing-vectorization/types.js';

const TRANSFORM = [1, 0, 0, -1, 0, 120] as const;
const REGION = { x: 0, y: 0, width: 120, height: 120 };

describe('DrawingFeedbackLoop', () => {
  it('bootstraps a clean stroke as polyline before promoting the same node to circle', async () => {
    const fixture = await setup();
    const modelDrawingTypes: string[][] = [];
    const vectorization = {
      vectorizeSource: async () => ({
        sourceId: fixture.input.sourceId,
        pipelineVersion: 'fixture-vector-v1',
        width: 120,
        height: 120,
        analysisScale: 1,
        medianLineWidthPx: 4,
        chains: [{
          id: 'chain_0123456789abcdef0123',
          closed: true,
          samples: [[30, 60], [60, 30], [90, 60], [60, 90]] as Array<readonly [number, number]>,
          simplified: [[30, 60], [60, 30], [90, 60], [60, 90]] as Array<readonly [number, number]>,
          bounds: { x: 30, y: 30, width: 60, height: 60 },
          candidate: {
            type: 'circle' as const,
            parameters: { center: [60, 60], radius: 30 },
            fitErrorMean: 0.2,
            fitErrorP95: 0.5,
            fitErrorMax: 0.8,
            confidence: 0.96,
          },
          evidence: {
            handle: 'evidence_cccccccccccccccccccccccc',
            sourceId: fixture.input.sourceId,
            regionId: 'vector_chain_0123456789abcdef0123',
            kind: 'circle-candidate' as const,
            bounds: { x: 30, y: 30, width: 60, height: 60 },
            confidence: 0.96,
            touchesRegionEdge: false,
            sampleCount: 4,
          },
        }],
      }),
    };
    const loop = fixture.loopWith([], (modelInput) => {
      modelDrawingTypes.push(modelInput.drawingItems.map((item) => item.type));
      return { type: 'finish', summary: 'bootstrap 已完成' };
    }, undefined, async () => metricReport(1, 0, 0, true), vectorization);

    const outputs = await collect(loop.run(fixture.input));

    const proposalTypes = outputs
      .filter((output): output is Extract<DrawingFeedbackOutput, { kind: 'proposal' }> => (
        output.kind === 'proposal'
      ))
      .map((output) => output.nodes[0]?.type);
    expect(proposalTypes).toEqual(['polyline', 'circle']);
    expect(outputs.filter((output) => output.kind === 'commit')).toHaveLength(2);
    expect(modelDrawingTypes).toEqual([]);
    expect((await fixture.application.open(fixture.input.drawingId)).document.geometry)
      .toEqual([expect.objectContaining({ type: 'circle', center: [250, 250], radius: 125 })]);
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed', unresolvedRequired: 0 });
  });

  it('pauses before the first vectorization transaction and resumes without duplicate drafts', async () => {
    const fixture = await setup();
    let pause = true;
    const vectorization = cleanVectorization(fixture.input.sourceId);
    const loop = fixture.loopWith(
      [],
      () => ({ type: 'finish', summary: '无需模型' }),
      undefined,
      async () => metricReport(1, 0, 0, true),
      { vectorizeSource: async () => vectorization },
    );

    const first = await collect(loop.run({ ...fixture.input, shouldPause: () => pause }));
    const checkpoint = first.find((output) => output.kind === 'paused')?.checkpoint;
    expect(checkpoint).toBeDefined();
    expect((await fixture.application.open(fixture.input.drawingId)).document.geometry).toEqual([]);

    pause = false;
    const resumed = await collect(loop.run({
      ...fixture.input, checkpoint, shouldPause: () => pause,
    }));

    expect(resumed.filter((output) => output.kind === 'commit')).toHaveLength(2);
    expect((await fixture.application.open(fixture.input.drawingId)).document.geometry)
      .toEqual([expect.objectContaining({ type: 'circle' })]);
  });

  it('keeps a committed polyline when its analytic promotion fails Drawing validation', async () => {
    const fixture = await setup();
    const vectorization = cleanVectorization(fixture.input.sourceId);
    vectorization.chains[0].closed = false;
    vectorization.chains[0].candidate = {
      type: 'line',
      parameters: { start: [60, 60], end: [60, 60] },
      fitErrorMean: 0,
      fitErrorP95: 0,
      fitErrorMax: 0,
      confidence: 0.99,
    };
    const loop = fixture.loopWith(
      [],
      () => ({ type: 'finish', summary: '保留底稿' }),
      undefined,
      async () => metricReport(1, 0, 0, true),
      { vectorizeSource: async () => vectorization },
    );

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({ kind: 'correction', action: 'reject' }));
    expect((await fixture.application.open(fixture.input.drawingId)).document.geometry)
      .toEqual([expect.objectContaining({ type: 'polyline' })]);
  });

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

  it('defers one slot after three different non-improving corrections', async () => {
    const fixture = await setup();
    const unchanged = (): FeedbackAgentDecision => ({
      type: 'transact', toolCallId: `noop_${Math.random()}`, slotIds: [fixture.slotId], confidence: 0.9,
      commands: [{
        type: 'geometry.create', value: {
          type: 'arc', visible: true,
          quality: { status: 'candidate', evidenceRefs: [] },
          center: [5, 5], radius: 1, startAngle: 0, endAngle: 10,
          counterClockwise: true,
        },
      }],
    });
    const loop = fixture.loopWith([
      unchanged(), unchanged(), unchanged(),
      { type: 'finish', summary: '暂缓该槽位' },
    ]);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.filter((item) => item.kind === 'correction' && item.action === 'reject'))
      .toHaveLength(3);
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'slot_paused', slotId: fixture.slotId,
    }));
    expect(outputs.at(-1)).toMatchObject({
      kind: 'failed', code: 'FEEDBACK_REQUIRED_RESIDUALS_REMAIN',
    });
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('defers a repeatedly incompatible dominant slot and continues with another object', async () => {
    const fixture = await setup();
    const dominant = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_dominant_contour', kind: 'contour',
        bounds: { x: 0, y: 0, width: 120, height: 120 }, confidence: 0.9,
        touchesRegionEdge: false,
      },
      candidateTypes: [{ type: 'polyline', score: 0.9 }],
    });
    const wrongCircle = (index: number): FeedbackAgentDecision => ({
      type: 'transact', toolCallId: `wrong_circle_${index}`,
      slotIds: [dominant.id], confidence: 0.9,
      commands: [{
        type: 'geometry.create', value: {
          type: 'circle', visible: true,
          quality: { status: 'candidate', evidenceRefs: [] },
          center: [60, 60], radius: 55,
        },
      }],
    });
    const visibleSlots: string[][] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      visibleSlots.push(modelInput.slots.map((slot) => slot.id));
      if (calls <= 3) return wrongCircle(calls);
      if (calls === 4) return arcDecision(fixture.slotId, 'draw_after_deferral');
      return { type: 'finish', summary: '已继续处理下一对象' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'slot_paused', slotId: dominant.id,
    }));
    expect(visibleSlots[3]).not.toContain(dominant.id);
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'proposal', slotId: fixture.slotId,
    }));
    expect(outputs).toContainEqual(expect.objectContaining({ kind: 'commit' }));
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed' });
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

  it('keeps extracted CV candidates in Agent context without drawing them', async () => {
    const fixture = await setup();
    let call = 0;
    let slotsAfterExtraction: FeedbackDecisionInput['slots'] = [];
    const loop = fixture.loopWith([], (modelInput) => {
      call += 1;
      if (call === 1) {
        return {
          type: 'call_tool', toolCallId: 'see_head', capability: 'inspect_source_crop',
          input: { sourceId: 'source_test1', regionId: 'region_head', budget: {
            maxPixels: 100_000, maxResults: 1, maxSamplesPerResult: 20, timeoutMs: 1_000,
          } },
        };
      }
      if (call === 2) {
        return {
          type: 'call_tool', toolCallId: 'extract_head', capability: 'cv_extract_evidence',
          input: { sourceId: 'source_test1', regionId: 'region_head', budget: {
            maxPixels: 100_000, maxResults: 10, maxSamplesPerResult: 64, timeoutMs: 1_000,
          } },
        };
      }
      slotsAfterExtraction = structuredClone(modelInput.slots);
      return { type: 'finish', summary: '候选已进入上下文' };
    }, {
      invoke: async (invocation): Promise<CvToolExecution> => {
        const receipt = {
          schemaVersion: 1 as const, toolCallId: invocation.toolCallId,
          capability: invocation.capability, capabilityVersion: '1.0.0' as const,
          runId: invocation.runId, inputDigest: `input-${call}`, outputDigest: `output-${call}`,
          sourceId: 'source_test1', regionId: 'region_head', slotIds: [], evidenceHandles: [],
          durationMs: 1, status: 'succeeded' as const, errorCodes: [], retry: { allowed: false },
        };
        if (invocation.capability === 'inspect_source_crop') {
          return { receipt, output: {
            mediaHandle: 'crop_0123456789abcdef01234567', sourceId: 'source_test1',
            regionId: 'region_head', mimeType: 'image/png', width: 100, height: 80,
            sourceBounds: { x: 10, y: 10, width: 100, height: 80 },
          } };
        }
        return { receipt: { ...receipt, evidenceHandles: ['evidence_head'] }, output: {
          evidence: [{
            handle: 'evidence_head', sourceId: 'source_test1', regionId: 'region_head',
            kind: 'circle-candidate', bounds: { x: 20, y: 20, width: 70, height: 70 },
            confidence: 0.91, touchesRegionEdge: false, sampleCount: 64,
          }],
          suggestedFits: [{
            evidenceHandle: 'evidence_head', primitiveType: 'circle',
            documentParameters: { center: [55, 65], radius: 35 },
          }],
        } };
      },
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.filter((output) => output.kind === 'inventory')
      .every((output) => !('nodes' in output))).toBe(true);
    expect(outputs.find((output) => output.kind === 'inventory')).toMatchObject({
      kind: 'inventory', regionId: 'region_head', candidateCount: 1,
      slotIds: [expect.any(String)],
    });
    expect(slotsAfterExtraction).toContainEqual(expect.objectContaining({
      sourceId: 'source_test1',
      evidenceRefs: ['evidence_head'],
      candidateTypes: [{ type: 'circle', score: 0.91 }],
    }));
  });

  it('returns protocol feedback when one transaction tries to draw multiple slots', async () => {
    const fixture = await setup();
    const second = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_second_arc', kind: 'arc-candidate',
        bounds: { x: 30, y: 30, width: 60, height: 30 }, confidence: 0.8,
        touchesRegionEdge: false,
      },
      candidateTypes: [{ type: 'arc', score: 0.8 }],
    });
    const feedback: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      feedback.push(modelInput.protocolFeedback ?? '');
      if (calls === 1) {
        return {
          type: 'transact', toolCallId: 'batch_two_slots',
          slotIds: [fixture.slotId, second.id], confidence: 0.9,
          commands: [{
            type: 'geometry.create', value: {
              type: 'arc', visible: true,
              quality: { status: 'candidate', evidenceRefs: [] },
              center: [60, 60], radius: 30, startAngle: 20, endAngle: 160,
              counterClockwise: true,
            },
          }],
        };
      }
      return { type: 'finish', summary: '等待逐个处理' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(feedback[1]).toContain('每次只能处理一个 slot');
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'decision', decision: expect.objectContaining({
        type: 'transact', slotIds: [fixture.slotId, second.id],
        commands: [expect.objectContaining({ type: 'geometry.create' })],
      }),
    }));
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'controller_feedback', message: expect.stringContaining('每次只能处理一个 slot'),
    }));
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('rejects a primitive type that is incompatible with its evidence slot', async () => {
    const fixture = await setup();
    const contour = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_whole_contour', kind: 'contour',
        bounds: { x: 5, y: 5, width: 110, height: 110 }, confidence: 0.8,
        touchesRegionEdge: false,
      },
      candidateTypes: [{ type: 'polyline', score: 0.8 }],
    });
    const feedback: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      feedback.push(modelInput.protocolFeedback ?? '');
      if (calls === 1) {
        return {
          type: 'transact', toolCallId: 'force_contour_to_circle',
          slotIds: [contour.id], confidence: 0.9,
          commands: [{
            type: 'geometry.create', value: {
              type: 'circle', visible: true,
              quality: { status: 'candidate', evidenceRefs: [] },
              center: [60, 60], radius: 55,
            },
          }],
        };
      }
      return { type: 'finish', summary: '等待兼容提案' };
    });

    await collect(loop.run(fixture.input));

    expect(feedback[1]).toContain('polyline');
    expect(feedback[1]).toContain('circle');
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('feeds a rejected Drawing preview back to the model instead of failing the run', async () => {
    const fixture = await setup();
    const contour = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_invalid_polyline', kind: 'contour',
        bounds: { x: 0, y: 0, width: 120, height: 120 }, confidence: 0.9,
        touchesRegionEdge: false,
      },
      candidateTypes: [{ type: 'polyline', score: 0.9 }],
    });
    const feedback: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      feedback.push(modelInput.protocolFeedback ?? '');
      if (calls === 1) {
        return {
          type: 'transact', toolCallId: 'invalid_polyline_preview',
          slotIds: [contour.id], confidence: 0.8,
          commands: [{
            type: 'geometry.create', value: {
              type: 'polyline', visible: true,
              quality: { status: 'candidate', evidenceRefs: [] },
              vertices: [], closed: false,
            },
          }],
        };
      }
      return { type: 'finish', summary: '等待修复预览' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'drawing_tool',
      execution: { receipt: expect.objectContaining({
        capability: 'preview_transaction', status: 'rejected',
        outcome: { kind: 'error', codes: ['INVALID_POLYLINE'] },
      }) },
    }));
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'correction', action: 'reject', slotIds: [contour.id],
    }));
    expect(feedback[1]).toContain('INVALID_POLYLINE');
    expect(outputs.at(-1)).not.toMatchObject({
      kind: 'failed', code: 'FEEDBACK_PREVIEW_REJECTED',
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

  it('allows an open polyline proposal to enter preview when its contour touches a crop edge', async () => {
    const fixture = await setup();
    const contour = fixture.slots.observe({
      sourceId: 'source_test1',
      evidence: {
        handle: 'evidence_open_contour', kind: 'contour',
        bounds: { x: 0, y: 0, width: 120, height: 120 }, confidence: 0.9,
        touchesRegionEdge: true,
      },
      candidateTypes: [{ type: 'polyline', score: 0.9 }],
    });
    const loop = fixture.loopWith([{
      type: 'transact', toolCallId: 'open_contour', slotIds: [contour.id], confidence: 0.9,
      commands: [{
        type: 'geometry.create', value: {
          type: 'polyline', visible: true,
          quality: { status: 'candidate', evidenceRefs: [] },
          vertices: [{ point: [0, 0] }, { point: [60, 60] }, { point: [120, 0] }],
          closed: false,
        },
      }],
    }, { type: 'finish', summary: '开放轮廓已验证' }]);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'proposal', slotId: contour.id,
      nodes: [expect.objectContaining({ type: 'polyline', closed: false })],
    }));
  });

  it('materializes one explicit Drawing object from a model-selected verified fit reference', async () => {
    const fixture = await setup();
    const fitDecision: FeedbackAgentDecision = {
      type: 'call_tool', toolCallId: 'fit_arc', capability: 'cv_fit_primitive',
      input: { handle: 'evidence_arc', primitiveType: 'arc', budget: {
        maxPixels: 100_000, maxResults: 1, maxSamplesPerResult: 64, timeoutMs: 1_000,
      } },
    };
    const loop = fixture.loopWith([
      fitDecision,
      {
        type: 'transact_fit', toolCallId: 'apply_arc_fit',
        slotId: fixture.slotId, evidenceHandle: 'evidence_arc',
        primitiveType: 'arc', confidence: 0.96,
      },
      { type: 'finish', summary: '引用拟合后完成' },
    ], undefined, {
      invoke: async (invocation): Promise<CvToolExecution> => ({
        receipt: {
          schemaVersion: 1, toolCallId: invocation.toolCallId,
          capability: invocation.capability, capabilityVersion: '1.0.0',
          runId: invocation.runId, inputDigest: 'fit-input', outputDigest: 'fit-output',
          sourceId: 'source_test1', slotIds: [], evidenceHandles: ['evidence_arc'],
          durationMs: 1, status: 'succeeded', errorCodes: [], retry: { allowed: false },
        },
        output: {
          primitiveType: 'arc', fitErrorP50: 0, fitErrorP95: 0, fitErrorMax: 0,
          sampleCount: 64, sourceParameters: {},
          documentParameters: {
            center: [60, 60], radius: 30, startAngle: 20, endAngle: 160,
            counterClockwise: true,
          },
        },
      }),
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'decision', decision: expect.objectContaining({
        type: 'transact_fit', slotId: fixture.slotId,
      }),
    }));
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'proposal', slotId: fixture.slotId,
      nodes: [expect.objectContaining({ type: 'arc', center: [60, 60], radius: 30 })],
    }));
    expect(outputs).toContainEqual(expect.objectContaining({ kind: 'commit' }));
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed' });
  });

  it('repairs one malformed model decision with explicit protocol feedback', async () => {
    const fixture = await setup();
    const received: string[] = [];
    const receivedModels: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (input) => {
      calls += 1;
      receivedModels.push(input.modelName);
      if (calls === 1) throw new DrawingFeedbackProtocolError(
        'decision.commands[0].type', '不支持的命令类型 circle',
      );
      received.push(input.protocolFeedback ?? '');
      return { type: 'finish', summary: '完成' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(calls).toBe(2);
    expect(received[0]).toContain('完整 DrawingCommand 包装');
    expect(receivedModels).toEqual([
      'doubao-seed-2.0-lite',
      'doubao-seed-2.1-turbo',
    ]);
    expect(outputs.at(-1)).toMatchObject({ kind: 'failed', code: 'FEEDBACK_REQUIRED_RESIDUALS_REMAIN' });
  });

  it('keeps repairing two malformed model replies before accepting one local proposal', async () => {
    const fixture = await setup();
    const received: string[] = [];
    let calls = 0;
    const loop = fixture.loopWith([], (modelInput) => {
      calls += 1;
      received.push(modelInput.protocolFeedback ?? '');
      if (calls <= 2) {
        throw new DrawingFeedbackProtocolError(
          'response.json', `malformed reply ${calls}`,
        );
      }
      if (calls === 3) return arcDecision(fixture.slotId, 'repaired_arc');
      return { type: 'finish', summary: '格式修复后完成' };
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs.filter((output) => output.kind === 'protocol_retry')).toEqual([
      expect.objectContaining({ kind: 'protocol_retry', attempt: 1, maxAttempts: 3 }),
      expect.objectContaining({ kind: 'protocol_retry', attempt: 2, maxAttempts: 3 }),
    ]);
    expect(received[1]).toContain('malformed reply 1');
    expect(received[2]).toContain('malformed reply 2');
    expect(outputs).toContainEqual(expect.objectContaining({ kind: 'commit' }));
    expect(outputs.at(-1)).toMatchObject({ kind: 'completed', unresolvedRequired: 0 });
  });

  it('fails explicitly after three malformed model replies', async () => {
    const fixture = await setup();
    let calls = 0;
    const loop = fixture.loopWith([], () => {
      calls += 1;
      throw new DrawingFeedbackProtocolError('response.json', `malformed reply ${calls}`);
    });

    const outputs = await collect(loop.run(fixture.input));

    expect(calls).toBe(3);
    expect(outputs.at(-1)).toMatchObject({
      kind: 'failed', code: 'FEEDBACK_MODEL_PROTOCOL_RETRIES_EXHAUSTED',
    });
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

    const proposalIndex = outputs.findIndex((output) => output.kind === 'proposal');
    const acceptedResidualIndex = outputs.findIndex((output, index) => (
      index > proposalIndex && output.kind === 'residual' && output.accepted
    ));
    const commitIndex = outputs.findIndex((output) => output.kind === 'commit');
    expect(proposalIndex).toBeGreaterThan(-1);
    expect(proposalIndex).toBeLessThan(acceptedResidualIndex);
    expect(acceptedResidualIndex).toBeLessThan(commitIndex);
    expect(outputs[proposalIndex]).toMatchObject({
      kind: 'proposal', slotId: fixture.slotId,
      nodes: [expect.objectContaining({
        id: `feedback_preview_${fixture.slotId}`, type: 'arc',
      })],
    });
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

  it('rejects an epsilon-only local metric change instead of committing noise', async () => {
    const fixture = await setup();
    let localCalls = 0;
    const compare = async (
      _document: Awaited<ReturnType<typeof fixture.application.open>>['document'],
      _previous?: Parameters<typeof compareDrawingRegion>[0]['previousGeometry'],
      context?: { sourceId: string; region?: { x: number; y: number; width: number; height: number } },
    ) => {
      if (!context?.region) return metricReport(0.4, 10, 1, false);
      localCalls += 1;
      return localCalls === 1
        ? metricReport(0.5, 10, 1, false)
        : metricReport(0.5000001, 9.9999999, 1, true);
    };
    const loop = fixture.loopWith([arcDecision(fixture.slotId, 'epsilon_arc'), {
      type: 'finish', summary: '不应提交噪声',
    }], undefined, undefined, compare);

    const outputs = await collect(loop.run(fixture.input));

    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'correction', action: 'reject', slotIds: [fixture.slotId],
    }));
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });

  it('rejects a locally improved proposal when whole-drawing residuals regress', async () => {
    const fixture = await setup();
    let localCalls = 0;
    let globalCalls = 0;
    const compare = async (
      _document: Awaited<ReturnType<typeof fixture.application.open>>['document'],
      _previous?: Parameters<typeof compareDrawingRegion>[0]['previousGeometry'],
      context?: { sourceId: string; region?: { x: number; y: number; width: number; height: number } },
    ) => {
      if (context?.region) {
        localCalls += 1;
        return localCalls === 1
          ? metricReport(0.5, 8, 1, false)
          : metricReport(0.7, 4, 0, true);
      }
      globalCalls += 1;
      return globalCalls === 1
        ? metricReport(0.4, 10, 1, false)
        : metricReport(0.5, 8, 2, true);
    };
    const loop = fixture.loopWith([arcDecision(fixture.slotId, 'global_regression'), {
      type: 'finish', summary: '不应提交整图退化',
    }], undefined, undefined, compare);

    const outputs = await collect(loop.run(fixture.input));

    expect(globalCalls).toBe(2);
    expect(outputs).toContainEqual(expect.objectContaining({
      kind: 'correction', action: 'reject', slotIds: [fixture.slotId],
    }));
    expect((await fixture.application.open(fixture.input.drawingId)).commits).toHaveLength(0);
  });
});

function arcDecision(slotId: string, toolCallId: string): FeedbackAgentDecision {
  return {
    type: 'transact', toolCallId, slotIds: [slotId], confidence: 0.9,
    commands: [{
      type: 'geometry.create', value: {
        type: 'arc', visible: true,
        quality: { status: 'candidate', evidenceRefs: [] },
        center: [60, 60], radius: 30, startAngle: 20, endAngle: 160,
        counterClockwise: true,
      },
    }],
  };
}

function metricReport(edgeF1: number, fitP95: number, residualCount: number, improved: boolean) {
  return {
    geometry: {
      edgePrecision: edgeF1, edgeRecall: edgeF1, edgeF1,
      fitP50: fitP95 / 2, fitP95, fitMax: fitP95,
    },
    topologyFailures: [], associationMismatches: [],
    residualRegions: Array.from({ length: residualCount }, (_, index) => ({
      x: index * 10, y: 0, width: 5, height: 5,
    })),
    improved,
  };
}

function cleanVectorization(sourceId: string): PersistedCleanLineVectorizationResult {
  return {
    sourceId,
    pipelineVersion: 'fixture-vector-v1',
    width: 120,
    height: 120,
    analysisScale: 1,
    medianLineWidthPx: 4,
    chains: [{
      id: 'chain_0123456789abcdef0123',
      closed: true,
      samples: [[30, 60], [60, 30], [90, 60], [60, 90]] as Array<readonly [number, number]>,
      simplified: [[30, 60], [60, 30], [90, 60], [60, 90]] as Array<readonly [number, number]>,
      bounds: { x: 30, y: 30, width: 60, height: 60 },
      candidate: {
        type: 'circle' as const,
        parameters: { center: [60, 60], radius: 30 },
        fitErrorMean: 0.2,
        fitErrorP95: 0.5,
        fitErrorMax: 0.8,
        confidence: 0.96,
      },
      evidence: {
        handle: 'evidence_cccccccccccccccccccccccc',
        sourceId,
        regionId: 'vector_chain_0123456789abcdef0123',
        kind: 'circle-candidate' as const,
        bounds: { x: 30, y: 30, width: 60, height: 60 },
        confidence: 0.96,
        touchesRegionEdge: false,
        sampleCount: 4,
      },
    }],
  };
}

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
    candidateTypes: [{ type: 'arc', score: 0.9 }, { type: 'circle', score: 0.7 }],
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
      vectorization?: ConstructorParameters<typeof DrawingFeedbackLoop>[0]['vectorization'],
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
        ...(vectorization ? { vectorization } : {}),
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
