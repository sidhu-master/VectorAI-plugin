import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { EditIntent } from '../src/contracts/drawing-spatial-agent.js';
import {
  applyDrawingPatch,
  MemoryDrawingRepository,
  type DrawingDocument,
  type GeometryId,
} from '../src/drawing/index.js';
import { FileDrawingAgentAuditStore } from '../api/services/drawing-agent/file-audit-store.js';
import { DrawingApplication } from '../api/services/drawing-application/application.js';
import { FileDrawingRepository } from '../api/services/drawing-application/file-drawing-repository.js';
import { compileEditIntent } from '../api/services/drawing-edit/compile-intent.js';
import { comparePreservedNodes } from '../api/services/drawing-edit/preserve-report.js';

const drawingId = process.argv[2];
const semanticRunId = process.argv[3];
if (!drawingId || !semanticRunId) {
  throw new Error('USAGE: tsx scripts/test2-self-semantic-edit.ts <drawingId> <semanticRunId>');
}

const drawingRoot = resolve(process.cwd(), '.local/vectorai/drawings');
const auditRoot = resolve(process.cwd(), '.local/vectorai/runs');
const outputRoot = resolve(process.cwd(), '.local/vectorai/baselines/test2-semantic-edit');
const sourceRepository = new FileDrawingRepository({ rootDirectory: drawingRoot });
const source = await sourceRepository.getCurrent(drawingId as never);
const audit = await new FileDrawingAgentAuditStore({ rootDirectory: auditRoot }).readRun(semanticRunId);
if (audit.manifest.drawingId !== drawingId) throw new Error('SELF_EDIT_DRAWING_RUN_MISMATCH');
await mkdir(outputRoot, { recursive: true });
const modelImagePath = resolve(outputRoot, 'model-edit-geometry.png');
await renderGeometry(source.document, [], modelImagePath);

let baseline = structuredClone(source.document);
for (const commit of [...audit.commits].reverse()) {
  const reverted = applyDrawingPatch(baseline, commit.inversePatch);
  if (!reverted.success) throw new Error(`SELF_EDIT_REVERT_FAILED:${commit.id}`);
  baseline = reverted.document;
}

const targetNodeIds = [
  'node_vec_c4deca597c5f861f3f5d',
  'node_vec_5eb3fbda138e8ac1789c',
  'node_vec_67b6a2bc2120c6e6a072',
] as GeometryId[];
const shoulderNodeId = 'node_vec_55e78541e9074bee6047' as GeometryId;
const armLine = baseline.geometry.find((node) => node.id === targetNodeIds[0]);
if (!armLine || armLine.type !== 'line') throw new Error('SELF_EDIT_TEST2_ARM_LINE_MISSING');
const pivot = armLine.end;
const intent: EditIntent = {
  operation: 'transform',
  targetFeatureIds: ['test2_character_right_arm'],
  targetNodeIds,
  anchors: [{ nodeId: armLine.id, role: 'shoulder_connection', point: pivot }],
  preserveNodeIds: baseline.geometry
    .filter((node) => !targetNodeIds.includes(node.id))
    .map((node) => node.id),
  preserveRules: [
    { type: 'outside-target-unchanged' },
    { type: 'maintain-connectivity', nodeIds: [armLine.id, shoulderNodeId] },
  ],
  desiredRelations: [{ type: 'connected', from: armLine.id, to: shoulderNodeId }],
  transform: { kind: 'rotate', center: pivot, angleDegrees: -90 },
  confidence: 0.99,
  evidenceRefs: [],
};
const compiled = compileEditIntent(intent, { document: baseline });
const memory = new MemoryDrawingRepository();
const created = await memory.create(baseline);
const application = new DrawingApplication({ repository: memory });
const transaction = {
  id: 'transaction_test2_self_edit',
  baseRevision: created.revision,
  actor: { type: 'AI' as const, id: 'codex-self-test' },
  commands: compiled.commands,
  preconditions: [],
  postconditions: [{ type: 'document.valid' as const }],
  evidenceRefs: [],
};
const preview = await application.preview({ drawingId: baseline.id, transaction });
if (preview.status !== 'ready') throw new Error(`SELF_EDIT_PREVIEW_${preview.status}`);
const committed = await application.execute({ drawingId: baseline.id, transaction });
if (committed.status !== 'committed') throw new Error(`SELF_EDIT_COMMIT_${committed.status}`);
const preserve = comparePreservedNodes(baseline, committed.document, compiled.preserveNodeIds);
if (!preserve.satisfied) throw new Error('SELF_EDIT_PRESERVE_FAILED');

const imagePath = resolve(outputRoot, 'self-edit-geometry.png');
const renderingRevision = await renderGeometry(committed.document, targetNodeIds, imagePath);
const reportPath = resolve(outputRoot, 'self-edit-report.json');
const report = {
  prompt: '把图中人物的右手抬起来打招呼，保持身体、头部、左手和其他图形不变，并保持手臂与身体连接',
  sourceDrawingId: drawingId,
  sourceSemanticRunId: semanticRunId,
  baselineRevision: audit.manifest.baseRevision,
  renderingRevision,
  targetNodeIds,
  pivot,
  transform: intent.transform,
  strategy: compiled.strategy,
  commandCount: compiled.commands.length,
  preservedNodeCount: compiled.preserveNodeIds.length,
  preserveSatisfied: preserve.satisfied,
  previewValid: preview.preview.validationReport.valid,
  modelImagePath,
  imagePath,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`);

async function renderGeometry(
  document: DrawingDocument,
  selectedIds: GeometryId[],
  outputPath: string,
): Promise<string> {
  const geometryOnly: DrawingDocument = { ...document, annotations: [] };
  const repository = new MemoryDrawingRepository();
  const rendering = await repository.create(geometryOnly);
  const application = new DrawingApplication({ repository });
  const observation = await application.observeForAgent({
    drawingId: geometryOnly.id,
    includeAnnotations: false,
    selectedIds,
  });
  const overview = observation.views.find((view) => view.purpose === 'overview')
    ?? observation.views[0];
  const image = application.readObservationImage(overview.image.handle);
  if (!image) throw new Error('SELF_EDIT_RENDER_MISSING');
  await writeFile(outputPath, Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'));
  return rendering.revision;
}
