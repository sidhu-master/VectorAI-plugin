// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod';
import {
  assessmentSchema,
  drawingRefSchema,
  finalizePreviewResultSchema,
  selectionProjectionRefSchema,
  spatialEditProgramSchema,
  type DrawingRef,
  type FinalizePreviewResult,
  type SpatialEditProgram,
} from '@vectorai/drawing-edit-protocol';
import type { DrawingWorkspaceSnapshot } from '@vectorai/drawing-workspace';
import { isToleranceStandardRefField } from '@vectorai/drawing-core';

export * from '@vectorai/drawing-edit-protocol';
export * from './axial-dimension-layout';

/** Same-origin DSH Host route used by every VectorAI client workspace to download DXF. */
export const DRAWING_DXF_EXPORT_PATH = '/api/vectorai.drawing.export';
export const DRAWING_ANNOTATED_DXF_EXPORT_PATH = '/api/vectorai.drawingAnnotation.export';

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
const toleranceStandardRefFieldSchema = z.string().trim().min(1).refine(isToleranceStandardRefField, {
  message: 'TOLERANCE_STANDARD_REF_INVALID',
});
const vec2Schema = z.tuple([z.number(), z.number()]);
const qualitySchema = z.object({
  status: z.enum(['confirmed', 'candidate']),
  confidence: z.number().optional(),
  evidenceRefs: z.array(idSchema),
}).strict();
const drawingNodeSourceRefSchema = z.object({
  sourceId: idSchema,
  objectId: idSchema.optional(),
  objectType: idSchema.optional(),
  layer: z.string().min(1).optional(),
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: z.boolean(),
  quality: qualitySchema,
  sourceRef: drawingNodeSourceRefSchema.optional(),
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
  labelPosition: vec2Schema.optional(),
}).strict();
const dimensionCandidateSchema = z.object({
  targets: z.array(dimensionTargetSchema),
  score: z.number(),
  reasons: z.array(z.string()),
}).strict();
const toleranceProjectionSchema = z.object({
  mode: z.enum(['none', 'bilateral', 'unilateral', 'limits', 'fit']),
  upperDeviation: z.number().finite().optional(),
  lowerDeviation: z.number().finite().optional(),
  upperLimit: z.number().finite().optional(),
  lowerLimit: z.number().finite().optional(),
  fitDesignation: z.string().min(1).max(32).optional(),
  unit: z.enum(['mm', 'cm', 'm', 'in', 'deg']),
  status: z.enum(['candidate', 'resolved', 'confirmed', 'conflict']),
  source: z.enum(['document', 'standard', 'enterprise-rule', 'manual', 'ai-candidate']),
  ruleRef: z.object({
    id: idSchema,
    version: idSchema,
    inputDigest: idSchema,
  }).strict().optional(),
  featureClass: z.enum(['internal', 'external']).optional(),
  standardRef: z.object({ id: toleranceStandardRefFieldSchema, edition: toleranceStandardRefFieldSchema }).strict().optional(),
  displayPreference: z.enum(['deviations', 'designation', 'both']).optional(),
  evidenceRefs: z.array(idSchema),
}).strict().superRefine((value, context) => {
  if (value.mode === 'limits' && (value.lowerLimit === undefined || value.upperLimit === undefined || value.lowerLimit > value.upperLimit)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_LIMIT_ORDER' });
  }
  if (value.mode === 'bilateral' && (value.upperDeviation === undefined || value.lowerDeviation === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATIONS_REQUIRED' });
  }
  if (value.mode === 'unilateral' && value.upperDeviation === undefined && value.lowerDeviation === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATION_REQUIRED' });
  }
  if (value.mode === 'fit' && value.fitDesignation === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_FIT_REQUIRED' });
  }
  if (value.status === 'confirmed' && value.evidenceRefs.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_EVIDENCE_REQUIRED' });
  }
  if (value.featureClass !== undefined && value.unit === 'deg') {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_FEATURE_CLASS_UNIT_INVALID' });
  }
});
const drawingDatumReferenceSchema = z.object({
  datumId: idSchema,
  role: z.enum(['primary', 'secondary', 'tertiary', 'origin']),
  geometryId: idSchema,
  anchor: entityAnchorSchema,
}).strict();

const hatchBoundaryEdgeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('line'), start: vec2Schema, end: vec2Schema }).strict(),
  z.object({
    type: z.literal('arc'), center: vec2Schema, radius: z.number().positive(),
    startAngle: z.number(), endAngle: z.number(), counterClockwise: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal('ellipse'), center: vec2Schema, majorAxis: vec2Schema,
    axisRatio: z.number().positive(), startParameter: z.number(), endParameter: z.number(),
    counterClockwise: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal('spline'), degree: z.number().int().positive(), rational: z.boolean(),
    periodic: z.boolean(), knots: z.array(z.number()), controlPoints: z.array(vec2Schema),
    weights: z.array(z.number()).optional(), fitPoints: z.array(vec2Schema).optional(),
  }).strict(),
]);

