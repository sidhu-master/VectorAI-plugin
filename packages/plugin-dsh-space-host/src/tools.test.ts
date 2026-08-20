// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type {
  ImageAttachmentRef,
  StoredImageAttachment,
} from '@deepseek-ai/dsh-attachment';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { DrawingImportResult } from '@vectorai/plugin-space-contracts';
import { describe, expect, it } from 'vitest';

import { InMemoryDrawingRepository } from './repository';
import { createDrawingImportTool, createDrawingSummarizeTool } from './tools';
import { ProvisionalFootprintVectorizer } from './vectorizer';

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
    vectorizer: new ProvisionalFootprintVectorizer(),
    drawingId: () => 'drawing-source',
  });
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
});
