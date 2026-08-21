// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import { createEngineeringAnnotationTool } from './tools';

describe('drawing_auto_annotate', () => {
  it('uses the first-layer extension seam and never commits directly', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'circle-1' as never, type: 'circle', center: [0, 0], radius: 5, visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const runExtensionProgram = vi.fn(async () => ({ result: {
      status: 'committed' as const, mode: 'auto-safe' as const, commitId: 'commit-1',
      ref: { drawingId: 'drawing-1', revision: 2 }, operationId: 'op-1', operationBindingDigest: 'sha256:binding',
    } }));
    const tool = createEngineeringAnnotationTool({
      getSnapshot: () => ({
        version: 1, ref: { drawingId: 'drawing-1', revision: 1 }, document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: runExtensionProgram as never,
    });
    const exec = {
      agent: { id: 'session-1' } as Agent,
      signal: new AbortController().signal,
    } as ToolRunContext;

    const result = await tool.execute({}, exec);

    expect(result).toMatchObject({ status: 'committed', annotations: [expect.stringMatching(/^annotation_auto_/)] });
    expect(runExtensionProgram).toHaveBeenCalledOnce();
    expect(runExtensionProgram.mock.calls[0]?.[1]).toMatchObject({ targetNodeIds: ['circle-1'] });
  });
});