const parametricHatchSchema = z.object({
  version: z.literal(1),
  style: z.enum(['normal', 'outer', 'ignore']),
  elevation: z.number(),
  extrusion: z.tuple([z.number(), z.number(), z.number()]),
  boundaryPaths: z.array(z.object({
    flags: z.number().int().nonnegative(),
    closed: z.boolean(),
    edges: z.array(hatchBoundaryEdgeSchema).min(1),
  }).strict()).min(1),
  patternLines: z.array(z.object({
    angle: z.number(), base: vec2Schema, offset: vec2Schema, dashLengths: z.array(z.number()),
  }).strict()),
  patternAngle: z.number(),
  patternScale: z.number().positive(),
  double: z.boolean(),
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
    unit: z.enum(['mm', 'cm', 'm', 'in', 'deg']).optional(),
    tolerance: z.object({ upper: z.number().optional(), lower: z.number().optional() }).strict().optional(),
    toleranceProjection: toleranceProjectionSchema.optional(),
    datumReferences: z.array(drawingDatumReferenceSchema).optional(),
    engineeringIntentId: idSchema.optional(),
    engineeringChainIds: z.array(idSchema).optional(),
    generationOrder: z.number().int().nonnegative().optional(),
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
    hatch: parametricHatchSchema.optional(),
    segments: z.array(z.object({ start: vec2Schema, end: vec2Schema }).strict()).optional(),
  }).strict().refine((value) => value.hatch !== undefined || value.segments !== undefined, {
    message: 'SECTION_HATCH_REPRESENTATION_REQUIRED',
  }),
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
  unitSystem: z.object({ length: z.enum(['mm', 'cm', 'm', 'in']), angle: z.literal('deg') }).strict(),
  sources: z.array(z.object({
    id: idSchema,
    kind: z.enum(['image', 'dxf']),
    mediaType: z.string().min(1),
    digest: idSchema,
    name: z.string().min(1).optional(),
    bytes: z.number().int().nonnegative().optional(),
  }).strict()).optional(),
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

const drawingSourceRefSchema = z.union([
  z.object({
    id: idSchema,
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    bytes: z.number().int().nonnegative().optional(),
    width: z.number().positive(),
    height: z.number().positive(),
    name: z.string().optional(),
  }).strict(),
  z.object({
    id: idSchema,
    mediaType: z.literal('application/dxf'),
    bytes: z.number().int().nonnegative().optional(),
    name: z.string().optional(),
  }).strict(),
]);

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

const extensionOwnershipShape = {
  extensionId: idSchema,
  workflowId: idSchema,
  ref: drawingRefSchema,
};

const extensionInterfaceSchema = z.object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: z.enum(['start', 'end']),
}).strict();

export const extensionPreviewCreateRequestSchema = z.object({
  ...extensionOwnershipShape,
  targetNodeIds: z.array(idSchema).min(1).max(256),
  interfaces: z.array(extensionInterfaceSchema).max(256).optional(),
  program: spatialEditProgramSchema,
}).strict();

export const extensionPreviewControlRequestSchema = z.object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema,
}).strict();

export const extensionPreviewReplaceRequestSchema = z.object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema,
  program: spatialEditProgramSchema,
}).strict();

const extensionNeedsRebaseResultSchema = z.object({
  status: z.literal('needs-rebase'),
  currentRef: drawingRefSchema,
}).strict();

const extensionRejectedResultSchema = z.object({
  status: z.literal('rejected'),
  code: idSchema,
  message: z.string().min(1),
}).strict();

const extensionPreviewReadyResultSchema = z.object({
  status: z.literal('previewed'),
  previewToken: idSchema,
  candidateDigest: idSchema,
  ref: drawingRefSchema,
  expiresAt: z.number().int().nonnegative(),
}).strict();

export const extensionPreviewCreateResultSchema = z.discriminatedUnion('status', [
  extensionPreviewReadyResultSchema,
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema,
]);

export const extensionPreviewAssessmentResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('assessed'),
    previewToken: idSchema,
    candidateDigest: idSchema,
    assessment: assessmentSchema,
  }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema,
]);

export const extensionPreviewFinalizeResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('finalized'), result: finalizePreviewResultSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema,
]);

export const extensionPreviewDiscardResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('discarded'), ref: drawingRefSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema,
]);

export const annotationSessionStateSchema = z.object({
  version: z.literal(1),
  workspaceClaimed: z.boolean(),
  activationEpoch: z.number().int().nonnegative(),
  workflow: z.object({
    status: z.enum(['idle', 'running', 'reviewing', 'completed', 'canceled', 'failed', 'needs-rebase']),
    stage: z.enum(['deterministic', 'dimension-chain', 'gdt', 'review']).optional(),
    workflowId: idSchema.optional(),
    message: z.string().min(1).optional(),
  }).strict(),
}).strict();

export type DrawingQueryRequest = z.infer<typeof drawingQueryRequestSchema>;
export type DrawingQueryResult = z.infer<typeof drawingQueryResultSchema>;
export type DrawingSelectionProjectionRequest = z.infer<typeof drawingSelectionProjectionRequestSchema>;
export type DrawingSelectionProjectionResult = z.infer<typeof drawingSelectionProjectionResultSchema>;
export type DrawingMotionRigRebuildRequest = z.infer<typeof drawingMotionRigRebuildRequestSchema>;
export type DrawingMotionRigDiscardRequest = z.infer<typeof drawingMotionRigDiscardRequestSchema>;
export type ExtensionPreviewCreateRequest = z.infer<typeof extensionPreviewCreateRequestSchema>;
export type ExtensionPreviewControlRequest = z.infer<typeof extensionPreviewControlRequestSchema>;
export type ExtensionPreviewReplaceRequest = z.infer<typeof extensionPreviewReplaceRequestSchema>;
export type ExtensionPreviewCreateResult = z.infer<typeof extensionPreviewCreateResultSchema>;
export type ExtensionPreviewAssessmentResult = z.infer<typeof extensionPreviewAssessmentResultSchema>;
export type ExtensionPreviewFinalizeResult = z.infer<typeof extensionPreviewFinalizeResultSchema>;
export type ExtensionPreviewDiscardResult = z.infer<typeof extensionPreviewDiscardResultSchema>;
export type AnnotationSessionState = z.infer<typeof annotationSessionStateSchema>;

