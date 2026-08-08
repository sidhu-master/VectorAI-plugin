import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import dotenv from 'dotenv';

import { FileDrawingObservationStore } from '../api/services/drawing-perception/observation-store.js';
import { DrawingPerceptionPipeline } from '../api/services/drawing-perception/pipeline.js';
import type { DrawingCoverageLedger } from '../api/services/drawing-perception/coverage.js';
import type {
  ContourEvidence,
  DimensionAssociation,
  GeometryObservation,
  GlobalContour,
} from '../api/services/drawing-perception/types.js';

dotenv.config();

const inputPath = process.argv.slice(2).find((argument) => argument !== '--');
if (!inputPath) {
  throw new Error('用法: pnpm test:drawing -- <image-or-pdf-path>');
}

const absolutePath = resolve(process.cwd(), inputPath);
const mimeType = mimeFor(absolutePath);
const bytes = await readFile(absolutePath);
const runId = `baseline_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 17)}`;
const rootDir = resolve(process.cwd(), '.local/vectorai/baselines');
const store = new FileDrawingObservationStore(rootDir);
const pipeline = new DrawingPerceptionPipeline({ observationStore: store });
const controller = new AbortController();
const startedAt = Date.now();
let firstOutputAt: number | undefined;
let firstPatchAt: number | undefined;
let batchCount = 0;
let commitEntityCount = 0;
let lowConfidenceCount = 0;

console.log(JSON.stringify({ event: 'accepted', runId, path: absolutePath, elapsedMs: 0 }));
for await (const output of pipeline.run({
  runId,
  page: 1,
  image: bytes.toString('base64'),
  mimeType,
  modelName: process.env.COMPANY_AI_VISION_MODEL
    || process.env.COMPANY_AI_PRIMARY_MODEL
    || 'doubao-seed-2.0-lite',
  signal: controller.signal,
  deadlineAt: Date.now() + Number(process.env.DRAWING_BASELINE_TIMEOUT_MS || 240_000),
})) {
  firstOutputAt ??= Date.now();
  if (output.kind === 'stage') {
    console.log(JSON.stringify({
      event: 'stage', stage: output.stage, viewId: output.viewId,
      durationMs: output.durationMs, elapsedMs: Date.now() - startedAt,
    }));
    continue;
  }
  batchCount += 1;
  firstPatchAt ??= Date.now();
  commitEntityCount += output.batch.commands.length;
  lowConfidenceCount += output.batch.lowConfidenceCount;
  console.log(JSON.stringify({
    event: 'patch_batch', componentId: output.batch.componentId,
    entityCount: output.batch.commands.length,
    lowConfidenceCount: output.batch.lowConfidenceCount,
    confidence: output.batch.confidence,
    elapsedMs: Date.now() - startedAt,
  }));
}

const geometry = await store.read<GeometryObservation[]>(runId, 'geometry');
const associations = await store.read<DimensionAssociation[]>(runId, 'associations');
const perceptionErrors = await store.read<Array<{
  viewId: string;
  tool: string;
  message: string;
}>>(runId, 'perception-errors');
const coverage = await store.read<DrawingCoverageLedger>(runId, 'coverage-ledger');
const globalContours = await store.read<GlobalContour[]>(runId, 'global-contours');
const contourEvidence = await store.read<ContourEvidence[]>(runId, 'contour-evidence');
console.log(JSON.stringify({
  event: 'summary',
  status: 'completed',
  acceptedLatencyMs: (firstOutputAt ?? Date.now()) - startedAt,
  firstPatchLatencyMs: firstPatchAt === undefined ? undefined : firstPatchAt - startedAt,
  totalMs: Date.now() - startedAt,
  geometryObservations: geometry.length,
  dimensionAssociations: associations.length,
  resolvedAssociations: associations.filter((item) => item.status === 'resolved').length,
  ambiguousAssociations: associations.filter((item) => item.status === 'ambiguous').length,
  conflictAssociations: associations.filter((item) => item.status === 'conflict').length,
  batchCount,
  commitEntityCount,
  lowConfidenceCount,
  perceptionErrorCount: perceptionErrors.length,
  failedTools: [...new Set(perceptionErrors.map((error) => error.tool))],
  coverageComplete: coverage.complete,
  coverageRegionCount: coverage.regions.length,
  refinedRegionCount: coverage.regions.filter((region) => region.status === 'refine').length,
  budgetExhaustedRegionCount: coverage.regions.filter(
    (region) => region.status === 'budget_exhausted',
  ).length,
  globalContourCount: globalContours.length,
  contourEvidenceCount: contourEvidence.length,
  recordsDirectory: resolve(rootDir, runId, 'drawing'),
}));

function mimeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    default: throw new Error(`不支持的图纸文件: ${path}`);
  }
}
