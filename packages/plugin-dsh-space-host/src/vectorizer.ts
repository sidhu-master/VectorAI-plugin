// SPDX-License-Identifier: Apache-2.0

import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import {
  createEmptyDrawing,
  type ArcGeometry,
  type CircleGeometry,
  type DrawingDocument,
  type DrawingId,
  type EllipseGeometry,
  type FeatureId,
  type GeometryId,
  type GeometryNode,
  type LineGeometry,
  type PolylineGeometry,
  type RelationId,
  type SemanticFeature,
  type TopologyRelation,
  type Vec2,
} from '@vectorai/drawing-core';
import type {
  Bounds2D,
} from '@vectorai/plugin-space-contracts';
import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PythonVectorizationProvider } from '../../../api/services/drawing-vectorization/python-provider';
import type {
  CleanLinePrimitiveCandidate,
  CleanLineStrokeChain,
  CleanLineStrokePiece,
  CleanLineVectorizationResult,
} from '../../../api/services/drawing-vectorization/types';

export interface VectorizedImage {
  document: DrawingDocument;
  bounds: Bounds2D;
  provisional: boolean;
}

export interface ImageVectorizer {
  vectorize(input: {
    drawingId: string;
    attachment: ImageAttachmentRef;
    data: Uint8Array;
    signal: AbortSignal;
  }): Promise<VectorizedImage>;
}

const PAGE_WIDTH = 500;

/** Runs the existing clean-line CV pipeline entirely on the local machine. */
export class LocalCleanLineVectorizer implements ImageVectorizer {
  readonly #timeoutMs: number;

  constructor(options: { timeoutMs?: number } = {}) {
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }

  async vectorize(input: {
    drawingId: string;
    attachment: ImageAttachmentRef;
    data: Uint8Array;
    signal: AbortSignal;
  }): Promise<VectorizedImage> {
    input.signal.throwIfAborted();
    const root = resolve(import.meta.dirname, '../../..');
    const localPython = resolve(root, '.local/vectorai/cv-venv/bin/python');
    const packagedScript = resolve(import.meta.dirname, 'vectorai_vectorizer.py');
    const provider = await PythonVectorizationProvider.create({
      pythonPath: await accessible(localPython) ? localPython : undefined,
      scriptPath: await accessible(packagedScript)
        ? packagedScript
        : resolve(root, 'python/vectorai_vectorizer.py'),
      timeoutMs: this.#timeoutMs,
    });
    try {
      const result = await provider.vectorize({
        source: {
          sourceId: String(input.attachment.attachmentId),
          mimeType: input.attachment.mediaType,
          bytes: input.data,
          width: input.attachment.width,
          height: input.attachment.height,
        },
        maxPixels: Math.min(input.attachment.width * input.attachment.height, 4_000_000),
        signal: input.signal,
      });
      input.signal.throwIfAborted();
      return vectorizedDocument(input.drawingId, result);
    } finally {
      await provider.close();
    }
  }
}

async function accessible(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function vectorizedDocument(drawingId: string, result: CleanLineVectorizationResult): VectorizedImage {
  const now = Date.now();
  const document = createEmptyDrawing({
    idFactory: { next: () => drawingId },
    now: () => now,
  });
  document.id = drawingId as DrawingId;
  const factor = PAGE_WIDTH / result.width;
  document.coordinateFrames.push({
    id: `frame_source_${safeId(result.sourceId)}`,
    kind: 'source',
    parentId: 'frame_document',
    transform: [factor, 0, 0, -factor, 0, result.height * factor],
  });
  const projections = result.chains.map((chain) => ({ chain, nodes: chainNodes(result, chain) }));
  document.geometry = projections.flatMap(({ nodes }) => nodes);
  document.relations = projections.flatMap(({ chain, nodes }) => compoundRelations(result, chain, nodes));
  document.features = projections.flatMap(({ chain, nodes }) => {
    const relations = document.relations.filter((relation): relation is TopologyRelation => (
      relation.type === 'topology' && relation.nodeIds.every((id) => nodes.some((node) => node.id === id))
    ));
    return nodes.length > 1 ? [compoundFeature(result, chain, nodes, relations)] : [];
  });
  return {
    document,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: PAGE_WIDTH,
      maxY: round(result.height * factor),
    },
    provisional: false,
  };
}

function chainNodes(result: CleanLineVectorizationResult, chain: CleanLineStrokeChain): GeometryNode[] {
  const candidates = chain.pieces.map((piece, index) => candidateNode(result, chain, piece, index));
  if (candidates.length > 0 && candidates.every((node) => node !== null)) {
    return candidates as GeometryNode[];
  }
  const vertices = chain.simplified.slice(0, 256).map((point) => ({ point: sourcePoint(result, point) }));
  if (vertices.length < (chain.closed ? 3 : 2)) return [];
  return [{
    ...commonNode(result, chain, [], chain.pieces[0]?.candidate?.confidence ?? 0.8),
    type: 'polyline',
    vertices,
    closed: chain.closed,
  } satisfies PolylineGeometry];
}

