// SPDX-License-Identifier: Apache-2.0

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools';
import {
  drawingPreviewControlRequestSchema,
  drawingPreviewCreateRequestSchema,
  drawingQueryRequestSchema,
  finalizePreviewRequestSchema,
  finalizePreviewResultSchema,
  type DrawingWorkspacePreviewCreateRequest,
  type DrawingWorkspacePreviewCreateResult,
  type DrawingWorkspaceCommitResult,
} from '@vectorai/plugin-space-contracts';

import type { InMemoryDrawingRepository } from './repository';
import type { SemanticEditService } from './semantic-edit-service';
import { createSemanticEditToolCatalog } from './semantic-tools';
import type { UserQuestionService } from '@deepseek-ai/dsh-user-questions';

export function createDrawingAgentToolCatalog(
  drawings: InMemoryDrawingRepository,
  attachments: Pick<AttachmentStore, 'readImage'>,
  semantic?: SemanticEditService,
  questions?: Pick<UserQuestionService, 'ask'>,
) {
  return [
    createDrawingImportTool(drawings, attachments),
    createDrawingSummarizeTool(drawings),
    createDrawingQueryTool(drawings),
    ...(semantic ? createSemanticEditToolCatalog(semantic, questions) : [
      createDrawingFinalizePreviewTool(drawings),
      createDrawingDiscardPreviewTool(drawings),
    ]),
  ];
}

const drawingRefSchema = {
  type: 'object',
  properties: {
    drawingId: { type: 'string', required: true },
    revision: { type: 'integer', required: true },
  },
  additionalProperties: false,
} as const;

export function createDrawingImportTool(
  drawings: InMemoryDrawingRepository,
  attachments: Pick<AttachmentStore, 'readImage'>,
) {
  return defineTool({
    name: 'drawing_import',
    description: 'Import and vectorize the latest pending image as an editable local VectorAI Drawing. Only call this when the user explicitly asks to import, convert, or vectorize that image as a drawing. Never call it merely because a reference or supplemental image was uploaded.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['imported', 'already-imported'],
            required: true,
          },
          ref: { ...drawingRefSchema, required: true },
          provisional: { type: 'boolean', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{
        type: 'text',
        text: `Drawing ${value.ref.drawingId} revision ${value.ref.revision} ${value.status}. ${
          value.provisional
            ? 'The current geometry is provisional.'
            : 'Local vectorization completed; geometry is ready for inspection and editing.'
        }`,
      }],
    },
    async execute(_args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const pending = drawings.getPending(String(sessionId));
      if (pending === null) throw new Error('PENDING_DRAWING_SOURCE_REQUIRED');
      const stored = await attachments.readImage(pending, exec.signal);
      return drawings.importPending(String(sessionId), {
        data: stored.data,
        signal: exec.signal,
      });
    },
  });
}

export function createDrawingSummarizeTool(drawings: InMemoryDrawingRepository) {
  return defineTool({
    name: 'drawing_summarize',
    description: 'Summarize the active local VectorAI Drawing revision, bounds, units, and geometry counts.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        properties: {
          ref: { ...drawingRefSchema, required: true },
          unit: { type: 'string', enum: ['mm', 'cm', 'm'], required: true },
          bounds: {
            type: 'object',
            properties: {
              minX: { type: 'number', required: true },
              minY: { type: 'number', required: true },
              maxX: { type: 'number', required: true },
              maxY: { type: 'number', required: true },
            },
            additionalProperties: false,
            required: true,
          },
          geometryByType: {
            type: 'object',
            additionalProperties: true,
            required: true,
          },
          provisional: { type: 'boolean', required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{
        type: 'text',
        text: JSON.stringify(value),
      }],
    },
    async execute(_args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const summary = drawings.summarize(String(sessionId));
      if (summary === null) throw new Error('DRAWING_REQUIRED');
      return summary;
    },
  });
}

export function createDrawingQueryTool(drawings: InMemoryDrawingRepository) {
  return defineTool({
    name: 'drawing_query',
    description: 'Read-only inspection of the active Drawing. This is not a semantic selection tool: never pass query node ids to drawing_select_parts. Use drawing_observe candidate keys or observation points/regions for edits.',
    parameters: {
      kind: {
        type: 'string',
        enum: ['world-slice', 'node', 'neighbors'],
        required: true,
      },
      ref: {
        type: 'object',
        properties: drawingRefSchema.properties,
        additionalProperties: false,
        required: true,
      },
      bounds: {
        type: 'object',
        properties: {
          minX: { type: 'number', required: true },
          minY: { type: 'number', required: true },
          maxX: { type: 'number', required: true },
          maxY: { type: 'number', required: true },
        },
        additionalProperties: false,
      },
      planes: {
        type: 'array',
        items: { type: 'string', enum: ['geometry', 'annotation', 'relation', 'feature'] },
      },
      limit: { type: 'integer' },
      id: { type: 'string' },
      nodeId: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: renderDrawingQuery,
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const request = drawingQueryRequestSchema.parse(args);
      return drawings.query(String(sessionId), request) as unknown as JsonValue;
    },
  });
}

