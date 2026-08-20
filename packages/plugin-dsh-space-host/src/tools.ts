// SPDX-License-Identifier: Apache-2.0

import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
import { defineTool } from '@deepseek-ai/dsh-tools';

import type { InMemoryDrawingRepository } from './repository';

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
    description: 'Import the latest pending drawing image into the local VectorAI 2D Space. Call this before inspecting or editing a new drawing image.',
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
