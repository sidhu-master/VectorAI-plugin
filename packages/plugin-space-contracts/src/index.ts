// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';

export type {
  DrawingSourceRef,
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';

const idSchema = z.string().min(1);
const vec2Schema = z.tuple([z.number(), z.number()]);
const qualitySchema = z.object({
  status: z.enum(['confirmed', 'candidate']),
  confidence: z.number().optional(),
  evidenceRefs: z.array(idSchema),
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: z.boolean(),
  quality: qualitySchema,
};

const geometrySchema = z.discriminatedUnion('type', [
  z.object({ ...baseNodeShape, type: z.literal('point'), x: z.number(), y: z.number() }).strict(),
  z.object({ ...baseNodeShape, type: z.literal('line'), start: vec2Schema, end: vec2Schema }).strict(),
  z.object({ ...baseNodeShape, type: z.literal('ray'), origin: vec2Schema, direction: vec2Schema }).strict(),
  z.object({ ...baseNodeShape, type: z.literal('xline'), origin: vec2Schema, direction: vec2Schema }).strict(),
  z.object({ ...baseNodeShape, type: z.literal('circle'), center: vec2Schema, radius: z.number() }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('arc'),
    center: vec2Schema,
    radius: z.number(),
    startAngle: z.number(),
    endAngle: z.number(),
    counterClockwise: z.boolean(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('ellipse'),
    center: vec2Schema,
    majorAxis: vec2Schema,
    ratio: z.number(),
    startParam: z.number().optional(),
    endParam: z.number().optional(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('polyline'),
    vertices: z.array(z.object({ point: vec2Schema, bulge: z.number().optional() }).strict()),
    closed: z.boolean(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('spline'),
    degree: z.number().int().nonnegative(),
    controlPoints: z.array(vec2Schema),
    knots: z.array(z.number()),
    weights: z.array(z.number()).optional(),
    closed: z.boolean(),
    periodic: z.boolean(),
  }).strict(),
]);

const entityAnchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['start', 'end', 'center']) }).strict(),
  z.object({ kind: z.literal('vertex'), index: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('curve-parameter'), parameter: z.number() }).strict(),
  z.object({ kind: z.literal('nearest'), point: vec2Schema }).strict(),
]);
const dimensionTargetSchema = z.object({
  geometryId: idSchema,
  anchor: entityAnchorSchema,
}).strict();
const dimensionCandidateSchema = z.object({
  targets: z.array(dimensionTargetSchema),
  score: z.number(),
  reasons: z.array(z.string()),
}).strict();

const annotationSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseNodeShape,
    type: z.literal('text'),
    content: z.string(),
    position: vec2Schema,
    height: z.number(),
    rotation: z.number(),
    alignment: z.enum(['left', 'center', 'right']),
    verticalAlignment: z.enum(['baseline', 'bottom', 'middle', 'top']),
    maxWidth: z.number().optional(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('dimension'),
    dimensionKind: z.enum(['linear', 'aligned', 'angular', 'radius', 'diameter', 'ordinate', 'arc-length']),
    associationStatus: z.enum(['resolved', 'ambiguous', 'conflict']),
    targets: z.array(dimensionTargetSchema),
    candidates: z.array(dimensionCandidateSchema).optional(),
    observedValue: z.number().optional(),
    computedValue: z.number().optional(),
    displayText: z.string().optional(),
    unit: z.enum(['mm', 'cm', 'm', 'deg']).optional(),
    tolerance: z.object({ upper: z.number().optional(), lower: z.number().optional() }).strict().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    textPosition: vec2Schema,
    definitionPoints: z.array(vec2Schema),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('leader'),
    target: dimensionTargetSchema,
    points: z.array(vec2Schema),
    content: z.string(),
    textHeight: z.number(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('centerline'),
    targets: z.array(idSchema),
    start: vec2Schema,
    end: vec2Schema,
    extension: z.number(),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('section-hatch'),
    pattern: z.string(),
    angle: z.number(),
    spacing: z.number(),
    segments: z.array(z.object({ start: vec2Schema, end: vec2Schema }).strict()),
  }).strict(),
]);

const relationSchema = z.discriminatedUnion('plane', [
  z.object({
    ...baseNodeShape,
    type: z.literal('topology'),
    plane: z.literal('topology'),
    kind: z.enum(['connected', 'closed', 'contains', 'intersects']),
    nodeIds: z.array(idSchema),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('constraint'),
    plane: z.literal('constraint'),
    kind: z.enum(['horizontal', 'vertical', 'parallel', 'perpendicular', 'tangent', 'concentric', 'equal', 'distance', 'radius', 'angle', 'symmetry']),
    geometryIds: z.array(idSchema),
    value: z.number().optional(),
    property: z.string().optional(),
    status: z.enum(['defined', 'satisfied', 'violated', 'unsolved']),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('association'),
    plane: z.literal('association'),
    kind: z.literal('annotation-target'),
    annotationId: idSchema,
    geometryIds: z.array(idSchema),
  }).strict(),
  z.object({
    ...baseNodeShape,
    type: z.literal('semantic'),
    plane: z.literal('semantic'),
    kind: z.literal('feature-member'),
    featureId: idSchema,
    nodeIds: z.array(idSchema),
  }).strict(),
]);