export interface DrawingExtensionProgramRequest {
  targetNodeIds: string[];
  interfaces?: ExtensionPreviewCreateRequest['interfaces'];
  program: SpatialEditProgram;
}

export type DrawingExtensionProgramTerminalResult =
  | FinalizePreviewResult
  | Extract<ExtensionPreviewCreateResult, { status: 'needs-rebase' | 'rejected' }>
  | Extract<ExtensionPreviewAssessmentResult, { status: 'needs-rebase' | 'rejected' }>;

export interface DrawingExtensionProgramWorkflow {
  result: DrawingExtensionProgramTerminalResult;
}

export const drawingDxfImportRequestSchema = z.object({
  bytes: z.instanceof(Uint8Array),
  digest: idSchema,
  name: z.string().trim().min(1).max(255).optional(),
}).strict();

const drawingObservationOverlaySchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(80),
  polygon: z.array(vec2Schema).min(3).max(16),
}).strict();

export const drawingObservationRequestSchema = z.object({
  ref: drawingRefSchema,
  overlays: z.array(drawingObservationOverlaySchema).max(128).optional(),
}).strict();

export const drawingObservationResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('rendered'),
    png: z.instanceof(Uint8Array),
    contentDigest: idSchema,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
  z.object({ status: z.literal('stale'), currentRef: drawingRefSchema }).strict(),
  z.object({ status: z.literal('rejected'), code: idSchema, message: z.string().min(1) }).strict(),
]);

export type DrawingDxfImportRequest = z.infer<typeof drawingDxfImportRequestSchema>;
export interface DrawingObservationRequest {
  ref: DrawingRef;
  overlays?: Array<{ id: string; label: string; polygon: Array<[number, number]> }>;
}
export type DrawingObservationResult = z.infer<typeof drawingObservationResultSchema>;

export interface DrawingSpaceExtensionHost<TSession = unknown> {
  getSnapshot(session: TSession): DrawingWorkspaceSnapshot | null;
  importDxf(
    session: TSession,
    request: DrawingDxfImportRequest,
    signal?: AbortSignal,
  ): Promise<DrawingImportResult>;
  renderObservation(
    session: TSession,
    request: DrawingObservationRequest,
    signal?: AbortSignal,
  ): Promise<DrawingObservationResult>;
  runExtensionProgram(
    session: TSession,
    request: DrawingExtensionProgramRequest,
    signal?: AbortSignal,
  ): Promise<DrawingExtensionProgramWorkflow>;
}

export interface Bounds2D {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawingSummary {
  ref: DrawingRef;
  unit: 'mm' | 'cm' | 'm' | 'in';
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

const partitionEvidenceSchema = z.object({
  id: idSchema, origin: z.enum(['document', 'geometry', 'fused', 'ai', 'manual']), label: z.string(),
  sourceLines: z.array(z.number().int().positive()).optional(), geometryNodeIds: z.array(idSchema).optional(),
}).strict();
const partitionDiagnosticSchema = z.object({
  id: idSchema, severity: z.enum(['info', 'warning', 'error']), code: idSchema, message: z.string(),
  segmentIds: z.array(idSchema).optional(), evidenceIds: z.array(idSchema).optional(),
}).strict();
const shaftAxisSchema = z.object({
  origin: vec2Schema, direction: vec2Schema, normal: vec2Schema,
  zMin: z.number(), zMax: z.number(), orientation: z.enum(['forward', 'reversed']),
  geometryNodeIds: z.array(idSchema).optional(),
}).strict();
const stepCandidateSchema = z.object({
  id: idSchema, z: z.number(), score: z.number(), evidenceIds: z.array(idSchema), accepted: z.boolean(),
}).strict();
const partitionSegmentSchema = z.object({
  id: idSchema, zStart: z.number(), zEnd: z.number(),
  profile: z.object({ minRadius: z.number(), maxRadius: z.number(), sampleCount: z.number().int().nonnegative() }).strict(),
  semanticType: z.string().optional(), name: z.string().optional(), boundaryConfidence: z.number(), semanticConfidence: z.number().optional(),
  geometryNodeIds: z.array(idSchema), boundaryEvidenceIds: z.array(idSchema), semanticEvidenceIds: z.array(idSchema), diagnosticIds: z.array(idSchema),
  profileSamples: z.array(z.object({ z: z.number(), radius: z.number().nonnegative(), geometryNodeId: idSchema }).strict()).optional(),
}).strict();
const partitionGroupSchema = z.object({
  id: idSchema, segmentIds: z.array(idSchema),
  range: z.object({ zStart: z.number(), zEnd: z.number() }).strict().optional(),
  semanticType: z.string(),
  dimensionRole: z.enum(['functional-feature', 'process-datum', 'transition', 'ordinary']).optional(),
  name: z.string().optional(), evidenceIds: z.array(idSchema),
}).strict();
export const partitionDraftSchema = z.object({
  version: z.literal(1), drawingRef: drawingRefSchema, axis: shaftAxisSchema,
  segments: z.array(partitionSegmentSchema), semanticGroups: z.array(partitionGroupSchema),
  stepCandidates: z.array(stepCandidateSchema), evidence: z.array(partitionEvidenceSchema), diagnostics: z.array(partitionDiagnosticSchema),
  basePartitionRevisionId: idSchema.optional(),
}).strict();
export const partitionRevisionSchema = z.object({
  version: z.literal(1), drawingRef: drawingRefSchema, axis: shaftAxisSchema,
  segments: z.array(partitionSegmentSchema), semanticGroups: z.array(partitionGroupSchema),
  evidence: z.array(partitionEvidenceSchema), diagnostics: z.array(partitionDiagnosticSchema),
  id: idSchema, parentRevisionId: idSchema.optional(), confirmedAt: z.number(),
}).strict();

export const partitionEditCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('boundary.move'), expectedDrawingRef: drawingRefSchema, boundaryIndex: z.number().int().positive(), requestedZ: z.number(), snapTolerance: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('semantic-range.move'), expectedDrawingRef: drawingRefSchema, groupId: idSchema, edge: z.enum(['start', 'end']), requestedZ: z.number(), snapTolerance: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('semantic-group.rename'), expectedDrawingRef: drawingRefSchema, groupId: idSchema, name: z.string().trim().min(1).max(120) }).strict(),
  z.object({ type: z.literal('segment.split'), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, z: z.number(), snapTolerance: z.number().nonnegative() }).strict(),
  z.object({ type: z.literal('boundary.merge'), expectedDrawingRef: drawingRefSchema, boundaryIndex: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('segment.metadata'), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, name: z.string().max(120).optional(), semanticType: z.string().max(80).optional() }).strict(),
]);