function candidateNode(
  result: CleanLineVectorizationResult,
  chain: CleanLineStrokeChain,
  piece: CleanLineStrokePiece,
  index: number,
): GeometryNode | null {
  const candidate = piece.candidate;
  if (!candidate || !candidateIsUsable(candidate, piece, chain.segmentation.fitTolerancePx)) return null;
  const common = commonNode(
    result,
    chain,
    chain.pieces.length === 1 ? [] : [piece.id, String(index)],
    candidate.confidence,
  );
  const parameters = candidate.parameters;
  switch (candidate.type) {
    case 'line':
      return {
        ...common,
        type: 'line',
        start: sourcePoint(result, parameters.start as Vec2),
        end: sourcePoint(result, parameters.end as Vec2),
      } satisfies LineGeometry;
    case 'circle':
      return {
        ...common,
        type: 'circle',
        center: sourcePoint(result, parameters.center as Vec2),
        radius: round((parameters.radius as number) * scale(result)),
      } satisfies CircleGeometry;
    case 'arc':
      return {
        ...common,
        type: 'arc',
        center: sourcePoint(result, parameters.center as Vec2),
        radius: round((parameters.radius as number) * scale(result)),
        startAngle: normalizeDegrees(-(parameters.startAngle as number)),
        endAngle: normalizeDegrees(-(parameters.endAngle as number)),
        counterClockwise: typeof parameters.counterClockwise === 'boolean'
          ? !parameters.counterClockwise
          : true,
      } satisfies ArcGeometry;
    case 'ellipse': {
      const axis = parameters.majorAxis as Vec2;
      return {
        ...common,
        type: 'ellipse',
        center: sourcePoint(result, parameters.center as Vec2),
        majorAxis: [round(axis[0] * scale(result)), round(-axis[1] * scale(result))],
        ratio: parameters.ratio as number,
      } satisfies EllipseGeometry;
    }
  }
}

function candidateIsUsable(
  candidate: CleanLinePrimitiveCandidate,
  piece: CleanLineStrokePiece,
  tolerance: number,
): boolean {
  if (!finite(candidate.fitErrorP95) || candidate.fitErrorP95 > tolerance) return false;
  const point = (value: unknown): value is Vec2 => (
    Array.isArray(value) && value.length === 2 && value.every(finite)
  );
  switch (candidate.type) {
    case 'line':
      return !piece.closed && point(candidate.parameters.start) && point(candidate.parameters.end);
    case 'circle':
      return piece.closed && point(candidate.parameters.center) && positive(candidate.parameters.radius);
    case 'arc':
      return !piece.closed && point(candidate.parameters.center) && positive(candidate.parameters.radius)
        && finite(candidate.parameters.startAngle) && finite(candidate.parameters.endAngle);
    case 'ellipse':
      return piece.closed && point(candidate.parameters.center) && point(candidate.parameters.majorAxis)
        && positive(candidate.parameters.ratio);
  }
}

function commonNode(
  result: CleanLineVectorizationResult,
  chain: CleanLineStrokeChain,
  member: string[],
  confidence: number,
) {
  return {
    id: stableId('node_vec', result.sourceId, chain.id, ...member) as GeometryId,
    visible: true,
    quality: {
      status: confidence < 0.6 ? 'candidate' as const : 'confirmed' as const,
      confidence,
      evidenceRefs: [],
    },
  };
}

function compoundRelations(
  result: CleanLineVectorizationResult,
  chain: CleanLineStrokeChain,
  nodes: GeometryNode[],
): TopologyRelation[] {
  if (nodes.length < 2) return [];
  const pairCount = chain.closed ? nodes.length : nodes.length - 1;
  return Array.from({ length: pairCount }, (_, index): TopologyRelation => ({
    id: stableId('relation_vec', result.sourceId, chain.id, String(index)) as RelationId,
    type: 'topology',
    plane: 'topology',
    kind: 'connected',
    nodeIds: [nodes[index].id, nodes[(index + 1) % nodes.length].id],
    visible: true,
    quality: {
      status: nodes[index].quality.status === 'candidate'
        || nodes[(index + 1) % nodes.length].quality.status === 'candidate'
        ? 'candidate'
        : 'confirmed',
      confidence: Math.min(
        nodes[index].quality.confidence ?? 1,
        nodes[(index + 1) % nodes.length].quality.confidence ?? 1,
      ),
      evidenceRefs: [],
    },
  }));
}

function compoundFeature(
  result: CleanLineVectorizationResult,
  chain: CleanLineStrokeChain,
  nodes: GeometryNode[],
  relations: TopologyRelation[],
): SemanticFeature {
  const confidence = nodes.reduce((sum, node) => sum + (node.quality.confidence ?? 1), 0) / nodes.length;
  return {
    id: stableId('feature_vec', result.sourceId, chain.id) as FeatureId,
    type: 'feature',
    semanticType: 'compound-path',
    geometryIds: nodes.map((node) => node.id),
    annotationIds: [],
    relationIds: relations.map((relation) => relation.id),
    properties: {
      sourceChainId: chain.id,
      ordered: true,
      closed: chain.closed,
      sampleRanges: chain.pieces.map((piece) => [...piece.sampleRange]),
      wraps: chain.pieces.map((piece) => piece.wraps),
      algorithmVersion: chain.segmentation.algorithmVersion,
    },
    visible: true,
    quality: {
      status: nodes.some((node) => node.quality.status === 'candidate') ? 'candidate' : 'confirmed',
      confidence,
      evidenceRefs: [],
    },
  };
}

function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 20)}`;
}

function sourcePoint(result: CleanLineVectorizationResult, point: Vec2): Vec2 {
  const factor = scale(result);
  return [round(point[0] * factor), round((result.height - point[1]) * factor)];
}

function scale(result: Pick<CleanLineVectorizationResult, 'width'>): number {
  return PAGE_WIDTH / result.width;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function positive(value: unknown): value is number {
  return finite(value) && value > 0;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeDegrees(value: number): number {
  return round((value % 360 + 360) % 360);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
