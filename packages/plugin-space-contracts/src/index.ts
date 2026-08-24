// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import {
  drawingRefSchema,
  selectionProjectionRefSchema,
  type DrawingRef,
} from '@vectorai/drawing-edit-protocol';

export * from '@vectorai/drawing-edit-protocol';

export type {
  DrawingSourceRef,
  DrawingWorkspaceCommand,
  DrawingWorkspaceCommitRequest,
  DrawingWorkspaceCommitResult,
  DrawingInteractiveStageResult,
  DrawingGroundingOverlay,
  DrawingGroundingOverlayGroup,
  DrawingMotionRigProjection,
  DrawingMotionRigResult,
  DrawingMotionRigDiscardResult,
  DrawingUndoStageRequest,
  DrawingUndoStageResult,
  DrawingRedoStageRequest,
  DrawingRedoStageResult,
  DrawingWorkspacePreview,
  DrawingWorkspaceRef,
  DrawingWorkspacePreviewControlRequest,
  DrawingWorkspacePreviewCreateRequest,
  DrawingWorkspacePreviewCreateResult,
  DrawingWorkspacePreviewDiscardResult,
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

const featureSchema = z.object({
  ...baseNodeShape,
  type: z.literal('feature'),
  semanticType: z.string(),
  geometryIds: z.array(idSchema),
  annotationIds: z.array(idSchema),
  relationIds: z.array(idSchema),
  properties: z.record(z.string(), z.unknown()),
}).strict();

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
  features: z.array(featureSchema),
}).strict();

export const bounds2DSchema = z.object({
  minX: z.number(),
  minY: z.number(),
  maxX: z.number(),
  maxY: z.number(),
}).strict().refine(({ minX, minY, maxX, maxY }) => (
  minX <= maxX && minY <= maxY
), { message: 'INVALID_QUERY_BOUNDS' });

const drawingPlaneSchema = z.enum(['geometry', 'annotation', 'relation', 'feature']);
const drawingSpatialNodeSchema = z.discriminatedUnion('plane', [
  z.object({ plane: z.literal('geometry'), node: geometrySchema }).strict(),
  z.object({ plane: z.literal('annotation'), node: annotationSchema }).strict(),
  z.object({ plane: z.literal('relation'), node: relationSchema }).strict(),
  z.object({ plane: z.literal('feature'), node: featureSchema }).strict(),
]);

export const drawingQueryRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('world-slice'),
    ref: drawingRefSchema,
    bounds: bounds2DSchema,
    planes: z.array(drawingPlaneSchema).min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }).strict(),
  z.object({
    kind: z.literal('node'),
    ref: drawingRefSchema,
    id: idSchema,
  }).strict(),
  z.object({
    kind: z.literal('neighbors'),
    ref: drawingRefSchema,
    nodeId: idSchema,
    limit: z.number().int().min(1).max(200).optional(),
  }).strict(),
]);

export const drawingQueryResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('world-slice'),
    ref: drawingRefSchema,
    bounds: bounds2DSchema,
    nodes: z.array(drawingSpatialNodeSchema),
    totalByPlane: z.object({
      geometry: z.number().int().nonnegative(),
      annotation: z.number().int().nonnegative(),
      relation: z.number().int().nonnegative(),
      feature: z.number().int().nonnegative(),
    }).strict(),
    truncated: z.boolean(),
  }).strict(),
  z.object({
    kind: z.literal('node'),
    ref: drawingRefSchema,
    node: drawingSpatialNodeSchema.nullable(),
  }).strict(),
  z.object({
    kind: z.literal('neighbors'),
    ref: drawingRefSchema,
    nodeId: idSchema,
    nodes: z.array(drawingSpatialNodeSchema),
    truncated: z.boolean(),
  }).strict(),
]);

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
  lastCommit: z.object({
    commitId: idSchema,
    mode: z.enum(['auto-safe', 'confirmed', 'interactive', 'undo', 'redo']),
    undoable: z.boolean(),
    redoable: z.boolean().optional(),
  }).strict().optional(),
}).strict().nullable();

