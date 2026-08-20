import type { Bounds2D } from '../../../src/drawing/index.js';
import type {
  GroundingEvidenceEventKind,
  SemanticSupport,
  TaskRelevantView,
  TaskSemanticRelation,
} from '../drawing-grounding/index.js';
import type { SpatialActionMethod } from '../drawing-spatial-actions/index.js';
import { ModelToolInputError } from '../drawing-tools/registry.js';
import type { WorldModelCompileRequest } from './types.js';

export type BuildWorldSliceInput = WorldModelCompileRequest;

export interface InspectWorldSliceInput {
  sliceHandle: string;
  refs: string[];
  includeSamples: boolean;
  continuationToken?: string;
}

export interface GroundCandidateInput {
  id: string;
  label: string;
  confidence: number;
  observationRefs: string[];
  regionRefs: string[];
  supports: SemanticSupport[];
  excludedSupports: string[];
  interfaceRefs: string[];
}

export interface GroundSemanticEntitiesInput {
  sliceHandle: string;
  goalDescription: string;
  referringExpression: string;
  evidenceRefs: string[];
  candidates: GroundCandidateInput[];
  selectedCandidateIds: string[];
  abstraction: TaskRelevantView['abstraction'];
  relations: TaskSemanticRelation[];
}

export interface RefineSemanticEntityInput {
  hypothesisId: string;
  kind: Exclude<GroundingEvidenceEventKind, 'proposed'>;
  confidence?: number;
  addedSupports: SemanticSupport[];
  removedSupportRefs: string[];
  evidenceRefs: string[];
  reasonCode: string;
}

export interface ProposeSpatialActionsInput {
  sliceHandle: string;
  goalDescription: string;
  targetRefs: string[];
  preserveRefs: string[];
  interfaceRefs: string[];
  methods?: SpatialActionMethod[];
}

export interface InspectCounterfactualInput {
  branchId: string;
}

export function parseBuildWorldSlice(value: unknown): BuildWorldSliceInput {
  const input = exactObject(value, [
    'nodeIds', 'bounds', 'limit', 'continuationToken', 'curveSamples', 'tolerance',
  ]);
  return {
    ...(input.nodeIds === undefined ? {} : { nodeIds: stringArray(input.nodeIds, 'nodeIds') }),
    ...(input.bounds === undefined ? {} : { bounds: bounds(input.bounds) }),
    ...(input.limit === undefined ? {} : { limit: integer(input.limit, 'limit', 1, 500) }),
    ...(input.continuationToken === undefined ? {} : {
      continuationToken: nonEmptyString(input.continuationToken, 'continuationToken'),
    }),
    ...(input.curveSamples === undefined ? {} : {
      curveSamples: integer(input.curveSamples, 'curveSamples', 8, 512),
    }),
    ...(input.tolerance === undefined ? {} : {
      tolerance: positive(input.tolerance, 'tolerance'),
    }),
  };
}

export function parseInspectWorldSlice(value: unknown): InspectWorldSliceInput {
  const input = exactObject(value, ['sliceHandle', 'refs', 'includeSamples', 'continuationToken']);
  return {
    sliceHandle: nonEmptyString(input.sliceHandle, 'sliceHandle'),
    refs: stringArray(input.refs, 'refs'),
    includeSamples: booleanValue(input.includeSamples, 'includeSamples'),
    ...(input.continuationToken === undefined ? {} : {
      continuationToken: nonEmptyString(input.continuationToken, 'continuationToken'),
    }),
  };
}

export function parseGroundSemanticEntities(value: unknown): GroundSemanticEntitiesInput {
  const input = exactObject(value, [
    'sliceHandle', 'goalDescription', 'referringExpression', 'evidenceRefs', 'candidates',
    'selectedCandidateIds', 'abstraction', 'relations',
  ]);
  const candidateValues = arrayValue(input.candidates, 'candidates');
  if (candidateValues.length === 0 || candidateValues.length > 20) invalid('candidates');
  return {
    sliceHandle: nonEmptyString(input.sliceHandle, 'sliceHandle'),
    goalDescription: nonEmptyString(input.goalDescription, 'goalDescription'),
    referringExpression: nonEmptyString(input.referringExpression, 'referringExpression'),
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
    candidates: candidateValues.map(parseGroundCandidate),
    selectedCandidateIds: stringArray(input.selectedCandidateIds, 'selectedCandidateIds'),
    abstraction: enumValue(input.abstraction, ['detail', 'part', 'object', 'region'], 'abstraction'),
    relations: arrayValue(input.relations, 'relations').map(parseTaskRelation),
  };
}

export function parseRefineSemanticEntity(value: unknown): RefineSemanticEntityInput {
  const input = exactObject(value, [
    'hypothesisId', 'kind', 'confidence', 'addedSupports', 'removedSupportRefs',
    'evidenceRefs', 'reasonCode',
  ]);
  return {
    hypothesisId: nonEmptyString(input.hypothesisId, 'hypothesisId'),
    kind: enumValue(input.kind, [
      'selected', 'refined', 'rejected', 'superseded', 'promoted',
    ], 'kind'),
    ...(input.confidence === undefined ? {} : { confidence: confidence(input.confidence, 'confidence') }),
    addedSupports: arrayValue(input.addedSupports, 'addedSupports').map(parseSupport),
    removedSupportRefs: stringArray(input.removedSupportRefs, 'removedSupportRefs'),
    evidenceRefs: stringArray(input.evidenceRefs, 'evidenceRefs'),
    reasonCode: nonEmptyString(input.reasonCode, 'reasonCode'),
  };
}

