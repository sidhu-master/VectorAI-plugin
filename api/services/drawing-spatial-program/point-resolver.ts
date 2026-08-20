import type {
  DrawingDocument,
  DrawingId,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';
import type { StoredObservationView } from '../drawing-vision/observation-builder.js';
import { SpatialProgramError, type SpatialPointRef } from './types.js';

export interface SpatialPointResolutionContext {
  document: DrawingDocument;
  drawingId: DrawingId;
  revision: RevisionId;
  readObservationView: (viewId: string) => StoredObservationView | null;
}

export function resolveSpatialPoint(
  reference: SpatialPointRef,
  context: SpatialPointResolutionContext,
): Vec2 {
  if (reference.kind === 'world') {
    const frame = reference.frameId === 'document'
      ? context.document.coordinateFrames.find((item) => item.kind === 'document')
      : context.document.coordinateFrames.find((item) => item.id === reference.frameId);
    if (!frame || frame.kind !== 'document') {
      throw new SpatialProgramError(
        'SPATIAL_FRAME_UNSUPPORTED',
        `Frame ${reference.frameId} is not the document world frame`,
      );
    }
    return [...reference.point];
  }
  if (reference.kind === 'node_anchor') {
    const node = context.document.geometry.find((item) => item.id === reference.nodeId);
    if (!node) {
      throw new SpatialProgramError(
        'SPATIAL_REFERENCE_UNRESOLVED',
        `Geometry ${reference.nodeId} does not exist`,
      );
    }
    if (reference.anchor === 'center') {
      if (node.type === 'point') return [node.x, node.y];
      if ('center' in node) return [...node.center];
    }
    if (node.type === 'line' && (reference.anchor === 'start' || reference.anchor === 'end')) {
      return [...node[reference.anchor]];
    }
    if (node.type === 'polyline') {
      const index = reference.anchor === 'start'
        ? 0
        : reference.anchor === 'end'
          ? node.vertices.length - 1
          : reference.anchor === 'vertex'
            ? reference.index
            : undefined;
      const point = index === undefined ? undefined : node.vertices[index]?.point;
      if (point) return [...point];
    }
    if (node.type === 'spline' && (reference.anchor === 'start' || reference.anchor === 'end')) {
      const point = reference.anchor === 'start'
        ? node.controlPoints[0]
        : node.controlPoints.at(-1);
      if (point) return [...point];
    }
    if (node.type === 'arc') {
      if (reference.anchor === 'center') return [...node.center];
      if (reference.anchor === 'start' || reference.anchor === 'end') {
        const angle = (reference.anchor === 'start' ? node.startAngle : node.endAngle) * Math.PI / 180;
        return [
          node.center[0] + node.radius * Math.cos(angle),
          node.center[1] + node.radius * Math.sin(angle),
        ];
      }
    }
    throw new SpatialProgramError(
      'SPATIAL_REFERENCE_UNRESOLVED',
      `Anchor ${reference.anchor} is unavailable on ${reference.nodeId}`,
    );
  }
  const stored = context.readObservationView(reference.observationId);
  if (!stored) {
    throw new SpatialProgramError(
      'SPATIAL_OBSERVATION_EXPIRED',
      `Observation ${reference.observationId} is unavailable`,
    );
  }
  if (stored.drawingId !== context.drawingId) {
    throw new SpatialProgramError(
      'SPATIAL_OBSERVATION_DRAWING_MISMATCH',
      `Observation ${reference.observationId} belongs to another drawing`,
    );
  }
  if (stored.revision !== context.revision) {
    throw new SpatialProgramError(
      'SPATIAL_OBSERVATION_REVISION_MISMATCH',
      `Observation ${reference.observationId} belongs to another revision`,
    );
  }
  const [a, b, c, d, e, f] = stored.view.worldToImage;
  const imageX = reference.normalized[0] * stored.view.width;
  const imageY = reference.normalized[1] * stored.view.height;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) {
    throw new SpatialProgramError(
      'SPATIAL_REFERENCE_UNRESOLVED',
      `Observation ${reference.observationId} has a singular coordinate transform`,
    );
  }
  const translatedX = imageX - e;
  const translatedY = imageY - f;
  return [
    (d * translatedX - c * translatedY) / determinant,
    (-b * translatedX + a * translatedY) / determinant,
  ];
}
