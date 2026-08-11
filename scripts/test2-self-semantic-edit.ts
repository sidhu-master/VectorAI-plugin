import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { DrawingAgentAuditEvent } from '../api/services/drawing-agent/audit-types.js';
import { DrawingApplication } from '../api/services/drawing-application/application.js';
import { evaluateSemanticEditBenchmark } from '../api/services/drawing-benchmark/semantic-edit.js';
import { buildAtomicGeometryGraph } from '../api/services/drawing-spatial/atomic-graph.js';
import { polygonRegionBounds } from '../api/services/drawing-spatial/polygon.js';
import { RegionResolver } from '../api/services/drawing-spatial/region-resolver.js';
import { materializeSpatialSplits } from '../api/services/drawing-spatial/split-materializer.js';
import { compileSpatialEdit } from '../api/services/drawing-spatial/spatial-edit-compiler.js';
import { validateSpatialEditPreview } from '../api/services/drawing-spatial/spatial-validator.js';
import { routeSpatialEditStrategy } from '../api/services/drawing-spatial/strategy-router.js';
import {
  TEST2_SHARED_POLYLINE_ID,
  TEST2_SHARED_POLYLINE_POINTS,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from '../api/services/drawing-spatial/test2-fixture.js';
import type { DrawingAgentProgressEvent } from '../src/contracts/drawing-agent.js';
import {
  MemoryDrawingRepository,
  type DrawingDocument,
  type GeometryId,
} from '../src/drawing/index.js';

const fixturePath = resolve(process.cwd(), process.argv[2] ?? 'test2.png');
await readFile(fixturePath);
const outputRoot = resolve(process.cwd(), '.local/vectorai/baselines/test2-region-edit');
await mkdir(outputRoot, { recursive: true });

const before = test2SharedPolylineDocument();
const repository = new MemoryDrawingRepository();
const created = await repository.create(before);
const application = new DrawingApplication({ repository });
const region = { ...test2RightArmRegion(), revision: created.revision };
const graph = buildAtomicGeometryGraph({
  document: before,
  revision: created.revision,
  regionBounds: polygonRegionBounds(region.worldContours),
  padding: 2,
});
const selection = new RegionResolver().resolve({
  document: before,
  revision: created.revision,
  region,
  graph,
  tolerance: 0.01,
});
const split = materializeSpatialSplits({ document: before, selection });
const strategy = routeSpatialEditStrategy({
  goal: '把图中人物的右手抬起来打招呼，保持身体不变并保持手臂闭合连接',
  document: before,
  region,
  selection,
});
const candidate = compileSpatialEdit({
  document: before,
  selection,
  region,
  strategy,
  split,
  design: {
    kind: 'transform',
    transform: {
      kind: 'rotate',
      center: TEST2_SHARED_POLYLINE_POINTS[3],
      angleDegrees: 35,
    },
    confidence: 0.99,
    evidenceRefs: ['view_test2'],
  },
});
const transaction = {
  id: 'transaction_test2_region_self_edit',
  baseRevision: created.revision,
  actor: { type: 'AI' as const, id: 'test2-region-self-gate' },
  commands: candidate.commands,
  preconditions: [],
  postconditions: [{ type: 'document.valid' as const }],
  evidenceRefs: [],
};
const preview = await application.preview({ drawingId: before.id, transaction });
if (preview.status !== 'ready') throw new Error(`TEST2_REGION_PREVIEW_${preview.status}`);
const validation = validateSpatialEditPreview({
  before,
  after: preview.resultingDocument,
  region,
  selection,
  candidate,
  tolerance: 0.02,
});
if (!validation.valid) {
  throw new Error(`TEST2_REGION_VALIDATION:${validation.issues.map((issue) => issue.code).join(',')}`);
}
const committed = await application.execute({ drawingId: before.id, transaction });
if (committed.status !== 'committed') throw new Error(`TEST2_REGION_COMMIT_${committed.status}`);
const commits = await repository.listCommits(before.id);
const previewVersionId = 'test2-region-preview-1';
const auditEvents = auditTimeline(created.revision, previewVersionId, split.lineage);
const progressEvents = progressTimeline();
const expectedProtectedFragments = Object.fromEntries(split.lineage
  .filter((entry) => entry.role === 'protected')
  .map((entry) => {
    const fragment = split.fragments.find((node) => node.id === entry.fragmentId);
    if (!fragment) throw new Error(`TEST2_PROTECTED_FRAGMENT_MISSING:${entry.fragmentId}`);
    return [entry.fragmentId, fragment];
  }));
const report = evaluateSemanticEditBenchmark({
  initialDocument: before,
  finalDocument: committed.document,
  commits,
  oldTargetNodeIds: [],
  editedNodeIds: candidate.targetNodeIds,
  preservedNodeIds: Object.keys(candidate.preserveNodeHashes),
  anchors: selection.boundaryAnchors.map((anchor) => ({
    nodeIds: candidate.targetNodeIds,
    point: anchor.point,
    tolerance: 0.02,
  })),
  auditEvents,
  progressEvents,
  regionEvidence: {
    sharedPolylineNodeId: TEST2_SHARED_POLYLINE_ID,
    expectedProtectedFragments,
    lineage: split.lineage,
    unexpectedDanglingEndpoints: validation.unexpectedDanglingEndpoints,
    closureTolerance: 0.02,
  },
});

const imagePath = resolve(outputRoot, 'final-preview.png');
await renderGeometry(committed.document, candidate.targetNodeIds, imagePath);
const reportPath = resolve(outputRoot, 'report.json');
const artifact = {
  fixturePath,
  reportPath,
  imagePath,
  sourceDrawingId: before.id,
  sourceRevision: created.revision,
  finalRevision: committed.revision,
  regionId: region.id,
  selection: {
    wholeNodes: selection.wholeNodes,
    crossingNodes: selection.crossingNodes,
    boundaryAnchors: selection.boundaryAnchors,
  },
  targetNodeIds: candidate.targetNodeIds,
  lineage: split.lineage,
  protectedBodyNodeId: TEST2_SHARED_POLYLINE_ID,
  ...report,
};
await writeFile(reportPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;

function auditTimeline(
  revision: string,
  previewVersionId: string,
  lineage: unknown[],
): DrawingAgentAuditEvent[] {
  const values: Array<[DrawingAgentAuditEvent['type'], Record<string, unknown>]> = [
    ['observation', { revision }],
    ['region', { id: 'region_test2_right_arm' }],
    ['atomic_graph', { revision }],
    ['selection', { selectionVersionId: 'test2-selection-1' }],
    ['strategy', { mode: 'geometric-edit' }],
    ['split', { fragmentCount: lineage.length }],
    ['lineage', { entries: lineage }],
    ['intent', { kind: 'transform' }],
    ['episode', { previewVersionId }],
    ['preview', { prepared: { previewVersionId } }],
    ['verification', { phase: 'deterministic-spatial', satisfied: true }],
    ['verification', { phase: 'preview', satisfied: true }],
    ['commit', { receipt: { status: 'succeeded' } }],
  ];
  return values.map(([type, payload], index) => ({
    schemaVersion: 1,
    id: `test2_audit_${index}`,
    runId: 'test2-region-self-gate',
    type,
    timestamp: index * 10,
    payload,
  }));
}

function progressTimeline(): DrawingAgentProgressEvent[] {
  const types: DrawingAgentProgressEvent['type'][] = [
    'observing', 'region_overlay', 'region_resolved', 'split_materialized',
    'designing', 'previewing', 'verifying', 'committed', 'completed',
  ];
  return types.map((type, index) => ({
    id: `test2_progress_${index}`,
    runId: 'test2-region-self-gate',
    type,
    title: type,
    timestamp: index * 1_000,
    elapsedMs: index * 1_000,
  }));
}

async function renderGeometry(
  document: DrawingDocument,
  selectedIds: GeometryId[],
  outputPath: string,
): Promise<void> {
  const repository = new MemoryDrawingRepository();
  await repository.create({ ...document, annotations: [] });
  const application = new DrawingApplication({ repository });
  const observation = await application.observeForAgent({
    drawingId: document.id,
    includeAnnotations: false,
    selectedIds,
  });
  const overview = observation.views.find((view) => view.purpose === 'overview')
    ?? observation.views[0];
  const image = application.readObservationImage(overview.image.handle);
  if (!image) throw new Error('TEST2_REGION_RENDER_MISSING');
  await writeFile(outputPath, Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'));
}