export const partitionSessionSnapshotSchema = z.object({
  version: z.literal(1),
  phase: z.enum(['idle', 'analyzing', 'editing', 'confirmed', 'needs-rebase', 'failed']),
  drawingRef: drawingRefSchema.optional(), draft: partitionDraftSchema.optional(), confirmed: partitionRevisionSchema.optional(),
  canUndo: z.boolean(), canRedo: z.boolean(), message: z.string().optional(), updatedAt: z.number(),
}).strict();

export const sha256DigestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export const engineeringDocumentInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  digest: sha256DigestSchema,
  mediaType: z.string().trim().min(1).max(127).optional(),
  base64: z.string().min(1).max(27_962_028),
}).strict();
export const partitionImportRequestSchema = z.object({
  dxf: z.object({ name: z.string().min(1).max(255), digest: idSchema, base64: z.string().min(1).max(27_962_028) }).strict(),
  engineeringDocuments: z.array(engineeringDocumentInputSchema).max(16).optional(),
  engineeringDocument: z.object({ name: z.string().min(1).max(255), text: z.string() }).strict().optional(),
}).strict().superRefine((request, context) => {
  if (request.engineeringDocuments !== undefined && request.engineeringDocument !== undefined) {
    context.addIssue({ code: 'custom', path: ['engineeringDocuments'], message: 'ENGINEERING_DOCUMENT_INPUT_AMBIGUOUS' });
  }
});
export const partitionDocumentSupplementRequestSchema = z.object({
  expectedDrawingRef: drawingRefSchema,
  engineeringDocuments: z.array(engineeringDocumentInputSchema).min(1).max(16),
}).strict();
export const engineeringDocumentStageRequestSchema = z.object({
  engineeringDocuments: z.array(engineeringDocumentInputSchema).min(1).max(16),
}).strict();

export type PartitionDraft = z.infer<typeof partitionDraftSchema>;
export type PartitionRevision = z.infer<typeof partitionRevisionSchema>;
export type PartitionEditCommand = z.infer<typeof partitionEditCommandSchema>;
export type PartitionSessionSnapshot = z.infer<typeof partitionSessionSnapshotSchema>;
export type EngineeringDocumentInput = z.infer<typeof engineeringDocumentInputSchema>;
export type EngineeringDocumentStageRequest = z.infer<typeof engineeringDocumentStageRequestSchema>;
export type PartitionImportRequest = z.infer<typeof partitionImportRequestSchema>;
export type PartitionDocumentSupplementRequest = z.infer<typeof partitionDocumentSupplementRequestSchema>;

