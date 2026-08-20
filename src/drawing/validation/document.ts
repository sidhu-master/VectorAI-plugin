import type {
  AnnotationNode,
  DimensionAnnotation,
  DrawingDocument,
  DrawingRelation,
  EntityAnchor,
  GeometryNode,
  NodeQuality,
  SemanticFeature,
  Vec2,
} from '../document/types';
import type { ValidationIssue, ValidationReport } from './types';

const UNIT_TOLERANCE = 1e-6;

export function validateDrawingDocument(document: DrawingDocument): ValidationReport {
  const issues = [
    ...validateEnvelope(document),
    ...validateIds(document),
    ...validateGeometry(document.geometry),
    ...validateAnnotations(document.annotations),
    ...validateRelations(document.relations),
    ...validateReferences(document),
    ...validateFeatures(document.features),
  ];
  return { valid: issues.every((item) => item.severity !== 'error'), issues };
}

function validateEnvelope(document: DrawingDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (document.protocol !== 'VectorAI-Drawing') {
    issues.push(error('INVALID_PROTOCOL', 'protocol', '协议必须是 VectorAI-Drawing'));
  }
  if (document.schemaVersion !== '1.0') {
    issues.push(error('INVALID_SCHEMA_VERSION', 'schemaVersion', 'Schema 版本必须是 1.0'));
  }
  if (!isFiniteNumber(document.metadata.createdAt) || !isFiniteNumber(document.metadata.updatedAt)) {
    issues.push(error('INVALID_METADATA_TIME', 'metadata', '文档时间必须是有限数字'));
  }
  if (document.coordinateFrames.length === 0
    || !document.coordinateFrames.some((frame) => frame.kind === 'document')) {
    issues.push(error('DOCUMENT_FRAME_REQUIRED', 'coordinateFrames', '必须存在文档坐标系'));
  }
  const frameIds = new Set(document.coordinateFrames.map((frame) => frame.id));
  document.coordinateFrames.forEach((frame, index) => {
    if (frame.transform.length !== 6 || frame.transform.some((value) => !isFiniteNumber(value))) {
      issues.push(error('INVALID_COORDINATE_FRAME', `coordinateFrames[${index}]`, '坐标变换必须包含六个有限数字'));
    }
    if (frame.parentId && !frameIds.has(frame.parentId)) {
      issues.push(error('REFERENCE_NOT_FOUND', `coordinateFrames[${index}].parentId`, '父坐标系不存在'));
    }
  });
  return issues;
}

function validateIds(document: DrawingDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const planes = [
    ['geometry', document.geometry],
    ['annotations', document.annotations],
    ['relations', document.relations],
    ['features', document.features],
  ] as const;

  for (const [plane, nodes] of planes) {
    nodes.forEach((node, index) => {
      const previous = ids.get(node.id);
      if (previous) {
        issues.push(error(
          'DUPLICATE_NODE_ID',
          `${plane}[${index}].id`,
          `节点 ID ${node.id} 已在 ${previous} 使用`,
          [node.id],
        ));
      } else {
        ids.set(node.id, `${plane}[${index}]`);
      }
      issues.push(...validateQuality(node.quality, `${plane}[${index}].quality`, node.id));
    });
  }
  return issues;
}

function validateQuality(quality: NodeQuality, path: string, nodeId: string): ValidationIssue[] {
  if (quality.confidence === undefined) return [];
  if (!isFiniteNumber(quality.confidence) || quality.confidence < 0 || quality.confidence > 1) {
    return [error('INVALID_CONFIDENCE', `${path}.confidence`, '置信度必须在 0 到 1 之间', [nodeId])];
  }
  return [];
}