const nodeCreateCommandSchema = z.object({
  type: z.literal('node.create'),
  plane: z.enum(['geometry', 'annotation', 'relation', 'feature']),
  node: z.union([geometrySchema, annotationSchema, relationSchema, featureSchema]),
}).strict().superRefine(({ plane, node }, context) => {
  const matches = plane === 'geometry'
    ? geometrySchema.safeParse(node).success
    : plane === 'annotation'
      ? annotationSchema.safeParse(node).success
      : plane === 'relation'
        ? relationSchema.safeParse(node).success
        : featureSchema.safeParse(node).success;
  if (!matches) context.addIssue({ code: 'custom', message: 'NODE_PLANE_MISMATCH' });
});

const workspaceCommandSchema = z.union([
  nodeCreateCommandSchema,
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

export const drawingInteractiveStageResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('staged'),
    intentId: idSchema,
    intentDigest: idSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: z.string().startsWith('/drawing-apply-intent '),
  }).strict(),
  z.object({ status: z.literal('conflict'), message: z.string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: idSchema }).strict(),
]);

export const drawingUndoStageRequestSchema = z.object({
  targetCommitId: idSchema,
  expectedCurrentRef: drawingRefSchema,
}).strict();

export const drawingUndoStageResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('staged'),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: z.string().startsWith('/drawing-undo '),
  }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: idSchema }).strict(),
]);

export const drawingRedoStageRequestSchema = drawingUndoStageRequestSchema;

export const drawingRedoStageResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('staged'),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: z.string().startsWith('/drawing-redo '),
  }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: idSchema }).strict(),
]);

export const drawingSelectionProjectionRequestSchema = z.object({
  expectedRef: drawingRefSchema,
  nodeIds: z.array(idSchema).max(256),
}).strict();

export const drawingSelectionProjectionResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('projected'), projection: selectionProjectionRefSchema }).strict(),
  z.object({ status: z.literal('cleared') }).strict(),
  z.object({ status: z.literal('stale'), currentRef: drawingRefSchema }).strict(),
  z.object({ status: z.literal('rejected'), code: idSchema, message: z.string().min(1) }).strict(),
]);

const drawingMotionRigConnectorSchema = z.object({
  nodeId: idSchema,
  movingEndpoint: z.enum(['start', 'end', 'first', 'last']),
  fixedPoint: vec2Schema,
}).strict();

export const drawingMotionRigProjectionSchema = z.object({
  version: z.literal(1),
  drawingRef: drawingRefSchema,
  state: z.enum(['ready', 'needs-correction']),
  message: z.string().min(1).optional(),
  carrierNodeId: idSchema.optional(),
  controlBodyNodeIds: z.array(idSchema).min(1).max(256),
  connectors: z.array(drawingMotionRigConnectorSchema).min(1).max(256),
  anchor: vec2Schema,
  handle: vec2Schema,
  keepAnchorFixed: z.literal(true),
  keepControlBodyRigid: z.literal(true),
  preserveConnectivity: z.literal(true),
  allowControlRotation: z.literal(false),
}).strict();

export const drawingMotionRigRebuildRequestSchema = z.object({
  ref: drawingRefSchema,
  nodeIds: z.array(idSchema).min(1).max(256),
}).strict();

export const drawingMotionRigResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready'), projection: drawingMotionRigProjectionSchema }).strict(),
  z.object({
    status: z.literal('needs-correction'),
    projection: drawingMotionRigProjectionSchema.optional(),
    message: z.string().min(1),
  }).strict(),
  z.object({ status: z.literal('stale'), currentRef: drawingRefSchema }).strict(),
  z.object({ status: z.literal('rejected'), code: idSchema, message: z.string().min(1) }).strict(),
]);

export const drawingMotionRigDiscardRequestSchema = z.object({ ref: drawingRefSchema }).strict();

export const drawingMotionRigDiscardResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('discarded') }).strict(),
  z.object({ status: z.literal('stale'), currentRef: drawingRefSchema }).strict(),
  z.object({ status: z.literal('rejected'), code: idSchema, message: z.string().min(1) }).strict(),
]);