const engineeringDiagnosticSchema = z.object({
  id: idSchema,
  severity: z.enum(['info', 'warning', 'error']),
  code: idSchema,
  message: z.string(),
  entityIds: z.array(idSchema).optional(),
  evidenceIds: z.array(idSchema).optional(),
}).strict();
const engineeringStateSchema = z.enum(['candidate', 'resolved', 'confirmed', 'conflict', 'stale']);
const engineeringDatumSchema = z.object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: z.string().min(1).max(120),
  geometryId: idSchema,
  anchor: entityAnchorSchema,
  labelPosition: vec2Schema.optional(),
  role: z.enum(['primary', 'secondary', 'tertiary', 'origin']),
  source: z.enum(['document', 'geometry', 'manual', 'ai-candidate']),
  status: z.enum(['candidate', 'confirmed', 'conflict', 'stale']),
  evidenceIds: z.array(idSchema),
}).strict();
const dimensionIntentSchema = z.object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  kind: z.enum(['linear', 'aligned', 'angular', 'radius', 'diameter', 'ordinate', 'arc-length']),
  targets: z.array(dimensionTargetSchema),
  datumIds: z.array(idSchema),
  nominalValue: z.number().finite(),
  unit: z.enum(['mm', 'cm', 'm', 'in', 'deg']),
  functionalRole: z.enum(['datum', 'overall', 'functional', 'assembly', 'process', 'inspection', 'auxiliary', 'closure']),
  source: z.enum(['document', 'geometry', 'manual', 'ai-candidate']),
  status: engineeringStateSchema,
  evidenceIds: z.array(idSchema),
}).strict();
const resolvedToleranceSchema = z.object({
  upperDeviation: z.number().finite().optional(),
  lowerDeviation: z.number().finite().optional(),
  upperLimit: z.number().finite().optional(),
  lowerLimit: z.number().finite().optional(),
  fitDesignation: z.string().min(1).max(32).optional(),
  inputDigest: idSchema,
  evaluatedAt: z.number().finite(),
}).strict();
const featureClassSchema = z.enum(['internal', 'external']);
const toleranceSelectionSourceSchema = z.enum(['rule', 'ai-recommended', 'manual']);
const toleranceDisplayPreferenceSchema = z.enum(['deviations', 'designation', 'both']);
const toleranceOverrideSchema = z.object({
  upperDeviation: z.number().finite(),
  lowerDeviation: z.number().finite(),
}).strict().superRefine((value, context) => {
  if (value.lowerDeviation > value.upperDeviation) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATION_ORDER' });
  }
});
const toleranceStandardRefSchema = z.object({
  id: toleranceStandardRefFieldSchema,
  edition: toleranceStandardRefFieldSchema,
}).strict();
const toleranceDatasetProvenanceSchema = z.object({
  kind: z.enum(['authorized-standard-tabulation', 'plan-reference-vector']),
  referenceId: idSchema,
  description: z.string().min(1),
}).strict();
const toleranceDatasetMetadataSchema = z.object({
  completeness: z.enum(['complete', 'partial']),
  catalogClassification: z.enum(['verified', 'unverified']),
  numericProvenance: z.array(toleranceDatasetProvenanceSchema),
}).strict();
const toleranceBandSchema = z.object({
  designation: z.string().min(2).max(8),
  featureClass: featureClassSchema,
  category: z.enum(['preferred', 'common', 'other', 'unknown']),
  available: z.boolean(),
  unavailableCode: z.enum([
    'TOLERANCE_SIZE_RANGE_UNSUPPORTED',
    'TOLERANCE_DESIGNATION_INVALID',
    'TOLERANCE_STANDARD_UNAVAILABLE',
  ]).optional(),
}).strict();
const resolvedStandardToleranceSchema = z.object({
  designation: z.string().min(2).max(8),
  featureClass: featureClassSchema,
  basicSize: z.number().finite(),
  unit: z.literal('mm'),
  upperDeviation: z.number().finite(),
  lowerDeviation: z.number().finite(),
  toleranceMagnitude: z.number().finite().nonnegative(),
  upperLimitSize: z.number().finite(),
  lowerLimitSize: z.number().finite(),
  standardRef: toleranceStandardRefSchema,
  ruleRef: z.object({ id: idSchema, version: idSchema, inputDigest: idSchema }).strict(),
}).strict().superRefine((value, context) => {
  if (value.lowerLimitSize > value.upperLimitSize) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_LIMIT_ORDER' });
  }
});
const resolvedFitSchema = z.object({
  designation: z.string().min(5).max(17),
  basis: z.enum(['hole', 'shaft']),
  hole: resolvedStandardToleranceSchema,
  shaft: resolvedStandardToleranceSchema,
  fitType: z.enum(['clearance', 'transition', 'interference']),
  minimumClearance: z.number().finite(),
  maximumClearance: z.number().finite(),
}).strict().superRefine((value, context) => {
  if (value.minimumClearance > value.maximumClearance) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_FIT_CLEARANCE_ORDER' });
  }
});
const fitAssignmentSchema = z.object({
  fitGroupId: idSchema,
  holeDimensionId: idSchema,
  shaftDimensionId: idSchema,
  basis: z.enum(['hole', 'shaft']),
  designation: z.string().min(5).max(17),
  fitType: z.enum(['clearance', 'transition', 'interference']),
  minimumClearance: z.number().finite(),
  maximumClearance: z.number().finite(),
  standardRef: toleranceStandardRefSchema,
}).strict().superRefine((value, context) => {
  if (value.minimumClearance > value.maximumClearance) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_FIT_CLEARANCE_ORDER' });
  }
});
const toleranceSpecSchema = z.object({
  id: idSchema,
  dimensionIntentId: idSchema,
  mode: z.enum(['bilateral', 'unilateral', 'limits', 'fit', 'formula']),
  source: z.enum(['document', 'standard', 'enterprise-rule', 'manual', 'ai-candidate']),
  ruleRef: z.object({ id: idSchema, version: idSchema }).strict().optional(),
  featureClass: featureClassSchema.optional(),
  selection: z.object({
    designation: z.string().min(2).max(17),
    source: toleranceSelectionSourceSchema,
    evidenceRefs: z.array(idSchema),
  }).strict().optional(),
  standardRef: toleranceStandardRefSchema.optional(),
  override: toleranceOverrideSchema.optional(),
  displayPreference: toleranceDisplayPreferenceSchema.optional(),
  fitGroupId: idSchema.optional(),
  inputs: z.record(z.string(), z.union([z.number().finite(), z.string(), z.boolean()])),
  resolved: resolvedToleranceSchema.optional(),
  status: engineeringStateSchema,
  evidenceIds: z.array(idSchema),
  diagnostics: z.array(engineeringDiagnosticSchema),
}).strict();

export const toleranceCatalogRequestSchema = z.object({
  expectedDrawingRef: drawingRefSchema,
  dimensionIntentId: idSchema,
  featureClass: featureClassSchema,
}).strict();

