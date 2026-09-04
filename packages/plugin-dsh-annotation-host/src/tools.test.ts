// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import {
  createDimensionChainStartTool,
  createEngineeringAnnotationTool,
  createGdtStartTool,
  createPartitionStartTool,
  createPartitionStatusTool,
} from './tools';
import { AnnotationSessionStateStore } from './session-state';
import { PartitionSessionStore } from './partition-store';
import {
  createDeterministicAnnotationPipeline,
  createEngineeringAnnotationPlanner,
} from './deterministic-annotation-pipeline';
import { RecognitionPipelineRunner, type RecognitionModelPort } from './recognition-runtime';

const deterministicRunner = new RecognitionPipelineRunner({
  review: async () => { throw new Error('MODEL_MUST_NOT_RUN'); },
} as RecognitionModelPort);
deterministicRunner.register(createDeterministicAnnotationPipeline());
const testPlanner = createEngineeringAnnotationPlanner(deterministicRunner);

function defaultAutomaticOptions() {
  return {
    planner: testPlanner,
    name: 'drawing_auto_annotate',
    description: 'automatic set',
    annotationKinds: ['opening-angle'] as const,
    objective: 'automatic set',
  };
}

describe('drawing_auto_annotate', () => {
  it('uses the injected recognition planner as the only annotation source', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing:pipeline-only' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({
      id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality,
    }));
    const planner = vi.fn(async () => ({
      annotations: [], associations: [], targetNodeIds: [], pending: [], suppressed: [], program: null,
    }));
    const runExtensionProgram = vi.fn();
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1 as const, ref: { drawingId: 'drawing:pipeline-only', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram,
    }, new AnnotationSessionStateStore(), undefined, undefined, {
      planner,
      name: 'drawing_auto_annotate', description: 'automatic set',
      annotationKinds: ['opening-angle'], objective: 'pipeline-only',
    } as never);

    const result = await tool.execute({}, {
      agent: { id: 'session:pipeline-only' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext);

    expect(result).toMatchObject({ status: 'no-effect', annotations: [] });
    expect(planner).toHaveBeenCalledWith({
      document,
      ref: { drawingId: 'drawing:pipeline-only', revision: 1 },
      objective: 'pipeline-only',
      annotationKinds: ['opening-angle'],
    }, expect.any(AbortSignal));
    expect(runExtensionProgram).not.toHaveBeenCalled();
  });

  it('resolves an editable partition once and continues in the same tool call', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-confirm' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({
      id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality,
    }));
    const draft = {
      version: 1 as const,
      drawingRef: { drawingId: 'drawing-confirm', revision: 1 },
      axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 20, orientation: 'forward' as const },
      segments: [], semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
    };
    const resolvePartitionDecision = vi.fn(async () => 'confirm' as const);
    const runExtensionProgram = vi.fn(async () => ({ result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-confirm',
      ref: { drawingId: 'drawing-confirm', revision: 2 }, operationId: 'op-confirm',
      operationBindingDigest: 'sha256:confirm',
    } }));
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1 as const, ref: { drawingId: 'drawing-confirm', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, new AnnotationSessionStateStore(), {
      get: () => ({
        version: 1 as const, phase: 'editing' as const, drawingRef: draft.drawingRef,
        draft, canUndo: false, canRedo: false, updatedAt: 1,
      }),
      advanceDrawingRevision: vi.fn(),
    }, undefined, {
      planner: testPlanner,
      name: 'drawing_auto_annotate', description: 'automatic set',
      annotationKinds: ['opening-angle'], objective: 'automatic set',
      preparePartition: async () => ({
        version: 1 as const, phase: 'editing' as const, drawingRef: draft.drawingRef,
        draft, canUndo: false, canRedo: false, updatedAt: 1,
      }),
      resolvePartitionDecision,
    } as never);

    await expect(tool.execute({}, {
      agent: { id: 'session-confirm' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({ status: 'committed' });
    expect(resolvePartitionDecision).toHaveBeenCalledOnce();
    expect(runExtensionProgram).toHaveBeenCalledOnce();
  });

  it('allows opening-angle preview while a partition draft is still being edited', async () => {
    const sessions = new AnnotationSessionStateStore(undefined, { now: () => 12 });
    sessions.start('session-1', 'partition-1');
    const partitions = {
      get: vi.fn(() => ({
        version: 1 as const, phase: 'editing' as const,
        drawingRef: { drawingId: 'drawing-1', revision: 1 },
        canUndo: false, canRedo: false, updatedAt: 0,
      })),
      advanceDrawingRevision: vi.fn(),
    };
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({ id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality }));
    const runExtensionProgram = vi.fn(async (agent: Agent, request: unknown) => { void agent; void request; return { result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-1',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-1', operationBindingDigest: 'sha256:binding',
    } }; });
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 },
        document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, sessions, partitions, undefined, defaultAutomaticOptions());

    await expect(tool.execute({}, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({ status: 'committed' });
    expect(runExtensionProgram).toHaveBeenCalledOnce();
    expect(partitions.advanceDrawingRevision).toHaveBeenCalledWith(
      'session-1',
      { drawingId: 'drawing-1', revision: 1 },
      { drawingId: 'drawing-1', revision: 2 },
    );
  });

  it('uses the first-layer extension seam and never commits directly', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({ id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality }));
    const runExtensionProgram = vi.fn(async (agent: Agent, request: unknown) => {
      void agent;
      void request;
      return { result: {
        status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-1',
        ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-1', operationBindingDigest: 'sha256:binding',
      } };
    });
    const partitions = {
      get: vi.fn(() => ({ version: 1 as const, phase: 'idle' as const, canUndo: false, canRedo: false, updatedAt: 0 })),
      advanceDrawingRevision: vi.fn(),
    };
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, new AnnotationSessionStateStore(undefined, { now: () => 10 }), partitions, undefined, defaultAutomaticOptions());
    const exec = {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext;

    const result = await tool.execute({}, exec);

    expect(result).toMatchObject({ status: 'committed' });
    expect((result as { annotations: string[] }).annotations).toEqual(expect.arrayContaining([expect.stringMatching(/^annotation_auto_/)]));
    expect(runExtensionProgram).toHaveBeenCalledOnce();
    expect(runExtensionProgram.mock.calls[0]?.[1]).toMatchObject({ targetNodeIds: ['left-lower', 'left-upper'] });
    expect(partitions.advanceDrawingRevision).not.toHaveBeenCalled();
  });

  it('does not report the automatic set complete before datum and GD&T recommendation', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({ id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality }));
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: vi.fn(async () => ({ result: {
        status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-1',
        ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-1', operationBindingDigest: 'sha256:binding',
      } })) as never,
    }, new AnnotationSessionStateStore(), undefined, undefined, {
      planner: testPlanner,
      name: 'drawing_auto_annotate', description: 'automatic set',
      annotationKinds: ['opening-angle', 'diameter'], objective: 'automatic set',
      afterAnnotations: () => ({
        version: 1, phase: 'editing', drawingRef: { drawingId: 'drawing-1', revision: 2 },
        canUndo: false, canRedo: false, updatedAt: 1,
        draft: {
          version: 1, drawingRef: { drawingId: 'drawing-1', revision: 2 }, datums: [], intents: [], tolerances: [], fitAssignments: [],
          geometricTolerances: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [],
        },
      }),
      requiresGdtRecommendation: true,
    });

    await expect(tool.execute({}, {
      agent: { id: 'session-auto' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      status: 'awaiting-gdt-recommendation',
      annotationSet: {
        completionStatus: 'incomplete',
        completionClaimAllowed: false,
        gdtStatus: 'required',
        requiredNextTools: ['drawing_query', 'drawing_gdt_start'],
      },
    });
  });

  it('returns user-facing clarification questions without routing to a manual GD&T tool', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-clarify' }, now: () => 1 });
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-clarify', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: vi.fn(),
    }, new AnnotationSessionStateStore(), undefined, undefined, {
      planner: testPlanner,
      name: 'drawing_auto_annotate', description: 'automatic set', annotationKinds: [], objective: 'automatic set',
      afterAnnotations: () => ({
        version: 1, phase: 'editing', drawingRef: { drawingId: 'drawing-clarify', revision: 1 },
        canUndo: false, canRedo: false, updatedAt: 1,
        draft: {
          version: 1, drawingRef: { drawingId: 'drawing-clarify', revision: 1 }, datums: [], intents: [], tolerances: [], fitAssignments: [],
          geometricTolerances: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [{
            id: 'diagnostic:gdt:coverage', severity: 'warning', code: 'GDT_USER_INPUT_REQUIRED', message: 'GD&T needs clarification',
          }, {
            id: 'diagnostic:gdt:clarification:0', severity: 'warning', code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED',
            message: '请确认哪两个轴段共同建立旋转基准轴线。',
          }],
        },
      }),
      requiresGdtRecommendation: true,
    });

    await expect(tool.execute({}, {
      agent: { id: 'session-clarify' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      status: 'needs-user-input',
      annotationSet: {
        completionStatus: 'needs-user-input',
        completionClaimAllowed: false,
        clarificationQuestions: ['请确认哪两个轴段共同建立旋转基准轴线。'],
        nextAction: 'ask-user-for-gdt-clarification',
      },
    });
  });

  it('sends deterministic axial-end opening annotations through the same preview seam', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({
      id: id as never, type: 'line' as const, start: start as never, end: end as never,
      visible: true, quality,
    }));
    const runExtensionProgram = vi.fn(async (agent: Agent, request: unknown) => { void agent; void request; return { result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-angle',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-angle', operationBindingDigest: 'sha256:angle',
    } }; });
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, new AnnotationSessionStateStore(), undefined, undefined, defaultAutomaticOptions());

    await tool.execute({}, {
      agent: { id: 'session-angle' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext);

    const request = runExtensionProgram.mock.calls[0]?.[1] as {
      program: { operations: Array<{ kind: string; annotations?: Array<{ dimensionKind?: string; displayText?: string }> }> };
    };
    expect(request.program.operations[0]?.annotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ dimensionKind: 'angular', displayText: '120°' }),
    ]));
  });

  it('claims only after a real Drawing route succeeds and retains the claim after failure', async () => {
    const sessions = new AnnotationSessionStateStore(undefined, { now: () => 12 });
    const noDrawing = createEngineeringAnnotationTool({
      getSnapshot: () => null,
      runExtensionProgram: vi.fn() as never,
    }, sessions, undefined, undefined, defaultAutomaticOptions());
    const exec = {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext;
    await expect(noDrawing.execute({}, exec)).rejects.toThrow('DRAWING_REQUIRED');
    expect(sessions.get('session-1').workspaceClaimed).toBe(false);

    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
    ].map(([id, start, end]) => ({ id: id as never, type: 'line' as const, start: start as never, end: end as never, visible: true, quality }));
    const failing = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: vi.fn(async () => { throw new Error('ASSESSMENT_FAILED'); }) as never,
    }, sessions, undefined, undefined, defaultAutomaticOptions());
    await expect(failing.execute({}, exec)).rejects.toThrow('ASSESSMENT_FAILED');
    expect(sessions.get('session-1')).toMatchObject({
      workspaceClaimed: true,
      activationEpoch: 12,
      workflow: { status: 'failed' },
    });
  });
});

