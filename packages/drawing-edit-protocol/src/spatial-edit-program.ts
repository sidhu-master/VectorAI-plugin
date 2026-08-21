// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

import { drawingRefSchema } from './refs';

const idSchema = z.string().trim().min(1).max(256);
const boundedTextSchema = z.string().trim().min(1).max(2_000);
const finiteSchema = z.number().finite();
const vec2Schema = z.tuple([finiteSchema, finiteSchema]);
const boundsSchema = z.object({
  minX: finiteSchema,
  minY: finiteSchema,
  maxX: finiteSchema,
  maxY: finiteSchema,
}).strict().refine(
  ({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY,
  { message: 'INVALID_BOUNDS' },
);

export const effectScopeRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node-field'),
    nodeId: idSchema,
    fields: z.array(idSchema).min(1).max(64),
  }).strict(),
  z.object({
    kind: z.literal('source-span'),
    nodeId: idSchema,
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }).strict().refine(({ start, end }) => start < end, { message: 'INVALID_SOURCE_SPAN' }),
  z.object({
    kind: z.literal('half-edge'),
    nodeId: idSchema,
    halfEdgeId: idSchema,
  }).strict(),
  z.object({
    kind: z.literal('interface'),
    interfaceId: idSchema,
  }).strict(),
  z.object({
    kind: z.literal('endpoint-slot'),
    nodeId: idSchema,
    endpoint: z.enum(['start', 'end']),
  }).strict(),
  z.object({
    kind: z.literal('creation'),
    plane: z.enum(['geometry', 'annotation', 'relation', 'feature']),
    nodeType: idSchema,
    containerId: idSchema.optional(),
    maxCount: z.number().int().min(1).max(256),
  }).strict(),
  z.object({
    kind: z.literal('deletion'),
    nodeIds: z.array(idSchema).min(1).max(256),
  }).strict(),
]);

export const spatialOperationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rigid_transform'),
    translation: vec2Schema,
    rotationRadians: finiteSchema,
    pivot: vec2Schema,
  }).strict(),
  z.object({
    kind: z.literal('connected_transform'),
    translation: vec2Schema,
    rotationRadians: finiteSchema,
    pivot: vec2Schema,
    interfaceIds: z.array(idSchema).min(1).max(256),
  }).strict(),
  z.object({
    kind: z.literal('set_endpoint'),
    nodeId: idSchema,
    endpoint: z.enum(['start', 'end']),
    point: vec2Schema,
  }).strict(),
  z.object({
    kind: z.literal('create_path'),
    nodeId: idSchema,
    points: z.array(vec2Schema).min(2).max(4_096),
    closed: z.boolean(),
  }).strict(),
  z.object({
    kind: z.literal('delete_nodes'),
    nodeIds: z.array(idSchema).min(1).max(256),
  }).strict(),
]);

export const spatialPostconditionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preserve_connectivity'),
    nodeIds: z.array(idSchema).min(1).max(256),
  }).strict(),
  z.object({
    kind: z.literal('within_bounds'),
    bounds: boundsSchema,
  }).strict(),
  z.object({
    kind: z.literal('target_position'),
    targetHandle: idSchema,
    point: vec2Schema,
    tolerance: finiteSchema.positive(),
  }).strict(),
]);

export const spatialEditProgramSchema = z.object({
  baseRef: drawingRefSchema,
  targetHandle: idSchema,
  summary: boundedTextSchema,
  objective: boundedTextSchema,
  operations: z.array(spatialOperationSchema).min(1).max(128),
  preserveScopes: z.array(effectScopeRefSchema).max(512),
  postconditions: z.array(spatialPostconditionSchema).max(128),
  evidenceRefs: z.array(idSchema).min(1).max(256),
}).strict();

export type EffectScopeRef = z.infer<typeof effectScopeRefSchema>;
export type SpatialOperation = z.infer<typeof spatialOperationSchema>;
export type SpatialPostcondition = z.infer<typeof spatialPostconditionSchema>;
export type SpatialEditProgram = z.infer<typeof spatialEditProgramSchema>;