export const toleranceCatalogResultSchema = z.object({
  drawingRef: drawingRefSchema,
  dimensionIntentId: idSchema,
  featureClass: featureClassSchema,
  standardRef: toleranceStandardRefSchema,
  datasetMetadata: toleranceDatasetMetadataSchema,
  bands: z.array(toleranceBandSchema),
  fitBands: z.object({
    internal: z.array(toleranceBandSchema),
    external: z.array(toleranceBandSchema),
  }).strict(),
  selection: z.object({
    designation: z.string().min(2).max(17),
    source: toleranceSelectionSourceSchema,
    evidenceRefs: z.array(idSchema),
    displayPreference: toleranceDisplayPreferenceSchema,
    override: toleranceOverrideSchema.optional(),
    fit: z.object({
      fitGroupId: idSchema,
      basis: z.enum(['hole', 'shaft']),
      designation: z.string().min(5).max(17),
      holeDimensionIntentId: idSchema,
      holeFeatureClass: z.literal('internal'),
      holeDesignation: z.string().min(2).max(8),
      shaftDimensionIntentId: idSchema,
      shaftFeatureClass: z.literal('external'),
      shaftDesignation: z.string().min(2).max(8),
      holeTarget: z.object({
        dimensionIntentId: idSchema,
        label: z.string().min(1).max(256),
        basicSize: z.number().finite(),
        unit: z.literal('mm'),
        featureClass: z.literal('internal'),
      }).strict(),
      shaftTarget: z.object({
        dimensionIntentId: idSchema,
        label: z.string().min(1).max(256),
        basicSize: z.number().finite(),
        unit: z.literal('mm'),
        featureClass: z.literal('external'),
      }).strict(),
      holeOverride: toleranceOverrideSchema.optional(),
      shaftOverride: toleranceOverrideSchema.optional(),
      result: resolvedFitSchema,
    }).strict().optional(),
  }).strict().optional(),
  recommendation: z.object({
    designation: z.string().min(2).max(17),
    source: z.literal('ai-recommended'),
    evidenceRefs: z.array(idSchema),
  }).strict().optional(),
}).strict();

export const tolerancePreviewRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('single'),
    expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
    featureClass: featureClassSchema,
    designation: z.string().min(2).max(8),
  }).strict(),
  z.object({
    type: z.literal('fit'),
    expectedDrawingRef: drawingRefSchema,
    primaryDimensionIntentId: idSchema,
    primaryFeatureClass: featureClassSchema,
    secondaryDimensionIntentId: idSchema,
    secondaryFeatureClass: featureClassSchema,
    basis: z.enum(['hole', 'shaft']),
    designation: z.string().min(5).max(17),
  }).strict(),
]);

export const tolerancePreviewResultSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('single'),
    drawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
    status: z.literal('resolved'),
    result: resolvedStandardToleranceSchema,
  }).strict(),
  z.object({
    type: z.literal('fit'),
    drawingRef: drawingRefSchema,
    holeDimensionIntentId: idSchema,
    shaftDimensionIntentId: idSchema,
    status: z.literal('resolved'),
    result: resolvedFitSchema,
  }).strict(),
]);

