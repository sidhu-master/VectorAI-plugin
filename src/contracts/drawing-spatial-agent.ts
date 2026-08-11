import type { Bounds2D, Vec2 } from '@/drawing';

export type SpatialRelationType =
  | 'connected'
  | 'coincident'
  | 'adjacent'
  | 'contains'
  | 'symmetric'
  | 'parallel'
  | 'perpendicular';

export interface VisualFeature {
  id: string;
  label: string;
  nodeIds: string[];
  bounds: Bounds2D;
  confidence: number;
  evidenceRefs: string[];
}

export interface VisualAnchor {
  id: string;
  nodeId: string;
  role: string;
  point: Vec2;
  confidence: number;
  evidenceRefs: string[];
}

export interface VisualFeatureGraph {
  features: VisualFeature[];
  anchors: VisualAnchor[];
  relations: Array<{
    type: SpatialRelationType;
    from: string;
    to: string;
    confidence: number;
  }>;
}

export type EditOperation = 'transform' | 'deform' | 'local-redraw';

export type SpatialTransform =
  | { kind: 'translate'; offset: Vec2 }
  | { kind: 'rotate'; center: Vec2; angleDegrees: number }
  | { kind: 'scale'; center: Vec2; factor: number };

export type EditPreserveRule =
  | { type: 'outside-target-unchanged' }
  | { type: 'nodes-unchanged'; nodeIds: string[] }
  | { type: 'maintain-connectivity'; nodeIds: string[] };

export interface EditIntent {
  operation: EditOperation;
  targetFeatureIds: string[];
  targetNodeIds: string[];
  anchors: Array<{ nodeId: string; role: string; point?: Vec2 }>;
  preserveNodeIds: string[];
  preserveRules: EditPreserveRule[];
  desiredRelations: Array<{ type: SpatialRelationType; from: string; to: string }>;
  transform?: SpatialTransform;
  confidence: number;
  evidenceRefs: string[];
}

export interface SpatialParseContext {
  allowedNodeIds?: readonly string[];
  allowedFeatureIds?: readonly string[];
  allowedAnchorIds?: readonly string[];
  allowedEvidenceRefs?: readonly string[];
}

export class DrawingSpatialProtocolError extends Error {
  constructor(readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'DrawingSpatialProtocolError';
  }
}

const RELATIONS = [
  'connected', 'coincident', 'adjacent', 'contains',
  'symmetric', 'parallel', 'perpendicular',
] as const;

export function parseVisualFeatureGraph(
  value: unknown,
  context: SpatialParseContext = {},
): VisualFeatureGraph {
  const graph = object(value, 'featureGraph');
  exact(graph, ['features', 'anchors', 'relations'], 'featureGraph');
  const features = array(graph.features, 'featureGraph.features').map((item, index) => {
    const path = `featureGraph.features[${index}]`;
    const feature = object(item, path);
    exact(feature, ['id', 'label', 'nodeIds', 'bounds', 'confidence', 'evidenceRefs'], path);
    return {
      id: string(feature.id, `${path}.id`),
      label: string(feature.label, `${path}.label`),
      nodeIds: checkedIds(feature.nodeIds, `${path}.nodeIds`, context.allowedNodeIds),
      bounds: bounds(feature.bounds, `${path}.bounds`),
      confidence: confidence(feature.confidence, `${path}.confidence`),
      evidenceRefs: checkedIds(
        feature.evidenceRefs, `${path}.evidenceRefs`, context.allowedEvidenceRefs,
      ),
    };
  });
  unique(features.map((feature) => feature.id), 'featureGraph.features', 'feature id');
  const anchors = array(graph.anchors, 'featureGraph.anchors').map((item, index) => {
    const path = `featureGraph.anchors[${index}]`;
    const anchor = object(item, path);
    exact(anchor, ['id', 'nodeId', 'role', 'point', 'confidence', 'evidenceRefs'], path);
    return {
      id: string(anchor.id, `${path}.id`),
      nodeId: checkedId(anchor.nodeId, `${path}.nodeId`, context.allowedNodeIds),
      role: string(anchor.role, `${path}.role`),
      point: point(anchor.point, `${path}.point`),
      confidence: confidence(anchor.confidence, `${path}.confidence`),
      evidenceRefs: checkedIds(
        anchor.evidenceRefs, `${path}.evidenceRefs`, context.allowedEvidenceRefs,
      ),
    };
  });
  unique(anchors.map((anchor) => anchor.id), 'featureGraph.anchors', 'anchor id');
  unique([
    ...features.map((feature) => feature.id),
    ...anchors.map((anchor) => anchor.id),
  ], 'featureGraph', 'feature/anchor id');
  const relationIds = [...new Set([
    ...(context.allowedNodeIds ?? []),
    ...features.map((feature) => feature.id),
    ...anchors.map((anchor) => anchor.id),
  ])];
  const relations = array(graph.relations, 'featureGraph.relations').map((item, index) => {
    const path = `featureGraph.relations[${index}]`;
    const relation = object(item, path);
    exact(relation, ['type', 'from', 'to', 'confidence'], path);
    return {
      type: enumValue(relation.type, RELATIONS, `${path}.type`),
      from: checkedId(relation.from, `${path}.from`, relationIds),
      to: checkedId(relation.to, `${path}.to`, relationIds),
      confidence: confidence(relation.confidence, `${path}.confidence`),
    };
  });
  return { features, anchors, relations };
}

