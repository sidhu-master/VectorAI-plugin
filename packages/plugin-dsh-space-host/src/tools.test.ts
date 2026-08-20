// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  ImageAttachmentRef,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { DrawingImportResult } from '@vectorai/plugin-space-contracts';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { InMemoryDrawingRepository } from './repository';
import {
  createDrawingImportTool,
  createDrawingCommitPreviewTool,
  createDrawingDiscardPreviewTool,
  createDrawingPreviewTool,
  createDrawingQueryTool,
  createDrawingSummarizeTool,
} from './tools';
import type { ImageVectorizer } from './vectorizer';

function attachment(id = 'source'): ImageAttachmentRef {
  return {
    attachmentId: id as ImageAttachmentRef['attachmentId'],
    mediaType: 'image/png',
    bytes: 4,
    width: 120,
    height: 80,
    name: 'drawing.png',
  };
}

function exec(sessionId?: string, signal = new AbortController().signal): ToolRunContext {
  return {
    callId: 'call-1',
    rootCallId: 'call-1',
    name: 'drawing_import',
    arguments: {},
    signal,
    token: Symbol('tool'),
    ...(sessionId === undefined ? {} : { agent: { id: sessionId } as unknown as Agent }),
    deferContext() {},
    concludeTurn() {},
  } as unknown as ToolRunContext;
}

function repository() {
  return new InMemoryDrawingRepository({
    vectorizer: fixtureVectorizer(),
    drawingId: () => 'drawing-source',
  });
}

function fixtureVectorizer(): ImageVectorizer {
  return {
    async vectorize({ drawingId, attachment: source }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      const lines: Array<[
        string,
        readonly [number, number],
        readonly [number, number],
      ]> = [
        ['top', [0, 0], [source.width, 0]],
        ['right', [source.width, 0], [source.width, source.height]],
        ['bottom', [source.width, source.height], [0, source.height]],
        ['left', [0, source.height], [0, 0]],
      ];
      document.geometry = lines.map(([id, start, end]) => ({
        id: id as typeof document.geometry[number]['id'],
        type: 'line' as const,
        start,
        end,
        visible: true,
        quality: { status: 'candidate' as const, confidence: 0.25, evidenceRefs: [] },
      }));
      return {
        document,
        bounds: { minX: 0, minY: 0, maxX: source.width, maxY: source.height },
        provisional: true,
      };
    },
  };
}

