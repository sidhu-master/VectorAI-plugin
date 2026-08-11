import type {
  Bounds2D,
  DrawingId,
  GeometryId,
  RevisionId,
  Vec2,
} from '@/drawing';

export type NormalizedPoint = readonly [number, number];

export interface SemanticAnchorProposal {
  id: string;
  role: string;
  point: NormalizedPoint;
  confidence: number;
}

export interface SemanticRegionProposal {
  label: string;
  sourceViewId: string;
  contours: NormalizedPoint[][];
  holes: NormalizedPoint[][];
  anchors: SemanticAnchorProposal[];
  confidence: number;
  evidenceRefs: string[];
}

export interface SemanticAnchor {
  id: string;
  role: string;
  point: Vec2;
  confidence: number;
}

export interface SemanticRegion {
  id: string;
  drawingId: DrawingId;
  revision: RevisionId;
  label: string;
  sourceViewIds: string[];
  maskHandle: string;
  worldContours: Vec2[][];
  worldHoles: Vec2[][];
  anchors: SemanticAnchor[];
  confidence: number;
  evidenceRefs: string[];
}

export interface AtomicSegmentRef {
  id: string;
  revision: RevisionId;
  nodeId: GeometryId;
  kind: 'whole-node' | 'vertex-range' | 'parameter-range';
  vertexRange?: readonly [number, number];
  parameterRange?: readonly [number, number];
  start: Vec2;
  end: Vec2;
  bounds: Bounds2D;
  adjacentSegmentIds: string[];
}

export interface SpatialBoundaryAnchor {
  id: string;
  role: 'entry' | 'exit' | 'shared-boundary' | 'semantic-anchor';
  point: Vec2;
  targetSegmentId?: string;
  protectedSegmentId?: string;
  confidence: number;
}

export type SpatialSelectionClassification =
  | 'inside'
  | 'outside'
  | 'crossing'
  | 'shared-boundary'
  | 'uncertain';

export interface SelectionCandidate {
  nodeId: GeometryId;
  segmentId?: string;
  classification: SpatialSelectionClassification;
  confidence: number;
  evidenceRefs: string[];
}

export interface VirtualSplitRange {
  range: readonly [number, number];
  role: 'target' | 'protected';
}

export interface VirtualSplitPlan {
  nodeId: GeometryId;
  revision: RevisionId;
  ranges: VirtualSplitRange[];
  cutParameters: number[];
}

export interface SpatialSelection {
  regionId: string;
  revision: RevisionId;
  wholeNodes: GeometryId[];
  partialSegments: AtomicSegmentRef[];
  crossingNodes: GeometryId[];
  protectedNodes: string[];
  boundaryAnchors: SpatialBoundaryAnchor[];
  classifications: SelectionCandidate[];
  uncertainParts: SelectionCandidate[];
  splitPlan: VirtualSplitPlan[];
}

export type SpatialEditMode =
  | 'geometric-edit'
  | 'generative-redraw'
  | 'hybrid-edit';

export type SpatialGuarantee =
  | 'outside-region-unchanged'
  | 'protected-region-unchanged'
  | 'maintain-connectivity'
  | 'preserve-analytic-geometry'
  | 'avoid-visible-seams';

export interface SpatialEditStrategy {
  mode: SpatialEditMode;
  regionId: string;
  preserveRegionIds: string[];
  boundaryAnchorIds: string[];
  requiredGuarantees: SpatialGuarantee[];
  primaryReason: string;
  fallbackMode?: SpatialEditMode;
}

export interface SemanticRegionParseContext {
  allowedViewIds?: readonly string[];
  allowedEvidenceRefs?: readonly string[];
}

export interface SpatialStrategyParseContext {
  allowedRegionIds?: readonly string[];
  allowedAnchorIds?: readonly string[];
}

export class DrawingSpatialRegionProtocolError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DrawingSpatialRegionProtocolError';
  }
}

export function parseSemanticRegionProposal(
  value: unknown,
  context: SemanticRegionParseContext = {},
): SemanticRegionProposal {
  const proposal = object(value, 'regionProposal');
  exact(proposal, [
    'label', 'sourceViewId', 'contours', 'holes', 'anchors', 'confidence', 'evidenceRefs',
  ], 'regionProposal');
  const contours = polygons(proposal.contours, 'regionProposal.contours');
  if (contours.length === 0) fail('regionProposal.contours', '至少需要一个区域轮廓');
  const anchors = array(proposal.anchors, 'regionProposal.anchors').map((item, index) => {
    const path = `regionProposal.anchors[${index}]`;
    const anchor = object(item, path);
    exact(anchor, ['id', 'role', 'point', 'confidence'], path);
    return {
      id: string(anchor.id, `${path}.id`),
      role: string(anchor.role, `${path}.role`),
      point: normalizedPoint(anchor.point, `${path}.point`),
      confidence: confidence(anchor.confidence, `${path}.confidence`),
    };
  });
  unique(anchors.map((anchor) => anchor.id), 'regionProposal.anchors');
  return {
    label: string(proposal.label, 'regionProposal.label'),
    sourceViewId: checkedId(
      proposal.sourceViewId,
      'regionProposal.sourceViewId',
      context.allowedViewIds,
    ),
    contours,
    holes: polygons(proposal.holes, 'regionProposal.holes'),
    anchors,
    confidence: confidence(proposal.confidence, 'regionProposal.confidence'),
    evidenceRefs: checkedIds(
      proposal.evidenceRefs,
      'regionProposal.evidenceRefs',
      context.allowedEvidenceRefs,
    ),
  };
}

