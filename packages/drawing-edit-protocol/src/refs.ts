// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(256);
const digestSchema = z.string().trim().min(1).max(512);

export const drawingRefSchema = z.object({
  drawingId: idSchema,
  revision: z.number().int().nonnegative(),
}).strict();

export const editBasisSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('canonical'),
    ref: drawingRefSchema,
  }).strict(),
  z.object({
    kind: z.literal('preview'),
    baseRef: drawingRefSchema,
    previewHandle: idSchema,
    previewDigest: digestSchema,
  }).strict(),
  z.object({
    kind: z.literal('carried-candidate'),
    handoffId: idSchema,
    taskId: idSchema,
    originTaskId: idSchema,
    baseRef: drawingRefSchema,
    candidateDigest: digestSchema,
  }).strict(),
]);

export const observationArtifactRefSchema = z.object({
  id: idSchema,
  contentDigest: digestSchema,
  mimeType: z.enum(['image/png', 'image/webp']),
  basis: editBasisSchema,
}).strict();

export type DrawingRef = z.infer<typeof drawingRefSchema>;
export type EditBasis = z.infer<typeof editBasisSchema>;
export type ObservationArtifactRef = z.infer<typeof observationArtifactRefSchema>;
