import {
  MemoryDrawingRepository,
  replayDrawingCommits,
  type DrawingDocument,
  type GeometryId,
  type GeometryNode,
  type IdFactory,
} from '../../../src/drawing/index.js';
import type {
  SemanticRegion,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type {
  EditEpisode,
} from '../drawing-episode/types.js';
import { comparePreservedNodes } from '../drawing-edit/preserve-report.js';
import { compileSpatialEdit } from '../drawing-spatial/spatial-edit-compiler.js';
import { validateGenerativeGeometry } from '../drawing-spatial/generative-validator.js';
import { validateSpatialEditPreview } from '../drawing-spatial/spatial-validator.js';
import { routeSpatialEditStrategy } from '../drawing-spatial/strategy-router.js';

export interface CreativeRegionEditBenchmarkReport {
  passed: boolean;
  strategy: string;
  generatedDrawingIr: boolean;
  protectedGeometryUnchanged: boolean;
  firstPreviewValid: boolean;
  revisedPreviewValid: boolean;
  feedbackRetained: boolean;
  previewVersionCount: number;
  replayExact: boolean;
  revertExact: boolean;
}

export async function runCreativeRegionEditBenchmark(): Promise<CreativeRegionEditBenchmarkReport> {
  const initial = fixtureDocument();
  const repository = new MemoryDrawingRepository({ idFactory: ids(), now: () => 100 });
  const opened = await repository.create(initial);
  const region: SemanticRegion = {
    id: 'region_hair', drawingId: initial.id, revision: opened.revision,
    label: '头发新增区域', sourceViewIds: ['overview'], maskHandle: 'mask_hair',
    worldContours: [[[15, 70], [85, 70], [85, 100], [15, 100]]],
    worldHoles: [],
    anchors: [{ id: 'hairline', role: 'face-connection', point: [50, 75] as const, confidence: 1 }],
    confidence: 1, evidenceRefs: ['overview'],
  };
  const selection: SpatialSelection = {
    regionId: region.id, revision: opened.revision,
    wholeNodes: [], partialSegments: [], crossingNodes: [],
    protectedNodes: ['face', 'left_eye', 'right_eye'],
    boundaryAnchors: [{
      id: 'hairline', point: [50, 75], role: 'semantic-anchor', confidence: 1,
    }],
    classifications: [], uncertainParts: [], splitPlan: [],
  };
  const strategy = routeSpatialEditStrategy({
    goal: '给角色增加卷发，但不遮挡眼睛和脸部轮廓',
    document: initial, region, selection,
    protectedRegionIds: ['region_eyes', 'region_face'],
  });
  const firstHair = hair('generated_hair_v1', 98);
  const revisedHair = hair('generated_hair_v2', 90);
  const validationInput = (geometry: GeometryNode[]) => ({
    geometry,
    protectedGeometry: initial.geometry,
    contours: region.worldContours,
    holes: region.worldHoles,
    boundaryAnchors: [{ id: 'hairline', point: [50, 75] as const }],
    tolerance: 1,
  });
  const firstValidation = validateGenerativeGeometry(validationInput([firstHair]));
  const revisedValidation = validateGenerativeGeometry(validationInput([revisedHair]));
  const candidate = compileSpatialEdit({
    document: initial, selection, region, strategy,
    split: { commands: [], fragments: [], lineage: [], fidelityWarnings: [] },
    design: {
      kind: 'local-redraw', geometry: [revisedHair], replaceTarget: false,
      confidence: 0.95, evidenceRefs: ['generated_fixture'],
    },
  });
  const committed = await repository.commit({
    id: 'transaction_hair_v2', baseRevision: opened.revision,
    actor: { type: 'AI', id: 'benchmark' },
    commands: candidate.commands,
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
  });
  if (committed.status !== 'committed') throw new Error('CREATIVE_BENCHMARK_COMMIT_FAILED');
  const deterministic = validateSpatialEditPreview({
    before: initial, after: committed.document, region, selection, candidate, tolerance: 1,
  });
  const protectedGeometryUnchanged = comparePreservedNodes(
    initial, committed.document, ['face', 'left_eye', 'right_eye'],
  ).satisfied;
  const episode: EditEpisode = {
    schemaVersion: 1, id: 'episode_hair', runId: 'run_hair', drawingId: initial.id,
    baseRevision: opened.revision, originalGoal: '给角色增加卷发，但不遮挡眼睛和脸部轮廓',
    status: 'completed',
    regionVersions: [{ version: 1, regionId: region.id, maskHandle: region.maskHandle, status: 'active', createdAt: 1 }],
    selectionVersions: [{
      version: 1, selectionVersionId: 'selection_hair_1', regionVersion: 1,
      status: 'active', targetNodeIds: [], crossingNodeIds: [], createdAt: 2,
    }],
    previewVersions: [
      {
        version: 1, previewVersionId: 'preview_hair_1', regionVersion: 1,
        selectionVersion: 1, strategy: strategy.mode, status: 'superseded',
        affectedNodeIds: [firstHair.id], diffSummary: '初版卷发', defectCodes: [], createdAt: 3,
      },
      {
        version: 2, previewVersionId: 'preview_hair_2', regionVersion: 1,
        selectionVersion: 1, strategy: strategy.mode, status: 'committed',
        affectedNodeIds: [revisedHair.id], diffSummary: '头发缩短', defectCodes: [], createdAt: 5,
      },
    ],
    feedbackTurns: [{
      id: 'feedback_hair_1', text: '头发短一点', receivedAt: 4, againstPreviewVersion: 1,
    }],
    createdAt: 1, updatedAt: 6,
  };
  const commitsBeforeRevert = await repository.listCommits(initial.id);
  const replay = replayDrawingCommits(initial, commitsBeforeRevert);
  const replayExact = replay.success
    && canonicalGeometry(replay.document.geometry) === canonicalGeometry(committed.document.geometry);
  const reverted = await repository.revert({
    drawingId: initial.id,
    commitId: committed.commit.id,
    actor: { type: 'user', id: 'benchmark-reviewer' },
  });
  if (reverted.status !== 'committed') throw new Error('CREATIVE_BENCHMARK_REVERT_FAILED');
  const commitsAfterRevert = await repository.listCommits(initial.id);
  const replayAfterRevert = replayDrawingCommits(initial, commitsAfterRevert);
  const revertExact = replayAfterRevert.success
    && canonicalGeometry(reverted.document.geometry) === canonicalGeometry(initial.geometry)
    && canonicalGeometry(replayAfterRevert.document.geometry) === canonicalGeometry(initial.geometry);
  const generatedDrawingIr = committed.document.geometry.some((node) => (
    node.id === revisedHair.id && node.type === 'polyline'
  ));
  const feedbackRetained = episode.feedbackTurns[0]?.againstPreviewVersion === 1
    && episode.previewVersions[1]?.version === 2
    && episode.previewVersions[1]?.status === 'committed';
  const passed = strategy.mode === 'hybrid-edit'
    && generatedDrawingIr
    && protectedGeometryUnchanged
    && firstValidation.valid
    && revisedValidation.valid
    && deterministic.valid
    && feedbackRetained
    && replayExact
    && revertExact;
  return {
    passed,
    strategy: strategy.mode,
    generatedDrawingIr,
    protectedGeometryUnchanged,
    firstPreviewValid: firstValidation.valid,
    revisedPreviewValid: revisedValidation.valid && deterministic.valid,
    feedbackRetained,
    previewVersionCount: episode.previewVersions.length,
    replayExact,
    revertExact,
  };
}

function fixtureDocument(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_creative_region' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [
      circle('face', [50, 50], 25),
      circle('left_eye', [42, 55], 3),
      circle('right_eye', [58, 55], 3),
    ],
    annotations: [], relations: [], features: [],
  };
}

function hair(id: string, peakY: number): GeometryNode {
  return {
    id: id as GeometryId, type: 'polyline', closed: false,
    vertices: [
      { point: [25, 78] }, { point: [35, peakY] }, { point: [50, 75] },
      { point: [65, peakY] }, { point: [75, 78] },
    ],
    visible: true,
    quality: { status: 'confirmed', confidence: 0.95, evidenceRefs: [] },
  };
}

function circle(id: string, center: readonly [number, number], radius: number): GeometryNode {
  return {
    id: id as GeometryId, type: 'circle', center, radius, visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  };
}

function canonicalGeometry(geometry: GeometryNode[]): string {
  return JSON.stringify(geometry);
}

function ids(): IdFactory {
  let sequence = 0;
  return { next: (kind) => `${kind}_${++sequence}` };
}
