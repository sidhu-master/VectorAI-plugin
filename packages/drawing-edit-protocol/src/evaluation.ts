// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import {
  contentDigestSchema,
  drawingRefSchema,
  protocolIdSchema,
} from './refs';

const boundedTextSchema = z.string().trim().min(1).max(2_000);
const boundsSchema = z.object({
  minX: z.number().finite(),
  minY: z.number().finite(),
  maxX: z.number().finite(),
  maxY: z.number().finite(),
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY);

export const diagnosticSchema = z.object({
  code: protocolIdSchema,
  severity: z.enum(['info', 'candidate', 'warning', 'decision_required', 'error']),
  message: boundedTextSchema,
  scopeDigest: contentDigestSchema.optional(),
  hard: z.boolean().optional(),
}).strict();

const authoritativeObjectiveSchema = z.object({
  text: z.string().trim().min(1).max(8_000),
  attachmentContentDigests: z.array(contentDigestSchema).max(16),
}).strict();

const resolvedDefectSchema = z.object({
  defectId: protocolIdSchema,
  scopeDigest: contentDigestSchema,
  evidenceDigests: z.array(contentDigestSchema).min(1).max(32),
}).strict();

export const reviewEvidenceSchema = z.object({
  kind: z.literal('reviewer'),
  provider: protocolIdSchema,
  providerVersion: protocolIdSchema,
  authoritativeObjective: authoritativeObjectiveSchema,
  renderManifest: z.object({
    rendererVersion: protocolIdSchema,
    beforeContentDigest: contentDigestSchema,
    afterContentDigest: contentDigestSchema,
    viewport: boundsSchema,
    width: z.number().int().positive().max(8_192),
    height: z.number().int().positive().max(8_192),
    overlays: z.array(protocolIdSchema).max(32),
  }).strict(),
  outcome: z.enum(['satisfied', 'needs_revision', 'unavailable']),
  defects: z.array(z.object({
    defectId: protocolIdSchema,
    code: protocolIdSchema,
    reason: boundedTextSchema,
    scopeDigest: contentDigestSchema,
  }).strict()).max(64),
  resolvedDefects: z.array(resolvedDefectSchema).max(64),
}).strict();

const assessmentBase = {
  assessmentId: protocolIdSchema,
  taskId: protocolIdSchema,
  drawingId: protocolIdSchema,
  baseRef: drawingRefSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  evaluationDigest: contentDigestSchema,
  policyVersion: protocolIdSchema,
  evaluatorVersions: z.array(protocolIdSchema).min(1).max(64),
  effectDigest: contentDigestSchema,
  reasons: z.array(protocolIdSchema).max(64),
};

export const assessmentSchema = z.discriminatedUnion('disposition', [
  z.object({
    ...assessmentBase,
    disposition: z.literal('blocked'),
    hardDeny: z.boolean(),
    nonOverridableProtected: z.boolean(),
  }).strict(),
  z.object({
    ...assessmentBase,
    disposition: z.literal('confirmation_required'),
    requiredEffectDigest: contentDigestSchema,
  }).strict(),
  z.object({
    ...assessmentBase,
    disposition: z.literal('auto_safe'),
    autoQualification: z.object({
      exactScope: z.literal(true),
      cleanDiagnostics: z.literal(true),
      sourceConfirmed: z.literal(true),
      reviewerSatisfied: z.literal(true),
      inverseVerified: z.literal(true),
    }).strict(),
  }).strict(),
]);

export const evaluationRecordSchema = z.object({
  evaluationId: protocolIdSchema,
  taskId: protocolIdSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  diagnostics: z.array(diagnosticSchema).max(256),
  mandatoryEvaluatorVersions: z.array(protocolIdSchema).min(1).max(64),
  review: reviewEvidenceSchema,
  evaluationDigest: contentDigestSchema,
}).strict();

export type Diagnostic = z.infer<typeof diagnosticSchema>;
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type EvaluationRecord = z.infer<typeof evaluationRecordSchema>;