describe('drawing tools', () => {
  it('rejects drawing_import without an owning Agent', async () => {
    const tool = createDrawingImportTool(repository(), {
      async readImage(): Promise<StoredImageAttachment> {
        throw new Error('must not read');
      },
    });

    await expect(tool.execute({}, exec())).rejects.toThrow('DRAWING_SESSION_REQUIRED');
  });

  it('reads the pending attachment with the tool signal and imports it', async () => {
    const drawings = repository();
    const source = attachment();
    drawings.bindPending('session-a', source);
    const controller = new AbortController();
    const reads: Array<{ ref: ImageAttachmentRef; signal?: AbortSignal }> = [];
    const tool = createDrawingImportTool(drawings, {
      async readImage(ref, signal) {
        reads.push({ ref, signal });
        return { ref, data: new Uint8Array([1, 2, 3, 4]) };
      },
    });

    const result = await tool.execute({}, exec('session-a', controller.signal));

    expect(reads).toEqual([{ ref: source, signal: controller.signal }]);
    expect(result).toEqual({
      status: 'imported',
      ref: { drawingId: 'drawing-source', revision: 1 },
      provisional: true,
    });
  });

  it('requires an imported Drawing before drawing_summarize', async () => {
    const tool = createDrawingSummarizeTool(repository());

    await expect(tool.execute({}, exec('session-a'))).rejects.toThrow('DRAWING_REQUIRED');
  });

  it('summarizes the same revision produced by drawing_import', async () => {
    const drawings = repository();
    const source = attachment();
    drawings.bindPending('session-a', source);
    const importTool = createDrawingImportTool(drawings, {
      async readImage(ref) {
        return { ref, data: new Uint8Array([1, 2, 3, 4]) };
      },
    });
    const summarizeTool = createDrawingSummarizeTool(drawings);

    const imported = await importTool.execute({}, exec('session-a')) as DrawingImportResult;
    const summary = await summarizeTool.execute({}, exec('session-a'));

    expect(summary).toMatchObject({
      ref: imported.ref,
      geometryByType: { line: 4 },
      provisional: true,
    });
  });

  it('binds drawing_query to the owning Agent and exact Drawing ref', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment());
    const importTool = createDrawingImportTool(drawings, {
      async readImage(ref) {
        return { ref, data: new Uint8Array([1]) };
      },
    });
    await importTool.execute({}, exec('session-a'));
    const tool = createDrawingQueryTool(drawings);
    const request = {
      kind: 'world-slice' as const,
      ref: { drawingId: 'drawing-source', revision: 1 },
      bounds: { minX: -1, minY: -1, maxX: 121, maxY: 1 },
      planes: ['geometry'] as const,
      limit: 20,
    };

    await expect(tool.execute(request, exec())).rejects.toThrow('DRAWING_SESSION_REQUIRED');
    const result = await tool.execute(request, exec('session-a'));

    expect(result).toMatchObject({
      kind: 'world-slice',
      ref: request.ref,
      totalByPlane: { geometry: 3 },
      truncated: false,
    });
  });

  it('creates and commits a Preview through session-bound DSH tools', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment());
    const importTool = createDrawingImportTool(drawings, {
      async readImage(ref) {
        return { ref, data: new Uint8Array([1]) };
      },
    });
    await importTool.execute({}, exec('session-a'));
    const previewTool = createDrawingPreviewTool(drawings);
    const commitTool = createDrawingCommitPreviewTool(drawings);

    const preview = await previewTool.execute({
      ref: { drawingId: 'drawing-source', revision: 1 },
      summary: 'hide top',
      commands: [{
        type: 'node.update',
        id: 'top',
        changes: { visible: false },
        expected: { visible: true },
      }],
    }, exec('session-a'));

    expect(preview).toMatchObject({
      status: 'previewed',
      preview: {
        baseRef: { drawingId: 'drawing-source', revision: 1 },
        diff: { updatedNodeIds: ['top'] },
      },
    });
    expect((preview as { preview: object }).preview).not.toHaveProperty('candidate');
    expect((preview as { preview: object }).preview).not.toHaveProperty('commands');
    const handle = (preview as { preview: { handle: string } }).preview.handle;
    const committed = await commitTool.execute({ handle }, exec('session-a'));
    expect(committed).toMatchObject({
      status: 'committed',
      ref: { drawingId: 'drawing-source', revision: 2 },
    });
    expect(committed as object).not.toHaveProperty('snapshot');
  });

  it('discards only the owning session current Preview', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment());
    await createDrawingImportTool(drawings, {
      async readImage(ref) {
        return { ref, data: new Uint8Array([1]) };
      },
    }).execute({}, exec('session-a'));
    const preview = await createDrawingPreviewTool(drawings).execute({
      ref: { drawingId: 'drawing-source', revision: 1 },
      commands: [{ type: 'node.delete', id: 'top' }],
    }, exec('session-a'));
    const handle = (preview as { preview: { handle: string } }).preview.handle;
    const discardTool = createDrawingDiscardPreviewTool(drawings);

    expect(await discardTool.execute({ handle }, exec('session-b'))).toMatchObject({
      status: 'rejected', code: 'PREVIEW_NOT_FOUND',
    });
    expect(await discardTool.execute({ handle }, exec('session-a'))).toEqual({
      status: 'discarded',
      ref: { drawingId: 'drawing-source', revision: 1 },
    });
  });
});