describe('drawing_partition_status', () => {
  it('routes partition follow-ups to the existing editable draft without geometry editing', async () => {
    const partitions = new PartitionSessionStore(undefined, { now: () => 1, id: () => 'partition-1' });
    partitions.beginAnalysis('session-1', { drawingId: 'drawing-1', revision: 1 });
    const tool = createPartitionStatusTool(partitions);

    await expect(tool.execute({}, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      phase: 'analyzing',
      nextAction: 'wait-for-analysis',
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
    });
  });

  it('tells the model that opening-angle annotation may continue before confirmation', async () => {
    const tool = createPartitionStatusTool({ get: () => ({
      version: 1, phase: 'editing', drawingRef: { drawingId: 'drawing-1', revision: 1 },
      canUndo: false, canRedo: false, updatedAt: 1,
    }) } as never);

    await expect(tool.execute({}, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      phase: 'editing',
      nextAction: 'review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming',
    });
  });
});

describe('drawing_gdt_start', () => {
  it('does not claim the automatic set complete from an unverified partial GD&T payload', async () => {
    const tool = createGdtStartTool({
      start: vi.fn(() => ({
        version: 1 as const, phase: 'editing' as const,
        drawingRef: { drawingId: 'drawing-1', revision: 2 }, canUndo: false, canRedo: false, updatedAt: 1,
        draft: {
          version: 1 as const, drawingRef: { drawingId: 'drawing-1', revision: 2 },
          datums: [{ id: 'datum:A' }], geometricTolerances: [{ id: 'gdt:1', computed: { status: 'pending' } }],
          axialScheme: { displayedCandidateIds: ['dimension:1'], closureCandidateIds: ['dimension:closure'] },
          diagnostics: [],
        },
      } as never)),
    });

    await expect(tool.execute({
      datums: [{ name: 'A', geometryId: 'edge:datum', role: 'primary' }],
      controls: [{
        id: 'gdt:1', characteristic: 'perpendicularity', geometryIds: ['edge:controlled'],
        datumNames: ['A'], toleranceZoneShape: 'linear',
      }],
    }, {
      agent: { id: 'session-auto' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      status: 'editing', datumCount: 1, controlCount: 1,
      annotationSet: {
        completionStatus: 'incomplete', completionClaimAllowed: false,
        gdtStatus: 'editing', dimensionChainStatus: 'editing',
      },
    });
  });
});

describe('drawing_partition_start', () => {
  it('starts partition analysis only after an explicit model tool call', async () => {
    const start = vi.fn(async () => ({
      version: 1 as const,
      phase: 'editing' as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      canUndo: false,
      canRedo: false,
      updatedAt: 1,
    }));
    const tool = createPartitionStartTool({ start });

    await expect(tool.execute({ engineeringContext: '外花键宽 24.5' }, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({
      status: 'editing', segmentCount: 0,
      nextAction: 'review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming',
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      '外花键宽 24.5',
      expect.any(AbortSignal),
    );
  });

  it('rejects oversized model-transcribed document context', async () => {
    const tool = createPartitionStartTool({ start: vi.fn() });
    await expect(tool.execute({ engineeringContext: 'x'.repeat(32_769) }, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).rejects.toThrow('PARTITION_CONTEXT_SIZE_LIMIT');
  });
});

describe('drawing_dimension_chain_start', () => {
  it('starts nominal axial chain inference only through an explicit tool call', async () => {
    const start = vi.fn(() => ({
      version: 1 as const, phase: 'editing' as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      canUndo: false, canRedo: false, updatedAt: 1,
    }));
    const tool = createDimensionChainStartTool({ start });

    expect(tool.name).toBe('drawing_dimension_chain_start');
    await expect(tool.execute({ policy: 'shaft-hierarchical-dimensioning-v1' }, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({ status: 'editing' });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      'shaft-hierarchical-dimensioning-v1',
    );
  });

  it('uses the reference terminal-closure policy when the model omits policy', async () => {
    const start = vi.fn(() => ({
      version: 1 as const, phase: 'editing' as const,
      drawingRef: { drawingId: 'drawing-1', revision: 1 },
      canUndo: false, canRedo: false, updatedAt: 1,
    }));
    const tool = createDimensionChainStartTool({ start });

    await tool.execute({}, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext);

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      'shaft-hierarchical-dimensioning-v1',
    );
  });
});
