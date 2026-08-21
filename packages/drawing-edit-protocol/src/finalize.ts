// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import { drawingRefSchema } from './refs';

const idSchema = z.string().trim().min(1).max(256);
const digestSchema = z.string().trim().min(1).max(512);

export const finalizePreviewRequestSchema = z.object({
  previewHandle: idSchema,
  previewDigest: digestSchema,
  finalizeOperationId: idSchema,
  finalizeOperationBindingDigest: digestSchema,
  evaluationId: idSchema,
}).strict();

export const finalizePreviewResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('committed'),
    mode: z.enum(['auto-safe', 'confirmed']),
    commitId: idSchema,
    ref: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: digestSchema,
  }).strict(),
  z.object({
    status: z.literal('already-satisfied'),
    ref: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: digestSchema,
  }).strict(),
  z.object({
    status: z.literal('root-required'),
    message: z.string().trim().min(1).max(2_000),
  }).strict(),
  z.object({
    status: z.literal('needs-revision'),
    evaluationId: idSchema,
    reasons: z.array(z.string().trim().min(1).max(1_000)).min(1).max(64),
  }).strict(),
  z.object({
    status: z.literal('discarded'),
    ref: drawingRefSchema,
  }).strict(),
  z.object({
    status: z.literal('rejected'),
    disposition: z.enum(['blocked', 'confirmation_required']),
    code: idSchema,
    message: z.string().trim().min(1).max(2_000),
  }).strict(),
  z.object({
    status: z.literal('outcome-unknown'),
    operationId: idSchema,
    operationBindingDigest: digestSchema,
  }).strict(),
]);

export type FinalizePreviewRequest = z.infer<typeof finalizePreviewRequestSchema>;
export type FinalizePreviewResult = z.infer<typeof finalizePreviewResultSchema>;