export function parseSpatialEditStrategy(
  value: unknown,
  context: SpatialStrategyParseContext = {},
): SpatialEditStrategy {
  const strategy = object(value, 'strategy');
  exact(strategy, [
    'mode', 'regionId', 'preserveRegionIds', 'boundaryAnchorIds',
    'requiredGuarantees', 'primaryReason', 'fallbackMode',
  ], 'strategy', ['fallbackMode']);
  const mode = enumValue(strategy.mode, [
    'geometric-edit', 'generative-redraw', 'hybrid-edit',
  ] as const, 'strategy.mode');
  const fallbackMode = strategy.fallbackMode === undefined
    ? undefined
    : enumValue(strategy.fallbackMode, [
        'geometric-edit', 'generative-redraw', 'hybrid-edit',
      ] as const, 'strategy.fallbackMode');
  return {
    mode,
    regionId: checkedId(strategy.regionId, 'strategy.regionId', context.allowedRegionIds),
    preserveRegionIds: checkedIds(
      strategy.preserveRegionIds,
      'strategy.preserveRegionIds',
      context.allowedRegionIds,
    ),
    boundaryAnchorIds: checkedIds(
      strategy.boundaryAnchorIds,
      'strategy.boundaryAnchorIds',
      context.allowedAnchorIds,
    ),
    requiredGuarantees: array(strategy.requiredGuarantees, 'strategy.requiredGuarantees')
      .map((item, index) => enumValue(item, [
        'outside-region-unchanged',
        'protected-region-unchanged',
        'maintain-connectivity',
        'preserve-analytic-geometry',
        'avoid-visible-seams',
      ] as const, `strategy.requiredGuarantees[${index}]`)),
    primaryReason: string(strategy.primaryReason, 'strategy.primaryReason'),
    ...(fallbackMode ? { fallbackMode } : {}),
  };
}

export function assertSelectionRevision(
  selection: Pick<SpatialSelection, 'revision'>,
  expectedRevision: RevisionId,
): void {
  if (selection.revision === expectedRevision) return;
  fail(
    'selection.revision',
    `SPATIAL_SELECTION_STALE: expected ${expectedRevision}, received ${selection.revision}`,
  );
}

function polygons(value: unknown, path: string): NormalizedPoint[][] {
  return array(value, path).map((item, polygonIndex) => {
    const polygonPath = `${path}[${polygonIndex}]`;
    const polygon = array(item, polygonPath).map((point, pointIndex) => (
      normalizedPoint(point, `${polygonPath}[${pointIndex}]`)
    ));
    if (polygon.length < 3) fail(polygonPath, '轮廓至少需要三个点');
    return polygon;
  });
}

function normalizedPoint(value: unknown, path: string): NormalizedPoint {
  const values = array(value, path);
  if (values.length !== 2) fail(path, '坐标必须包含两个数字');
  const point: NormalizedPoint = [
    finite(values[0], `${path}[0]`),
    finite(values[1], `${path}[1]`),
  ];
  point.forEach((coordinate, index) => {
    if (coordinate < 0 || coordinate > 1) fail(`${path}[${index}]`, '归一化坐标必须在 0 到 1 之间');
  });
  return point;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '必须是对象');
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, '必须是数组');
  return value;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(path, '必须是非空字符串');
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '必须是有限数字');
  return value;
}

function confidence(value: unknown, path: string): number {
  const result = finite(value, path);
  if (result < 0 || result > 1) fail(path, '置信度必须在 0 到 1 之间');
  return result;
}

function checkedIds(value: unknown, path: string, allowed?: readonly string[]): string[] {
  const result = array(value, path).map((item, index) => (
    checkedId(item, `${path}[${index}]`, allowed)
  ));
  unique(result, path);
  return result;
}

function checkedId(value: unknown, path: string, allowed?: readonly string[]): string {
  const result = string(value, path);
  if (allowed && !allowed.includes(result)) fail(path, `引用了未观察到的 id ${result}`);
  return result;
}

function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) fail(path, 'id 不能重复');
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  path: string,
): T[number] {
  const result = string(value, path);
  if (!values.includes(result)) fail(path, `不支持的值 ${result}`);
  return result as T[number];
}

function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  optional: readonly string[] = [],
): void {
  const allowed = new Set(keys);
  const optionalKeys = new Set(optional);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, '不允许的字段');
  }
  for (const key of keys) {
    if (!optionalKeys.has(key) && !(key in value)) fail(`${path}.${key}`, '缺少字段');
  }
}

function fail(path: string, message: string): never {
  throw new DrawingSpatialRegionProtocolError(path, message);
}
