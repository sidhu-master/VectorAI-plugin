import type {
  EvidenceId,
  GeometryId,
  GeometryNode,
  PerceptionPreviewNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { CvEvidenceSummary, CvPrimitiveType } from '../drawing-cv/types.js';

export interface FeedbackSuggestedFit {
  evidenceHandle: string;
  primitiveType: CvPrimitiveType;
  documentParameters: unknown;
}

export function feedbackPreviewNodeId(slotId: string): GeometryId {
  return `feedback_preview_${slotId}` as GeometryId;
}

export function projectFeedbackCandidates(input: {
  evidence: CvEvidenceSummary[];
  suggestedFits: FeedbackSuggestedFit[];
  slotIdsByEvidence: Record<string, string>;
}): {
  nodes: PerceptionPreviewNode[];
  labelsByNodeId: Record<string, string>;
} {
  const summaries = new Map(input.evidence.map((item) => [item.handle, item]));
  const nodes: PerceptionPreviewNode[] = [];
  const labelsByNodeId: Record<string, string> = {};
  for (const fit of input.suggestedFits.slice(0, 16)) {
    const evidence = summaries.get(fit.evidenceHandle);
    const slotId = input.slotIdsByEvidence[fit.evidenceHandle];
    if (!evidence || !slotId) continue;
    const node = geometryNode(fit, evidence, slotId);
    if (!node) continue;
    nodes.push(node);
    labelsByNodeId[node.id] = `轮廓 ${nodes.length}`;
  }
  return { nodes, labelsByNodeId };
}

function geometryNode(
  fit: FeedbackSuggestedFit,
  evidence: CvEvidenceSummary,
  slotId: string,
): GeometryNode | undefined {
  const params = record(fit.documentParameters);
  if (!params) return undefined;
  const common = {
    id: feedbackPreviewNodeId(slotId),
    visible: true,
    quality: {
      status: 'candidate' as const,
      confidence: evidence.confidence,
      evidenceRefs: [evidence.handle as EvidenceId],
    },
  };
  switch (fit.primitiveType) {
    case 'point': {
      const x = finite(params.x);
      const y = finite(params.y);
      return x === undefined || y === undefined ? undefined : { ...common, type: 'point', x, y };
    }
    case 'line': {
      const start = point(params.start);
      const end = point(params.end);
      return !start || !end ? undefined : { ...common, type: 'line', start, end };
    }
    case 'ray':
    case 'xline': {
      const origin = point(params.origin);
      const direction = point(params.direction);
      return !origin || !direction || Math.hypot(...direction) === 0
        ? undefined
        : { ...common, type: fit.primitiveType, origin, direction };
    }
    case 'circle': {
      const center = point(params.center);
      const radius = positive(params.radius);
      return !center || radius === undefined
        ? undefined
        : { ...common, type: 'circle', center, radius };
    }
    case 'arc': {
      const center = point(params.center);
      const radius = positive(params.radius);
      const startAngle = finite(params.startAngle);
      const endAngle = finite(params.endAngle);
      if (!center || radius === undefined || startAngle === undefined || endAngle === undefined
        || typeof params.counterClockwise !== 'boolean') return undefined;
      return {
        ...common, type: 'arc', center, radius, startAngle, endAngle,
        counterClockwise: params.counterClockwise,
      };
    }
    case 'ellipse': {
      const center = point(params.center);
      const majorAxis = point(params.majorAxis);
      const ratio = positive(params.ratio);
      return !center || !majorAxis || ratio === undefined || ratio > 1
        ? undefined
        : { ...common, type: 'ellipse', center, majorAxis, ratio };
    }
    case 'polyline': {
      if (!Array.isArray(params.vertices) || typeof params.closed !== 'boolean') return undefined;
      const vertices = params.vertices.slice(0, 64).map((item) => {
        const value = record(item);
        const parsed = point(value?.point);
        return parsed ? { point: parsed } : undefined;
      });
      if (vertices.length < 2 || vertices.some((item) => item === undefined)) return undefined;
      return {
        ...common, type: 'polyline', vertices: vertices as Array<{ point: Vec2 }>,
        closed: params.closed,
      };
    }
    case 'spline': {
      if (!Array.isArray(params.controlPoints) || !Array.isArray(params.knots)
        || typeof params.closed !== 'boolean' || typeof params.periodic !== 'boolean') return undefined;
      const controlPoints = params.controlPoints.slice(0, 64).map(point);
      const knots = params.knots.map(finite);
      const degree = positiveOrZero(params.degree);
      if (degree === undefined || controlPoints.length < 2 || controlPoints.some((item) => !item)
        || knots.some((item) => item === undefined)) return undefined;
      return {
        ...common, type: 'spline', degree,
        controlPoints: controlPoints as Vec2[], knots: knots as number[],
        closed: params.closed, periodic: params.periodic,
      };
    }
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function point(value: unknown): Vec2 | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const x = finite(value[0]);
  const y = finite(value[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function positive(value: unknown): number | undefined {
  const parsed = finite(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function positiveOrZero(value: unknown): number | undefined {
  const parsed = finite(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
}
