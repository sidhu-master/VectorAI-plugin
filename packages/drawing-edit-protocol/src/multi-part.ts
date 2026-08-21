// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(256);
const boundedTextSchema = z.string().trim().min(1).max(2_000);
const finiteSchema = z.number().finite();
const vec2Schema = z.tuple([finiteSchema, finiteSchema]);

export const multiPartTransformPartSchema = z.object({
  groundingId: idSchema,
  translation: vec2Schema,
  rotationRadians: finiteSchema.optional(),
  pivot: vec2Schema.optional(),
}).strict().superRefine(({ rotationRadians, pivot }, context) => {
  if ((rotationRadians === undefined) !== (pivot === undefined)) {
    context.addIssue({
      code: 'custom',
      message: 'EDIT_ROTATION_PIVOT_PAIR_REQUIRED',
    });
  }
});

export const multiPartTransformRequestSchema = z.object({
  taskId: idSchema,
  parts: z.array(multiPartTransformPartSchema).min(2).max(16),
  summary: boundedTextSchema,
}).strict().superRefine(({ parts }, context) => {
  const groundingIds = new Set<string>();
  for (const [index, part] of parts.entries()) {
    if (groundingIds.has(part.groundingId)) {
      context.addIssue({
        code: 'custom',
        path: ['parts', index, 'groundingId'],
        message: 'EDIT_GROUNDING_DUPLICATE',
      });
    }
    groundingIds.add(part.groundingId);
  }
});

export type MultiPartTransformPart = z.infer<typeof multiPartTransformPartSchema>;
export type MultiPartTransformRequest = z.infer<typeof multiPartTransformRequestSchema>;
