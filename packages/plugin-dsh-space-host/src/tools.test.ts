// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ImageAttachmentRef, StoredImageAttachment } from '@deepseek-ai/dsh-attachment';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { createEmptyDrawing } from '@vectorai/drawing-core';
import { describe, expect, it, vi } from 'vitest';

import { InMemoryDrawingRepository } from './repository';
import { SemanticEditService } from './semantic-edit-service';
import {
  createDrawingDiscardSemanticTool,
  createDrawingEvaluatePreviewTool,
  createDrawingFinalizeSemanticTool,
  createDrawingGetOperationTool,
  createDrawingObserveTool,
  createDrawingPreviewSpatialIntentTool,
  createDrawingReviseSpatialIntentTool,
  createDrawingSelectPartsTool,
  createDrawingUndoTool,
} from './semantic-tools';
import {
  createDrawingAgentToolCatalog,
  createDrawingImportTool,
  createDrawingQueryTool,
  createDrawingSummarizeTool,
} from './tools';
import type { ImageVectorizer } from './vectorizer';

function attachment(id = 'source'): ImageAttachmentRef {
  return {
    attachmentId: id as ImageAttachmentRef['attachmentId'], mediaType: 'image/png',
    bytes: 4, width: 120, height: 80, name: 'drawing.png',
  };
}

function exec(sessionId?: string, signal = new AbortController().signal): ToolRunContext {
  return {
    callId: 'call-1', rootCallId: 'call-1', name: 'drawing_observe', arguments: {},
    signal, token: Symbol('tool'),
    ...(sessionId === undefined ? {} : { agent: { id: sessionId } as unknown as Agent }),
    deferContext() {}, concludeTurn() {},
  } as unknown as ToolRunContext;
}

function fixtureVectorizer(): ImageVectorizer {
  return {
    async vectorize({ drawingId, attachment: source }) {
      const document = createEmptyDrawing({ idFactory: { next: () => drawingId }, now: () => 1 });
      document.geometry = [{
        id: 'top' as typeof document.geometry[number]['id'], type: 'line',
        start: [0, 0], end: [source.width, 0], visible: true,
        quality: { status: 'candidate', confidence: 0.25, evidenceRefs: [] },
      }, {
        id: 'right' as typeof document.geometry[number]['id'], type: 'line',
        start: [source.width, 0], end: [source.width, source.height], visible: true,
        quality: { status: 'candidate', confidence: 0.25, evidenceRefs: [] },
      }];
      return {
        document, bounds: { minX: 0, minY: 0, maxX: source.width, maxY: source.height },
        provisional: true,
      };
    },
  };
}

function repository() {
  return new InMemoryDrawingRepository({ vectorizer: fixtureVectorizer(), drawingId: () => 'drawing-source' });
}