export const drawingDocumentSchema = z.object({
  protocol: z.literal('VectorAI-Drawing'),
  schemaVersion: z.literal('1.0'),
  id: idSchema,
  metadata: z.object({ createdAt: z.number(), updatedAt: z.number() }).strict(),
  unitSystem: z.object({ length: z.enum(['mm', 'cm', 'm']), angle: z.literal('deg') }).strict(),
  coordinateFrames: z.array(z.object({
    id: idSchema,
    kind: z.enum(['document', 'source', 'page', 'view', 'provisional']),
    transform: z.tuple([z.number(), z.number(), z.number(), z.number(), z.number(), z.number()]),
    parentId: idSchema.optional(),
  }).strict()),
  geometry: z.array(geometrySchema),
  annotations: z.array(annotationSchema),
  relations: z.array(relationSchema),
  features: z.array(z.object({
    ...baseNodeShape,
    type: z.literal('feature'),
    semanticType: z.string(),
    geometryIds: z.array(idSchema),
    annotationIds: z.array(idSchema),
    relationIds: z.array(idSchema),
    properties: z.record(z.string(), z.unknown()),
  }).strict()),
}).strict();

const drawingSourceRefSchema = z.object({
  id: idSchema,
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  bytes: z.number().int().nonnegative().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  name: z.string().optional(),
}).strict();

export const drawingWorkspaceSnapshotSchema = z.object({
  version: z.literal(1),
  ref: z.object({ drawingId: idSchema, revision: z.number().int().nonnegative() }).strict(),
  document: drawingDocumentSchema,
  source: drawingSourceRefSchema.optional(),
  capabilities: z.object({
    edit: z.boolean(),
    delete: z.boolean(),
    annotations: z.boolean(),
    sourceUnderlay: z.boolean(),
  }).strict(),
  provisional: z.boolean().optional(),
}).strict().nullable();

const workspaceCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('node.update'),
    id: idSchema,
    changes: z.record(z.string(), z.unknown()),
    expected: z.record(z.string(), z.unknown()),
  }).strict(),
  z.object({ type: z.literal('node.delete'), id: idSchema }).strict(),
  z.object({
    type: z.literal('annotation.move-text'),
    id: idSchema,
    position: vec2Schema,
    expectedPosition: vec2Schema,
  }).strict(),
]);

export const drawingWorkspaceCommitRequestSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  commands: z.array(workspaceCommandSchema).min(1),
}).strict();

export const drawingWorkspaceCommitResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('committed'), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
  z.object({ status: z.literal('conflict'), message: z.string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: z.string().optional() }).strict(),
]);

export interface DrawingRef {
  drawingId: string;
  revision: number;
}

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawingCanvasLine {
  id: string;
  type: 'line';
  start: readonly [number, number];
  end: readonly [number, number];
  status: 'candidate' | 'confirmed';
  confidence?: number;
}

export interface DrawingSourceRaster {
  attachmentId: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  width: number;
  height: number;
  name?: string;
  dataUrl: string;
}

export interface DrawingCanvasProjection {
  version: 1;
  ref: DrawingRef;
  source: DrawingSourceRaster;
  bounds: Bounds2D;
  geometry: DrawingCanvasLine[];
  provisional: boolean;
}

export interface DrawingSummary {
  ref: DrawingRef;
  unit: 'mm' | 'cm' | 'm';
  bounds: Bounds2D;
  geometryByType: Record<string, number>;
  provisional: boolean;
}

export interface DrawingImportResult {
  status: 'imported' | 'already-imported';
  ref: DrawingRef;
  provisional: boolean;
}

export const drawingSessionIdSchema = z.string().min(1);

export const drawingCanvasProjectionSchema = z.object({
  version: z.literal(1),
  ref: z.object({
    drawingId: z.string().min(1),
    revision: z.number().int().nonnegative(),
  }),
  source: z.object({
    attachmentId: z.string().min(1),
    mediaType: z.union([
      z.literal('image/png'),
      z.literal('image/jpeg'),
      z.literal('image/webp'),
      z.literal('image/gif'),
    ]),
    width: z.number().positive(),
    height: z.number().positive(),
    name: z.string().optional(),
    dataUrl: z.string().min(1),
  }),
  bounds: z.object({
    minX: z.number(),
    minY: z.number(),
    maxX: z.number(),
    maxY: z.number(),
  }),
  geometry: z.array(z.object({
    id: z.string().min(1),
    type: z.literal('line'),
    start: z.tuple([z.number(), z.number()]),
    end: z.tuple([z.number(), z.number()]),
    status: z.union([z.literal('candidate'), z.literal('confirmed')]),
    confidence: z.number().optional(),
  })),
  provisional: z.boolean(),
}).nullable();
