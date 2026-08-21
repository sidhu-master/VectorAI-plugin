// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import {
  contentDigestSchema,
  drawingRefSchema,
  protocolIdSchema,
  taskRefSchema,
} from './refs';

const operationBase = {
  operationId: protocolIdSchema,
  sessionId: protocolIdSchema,
  drawingId: protocolIdSchema,
};

export const durableOperationBindingSchema = z.discriminatedUnion('mode', [
  z.object({
    ...operationBase,
    mode: z.literal('semantic'),
    candidateDigest: contentDigestSchema,
    previewHandle: protocolIdSchema,
  }).strict(),
  z.object({
    ...operationBase,
    mode: z.literal('interactive'),
    intentId: protocolIdSchema,
    intentDigest: contentDigestSchema,
    effectDigest: contentDigestSchema,
  }).strict(),
  z.object({
    ...operationBase,
    mode: z.literal('genesis'),
    sourceDigest: contentDigestSchema,
  }).strict(),
  z.object({
    ...operationBase,
    mode: z.literal('undo'),
    targetCommitId: protocolIdSchema,
    expectedCurrentRef: drawingRefSchema,
  }).strict(),
]);

const committedReceiptBase = {
  operationId: protocolIdSchema,
  operationBindingDigest: contentDigestSchema,
  sessionId: protocolIdSchema,
  drawingId: protocolIdSchema,
  parentRef: drawingRefSchema,
  resultingRef: drawingRefSchema,
  commitId: protocolIdSchema,
  semanticDigest: contentDigestSchema,
  snapshotIntegrityDigest: contentDigestSchema,
};

const committedOperationReceiptSchema = z.discriminatedUnion('mode', [
  z.object({ ...committedReceiptBase, status: z.literal('committed'), mode: z.literal('semantic') }).strict(),
  z.object({ ...committedReceiptBase, status: z.literal('committed'), mode: z.literal('interactive') }).strict(),
  z.object({ ...committedReceiptBase, status: z.literal('committed'), mode: z.literal('undo'), targetCommitId: protocolIdSchema }).strict(),
]);

export const durableOperationReceiptSchema = z.union([
  committedOperationReceiptSchema,
  z.object({
    status: z.literal('initialized'),
    mode: z.literal('genesis'),
    operationId: protocolIdSchema,
    operationBindingDigest: contentDigestSchema,
    sessionId: protocolIdSchema,
    drawingId: protocolIdSchema,
    resultingRef: drawingRefSchema,
    semanticDigest: contentDigestSchema,
    snapshotIntegrityDigest: contentDigestSchema,
    initialTask: taskRefSchema,
    taskStatus: z.enum(['active', 'expired']),
  }).strict(),
  z.object({
    status: z.literal('no-effect'),
    mode: z.enum(['semantic', 'interactive']),
    operationId: protocolIdSchema,
    operationBindingDigest: contentDigestSchema,
    sessionId: protocolIdSchema,
    drawingId: protocolIdSchema,
    ref: drawingRefSchema,
    semanticDigest: contentDigestSchema,
  }).strict(),
]);

export const operationLookupResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('committed'), receipt: durableOperationReceiptSchema }).strict(),
  z.object({ status: z.literal('no-effect'), receipt: durableOperationReceiptSchema }).strict(),
  z.object({
    status: z.literal('pending'),
    operationId: protocolIdSchema,
    operationBindingDigest: contentDigestSchema,
  }).strict(),
  z.object({
    status: z.literal('outcome-unknown'),
    operationId: protocolIdSchema,
    operationBindingDigest: contentDigestSchema,
  }).strict(),
  z.object({
    status: z.literal('recovering'),
    operationId: protocolIdSchema,
    operationBindingDigest: contentDigestSchema,
    retryAfterMs: z.number().int().positive().max(60_000),
  }).strict(),
  z.object({ status: z.literal('absent') }).strict(),
  z.object({
    status: z.literal('digest-mismatch'),
    operationId: protocolIdSchema,
  }).strict(),
]);

export type DurableOperationBinding = z.infer<typeof durableOperationBindingSchema>;
export type DurableOperationReceipt = z.infer<typeof durableOperationReceiptSchema>;
export type OperationLookupResult = z.infer<typeof operationLookupResultSchema>;
