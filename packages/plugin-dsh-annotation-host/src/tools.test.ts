// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import {
  createDimensionChainStartTool,
  createEngineeringAnnotationTool,
  createPartitionStartTool,
  createPartitionStatusTool,
} from './tools';
import { AnnotationSessionStateStore } from './session-state';
import { PartitionSessionStore } from './partition-store';

describe('drawing_auto_annotate', () => {
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
    const runExtensionProgram = vi.fn(async (_agent: Agent, _request: unknown) => ({ result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-1',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-1', operationBindingDigest: 'sha256:binding',
    } }));
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 },
        document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, sessions, partitions);

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
    }, new AnnotationSessionStateStore(undefined, { now: () => 10 }), partitions);
    const exec = {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext;

    const result = await tool.execute({}, exec);

    expect(result).toMatchObject({ status: 'committed', annotations: [expect.stringMatching(/^annotation_auto_/)] });
    expect(runExtensionProgram).toHaveBeenCalledOnce();
    expect(runExtensionProgram.mock.calls[0]?.[1]).toMatchObject({ targetNodeIds: ['left-lower', 'left-upper'] });
    expect(partitions.advanceDrawingRevision).not.toHaveBeenCalled();
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
    const runExtensionProgram = vi.fn(async (_agent: Agent, _request: unknown) => ({ result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-angle',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-angle', operationBindingDigest: 'sha256:angle',
    } }));
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    }, new AnnotationSessionStateStore());

    await tool.execute({}, {
      agent: { id: 'session-angle' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext);

    const request = runExtensionProgram.mock.calls[0]?.[1] as {
      program: { operations: Array<{ kind: string; annotations?: Array<{ dimensionKind?: string; displayText?: string }> }> };
    };
    expect(request.program.operations[0]?.annotations).toEqual([
      expect.objectContaining({ dimensionKind: 'angular', displayText: '120°' }),
    ]);
  });

  it('claims only after a real Drawing route succeeds and retains the claim after failure', async () => {
    const sessions = new AnnotationSessionStateStore(undefined, { now: () => 12 });
    const noDrawing = createEngineeringAnnotationTool({
      getSnapshot: () => null,
      runExtensionProgram: vi.fn() as never,
    }, sessions);
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
    }, sessions);
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
    await expect(tool.execute({ policy: 'shaft-reference-terminal-closure-v1' }, {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext)).resolves.toMatchObject({ status: 'editing' });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      'shaft-reference-terminal-closure-v1',
    );
  });
});