export const toleranceEditCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('standard.single.apply'),
    expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
    featureClass: featureClassSchema,
    designation: z.string().min(2).max(8),
    expectedInputDigest: z.string().min(1).max(256),
    selectionSource: toleranceSelectionSourceSchema,
    displayPreference: toleranceDisplayPreferenceSchema,
    evidenceRefs: z.array(idSchema),
  }).strict(),
  z.object({
    type: z.literal('standard.fit.apply'),
    expectedDrawingRef: drawingRefSchema,
    holeDimensionIntentId: idSchema,
    shaftDimensionIntentId: idSchema,
    basis: z.enum(['hole', 'shaft']),
    designation: z.string().min(5).max(17),
    expectedHoleInputDigest: z.string().min(1).max(256),
    expectedShaftInputDigest: z.string().min(1).max(256),
    selectionSource: toleranceSelectionSourceSchema,
    displayPreference: toleranceDisplayPreferenceSchema,
    evidenceRefs: z.array(idSchema),
  }).strict(),
  z.object({
    type: z.literal('standard.override.set'),
    expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
    upperDeviation: z.number().finite(),
    lowerDeviation: z.number().finite(),
  }).strict(),
  z.object({
    type: z.literal('standard.override.clear'),
    expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
  }).strict(),
  z.object({
    type: z.literal('manual.apply'),
    expectedDrawingRef: drawingRefSchema,
    dimensionIntentId: idSchema,
    mode: z.enum(['unilateral', 'bilateral']),
    upperDeviation: z.number().finite().optional(),
    lowerDeviation: z.number().finite().optional(),
    displayPreference: toleranceDisplayPreferenceSchema.default('deviations'),
    evidenceRefs: z.array(idSchema),
  }).strict(),
]).superRefine((value, context) => {
  if (value.type === 'standard.override.set' && value.lowerDeviation > value.upperDeviation) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATION_ORDER' });
  }
  if (value.type !== 'manual.apply') return;
  const bothDeviations = value.upperDeviation !== undefined && value.lowerDeviation !== undefined;
  if (value.mode === 'bilateral' && !bothDeviations) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATIONS_REQUIRED' });
  }
  if (value.mode === 'unilateral' && value.upperDeviation === undefined && value.lowerDeviation === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATION_REQUIRED' });
  }
  if (value.upperDeviation !== undefined && value.lowerDeviation !== undefined
    && value.lowerDeviation > value.upperDeviation) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'TOLERANCE_DEVIATION_ORDER' });
  }
});
export const geometricCharacteristicSchema = z.enum([
  'straightness', 'flatness', 'circularity', 'cylindricity',
  'profile-line', 'profile-surface', 'parallelism', 'perpendicularity', 'angularity',
  'position', 'coaxiality', 'symmetry', 'circular-runout', 'total-runout',
]);
const materialConditionSchema = z.enum(['rfs', 'mmc', 'lmc']);
const geometricDatumFrameReferenceSchema = z.object({
  datumId: idSchema,
  materialCondition: materialConditionSchema.optional(),
}).strict();
const toleranceZoneSchema = z.object({
  shape: z.enum(['linear', 'diametrical', 'spherical']),
  materialCondition: materialConditionSchema.optional(),
  projectedZoneLength: z.number().finite().positive().optional(),
}).strict();
export const geometricToleranceIntentSchema = z.object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  characteristic: geometricCharacteristicSchema,
  controlledTargets: z.array(dimensionTargetSchema),
  toleranceZone: toleranceZoneSchema,
  datumReferenceFrame: z.array(geometricDatumFrameReferenceSchema),
  computed: z.object({
    status: z.enum(['pending', 'resolved', 'conflict', 'stale']),
    value: z.number().finite().positive().optional(),
    unit: z.literal('mm'),
    ruleRef: z.object({ id: idSchema, version: idSchema }).strict().optional(),
    inputDigest: idSchema.optional(),
    diagnostics: z.array(engineeringDiagnosticSchema),
  }).strict(),
  override: z.object({ value: z.number().finite().positive() }).strict().optional(),
  source: z.enum(['document', 'geometry', 'manual', 'ai-candidate']),
  status: z.enum(['candidate', 'pending-calculation', 'resolved', 'confirmed', 'conflict', 'stale']),
  evidenceIds: z.array(idSchema),
  framePosition: vec2Schema.optional(),
}).strict();
const dimensionChainSchema = z.object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: z.string().max(120).optional(),
  datumIds: z.array(idSchema),
  members: z.array(z.object({
    dimensionIntentId: idSchema,
    coefficient: z.union([z.literal(1), z.literal(-1)]),
    role: z.enum(['functional', 'component', 'closure']),
    sequenceHint: z.number().int().optional(),
  }).strict()),
  equation: z.object({
    closureIntentId: idSchema,
    targetValue: z.number().finite().optional(),
  }).strict(),
  analysisMode: z.enum(['worst-case', 'statistical', 'reference-only']),
  status: engineeringStateSchema,
  evidenceIds: z.array(idSchema),
  diagnostics: z.array(engineeringDiagnosticSchema),
}).strict();
const annotationDependencySchema = z.object({
  beforeIntentId: idSchema,
  afterIntentId: idSchema,
  reason: z.enum(['datum-before-dependent', 'overall-before-functional', 'functional-before-component', 'component-before-closure', 'explicit-document-order']),
  evidenceIds: z.array(idSchema),
}).strict();

const axialStationSchema = z.object({
  id: idSchema,
  coordinate: z.number().finite(),
  sourceCoordinate: z.number().finite(),
  unit: z.enum(['mm', 'cm', 'm', 'in']),
  kinds: z.array(z.enum(['drawing-end', 'shoulder', 'partition-boundary', 'datum'])),
  geometryNodeIds: z.array(idSchema),
  evidenceIds: z.array(idSchema),
}).strict();
const axialElementarySpanSchema = z.object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: z.number().finite().nonnegative(),
  segmentIds: z.array(idSchema),
  evidenceIds: z.array(idSchema),
}).strict();
const dimensionEvidenceSchema = z.object({
  id: idSchema,
  origin: z.enum(['geometry', 'partition', 'document', 'manual', 'ai']),
  kind: z.enum(['drawing-end', 'elementary-span', 'functional-region', 'document-interval', 'process-envelope', 'manual-requirement']),
  label: z.string(),
  required: z.boolean(),
  sourceIds: z.array(idSchema),
}).strict();
const axialDimensionCandidateSchema = z.object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: z.number().finite().nonnegative(),
  roles: z.array(z.enum(['overall', 'composite', 'functional', 'process', 'local', 'reference', 'closure'])),
  evidenceIds: z.array(idSchema),
  required: z.boolean(),
}).strict();
const dimensionDecisionTraceSchema = z.object({
  candidateId: idSchema,
  decision: z.enum(['displayed', 'closure', 'rejected', 'alternative']),
  score: z.number().finite(),
  features: z.array(z.object({
    feature: z.enum(['manual-required', 'document-exact', 'functional-region', 'process-envelope', 'composite-block', 'overall-root', 'elementary-span', 'ordinary-residual', 'terminal-residual']),
    contribution: z.number().finite(),
    evidenceIds: z.array(idSchema),
  }).strict()),
  reasonCodes: z.array(idSchema),
}).strict();
const axialChainNodeSchema = z.object({
  id: idSchema,
  parentCandidateId: idSchema,
  childCandidateIds: z.array(idSchema),
  closureCandidateId: idSchema,
  alternativeClosureCandidateIds: z.array(idSchema),
  status: z.enum(['resolved', 'needs-review', 'conflict']),
}).strict();
export const axialDimensionSchemeSchema = z.object({
  version: z.literal(1),
  drawingRef: drawingRefSchema,
  partitionRevisionId: idSchema.optional(),
  policy: z.object({
    id: z.literal('shaft-hierarchical-dimensioning-v1'),
    version: z.literal('1'),
  }).strict(),
  inputDigest: idSchema,
  topology: z.object({
    drawingRef: drawingRefSchema,
    axis: shaftAxisSchema,
    unit: z.enum(['mm', 'cm', 'm', 'in']),
    stations: z.array(axialStationSchema),
    elementarySpans: z.array(axialElementarySpanSchema),
  }).strict(),
  evidence: z.array(dimensionEvidenceSchema),
  candidates: z.array(axialDimensionCandidateSchema),
  displayedCandidateIds: z.array(idSchema),
  closureCandidateIds: z.array(idSchema),
  chains: z.array(axialChainNodeSchema),
  layout: z.object({
    chainNormalOffsets: z.array(z.object({
      chainId: idSchema,
      normalOffset: z.number().finite(),
    }).strict()).default([]),
    candidateNormalOffsets: z.array(z.object({
      candidateId: idSchema,
      normalOffset: z.number().finite(),
    }).strict()),
  }).strict().optional(),
  decisions: z.array(dimensionDecisionTraceSchema),
  diagnostics: z.array(engineeringDiagnosticSchema),
  status: z.enum(['resolved', 'needs-review', 'conflict', 'stale']),
}).strict();

