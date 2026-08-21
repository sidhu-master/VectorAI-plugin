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
  createDrawingAgentToolCatalog,
  createDrawingFinalizePreviewTool,
  createDrawingImportTool,
  createDrawingCommitPreviewTool,
  createDrawingDiscardPreviewTool,
  createDrawingPreviewTool,
  createDrawingQueryTool,
  createDrawingSummarizeTool,
} from './tools';
import type { ImageVectorizer } from './vectorizer';
import { SemanticEditService } from './semantic-edit-service';
import {
  createDrawingFinalizeSemanticTool,
  createDrawingUndoTool,
} from './semantic-tools';

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
  it('single-flights concurrent semantic confirmation and Undo questions', async () => {
    let askCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const questions = {
      async ask(input: { questions: Array<{ id: string }> }) {
        askCalls += 1;
        await gate;
        const id = input.questions[0]!.id;
        return { answers: [{ id, selected: [id.startsWith('drawing-undo-') ? '撤销此提交' : '应用修改'] }] };
      },
    };
    let confirms = 0;
    let undoes = 0;
    const semantic = {
      finalizePreview: () => ({
        status: 'rejected', disposition: 'confirmation_required', code: 'REVIEW', message: 'review',
      }),
      confirmFinalize: () => { confirms += 1; return { status: 'committed' }; },
      discardPreview: () => ({ status: 'discarded' }),
      undoAuthorized: () => { undoes += 1; return { status: 'committed' }; },
    } as unknown as SemanticEditService;
    const finalize = createDrawingFinalizeSemanticTool(semantic, questions as never);
    const request = {
      previewHandle: 'preview-1', previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1', finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    };
    const a = finalize.execute(request, exec('session-a'));
    const b = finalize.execute(request, exec('session-a'));
    await Promise.resolve();
    expect(askCalls).toBe(1);
    release();
    await Promise.all([a, b]);
    expect(confirms).toBe(1);

    let releaseUndo!: () => void;
    const undoGate = new Promise<void>((resolve) => { releaseUndo = resolve; });
    const undoQuestions = {
      async ask(input: { questions: Array<{ id: string }> }) {
        askCalls += 1;
        await undoGate;
        return { answers: [{ id: input.questions[0]!.id, selected: ['撤销此提交'] }] };
      },
    };
    const undo = createDrawingUndoTool(semantic, undoQuestions as never);
    const undoArgs = { targetCommitId: 'commit-1', expectedCurrentRef: { drawingId: 'drawing-1', revision: 2 } };
    const u1 = undo.execute(undoArgs, exec('session-a'));
    const u2 = undo.execute(undoArgs, exec('session-a'));
    await Promise.resolve();
    expect(askCalls).toBe(2);
    releaseUndo();
    await Promise.all([u1, u2]);
    expect(undoes).toBe(1);
  });

  it('exposes only the fail-closed semantic edit surface to the model', () => {
    const drawings = repository();
    const semantic = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-1`,
      now: () => 1,
      digest: (value) => `sha256:${value.length}`,
    });
    const tools = createDrawingAgentToolCatalog(drawings, {
      async readImage(): Promise<StoredImageAttachment> {
        throw new Error('must not read');
      },
    }, semantic);

    expect(tools.map((tool) => tool.name)).toEqual([
      'drawing_import',
      'drawing_summarize',
      'drawing_query',
      'drawing_observe',
      'drawing_build_context',
      'drawing_ground',
      'drawing_preview_program',
      'drawing_revise_preview',
      'drawing_evaluate_preview',
      'drawing_finalize_preview',
      'drawing_discard_preview',
      'drawing_get_operation',
      'drawing_undo_commit',
    ]);
  });

  it('blocks semantic finalize without mutating the formal Drawing or current Preview', async () => {
    const drawings = repository();
    drawings.bindPending('session-a', attachment());
    await createDrawingImportTool(drawings, {
      async readImage(ref) {
        return { ref, data: new Uint8Array([1]) };
      },
    }).execute({}, exec('session-a'));
    const previewed = drawings.createPreview('session-a', {
      ref: { drawingId: 'drawing-source', revision: 1 },
      commands: [{
        type: 'node.update',
        id: 'top',
        changes: { visible: false },
        expected: { visible: true },
      }],
    });
    expect(previewed.status).toBe('previewed');
    const before = drawings.getSnapshot('session-a');
    const previewBefore = drawings.getPreview('session-a');

    const result = await createDrawingFinalizePreviewTool(drawings).execute({
      previewHandle: previewBefore?.handle ?? 'missing-preview',
      previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1',
      finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    }, exec('session-a'));

    expect(result).toEqual({
      status: 'rejected',
      disposition: 'blocked',
      code: 'AUTO_SAFE_UNAVAILABLE',
      message: 'Durable history, inverse transactions, idempotency, and Undo are required before semantic finalize.',
    });
    expect(drawings.getSnapshot('session-a')?.ref).toEqual(before?.ref);
    expect(drawings.getPreview('session-a')?.handle).toBe(previewBefore?.handle);
  });

  it('rejects authority and raw command fields on semantic finalize', async () => {
    const tool = createDrawingFinalizePreviewTool(repository());
    const request = {
      previewHandle: 'preview-1',
      previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1',
      finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    };

    for (const forbidden of [
      { force: true },
      { approved: true },
      { humanDecision: 'apply' },
      { commands: [] },
      { autoSafe: true },
    ]) {
      await expect(tool.execute({ ...request, ...forbidden } as never, exec('session-a')))
        .rejects.toThrow();
    }
  });

  it('rejects semantic finalize without an owning Agent', async () => {
    const tool = createDrawingFinalizePreviewTool(repository());

    await expect(tool.execute({
      previewHandle: 'preview-1',
      previewDigest: 'sha256:candidate',
      finalizeOperationId: 'operation-1',
      finalizeOperationBindingDigest: 'sha256:binding',
      evaluationId: 'evaluation-1',
    }, exec())).rejects.toThrow('DRAWING_SESSION_REQUIRED');
  });

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