function validateGeometry(geometry: GeometryNode[]): ValidationIssue[] {
  return geometry.flatMap((node, index) => {
    const path = `geometry[${index}]`;
    switch (node.type) {
      case 'point':
        return finitePoint([node.x, node.y]) ? [] : [invalidPoint(path, node.id)];
      case 'line':
        return finitePoint(node.start) && finitePoint(node.end)
          ? distance(node.start, node.end) > 0
            ? []
            : [error('DEGENERATE_LINE', path, '线段起点和终点不能重合', [node.id])]
          : [invalidPoint(path, node.id)];
      case 'ray':
      case 'xline': {
        const issues = finitePoint(node.origin) && finitePoint(node.direction)
          ? []
          : [invalidPoint(path, node.id)];
        const length = Math.hypot(node.direction[0], node.direction[1]);
        if (!isFiniteNumber(length) || Math.abs(length - 1) > UNIT_TOLERANCE) {
          issues.push(error(
            'DIRECTION_NOT_NORMALIZED',
            `${path}.direction`,
            '方向向量必须规范化',
            [node.id],
          ));
        }
        return issues;
      }
      case 'circle':
        return [
          ...(!finitePoint(node.center) ? [invalidPoint(`${path}.center`, node.id)] : []),
          ...(!isFiniteNumber(node.radius) || node.radius <= 0
            ? [error('INVALID_RADIUS', `${path}.radius`, '半径必须大于零', [node.id])]
            : []),
        ];
      case 'arc':
        return [
          ...(!finitePoint(node.center) ? [invalidPoint(`${path}.center`, node.id)] : []),
          ...(!isFiniteNumber(node.radius) || node.radius <= 0
            ? [error('INVALID_RADIUS', `${path}.radius`, '圆弧半径必须大于零', [node.id])]
            : []),
          ...(!isFiniteNumber(node.startAngle) || !isFiniteNumber(node.endAngle)
            ? [error('INVALID_ANGLE', path, '圆弧角度必须是有限数字', [node.id])]
            : []),
        ];
      case 'ellipse':
        return [
          ...(!finitePoint(node.center) || !finitePoint(node.majorAxis)
            ? [invalidPoint(path, node.id)]
            : []),
          ...(Math.hypot(node.majorAxis[0], node.majorAxis[1]) <= 0
            ? [error('INVALID_MAJOR_AXIS', `${path}.majorAxis`, '椭圆主轴不能为零', [node.id])]
            : []),
          ...(!isFiniteNumber(node.ratio) || node.ratio <= 0 || node.ratio > 1
            ? [error('INVALID_ELLIPSE_RATIO', `${path}.ratio`, '椭圆比例必须在 (0, 1] 内', [node.id])]
            : []),
        ];
      case 'polyline': {
        const minimum = node.closed ? 3 : 2;
        const validVertices = node.vertices.length >= minimum
          && node.vertices.every((vertex) => finitePoint(vertex.point)
            && (vertex.bulge === undefined || isFiniteNumber(vertex.bulge)));
        return validVertices
          ? []
          : [error('INVALID_POLYLINE', path, '多段线顶点数量或参数无效', [node.id])];
      }
      case 'spline':
        return validateSpline(node, path);
    }
  });
}

function validateSpline(
  node: Extract<GeometryNode, { type: 'spline' }>,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(node.degree) || node.degree < 1
    || node.controlPoints.length <= node.degree
    || !node.controlPoints.every(finitePoint)) {
    issues.push(error('INVALID_SPLINE', path, '样条次数和控制点无效', [node.id]));
  }
  const expectedKnots = node.controlPoints.length + node.degree + 1;
  if (node.knots.length !== expectedKnots
    || node.knots.some((value) => !isFiniteNumber(value))
    || !nonDecreasing(node.knots)) {
    issues.push(error('INVALID_SPLINE_KNOTS', `${path}.knots`, '样条 knot 数量或顺序无效', [node.id]));
  }
  if (node.weights
    && (node.weights.length !== node.controlPoints.length
      || node.weights.some((value) => !isFiniteNumber(value) || value <= 0))) {
    issues.push(error('INVALID_SPLINE_WEIGHTS', `${path}.weights`, '样条权重无效', [node.id]));
  }
  return issues;
}