export function parseEditIntent(
  value: unknown,
  context: SpatialParseContext = {},
): EditIntent {
  const intent = object(value, 'intent');
  exact(intent, [
    'operation', 'targetFeatureIds', 'targetNodeIds', 'anchors', 'preserveNodeIds',
    'preserveRules', 'desiredRelations', 'transform', 'confidence', 'evidenceRefs',
  ], 'intent');
  const operation = enumValue(
    intent.operation,
    ['transform', 'deform', 'local-redraw'] as const,
    'intent.operation',
  );
  const targetNodeIds = checkedIds(
    intent.targetNodeIds, 'intent.targetNodeIds', context.allowedNodeIds,
  );
  if (targetNodeIds.length === 0) fail('intent.targetNodeIds', '至少需要一个目标节点');
  const transform = intent.transform === undefined
    ? undefined
    : parseTransform(intent.transform, 'intent.transform');
  if (operation === 'transform' && !transform) {
    fail('intent.transform', 'transform 操作必须声明确定性变换');
  }
  const anchors = array(intent.anchors, 'intent.anchors').map((item, index) => {
    const path = `intent.anchors[${index}]`;
    const anchor = object(item, path);
    exact(anchor, ['nodeId', 'role', 'point'], path);
    return {
      nodeId: checkedId(anchor.nodeId, `${path}.nodeId`, context.allowedNodeIds),
      role: string(anchor.role, `${path}.role`),
      ...(anchor.point === undefined ? {} : { point: point(anchor.point, `${path}.point`) }),
    };
  });
  const preserveRules = array(intent.preserveRules, 'intent.preserveRules')
    .map((item, index) => parsePreserveRule(item, `intent.preserveRules[${index}]`, context));
  const relationIds = context.allowedNodeIds || context.allowedFeatureIds || context.allowedAnchorIds
    ? [...new Set([
        ...(context.allowedNodeIds ?? []),
        ...(context.allowedFeatureIds ?? []),
        ...(context.allowedAnchorIds ?? []),
      ])]
    : undefined;
  const desiredRelations = array(intent.desiredRelations, 'intent.desiredRelations')
    .map((item, index) => {
      const path = `intent.desiredRelations[${index}]`;
      const relation = object(item, path);
      exact(relation, ['type', 'from', 'to'], path);
      return {
        type: enumValue(relation.type, RELATIONS, `${path}.type`),
        from: checkedId(relation.from, `${path}.from`, relationIds),
        to: checkedId(relation.to, `${path}.to`, relationIds),
      };
    });
  return {
    operation,
    targetFeatureIds: checkedIds(
      intent.targetFeatureIds, 'intent.targetFeatureIds', context.allowedFeatureIds,
    ),
    targetNodeIds,
    anchors,
    preserveNodeIds: checkedIds(
      intent.preserveNodeIds, 'intent.preserveNodeIds', context.allowedNodeIds,
    ),
    preserveRules,
    desiredRelations,
    ...(transform ? { transform } : {}),
    confidence: confidence(intent.confidence, 'intent.confidence'),
    evidenceRefs: checkedIds(
      intent.evidenceRefs, 'intent.evidenceRefs', context.allowedEvidenceRefs,
    ),
  };
}

