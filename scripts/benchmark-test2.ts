import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import sharp from 'sharp';

import type { DrawingDocument, GeometryNode, Vec2 } from '../src/drawing/index.js';
import { SourceRasterFeedbackComparator } from '../api/services/drawing-feedback/source-comparator.js';
import { buildVectorizationSteps } from '../api/services/drawing-vectorization/build-steps.js';
import { PythonVectorizationProvider } from '../api/services/drawing-vectorization/python-provider.js';
import type {
  CleanLineStrokeChain,
  PersistedCleanLineVectorizationResult,
} from '../api/services/drawing-vectorization/types.js';

const sourcePath = resolve(process.cwd(), process.argv[2] ?? 'test2.png');
const outputDirectory = resolve(process.cwd(), '.local/vectorai/baselines/test2');
const reportPath = resolve(outputDirectory, 'report.json');
const svgPath = resolve(outputDirectory, 'result.svg');

const startedAt = performance.now();
const bytes = await readFile(sourcePath);
const metadata = await sharp(bytes).metadata();
if (!metadata.width || !metadata.height) throw new Error('TEST2_IMAGE_SIZE_UNAVAILABLE');

const provider = await PythonVectorizationProvider.create({ timeoutMs: 30_000 });
try {
  const workerStartedAt = performance.now();
  const result = await provider.vectorize({
    source: {
      sourceId: 'test2', mimeType: 'image/png', bytes,
      width: metadata.width, height: metadata.height,
    },
    maxPixels: 4_000_000,
    signal: new AbortController().signal,
  });
  const vectorizationMs = performance.now() - workerStartedAt;
  const persisted = persistForBenchmark(result);
  const steps = buildVectorizationSteps(persisted);
  const drafts = steps.filter((step) => step.kind === 'draft');
  const promotions = steps.filter((step) => step.kind === 'promotion');
  const geometry = finalGeometry(steps.map((step) => step.previewNode));
  const document = drawingDocument(geometry);
  const comparator = new SourceRasterFeedbackComparator({
    sources: { read: async () => ({
      sourceId: result.sourceId,
      mimeType: 'image/png',
      bytes,
      width: result.width,
      height: result.height,
    }) },
  });
  const coverageStartedAt = performance.now();
  const residual = await comparator.compare(document, undefined, { sourceId: result.sourceId });
  const coverageMs = performance.now() - coverageStartedAt;
  const errors = validationErrors(result.chains, result.width, result.height, drafts.length);
  const typeCounts = Object.fromEntries(
    [...new Set(geometry.map((node) => node.type))]
      .sort()
      .map((type) => [type, geometry.filter((node) => node.type === type).length]),
  );
  const report = {
    source: { file: sourcePath, width: result.width, height: result.height },
    pipelineVersion: result.pipelineVersion,
    elapsedMs: round(performance.now() - startedAt),
    vectorizationMs: round(vectorizationMs),
    coverageMs: round(coverageMs),
    firstResultMs: round(vectorizationMs),
    medianLineWidthPx: round(result.medianLineWidthPx),
    chainCount: result.chains.length,
    draftCount: drafts.length,
    promotionCount: promotions.length,
    typeCounts,
    coverage: {
      edgePrecision: round(residual.geometry.edgePrecision),
      edgeRecall: round(residual.geometry.edgeRecall),
      edgeF1: round(residual.geometry.edgeF1),
      fitP50: round(residual.geometry.fitP50),
      fitP95: round(residual.geometry.fitP95),
      fitMax: round(residual.geometry.fitMax),
      residualRegionCount: residual.residualRegions.length,
    },
    maxCandidateRadiusRatio: round(maxCandidateRadiusRatio(result.chains)),
    errors,
  };

  await mkdir(dirname(reportPath), { recursive: true });
  await Promise.all([
    writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(svgPath, renderSvg(geometry, result.height * 500 / result.width), 'utf8'),
  ]);
  process.stdout.write(`${JSON.stringify({ reportPath, svgPath, ...report }, null, 2)}\n`);
  if (errors.length > 0) process.exitCode = 1;
} finally {
  await provider.close();
}