function validateAnnotations(annotations: AnnotationNode[]): ValidationIssue[] {
  return annotations.flatMap((node, index) => {
    const path = `annotations[${index}]`;
    switch (node.type) {
      case 'text':
        return [
          ...(!node.content.trim()
            ? [error('EMPTY_TEXT', `${path}.content`, '文字内容不能为空', [node.id])]
            : []),
          ...(!finitePoint(node.position) || !isFiniteNumber(node.rotation)
            ? [invalidPoint(path, node.id)]
            : []),
          ...(!isFiniteNumber(node.height) || node.height <= 0
            ? [error('INVALID_TEXT_HEIGHT', `${path}.height`, '文字高度必须大于零', [node.id])]
            : []),
        ];
      case 'dimension': return validateDimension(node, path);
      case 'leader':
        return [
          ...(!node.content.trim()
            ? [error('EMPTY_TEXT', `${path}.content`, '引线文字不能为空', [node.id])]
            : []),
          ...(node.points.length < 2 || node.points.some((point) => !finitePoint(point))
            ? [error('INVALID_LEADER_PATH', `${path}.points`, '引线至少需要两个有效点', [node.id])]
            : []),
          ...(!isFiniteNumber(node.textHeight) || node.textHeight <= 0
            ? [error('INVALID_TEXT_HEIGHT', `${path}.textHeight`, '引线文字高度必须大于零', [node.id])]
            : []),
        ];
      case 'centerline':
        return [
          ...(!finitePoint(node.start) || !finitePoint(node.end)
            || distance(node.start, node.end) <= 0
            ? [error('INVALID_CENTERLINE', path, '中心线端点必须有效且不能重合', [node.id])]
            : []),
          ...(!isFiniteNumber(node.extension) || node.extension < 0
            ? [error('INVALID_CENTERLINE_EXTENSION', `${path}.extension`, '中心线延伸量不能为负数', [node.id])]
            : []),
          ...(node.targets.length === 0
            ? [error('CENTERLINE_TARGET_REQUIRED', `${path}.targets`, '中心线必须引用几何目标', [node.id])]
            : []),
        ];
      case 'section-hatch':
        return [
          ...(!node.pattern.trim()
            ? [error('INVALID_SECTION_HATCH_PATTERN', `${path}.pattern`, '剖面线图案不能为空', [node.id])]
            : []),
          ...(!isFiniteNumber(node.angle)
            ? [error('INVALID_ANGLE', `${path}.angle`, '剖面线角度必须是有限数字', [node.id])]
            : []),
          ...(!isFiniteNumber(node.spacing) || node.spacing <= 0
            ? [error('INVALID_SECTION_HATCH_SPACING', `${path}.spacing`, '剖面线间距必须大于零', [node.id])]
            : []),
          ...(node.segments.length === 0 || node.segments.some(({ start, end }) => (
            !finitePoint(start) || !finitePoint(end) || distance(start, end) <= 0
          ))
            ? [error('INVALID_SECTION_HATCH_SEGMENTS', `${path}.segments`, '剖面线必须包含有效且非退化的线段', [node.id])]
            : []),
        ];
    }
  });
}

function validateDimension(node: DimensionAnnotation, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!finitePoint(node.textPosition) || node.definitionPoints.some((point) => !finitePoint(point))) {
    issues.push(invalidPoint(path, node.id));
  }
  if (node.associationStatus === 'resolved' && node.targets.length === 0) {
    issues.push(error('DIMENSION_TARGET_REQUIRED', `${path}.targets`, '已解析尺寸必须有目标', [node.id]));
  }
  if (node.associationStatus === 'ambiguous' && (node.candidates?.length ?? 0) < 2) {
    issues.push(error('DIMENSION_CANDIDATES_REQUIRED', `${path}.candidates`, '歧义尺寸必须保留至少两个候选', [node.id]));
  }
  node.candidates?.forEach((candidate, index) => {
    if (!isFiniteNumber(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      issues.push(error(
        'INVALID_CANDIDATE_SCORE',
        `${path}.candidates[${index}].score`,
        '候选得分必须在 0 到 1 之间',
        [node.id],
      ));
    }
  });
  return issues;
}

function validateRelations(relations: DrawingRelation[]): ValidationIssue[] {
  return relations.flatMap((relation, index) => {
    const path = `relations[${index}]`;
    if (relation.plane === 'constraint') {
      const minimum = ['horizontal', 'vertical', 'radius'].includes(relation.kind) ? 1 : 2;
      return relation.geometryIds.length >= minimum
        ? []
        : [error('INVALID_RELATION_ARITY', path, '约束引用数量不足', [relation.id])];
    }
    if (relation.plane === 'topology') {
      return relation.nodeIds.length > 0
        ? []
        : [error('INVALID_RELATION_ARITY', path, '拓扑关系必须引用节点', [relation.id])];
    }
    if (relation.plane === 'association') {
      return relation.geometryIds.length > 0
        ? []
        : [error('INVALID_RELATION_ARITY', path, '关联关系必须引用几何', [relation.id])];
    }
    return relation.nodeIds.length > 0
      ? []
      : [error('INVALID_RELATION_ARITY', path, '语义关系必须引用节点', [relation.id])];
  });
}