export const dimensionSchemeEditCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('candidate.display'), candidateId: idSchema, displayed: z.boolean(),
    expectedDrawingRef: drawingRefSchema,
  }).strict(),
  z.object({
    type: z.literal('closure.choose'), chainId: idSchema, candidateId: idSchema,
    expectedDrawingRef: drawingRefSchema,
  }).strict(),
  z.object({
    type: z.literal('candidate.layout'), candidateId: idSchema, normalOffset: z.number().finite(),
    expectedDrawingRef: drawingRefSchema,
  }).strict(),
  z.object({
    type: z.literal('chain.layout'), chainId: idSchema, normalOffset: z.number().finite(),
    expectedDrawingRef: drawingRefSchema,
  }).strict(),
]);

export const geometricToleranceEditCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('datum.layout'), datumId: idSchema, position: vec2Schema, expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('frame.layout'), intentIds: z.array(idSchema).min(1), position: vec2Schema, expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('characteristic.set'), intentId: idSchema, characteristic: geometricCharacteristicSchema, expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('controlled-targets.set'), intentId: idSchema, targets: z.array(dimensionTargetSchema), expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('datum-frame.set'), intentId: idSchema, references: z.array(geometricDatumFrameReferenceSchema), expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('zone.set'), intentId: idSchema, zone: toleranceZoneSchema, expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('override.set'), intentId: idSchema, value: z.number().finite().positive(), expectedDrawingRef: drawingRefSchema }).strict(),
  z.object({ type: z.literal('override.clear'), intentId: idSchema, expectedDrawingRef: drawingRefSchema }).strict(),
]);

export const engineeringAnnotationDraftSchema = z.object({
  version: z.literal(1),
  drawingRef: drawingRefSchema,
  datums: z.array(engineeringDatumSchema),
  intents: z.array(dimensionIntentSchema),
  tolerances: z.array(toleranceSpecSchema),
  fitAssignments: z.array(fitAssignmentSchema).default([]),
  geometricTolerances: z.array(geometricToleranceIntentSchema).default([]),
  chains: z.array(dimensionChainSchema),
  dependencies: z.array(annotationDependencySchema),
  diagnostics: z.array(engineeringDiagnosticSchema),
  axialScheme: axialDimensionSchemeSchema.optional(),
  baseRevisionId: idSchema.optional(),
}).strict();
export const engineeringAnnotationRevisionSchema = engineeringAnnotationDraftSchema.omit({
  baseRevisionId: true,
}).extend({
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  generationOrder: z.array(idSchema),
  confirmedAt: z.number().finite(),
}).strict();

export const dimensionPlanSessionSnapshotSchema = z.object({
  version: z.literal(1),
  phase: z.enum(['idle', 'editing', 'confirmed', 'needs-rebase', 'failed']),
  drawingRef: drawingRefSchema.optional(),
  draft: engineeringAnnotationDraftSchema.optional(),
  confirmed: engineeringAnnotationRevisionSchema.optional(),
  canUndo: z.boolean(),
  canRedo: z.boolean(),
  message: z.string().optional(),
  updatedAt: z.number().finite(),
}).strict();

export type EngineeringAnnotationDraft = z.infer<typeof engineeringAnnotationDraftSchema>;
export type EngineeringAnnotationRevision = z.infer<typeof engineeringAnnotationRevisionSchema>;
export type DimensionPlanSessionSnapshot = z.infer<typeof dimensionPlanSessionSnapshotSchema>;
export type AxialDimensionScheme = z.infer<typeof axialDimensionSchemeSchema>;
export type DimensionSchemeEditCommand = z.infer<typeof dimensionSchemeEditCommandSchema>;
export type GeometricToleranceIntent = z.infer<typeof geometricToleranceIntentSchema>;
export type GeometricToleranceEditCommand = z.infer<typeof geometricToleranceEditCommandSchema>;
export type ToleranceCatalogRequest = z.infer<typeof toleranceCatalogRequestSchema>;
export type ToleranceCatalogResult = z.infer<typeof toleranceCatalogResultSchema>;
export type TolerancePreviewRequest = z.infer<typeof tolerancePreviewRequestSchema>;
export type TolerancePreviewResult = z.infer<typeof tolerancePreviewResultSchema>;
export type ToleranceEditCommand = z.infer<typeof toleranceEditCommandSchema>;