function persistForBenchmark(
  result: Awaited<ReturnType<PythonVectorizationProvider['vectorize']>>,
): PersistedCleanLineVectorizationResult {
  return {
    ...result,
    chains: result.chains.map((chain) => ({
      ...chain,
      evidence: {
        handle: `benchmark_${chain.id}`,
        sourceId: result.sourceId,
        regionId: `vector_${chain.id}`,
        kind: chain.candidate ? `${chain.candidate.type}-candidate` : 'polyline-candidate',
        bounds: { ...chain.bounds },
        confidence: chain.candidate?.confidence ?? 0.8,
        touchesRegionEdge: false,
        sampleCount: chain.samples.length,
      },
    })),
  };
}

function finalGeometry(nodes: GeometryNode[]): GeometryNode[] {
  const byId = new Map<string, GeometryNode>();
  for (const node of nodes) byId.set(node.id, structuredClone(node));
  return [...byId.values()];
}

function drawingDocument(geometry: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_test2' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry, annotations: [], relations: [], features: [],
  };
}

function validationErrors(
  chains: CleanLineStrokeChain[],
  width: number,
  height: number,
  draftCount: number,
): string[] {
  const errors = new Set<string>();
  if (draftCount !== chains.length) errors.add('EMPTY_DRAFT');
  const sourceDiagonal = Math.hypot(width, height);
  for (const chain of chains) {
    if (chain.samples.length === 0 || chain.simplified.length === 0) errors.add('EMPTY_DRAFT');
    for (const [x, y] of chain.samples) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) errors.add('NON_FINITE');
      if (x < 0 || x >= width || y < 0 || y >= height) errors.add('OUT_OF_BOUNDS');
    }
    const radius = chain.candidate?.parameters.radius;
    const boundsDiagonal = Math.hypot(chain.bounds.width, chain.bounds.height);
    if (typeof radius === 'number'
      && (radius > sourceDiagonal || (boundsDiagonal > 0 && radius > boundsDiagonal * 4))) {
      errors.add('FALSE_GIANT_CIRCLE');
    }
  }
  return [...errors].sort();
}

function maxCandidateRadiusRatio(chains: CleanLineStrokeChain[]): number {
  return chains.reduce((maximum, chain) => {
    const radius = chain.candidate?.parameters.radius;
    const diagonal = Math.hypot(chain.bounds.width, chain.bounds.height);
    return typeof radius === 'number' && diagonal > 0
      ? Math.max(maximum, radius / diagonal)
      : maximum;
  }, 0);
}

function renderSvg(geometry: GeometryNode[], height: number): string {
  const body = geometry.map(svgNode).filter(Boolean).join('\n    ');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ${round(height)}" width="500" height="${round(height)}">`,
    '  <rect width="100%" height="100%" fill="#fafafa"/>',
    `  <g transform="translate(0 ${round(height)}) scale(1 -1)" fill="none" stroke="#111827" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">`,
    `    ${body}`,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function svgNode(node: GeometryNode): string {
  switch (node.type) {
    case 'point': return `<circle cx="${node.x}" cy="${node.y}" r="1"/>`;
    case 'line': return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}"/>`;
    case 'circle': return `<circle cx="${node.center[0]}" cy="${node.center[1]}" r="${node.radius}"/>`;
    case 'arc': return svgArc(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
    case 'ellipse': {
      const radius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
      return `<ellipse cx="${node.center[0]}" cy="${node.center[1]}" rx="${radius}" ry="${radius * node.ratio}" transform="rotate(${rotation} ${node.center[0]} ${node.center[1]})"/>`;
    }
    case 'polyline': {
      const points = node.vertices.map(({ point }) => point.join(',')).join(' ');
      return node.closed ? `<polygon points="${points}"/>` : `<polyline points="${points}"/>`;
    }
    case 'spline': {
      const points = node.controlPoints.map((point) => point.join(',')).join(' ');
      return `<polyline points="${points}"/>`;
    }
    case 'ray':
    case 'xline': return '';
  }
}

function svgArc(
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterClockwise: boolean,
): string {
  const start = polar(center, radius, startAngle);
  const end = polar(center, radius, endAngle);
  const span = counterClockwise
    ? (endAngle - startAngle + 360) % 360
    : (startAngle - endAngle + 360) % 360;
  return `<path d="M ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} ${counterClockwise ? 1 : 0} ${end[0]} ${end[1]}"/>`;
}

function polar(center: Vec2, radius: number, degrees: number): Vec2 {
  const radians = degrees * Math.PI / 180;
  return [round(center[0] + radius * Math.cos(radians)), round(center[1] + radius * Math.sin(radians))];
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