const drawingGroundingOverlayInterfaceSchema = z.object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: z.enum(['start', 'end']),
}).strict();

const drawingGroundingOverlayGroupSchema = z.object({
  groundingId: idSchema,
  partKey: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(80),
  role: z.enum(['target', 'reference']).optional(),
  colorIndex: z.number().int().nonnegative(),
  nodeIds: z.array(idSchema).min(1).max(256),
  interfaces: z.array(drawingGroundingOverlayInterfaceSchema).max(256),
}).strict();

export const drawingGroundingOverlaySchema = z.object({
  version: z.literal(1),
  drawingRef: drawingRefSchema,
  taskId: idSchema,
  stateEpoch: z.number().int().nonnegative(),
  disposition: z.enum(['active', 'committed', 'discarded', 'failed']),
  groups: z.array(drawingGroundingOverlayGroupSchema).max(16),
}).strict().superRefine(({ disposition, groups }, context) => {
  if (disposition === 'active' && groups.length === 0) {
    context.addIssue({ code: 'custom', path: ['groups'], message: 'GROUNDING_ACTIVE_GROUP_REQUIRED' });
  }
  if (disposition !== 'active' && groups.length > 0) {
    context.addIssue({ code: 'custom', path: ['groups'], message: 'GROUNDING_TERMINAL_GROUP_FORBIDDEN' });
  }
  const groundingIds = new Set<string>();
  const partKeys = new Set<string>();
  for (const [index, group] of groups.entries()) {
    if (groundingIds.has(group.groundingId)) {
      context.addIssue({
        code: 'custom', path: ['groups', index, 'groundingId'], message: 'GROUNDING_ID_DUPLICATE',
      });
    }
    if (partKeys.has(group.partKey)) {
      context.addIssue({
        code: 'custom', path: ['groups', index, 'partKey'], message: 'GROUNDING_PART_KEY_DUPLICATE',
      });
    }
    groundingIds.add(group.groundingId);
    partKeys.add(group.partKey);
  }
});

export const drawingPreviewCreateRequestSchema = z.object({
  ref: drawingRefSchema,
  commands: z.array(workspaceCommandSchema).min(1),
  summary: z.string().min(1).optional(),
}).strict();

export const drawingPreviewSchema = z.object({
  version: z.literal(1),
  handle: idSchema,
  baseRef: drawingRefSchema,
  commands: z.array(workspaceCommandSchema).min(1),
  candidate: drawingWorkspaceSnapshotSchema.unwrap(),
  diff: z.object({
    createdNodeIds: z.array(idSchema),
    updatedNodeIds: z.array(idSchema),
    deletedNodeIds: z.array(idSchema),
  }).strict(),
  createdAt: z.number(),
  summary: z.string().min(1).optional(),
}).strict();

export const drawingPreviewCreateResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('previewed'), preview: drawingPreviewSchema }).strict(),
  z.object({ status: z.literal('conflict'), message: z.string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: z.string().optional() }).strict(),
]);

export const drawingPreviewControlRequestSchema = z.object({ handle: idSchema }).strict();

export const drawingPreviewDiscardResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('discarded'), ref: drawingRefSchema }).strict(),
  z.object({ status: z.literal('rejected'), message: z.string(), code: z.string().optional() }).strict(),
]);

export type DrawingQueryRequest = z.infer<typeof drawingQueryRequestSchema>;
export type DrawingQueryResult = z.infer<typeof drawingQueryResultSchema>;
export type DrawingSelectionProjectionRequest = z.infer<typeof drawingSelectionProjectionRequestSchema>;
export type DrawingSelectionProjectionResult = z.infer<typeof drawingSelectionProjectionResultSchema>;
export type DrawingMotionRigRebuildRequest = z.infer<typeof drawingMotionRigRebuildRequestSchema>;
export type DrawingMotionRigDiscardRequest = z.infer<typeof drawingMotionRigDiscardRequestSchema>;

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