describe('drawing semantic tools', () => {
  it('exposes only high-level semantic editing tools and no model-carried internal handles', () => {
    const drawings = repository();
    const semantic = new SemanticEditService(drawings, {
      id: (kind) => `${kind}-1`, now: () => 1, digest: (value) => `sha256:${value.length}`,
    });
    const tools = createDrawingAgentToolCatalog(drawings, {
      async readImage(): Promise<StoredImageAttachment> { throw new Error('must not read'); },
    }, semantic);

    expect(tools.map(({ name }) => name)).toEqual([
      'drawing_import', 'drawing_summarize', 'drawing_query',
      'drawing_observe', 'drawing_select_parts', 'drawing_preview_spatial_intent',
      'drawing_revise_spatial_intent', 'drawing_evaluate_preview',
      'drawing_finalize_preview', 'drawing_discard_preview',
      'drawing_get_operation', 'drawing_undo_commit',
    ]);
    const semanticSchemas = tools.slice(3).map(({ parameters }) => JSON.stringify(parameters)).join('\n');
    expect(semanticSchemas).not.toMatch(
      /taskId|contextId|groundingId|previewHandle|candidateDigest|translation|pivot|rotationRadians/,
    );
    for (const name of [
      'drawing_observe', 'drawing_evaluate_preview', 'drawing_finalize_preview',
      'drawing_discard_preview', 'drawing_get_operation',
    ]) {
      expect(tools.find((tool) => tool.name === name)?.parameters)
        .toEqual(expect.objectContaining({ properties: {} }));
    }
  });

  it('runs the compact semantic chain without accepting or returning opaque lineage ids', async () => {
    const calls: string[] = [];
    const semantic = {
      async observeCurrent() { calls.push('observe'); return { state: 'observed', nextTools: ['drawing_select_parts'] }; },
      currentObservationAttachment() { return null; },
      selectCurrentParts() {
        calls.push('select');
        return { state: 'selected', parts: [{ partKey: 'hand', label: 'right hand', nodeCount: 3, interfaceCount: 1, sourceStatus: 'confirmed' }], nextTools: ['drawing_preview_spatial_intent'] };
      },
      previewCurrentIntent() { calls.push('preview'); return { previewHandle: 'secret', candidateDigest: 'secret' }; },
      currentPreviewPresentation() {
        return { state: 'preview_ready', summary: 'raise hand', changedNodeCount: 3, nextTools: ['drawing_evaluate_preview'] };
      },
      async evaluateCurrentPreview() {
        calls.push('evaluate');
        return {
          evaluation: { review: { outcome: 'satisfied', defects: [] }, diagnostics: [] },
          assessment: { disposition: 'auto_safe', reasons: [] },
        };
      },
      finalizeCurrentPreview() {
        calls.push('finalize');
        return { status: 'committed', mode: 'auto_safe', commitId: 'secret', ref: { drawingId: 'secret', revision: 2 } };
      },
    } as unknown as SemanticEditService;

    const results = [
      await createDrawingObserveTool(semantic).execute({}, exec('session-a')),
      await createDrawingSelectPartsTool(semantic).execute({
        parts: [{ partKey: 'hand', label: 'right hand', references: [{ kind: 'semantic_query', text: 'right hand' }] }],
      }, exec('session-a')),
      await createDrawingPreviewSpatialIntentTool(semantic).execute({
        summary: 'raise hand',
        goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
        preserve: [{ kind: 'part_shape', partKey: 'hand' }, { kind: 'minimum_deformation' }],
      }, exec('session-a')),
      await createDrawingEvaluatePreviewTool(semantic).execute({}, exec('session-a')),
      await createDrawingFinalizeSemanticTool(semantic).execute({}, exec('session-a')),
    ];

    expect(calls).toEqual(['observe', 'select', 'preview', 'evaluate', 'finalize']);
    expect(JSON.stringify(results)).not.toMatch(/secret|taskId|groundingId|previewHandle|candidateDigest/);
    expect(results.at(-1)).toMatchObject({ status: 'committed', revision: 2 });
  });

  it('strictly rejects model-provided coordinates and unknown fields', async () => {
    const semantic = { previewCurrentIntent: vi.fn() } as unknown as SemanticEditService;
    const tool = createDrawingPreviewSpatialIntentTool(semantic);
    const request = {
      summary: 'raise hand',
      goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
      preserve: [],
    };
    await expect(tool.execute({ ...request, translation: [0, 50] } as never, exec('session-a')))
      .rejects.toThrow();
    await expect(tool.execute({
      ...request, goals: [{ ...request.goals[0], pivot: [10, 20] }],
    } as never, exec('session-a'))).rejects.toThrow();
    expect(semantic.previewCurrentIntent).not.toHaveBeenCalled();
  });

  it('returns compact recovery guidance for wrong semantic state', async () => {
    const semantic = {
      previewCurrentIntent() { throw new Error('EDIT_SELECTION_REQUIRED'); },
    } as unknown as SemanticEditService;
    const result = await createDrawingPreviewSpatialIntentTool(semantic).execute({
      summary: 'raise hand',
      goals: [{ kind: 'direction', subject: 'hand', direction: 'up', magnitude: 'moderate' }],
      preserve: [],
    }, exec('session-a'));
    expect(result).toEqual({
      drawingWorkflow: {
        state: 'invalid_state', code: 'EDIT_SELECTION_REQUIRED', nextTools: ['drawing_observe'],
      },
    });
  });

  it('revises semantic goals only, without coordinates or current Preview ids', async () => {
    const reviseCurrentIntent = vi.fn(() => ({}));
    const semantic = {
      reviseCurrentIntent,
      currentPreviewPresentation: () => ({ state: 'preview_ready', changedNodeCount: 2, nextTools: ['drawing_evaluate_preview'] }),
    } as unknown as SemanticEditService;
    const tool = createDrawingReviseSpatialIntentTool(semantic);
    await tool.execute({
      goalDelta: [{ kind: 'direction', subject: 'left_hand', direction: 'down', magnitude: 'slight' }],
      preserveDelta: [{ kind: 'connectivity', partKey: 'left_hand' }],
    }, exec('session-a'));
    expect(reviseCurrentIntent).toHaveBeenCalledWith('session-a', {
      goalDelta: [{ kind: 'direction', subject: 'left_hand', direction: 'down', magnitude: 'slight' }],
      preserveDelta: [{ kind: 'connectivity', partKey: 'left_hand' }],
    });
    expect(JSON.stringify(tool.parameters)).not.toMatch(/currentPreview|handle|translation|rotation|pivot/);
  });

  it('single-flights the current semantic confirmation question', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const ask = vi.fn(async (input: { questions: Array<{ id: string }> }) => {
      await gate;
      return { answers: [{ id: input.questions[0]!.id, selected: ['应用修改'] }] };
    });
    const finalizeCurrentPreview = vi.fn((_: string, confirmed = false) => confirmed
      ? { status: 'committed', mode: 'confirmed', ref: { drawingId: 'drawing-1', revision: 2 } }
      : { status: 'rejected', disposition: 'confirmation_required', code: 'REVIEW', message: 'review' });
    const semantic = { finalizeCurrentPreview } as unknown as SemanticEditService;
    const tool = createDrawingFinalizeSemanticTool(semantic, { ask } as never);
    const first = tool.execute({}, exec('session-a'));
    const second = tool.execute({}, exec('session-a'));
    await Promise.resolve();
    expect(ask).toHaveBeenCalledTimes(1);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatchObject({ status: 'committed', mode: 'confirmed', revision: 2 });
    expect(b).toEqual(a);
    expect(finalizeCurrentPreview).toHaveBeenCalledTimes(2);
  });

  it('does not let the model bypass human authority for Undo', async () => {
    const undoAuthorized = vi.fn(() => ({ status: 'committed', resultingRef: { revision: 3 } }));
    const semantic = { undoAuthorized } as unknown as SemanticEditService;
    const tool = createDrawingUndoTool(semantic);
    const args = { targetCommitId: 'commit-1', expectedCurrentRef: { drawingId: 'drawing-1', revision: 2 } };
    const result = await tool.execute(args, exec('session-a'));
    expect(result).toMatchObject({ status: 'rejected', code: 'UNDO_HUMAN_AUTHORITY_REQUIRED' });
    expect(undoAuthorized).not.toHaveBeenCalled();
  });

  it('requires an owning Agent for semantic tools', async () => {
    await expect(createDrawingObserveTool({} as SemanticEditService).execute({}, exec()))
      .rejects.toThrow('DRAWING_SESSION_REQUIRED');
  });

  it('keeps import explicit and read tools session-bound', async () => {
    const drawings = repository();
    const source = attachment();
    drawings.bindPending('session-a', source);
    const importer = createDrawingImportTool(drawings, {
      async readImage(ref) { return { ref, data: new Uint8Array([1]) }; },
    });
    expect(importer.description).toContain('Only call this when the user explicitly asks');
    await importer.execute({}, exec('session-a'));
    expect(await createDrawingSummarizeTool(drawings).execute({}, exec('session-a')))
      .toMatchObject({ ref: { revision: 1 } });
    expect(await createDrawingQueryTool(drawings).execute({
      kind: 'node', ref: { drawingId: 'drawing-source', revision: 1 }, id: 'top',
    }, exec('session-a'))).toMatchObject({ kind: 'node' });
  });

  it('projects discard, evaluation, and operation lookup without internal receipts', async () => {
    const semantic = {
      discardCurrentPreview: () => ({ status: 'discarded', ref: { drawingId: 'drawing-1', revision: 2 } }),
      evaluateCurrentPreview: async () => ({
        evaluation: { review: { outcome: 'needs_revision', defects: [{ code: 'POSE', reason: 'wrong', scopeDigest: 'secret' }] }, diagnostics: [] },
        assessment: { disposition: 'confirmation_required', reasons: ['POSE'] },
      }),
      getCurrentOperation: () => ({ status: 'committed', receipt: { resultingRef: { drawingId: 'drawing-1', revision: 2 }, operationId: 'secret' } }),
    } as unknown as SemanticEditService;
    expect(await createDrawingDiscardSemanticTool(semantic).execute({}, exec('session-a')))
      .toMatchObject({ status: 'discarded', revision: 2 });
    expect(JSON.stringify(await createDrawingEvaluatePreviewTool(semantic).execute({}, exec('session-a'))))
      .not.toContain('scopeDigest');
    expect(JSON.stringify(await createDrawingGetOperationTool(semantic).execute({}, exec('session-a'))))
      .not.toContain('secret');
  });
});