function renderDrawingQuery(_args: unknown, value: unknown) {
  if (value && typeof value === 'object' && 'kind' in value
    && (value as { kind?: unknown }).kind === 'world-slice') {
    const slice = value as {
      bounds?: unknown;
      nodes?: Array<{ plane?: unknown; node?: { type?: unknown; quality?: { status?: unknown } } }>;
      totalByPlane?: unknown;
      truncated?: unknown;
    };
    const counts: Record<string, number> = {};
    for (const item of slice.nodes ?? []) {
      const key = `${String(item.plane ?? 'unknown')}:${String(item.node?.type ?? 'unknown')}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return [{
      type: 'text' as const,
      text: JSON.stringify({
        kind: 'world-slice-summary', mode: 'read_only', bounds: slice.bounds,
        visibleCounts: counts, totalByPlane: slice.totalByPlane, truncated: slice.truncated,
        semanticSelection: 'Use drawing_observe selectionCandidates and drawing_select_parts; query ids are not candidate keys.',
      }),
    }];
  }
  return [{ type: 'text' as const, text: JSON.stringify(value) }];
}

export function createDrawingPreviewTool(drawings: InMemoryDrawingRepository) {
  return defineTool({
    name: 'drawing_preview_transaction',
    description: 'Create or replace the current local Drawing Preview from an exact formal revision. This does not modify the formal drawing until drawing_commit_preview is called.',
    parameters: {
      ref: {
        type: 'object',
        properties: drawingRefSchema.properties,
        additionalProperties: false,
        required: true,
      },
      commands: { type: 'array', items: { type: 'json' }, required: true },
      summary: { type: 'string' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const request = drawingPreviewCreateRequestSchema.parse(args) as DrawingWorkspacePreviewCreateRequest;
      return previewReceipt(drawings.createPreview(String(sessionId), request));
    },
  });
}

export function createDrawingCommitPreviewTool(drawings: InMemoryDrawingRepository) {
  return defineTool({
    name: 'drawing_commit_preview',
    description: 'Commit the current local Drawing Preview as one new formal revision. The opaque Preview handle must still be current.',
    parameters: { handle: { type: 'string', required: true } },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const request = drawingPreviewControlRequestSchema.parse(args);
      return commitReceipt(drawings.commitPreview(String(sessionId), request));
    },
  });
}

export function createDrawingFinalizePreviewTool(_drawings: InMemoryDrawingRepository) {
  void _drawings;
  return defineTool({
    name: 'drawing_finalize_preview',
    description: 'Finalize an evaluated semantic Drawing Preview. This remains fail-closed until durable local history, inverse transactions, idempotency, and Undo are available.',
    parameters: {
      previewHandle: { type: 'string', required: true },
      previewDigest: { type: 'string', required: true },
      finalizeOperationId: { type: 'string', required: true },
      finalizeOperationBindingDigest: { type: 'string', required: true },
      evaluationId: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      finalizePreviewRequestSchema.parse(args);
      return finalizePreviewResultSchema.parse({
        status: 'rejected',
        disposition: 'blocked',
        code: 'AUTO_SAFE_UNAVAILABLE',
        message: 'Durable history, inverse transactions, idempotency, and Undo are required before semantic finalize.',
      }) as JsonValue;
    },
  });
}

function previewReceipt(result: DrawingWorkspacePreviewCreateResult): JsonValue {
  if (result.status === 'previewed') {
    const { preview } = result;
    return {
      status: 'previewed',
      preview: {
        version: preview.version,
        handle: preview.handle,
        baseRef: {
          drawingId: preview.baseRef.drawingId,
          revision: preview.baseRef.revision,
        },
        diff: {
          createdNodeIds: [...preview.diff.createdNodeIds],
          updatedNodeIds: [...preview.diff.updatedNodeIds],
          deletedNodeIds: [...preview.diff.deletedNodeIds],
        },
        createdAt: preview.createdAt,
        ...(preview.summary === undefined ? {} : { summary: preview.summary }),
      },
    };
  }
  if (result.status === 'conflict') {
    return {
      status: 'conflict',
      message: result.message,
      ...(result.snapshot === undefined ? {} : { ref: {
        drawingId: result.snapshot.ref.drawingId,
        revision: result.snapshot.ref.revision,
      } }),
    };
  }
  return { status: 'rejected', message: result.message, ...(result.code === undefined ? {} : { code: result.code }) };
}

function commitReceipt(result: DrawingWorkspaceCommitResult): JsonValue {
  if (result.status === 'committed') return {
    status: 'committed',
    ref: {
      drawingId: result.snapshot.ref.drawingId,
      revision: result.snapshot.ref.revision,
    },
  };
  if (result.status === 'conflict') {
    return {
      status: 'conflict',
      message: result.message,
      ...(result.snapshot === undefined ? {} : { ref: {
        drawingId: result.snapshot.ref.drawingId,
        revision: result.snapshot.ref.revision,
      } }),
    };
  }
  return { status: 'rejected', message: result.message, ...(result.code === undefined ? {} : { code: result.code }) };
}

export function createDrawingDiscardPreviewTool(drawings: InMemoryDrawingRepository) {
  return defineTool({
    name: 'drawing_discard_preview',
    description: 'Discard the current local Drawing Preview without changing the formal drawing revision.',
    parameters: { handle: { type: 'string', required: true } },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const sessionId = exec.agent?.id;
      if (sessionId === undefined) throw new Error('DRAWING_SESSION_REQUIRED');
      const request = drawingPreviewControlRequestSchema.parse(args);
      return drawings.discardPreview(String(sessionId), request) as unknown as JsonValue;
    },
  });
}
