// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

const partKeySchema = z.string().trim().min(1).max(64);
const boundedLabelSchema = z.string().trim().min(1).max(160);
const boundedSummarySchema = z.string().trim().min(1).max(500);
const normalizedCoordinateSchema = z.number().finite().min(0).max(1);
const normalizedPointSchema = z.tuple([normalizedCoordinateSchema, normalizedCoordinateSchema]);
const numericKeySchema = z.string().regex(/^n[1-9]\d*$/).max(16);

export const partSelectionReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('current_selection') }),
  z.strictObject({
    kind: z.literal('observation_point'),
    normalized: normalizedPointSchema,
  }),
  z.strictObject({
    kind: z.literal('observation_region'),
    polygon: z.array(normalizedPointSchema).min(3).max(64),
  }),
  z.strictObject({
    kind: z.literal('candidate'),
    key: z.string().trim().min(1).max(64),
  }),
  z.strictObject({
    kind: z.literal('semantic_query'),
    text: z.string().trim().min(1).max(160),
  }),
]);

export const partSelectionExclusionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('candidate'),
    value: z.string().trim().min(1).max(64),
  }),
  z.strictObject({
    kind: z.literal('semantic_query'),
    value: z.string().trim().min(1).max(160),
  }),
]);

export const semanticPartSelectionSchema = z.strictObject({
  partKey: partKeySchema,
  label: boundedLabelSchema,
  references: z.array(partSelectionReferenceSchema).min(1).max(8),
  exclude: z.array(partSelectionExclusionSchema).max(16).optional(),
}).superRefine(({ exclude }, context) => {
  if (exclude === undefined) return;
  const seen = new Set<string>();
  for (const [index, item] of exclude.entries()) {
    const key = `${item.kind}:${item.value}`;
    if (seen.has(key)) {
      context.addIssue({
        code: 'custom',
        path: ['exclude', index],
        message: 'EDIT_SELECTION_EXCLUSION_DUPLICATE',
      });
    }
    seen.add(key);
  }
});

export const drawingSelectPartsRequestSchema = z.strictObject({
  parts: z.array(semanticPartSelectionSchema).min(1).max(16),
}).superRefine(({ parts }, context) => {
  const partKeys = new Set<string>();
  for (const [index, part] of parts.entries()) {
    if (partKeys.has(part.partKey)) {
      context.addIssue({
        code: 'custom',
        path: ['parts', index, 'partKey'],
        message: 'EDIT_PART_KEY_DUPLICATE',
      });
    }
    partKeys.add(part.partKey);
  }
});

export const spatialReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('part'), partKey: partKeySchema }),
  z.strictObject({
    kind: z.literal('drawing_anchor'),
    anchor: z.enum(['center', 'top', 'bottom', 'left', 'right']),
  }),
  z.strictObject({
    kind: z.literal('observation_point'),
    normalized: normalizedPointSchema,
  }),
  z.strictObject({
    kind: z.literal('semantic_anchor'),
    query: z.string().trim().min(1).max(160),
  }),
]);

const qualitativeMagnitudeSchema = z.enum(['minimum', 'slight', 'moderate', 'strong']);

export const spatialGoalSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('direction'),
    subject: partKeySchema,
    direction: z.enum(['up', 'down', 'left', 'right']),
    magnitude: qualitativeMagnitudeSchema,
  }),
  z.strictObject({
    kind: z.literal('relative_position'),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    relation: z.enum(['above', 'below', 'left_of', 'right_of', 'near', 'far', 'centered']),
    magnitude: qualitativeMagnitudeSchema,
  }),
  z.strictObject({
    kind: z.literal('alignment'),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    axis: z.enum(['x', 'y', 'both']),
  }),
  z.strictObject({
    kind: z.literal('topology'),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    relation: z.enum(['touches', 'crosses', 'does_not_cross', 'inside', 'outside']),
  }),
  z.strictObject({
    kind: z.literal('explicit_numeric'),
    subject: partKeySchema,
    quantity: z.enum(['delta_x', 'delta_y', 'distance', 'angle', 'target_x', 'target_y']),
    numericKey: numericKeySchema,
  }),
]);

export const preservationGoalSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('part_shape'), partKey: partKeySchema }),
  z.strictObject({ kind: z.literal('connectivity'), partKey: partKeySchema }),
  z.strictObject({ kind: z.literal('anchor'), reference: spatialReferenceSchema }),
  z.strictObject({ kind: z.literal('topology'), partKey: partKeySchema.optional() }),
  z.strictObject({ kind: z.literal('protected_scope') }),
  z.strictObject({ kind: z.literal('minimum_deformation') }),
]);

export const spatialIntentRequestSchema = z.strictObject({
  summary: boundedSummarySchema,
  goals: z.array(spatialGoalSchema).min(1).max(32),
  preserve: z.array(preservationGoalSchema).max(32),
});

export const spatialIntentRevisionSchema = z.strictObject({
  goalDelta: z.array(spatialGoalSchema).min(1).max(32),
  preserveDelta: z.array(preservationGoalSchema).max(32).optional(),
});

const userEvidenceSpanSchema = z.strictObject({
  start: z.number().int().nonnegative().max(1_000_000),
  end: z.number().int().positive().max(1_000_000),
  text: z.string().min(1).max(160),
}).superRefine(({ start, end }, context) => {
  if (end <= start) {
    context.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'EDIT_NUMERIC_EVIDENCE_SPAN_INVALID',
    });
  }
});

const numericConstraintCommon = {
  numericKey: numericKeySchema,
  unit: z.string().trim().min(1).max(32),
  userEvidenceSpan: userEvidenceSpanSchema,
};

export const explicitNumericConstraintSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...numericConstraintCommon,
    kind: z.literal('distance'),
    value: z.number().finite(),
  }),
  z.strictObject({
    ...numericConstraintCommon,
    kind: z.literal('angle'),
    value: z.number().finite(),
  }),
  z.strictObject({
    ...numericConstraintCommon,
    kind: z.literal('coordinate'),
    value: z.tuple([z.number().finite(), z.number().finite()]),
  }),
]);

export const drawingWorkflowDispositionSchema = z.enum([
  'observed',
  'selected',
  'preview_ready',
  'needs_revision',
  'committed',
  'blocked',
  'discarded',
  'invalid_state',
  'reobserve_required',
  'drawing_not_active',
  'selection_ambiguous',
  'no_solution',
]);

export type PartSelectionReference = z.infer<typeof partSelectionReferenceSchema>;
export type PartSelectionExclusion = z.infer<typeof partSelectionExclusionSchema>;
export type SemanticPartSelection = z.infer<typeof semanticPartSelectionSchema>;
export type DrawingSelectPartsRequest = z.infer<typeof drawingSelectPartsRequestSchema>;
export type SpatialReference = z.infer<typeof spatialReferenceSchema>;
export type SpatialGoal = z.infer<typeof spatialGoalSchema>;
export type PreservationGoal = z.infer<typeof preservationGoalSchema>;
export type SpatialIntentRequest = z.infer<typeof spatialIntentRequestSchema>;
export type SpatialIntentRevision = z.infer<typeof spatialIntentRevisionSchema>;
export type ExplicitNumericConstraint = z.infer<typeof explicitNumericConstraintSchema>;
export type DrawingWorkflowDisposition = z.infer<typeof drawingWorkflowDispositionSchema>;
