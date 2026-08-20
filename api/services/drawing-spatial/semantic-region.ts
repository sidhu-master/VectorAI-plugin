import { createHash } from 'node:crypto';

import sharp from 'sharp';

import type {
  SemanticRegion,
  SemanticRegionProposal,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  DrawingId,
  Vec2,
} from '../../../src/drawing/index.js';
import type { AffineTransform } from '../drawing-render/rasterize-scene.js';
import type { VisualObservation } from '../drawing-vision/observation-types.js';
import type { RegionMediaStore } from './region-media-store.js';

export async function buildSemanticRegion(input: {
  drawingId: DrawingId;
  observation: VisualObservation;
  proposal: SemanticRegionProposal;
  mediaStore: RegionMediaStore;
}): Promise<SemanticRegion> {
  if (input.observation.drawingId !== input.drawingId) {
    throw new Error('SEMANTIC_REGION_DRAWING_MISMATCH');
  }
  const view = input.observation.views.find((item) => item.id === input.proposal.sourceViewId);
  if (!view) throw new Error(`SEMANTIC_REGION_VIEW_MISSING:${input.proposal.sourceViewId}`);
  const toWorld = inverse(view.worldToImage);
  const worldPoint = (point: readonly [number, number]): Vec2 => transform(toWorld, [
    point[0] * view.width,
    point[1] * view.height,
  ]);
  const worldContours = input.proposal.contours.map((contour) => contour.map(worldPoint));
  const worldHoles = input.proposal.holes.map((contour) => contour.map(worldPoint));
  const mask = await renderMask(
    input.proposal.contours,
    input.proposal.holes,
    view.width,
    view.height,
  );
  const scope = JSON.stringify({
    drawingId: input.drawingId,
    revision: input.observation.revision,
    viewId: view.id,
    proposal: input.proposal,
  });
  const id = `region_${createHash('sha256').update(scope).digest('hex').slice(0, 24)}`;
  return {
    id,
    drawingId: input.drawingId,
    revision: input.observation.revision,
    label: input.proposal.label,
    operation: input.proposal.operation,
    preferredEditMode: input.proposal.preferredEditMode,
    sourceViewIds: [view.id],
    maskHandle: input.mediaStore.put(scope, mask),
    worldContours,
    worldHoles,
    anchors: input.proposal.anchors.map((anchor) => ({
      id: anchor.id,
      role: anchor.role,
      point: worldPoint(anchor.point),
      confidence: anchor.confidence,
    })),
    confidence: input.proposal.confidence,
    evidenceRefs: [...input.proposal.evidenceRefs],
  };
}

function inverse(transform: AffineTransform): AffineTransform {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('SEMANTIC_REGION_TRANSFORM_SINGULAR');
  }
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function transform(matrix: AffineTransform, point: Vec2): Vec2 {
  return [
    normalize(matrix[0] * point[0] + matrix[2] * point[1] + matrix[4]),
    normalize(matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]),
  ];
}

async function renderMask(
  contours: readonly (readonly (readonly [number, number])[])[],
  holes: readonly (readonly (readonly [number, number])[])[],
  width: number,
  height: number,
): Promise<Buffer> {
  const path = [...contours, ...holes].map((polygon) => polygon.map((point, index) => {
    const x = normalize(point[0] * width);
    const y = normalize(point[1] * height);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ') + ' Z').join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="black"/><path d="${path}" fill="white" fill-rule="evenodd"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function normalize(value: number): number {
  const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}