function parseTransform(value: unknown, path: string): SpatialTransform {
  const transform = object(value, path);
  const kind = string(transform.kind, `${path}.kind`);
  if (kind === 'translate') {
    exact(transform, ['kind', 'offset'], path);
    return { kind, offset: point(transform.offset, `${path}.offset`) };
  }
  if (kind === 'rotate') {
    exact(transform, ['kind', 'center', 'angleDegrees'], path);
    return {
      kind,
      center: point(transform.center, `${path}.center`),
      angleDegrees: finite(transform.angleDegrees, `${path}.angleDegrees`),
    };
  }
  if (kind === 'scale') {
    exact(transform, ['kind', 'center', 'factor'], path);
    const factor = finite(transform.factor, `${path}.factor`);
    if (!(factor > 0)) fail(`${path}.factor`, '缩放系数必须大于 0');
    return { kind, center: point(transform.center, `${path}.center`), factor };
  }
  fail(`${path}.kind`, `不支持的变换 ${kind}`);
}

function parsePreserveRule(
  value: unknown,
  path: string,
  context: SpatialParseContext,
): EditPreserveRule {
  const rule = object(value, path);
  const type = string(rule.type, `${path}.type`);
  if (type === 'outside-target-unchanged') {
    exact(rule, ['type'], path);
    return { type };
  }
  if (type === 'nodes-unchanged' || type === 'maintain-connectivity') {
    exact(rule, ['type', 'nodeIds'], path);
    return {
      type,
      nodeIds: checkedIds(rule.nodeIds, `${path}.nodeIds`, context.allowedNodeIds),
    };
  }
  fail(`${path}.type`, `不支持的保护规则 ${type}`);
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

function point(value: unknown, path: string): Vec2 {
  const values = array(value, path);
  if (values.length !== 2) fail(path, '坐标必须包含两个数字');
  return [finite(values[0], `${path}[0]`), finite(values[1], `${path}[1]`)];
}

function bounds(value: unknown, path: string): Bounds2D {
  const result = object(value, path);
  exact(result, ['minX', 'minY', 'maxX', 'maxY'], path);
  const parsed = {
    minX: finite(result.minX, `${path}.minX`),
    minY: finite(result.minY, `${path}.minY`),
    maxX: finite(result.maxX, `${path}.maxX`),
    maxY: finite(result.maxY, `${path}.maxY`),
  };
  if (parsed.minX > parsed.maxX || parsed.minY > parsed.maxY) fail(path, '边界范围无效');
  return parsed;
}

function checkedIds(value: unknown, path: string, allowed?: readonly string[]): string[] {
  const result = array(value, path).map((item, index) => (
    checkedId(item, `${path}[${index}]`, allowed)
  ));
  unique(result, path, 'id');
  return result;
}

function checkedId(value: unknown, path: string, allowed?: readonly string[]): string {
  const result = string(value, path);
  if (allowed && !allowed.includes(result)) fail(path, `引用了未观察到的 id ${result}`);
  return result;
}

function unique(values: string[], path: string, label: string): void {
  if (new Set(values).size !== values.length) fail(path, `${label} 不能重复`);
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

function exact(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, '不允许的字段');
  }
  for (const key of keys) {
    if (!(key in value) && key !== 'transform') fail(`${path}.${key}`, '缺少字段');
  }
}

function fail(path: string, message: string): never {
  throw new DrawingSpatialProtocolError(path, message);
}