function validateReferences(document: DrawingDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const geometry = new Map(document.geometry.map((node) => [node.id, node]));
  const annotations = new Set(document.annotations.map((node) => node.id));
  const relations = new Set(document.relations.map((node) => node.id));
  const features = new Set(document.features.map((node) => node.id));
  const allNodes = new Set<string>([
    ...geometry.keys(),
    ...annotations,
    ...relations,
    ...features,
  ]);

  document.annotations.forEach((annotation, index) => {
    const targets = annotation.type === 'dimension'
      ? [
        ...annotation.targets,
        ...(annotation.candidates?.flatMap((candidate) => candidate.targets) ?? []),
      ]
      : annotation.type === 'leader' ? [annotation.target] : [];
    targets.forEach((target, targetIndex) => {
      const targetGeometry = geometry.get(target.geometryId);
      if (!targetGeometry) {
        issues.push(missing(`annotations[${index}].targets[${targetIndex}]`, target.geometryId, annotation.id));
      } else if (!anchorApplies(target.anchor, targetGeometry)) {
        issues.push(error(
          'INVALID_ANCHOR',
          `annotations[${index}].targets[${targetIndex}].anchor`,
          `锚点 ${target.anchor.kind} 不适用于 ${targetGeometry.type}`,
          [annotation.id, target.geometryId],
        ));
      }
    });
    if (annotation.type === 'centerline') {
      annotation.targets.forEach((id, targetIndex) => {
        if (!geometry.has(id)) {
          issues.push(missing(`annotations[${index}].targets[${targetIndex}]`, id, annotation.id));
        }
      });
    }
  });

  document.relations.forEach((relation, index) => {
    const path = `relations[${index}]`;
    if (relation.plane === 'constraint') {
      relation.geometryIds.forEach((id) => {
        if (!geometry.has(id)) issues.push(missing(`${path}.geometryIds`, id, relation.id));
      });
    } else if (relation.plane === 'association') {
      if (!annotations.has(relation.annotationId)) {
        issues.push(missing(`${path}.annotationId`, relation.annotationId, relation.id));
      }
      relation.geometryIds.forEach((id) => {
        if (!geometry.has(id)) issues.push(missing(`${path}.geometryIds`, id, relation.id));
      });
    } else {
      relation.nodeIds.forEach((id) => {
        if (!allNodes.has(id)) issues.push(missing(`${path}.nodeIds`, id, relation.id));
      });
      if (relation.plane === 'semantic' && !features.has(relation.featureId)) {
        issues.push(missing(`${path}.featureId`, relation.featureId, relation.id));
      }
    }
  });

  document.features.forEach((feature, index) => {
    feature.geometryIds.forEach((id) => {
      if (!geometry.has(id)) issues.push(missing(`features[${index}].geometryIds`, id, feature.id));
    });
    feature.annotationIds.forEach((id) => {
      if (!annotations.has(id)) issues.push(missing(`features[${index}].annotationIds`, id, feature.id));
    });
    feature.relationIds.forEach((id) => {
      if (!relations.has(id)) issues.push(missing(`features[${index}].relationIds`, id, feature.id));
    });
  });
  return issues;
}

function validateFeatures(features: SemanticFeature[]): ValidationIssue[] {
  return features.flatMap((feature, index) => feature.semanticType.trim()
    ? []
    : [error('EMPTY_SEMANTIC_TYPE', `features[${index}].semanticType`, 'Feature 类型不能为空', [feature.id])]);
}

function anchorApplies(anchor: EntityAnchor, geometry: GeometryNode): boolean {
  if (anchor.kind === 'nearest') return finitePoint(anchor.point);
  if (anchor.kind === 'center') {
    return ['point', 'circle', 'arc', 'ellipse'].includes(geometry.type);
  }
  if (anchor.kind === 'start' || anchor.kind === 'end') {
    return ['line', 'ray', 'arc'].includes(geometry.type);
  }
  if (anchor.kind === 'vertex') {
    return Number.isInteger(anchor.index) && anchor.index >= 0
      && ((geometry.type === 'polyline' && anchor.index < geometry.vertices.length)
        || (geometry.type === 'spline' && anchor.index < geometry.controlPoints.length));
  }
  if (anchor.kind === 'curve-parameter') {
    return isFiniteNumber(anchor.parameter)
      && ['circle', 'arc', 'ellipse', 'spline'].includes(geometry.type);
  }
  return false;
}

function missing(path: string, missingId: string, ownerId: string): ValidationIssue {
  return error('REFERENCE_NOT_FOUND', path, `引用 ${missingId} 不存在`, [ownerId, missingId]);
}

function invalidPoint(path: string, nodeId: string): ValidationIssue {
  return error('INVALID_COORDINATE', path, '坐标必须是有限数字', [nodeId]);
}

function error(code: string, path: string, message: string, nodeIds: string[] = []): ValidationIssue {
  return { code, severity: 'error', path, message, nodeIds };
}

function finitePoint(point: Vec2): boolean {
  return point.length === 2 && point.every(isFiniteNumber);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonDecreasing(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value >= values[index - 1]);
}

function distance(first: Vec2, second: Vec2): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}