export function parseProposeSpatialActions(value: unknown): ProposeSpatialActionsInput {
  const input = exactObject(value, [
    'sliceHandle', 'goalDescription', 'targetRefs', 'preserveRefs', 'interfaceRefs', 'methods',
  ]);
  return {
    sliceHandle: nonEmptyString(input.sliceHandle, 'sliceHandle'),
    goalDescription: nonEmptyString(input.goalDescription, 'goalDescription'),
    targetRefs: stringArray(input.targetRefs, 'targetRefs'),
    preserveRefs: stringArray(input.preserveRefs, 'preserveRefs'),
    interfaceRefs: stringArray(input.interfaceRefs, 'interfaceRefs'),
    ...(input.methods === undefined ? {} : {
      methods: arrayValue(input.methods, 'methods').map((method, index) => enumValue(method, [
        'transform', 'deform', 'solve', 'replace', 'redraw', 'hybrid', 'raw',
      ], `methods[${index}]`)),
    }),
  };
}

export function parseInspectCounterfactual(value: unknown): InspectCounterfactualInput {
  const input = exactObject(value, ['branchId']);
  return { branchId: nonEmptyString(input.branchId, 'branchId') };
}

function parseGroundCandidate(value: unknown, index: number): GroundCandidateInput {
  const input = exactObject(value, [
    'id', 'label', 'confidence', 'observationRefs', 'regionRefs', 'supports',
    'excludedSupports', 'interfaceRefs',
  ]);
  return {
    id: nonEmptyString(input.id, `candidates[${index}].id`),
    label: nonEmptyString(input.label, `candidates[${index}].label`),
    confidence: confidence(input.confidence, `candidates[${index}].confidence`),
    observationRefs: stringArray(input.observationRefs, `candidates[${index}].observationRefs`),
    regionRefs: stringArray(input.regionRefs, `candidates[${index}].regionRefs`),
    supports: arrayValue(input.supports, `candidates[${index}].supports`).map(parseSupport),
    excludedSupports: stringArray(input.excludedSupports, `candidates[${index}].excludedSupports`),
    interfaceRefs: stringArray(input.interfaceRefs, `candidates[${index}].interfaceRefs`),
  };
}

function parseSupport(value: unknown, index: number): SemanticSupport {
  const input = exactObject(value, ['kind', 'ref', 'weight', 'role']);
  return {
    kind: enumValue(input.kind, ['node', 'source-span', 'half-edge', 'face'], `supports[${index}].kind`),
    ref: nonEmptyString(input.ref, `supports[${index}].ref`),
    weight: confidence(input.weight, `supports[${index}].weight`),
    role: enumValue(input.role, ['interior', 'boundary', 'interface', 'context'], `supports[${index}].role`),
  };
}

function parseTaskRelation(value: unknown, index: number): TaskSemanticRelation {
  const input = exactObject(value, ['kind', 'from', 'to', 'confidence', 'evidenceRefs']);
  return {
    kind: enumValue(input.kind, [
      'part-of', 'contains', 'connected-to', 'boundary-of', 'interface-with', 'context-for',
    ], `relations[${index}].kind`),
    from: nonEmptyString(input.from, `relations[${index}].from`),
    to: nonEmptyString(input.to, `relations[${index}].to`),
    confidence: confidence(input.confidence, `relations[${index}].confidence`),
    evidenceRefs: stringArray(input.evidenceRefs, `relations[${index}].evidenceRefs`),
  };
}

function exactObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('input');
  const input = value as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => !keys.includes(key));
  if (unknown) invalid(unknown);
  return input;
}

function bounds(value: unknown): Bounds2D {
  const input = exactObject(value, ['minX', 'minY', 'maxX', 'maxY']);
  const result = {
    minX: finite(input.minX, 'bounds.minX'),
    minY: finite(input.minY, 'bounds.minY'),
    maxX: finite(input.maxX, 'bounds.maxX'),
    maxY: finite(input.maxY, 'bounds.maxY'),
  };
  if (result.minX > result.maxX || result.minY > result.maxY) invalid('bounds');
  return result;
}

function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path);
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  return unique(arrayValue(value, path).map((item, index) => nonEmptyString(item, `${path}[${index}]`)));
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid(path);
  return value;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') invalid(path);
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path);
  return value;
}

function positive(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result <= 0) invalid(path);
  return result;
}

function confidence(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0 || result > 1) invalid(path);
  return result;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  const result = finite(value, path);
  if (!Number.isInteger(result) || result < minimum || result > maximum) invalid(path);
  return result;
}

function enumValue<const T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) invalid(path);
  return value as T;
}

function invalid(path: string): never {
  throw new ModelToolInputError(`Invalid ${path}`);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
