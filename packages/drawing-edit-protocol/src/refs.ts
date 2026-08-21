// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

export const protocolIdSchema = z.string().trim().min(1).max(256);
export const contentDigestSchema = z.string().trim().min(1).max(512);

const idSchema = protocolIdSchema;
const digestSchema = contentDigestSchema;

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

export const taskRefSchema = z.object({
  taskId: idSchema,
  rootUserMessageDigest: digestSchema,
  authoritativeObjectiveDigest: digestSchema,
  baseRef: drawingRefSchema,
  policy: z.enum(['review', 'auto-safe']),
  stateEpoch: z.number().int().nonnegative(),
}).strict();

export const observationRefSchema = z.object({
  observationId: idSchema,
  taskId: idSchema,
  basis: editBasisSchema,
  artifactRefs: z.array(observationArtifactRefSchema).max(16),
  selectionProjectionId: idSchema.optional(),
  observationDigest: digestSchema,
}).strict();

export const contextRefSchema = z.object({
  contextId: idSchema,
  taskId: idSchema,
  observationId: idSchema,
  contextDigest: digestSchema,
}).strict();

export const groundingRefSchema = z.object({
  groundingId: idSchema,
  taskId: idSchema,
  contextId: idSchema,
  targetHandle: idSchema,
  targetNodeIds: z.array(idSchema).min(1).max(256),
  interfaces: z.array(z.object({
    interfaceId: idSchema,
    nodeId: idSchema,
    endpoint: z.enum(['start', 'end']),
  }).strict()).max(256),
  targetScopeDigest: digestSchema,
  protectedScopeDigest: digestSchema,
  evidenceDigest: digestSchema,
}).strict();

export const previewRefSchema = z.object({
  previewHandle: idSchema,
  taskId: idSchema,
  groundingId: idSchema,
  groundingIds: z.array(idSchema).min(2).max(16).optional(),
  baseRef: drawingRefSchema,
  candidateDigest: digestSchema,
  effectDigest: digestSchema,
  finalizeOperationId: idSchema,
  finalizeOperationBindingDigest: digestSchema,
}).strict().superRefine(({ groundingId, groundingIds }, context) => {
  if (groundingIds === undefined) return;
  if (groundingIds[0] !== groundingId || new Set(groundingIds).size !== groundingIds.length) {
    context.addIssue({ code: 'custom', path: ['groundingIds'], message: 'EDIT_GROUNDING_SET_INVALID' });
  }
});

export const evaluationRefSchema = z.object({
  evaluationId: idSchema,
  taskId: idSchema,
  previewHandle: idSchema,
  candidateDigest: digestSchema,
  evaluationDigest: digestSchema,
}).strict();

export const selectionProjectionRefSchema = z.object({
  selectionProjectionId: idSchema,
  drawingRef: drawingRefSchema,
  nodeIds: z.array(idSchema).min(1).max(256),
  projectionDigest: digestSchema,
  expiresAt: z.number().int().nonnegative(),
}).strict();

export type DrawingRef = z.infer<typeof drawingRefSchema>;
export type EditBasis = z.infer<typeof editBasisSchema>;
export type ObservationArtifactRef = z.infer<typeof observationArtifactRefSchema>;
export type TaskRef = z.infer<typeof taskRefSchema>;
export type ObservationRef = z.infer<typeof observationRefSchema>;
export type ContextRef = z.infer<typeof contextRefSchema>;
export type GroundingRef = z.infer<typeof groundingRefSchema>;
export type PreviewRef = z.infer<typeof previewRefSchema>;
export type EvaluationRef = z.infer<typeof evaluationRefSchema>;
export type SelectionProjectionRef = z.infer<typeof selectionProjectionRefSchema>;
