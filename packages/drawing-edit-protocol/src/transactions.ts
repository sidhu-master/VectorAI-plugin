// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import { protocolIdSchema } from './refs';

const jsonScalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  jsonScalarSchema,
  z.array(jsonValueSchema).max(16_384),
  z.record(z.string(), jsonValueSchema),
]));

const nodePayloadSchema = z.object({
  id: protocolIdSchema,
  type: protocolIdSchema,
}).catchall(jsonValueSchema);

export const drawingTransactionCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('node.create'),
    plane: z.enum(['geometry', 'annotation', 'relation', 'feature']),
    node: nodePayloadSchema,
  }).strict(),
  z.object({
    type: z.literal('node.update'),
    id: protocolIdSchema,
    changes: z.record(z.string(), jsonValueSchema),
    expected: z.record(z.string(), jsonValueSchema),
  }).strict(),
  z.object({
    type: z.literal('node.delete'),
    id: protocolIdSchema,
  }).strict(),
  z.object({
    type: z.literal('annotation.move-text'),
    id: protocolIdSchema,
    position: z.tuple([z.number().finite(), z.number().finite()]),
    expectedPosition: z.tuple([z.number().finite(), z.number().finite()]),
  }).strict(),
]);

export const drawingTransactionSchema = z.object({
  forward: z.array(drawingTransactionCommandSchema).max(4_096),
  inverse: z.array(drawingTransactionCommandSchema).max(4_096),
}).strict();

export type JsonValue = z.infer<typeof jsonValueSchema>;
export type DrawingTransactionCommand = z.infer<typeof drawingTransactionCommandSchema>;
export type DrawingTransaction = z.infer<typeof drawingTransactionSchema>;
