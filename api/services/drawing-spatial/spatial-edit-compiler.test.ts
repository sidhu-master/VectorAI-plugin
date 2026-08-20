import { describe, expect, it } from 'vitest';

import type {
  SemanticRegion,
  SpatialEditAuthorization,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import {
  previewTransaction,
  type DrawingDocument,
  type GeometryId,
  type RevisionId,
} from '../../../src/drawing/index.js';
import { materializeSpatialSplits } from './split-materializer.js';
import { compileSpatialEdit } from './spatial-edit-compiler.js';
import { routeSpatialEditStrategy } from './strategy-router.js';

const REVISION = 'revision_compile' as RevisionId;

describe('compileSpatialEdit', () => {
  it('does not attach design confidence to protected fragments created by a split', () => {
    const before = document();
    const selection = partialSelection();
    const split = materializeSpatialSplits({ document: before, selection });
    const candidate = compileSpatialEdit({
      document: before, selection, region: region(),
      strategy: routeSpatialEditStrategy({ document: before, region: region(), selection }),
      split, authorization: authorizationFor(selection),
      design: {
        kind: 'transform', transform: { kind: 'translate', offset: [0, 2] },
        confidence: 0.97, evidenceRefs: ['view'],
      },
    });
    const result = previewResult(before, candidate.commands);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    const createdProtected = split.lineage.find((entry) => (
      entry.role === 'protected' && entry.fragmentId !== 'shared_path'
    ));
    expect(result.resultingDocument.geometry.find((node) => node.id === createdProtected?.fragmentId)?.quality)
      .toEqual(split.fragments.find((node) => node.id === createdProtected?.fragmentId)?.quality);
  });

  it('compiles a deterministic transform only for the authorized whole node', () => {
    const before = document();
    const selection = wholeSelection();
    const candidate = compileSpatialEdit({
      document: before, selection, region: region(),
      strategy: routeSpatialEditStrategy({ document: before, region: region(), selection }),
      split: emptySplit(), authorization: authorizationFor(selection),
      design: {
        kind: 'transform', transform: { kind: 'translate', offset: [0, 5] },
        confidence: 0.96, evidenceRefs: ['view'],
      },
    });
    const result = previewResult(before, candidate.commands);

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.resultingDocument.geometry.find((node) => node.id === 'target_line'))
      .toMatchObject({ start: [10, 15], end: [20, 15] });
    expect(result.resultingDocument.geometry.find((node) => node.id === 'protected_line'))
      .toEqual(before.geometry.find((node) => node.id === 'protected_line'));
  });

  it('adds vectorized local-redraw geometry without changing existing nodes', () => {
    const before = document();
    const additiveRegion = region('add-new', 'generative-redraw');
    const selection = emptySelection(additiveRegion.id);
    const generated = line('generated_path', [5, 20], [25, 20]);
    const candidate = compileSpatialEdit({
      document: before, selection, region: additiveRegion,
      strategy: routeSpatialEditStrategy({ document: before, region: additiveRegion, selection }),
      split: emptySplit(), authorization: authorizationFor(selection),
      design: {
        kind: 'local-redraw', geometry: [generated], replaceTarget: false,
        confidence: 0.92, evidenceRefs: ['generated_source'],
      },
    });

    expect(candidate.commands).toEqual([
      { type: 'geometry.create', value: expect.objectContaining({ id: generated.id }) },
    ]);
    expect(Object.keys(candidate.preserveNodeHashes)).toHaveLength(before.geometry.length);
  });

  it('compiles exact new geometry from an additive replacement design with no selected source', () => {
    const before = document();
    const additiveRegion = region('add-new', 'geometric-edit');
    const selection = emptySelection(additiveRegion.id);
    const generated = line('new_exact_line', [5, 25], [25, 25]);
    const candidate = compileSpatialEdit({
      document: before, selection, region: additiveRegion,
      strategy: routeSpatialEditStrategy({ document: before, region: additiveRegion, selection }),
      split: emptySplit(), authorization: authorizationFor(selection),
      design: {
        kind: 'replacement', geometry: [generated], confidence: 0.98, evidenceRefs: ['view'],
      },
    });

    expect(candidate.commands).toEqual([
      { type: 'geometry.create', value: expect.objectContaining({ id: generated.id }) },
    ]);
    expect(candidate.targetNodeIds).toEqual([generated.id]);
  });

  it('rejects a selected target absent from deterministic authorization', () => {
    const before = document();
    const selection = wholeSelection();
    const authorization = authorizationFor(selection);
    authorization.editableTargetIds = [];

    expect(() => compileSpatialEdit({
      document: before, selection, region: region(),
      strategy: routeSpatialEditStrategy({ document: before, region: region(), selection }),
      split: emptySplit(), authorization,
      design: {
        kind: 'transform', transform: { kind: 'translate', offset: [0, 5] },
        confidence: 0.9, evidenceRefs: ['view'],
      },
    })).toThrow('SPATIAL_EDIT_UNAUTHORIZED_TARGET:node:target_line');
  });
});

function document(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_compile' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'shared_path' as GeometryId, type: 'polyline', closed: false,
      vertices: [[0, 0], [10, 0], [20, 0], [30, 0]].map((point) => ({ point: point as [number, number] })),
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }, line('target_line', [10, 10], [20, 10]), line('protected_line', [0, 30], [30, 30])],
    annotations: [], relations: [], features: [],
  };
}

function region(
  operation: SemanticRegion['operation'] = 'modify-existing',
  preferredEditMode: SemanticRegion['preferredEditMode'] = 'geometric-edit',
): SemanticRegion {
  return {
    id: 'region_compile', drawingId: 'drawing_compile' as DrawingDocument['id'], revision: REVISION,
    label: 'target component', operation, preferredEditMode,
    sourceViewIds: ['view'], maskHandle: 'mask',
    worldContours: [[[-5, -5], [35, -5], [35, 35], [-5, 35]]], worldHoles: [],
    anchors: [], confidence: 0.95, evidenceRefs: ['view'],
  };
}

function wholeSelection(): SpatialSelection {
  return {
    regionId: region().id, revision: REVISION,
    wholeNodes: ['target_line' as GeometryId], partialSegments: [], crossingNodes: [],
    protectedNodes: ['shared_path', 'protected_line'], boundaryAnchors: [],
    classifications: [], uncertainParts: [], splitPlan: [],
  };
}

function partialSelection(): SpatialSelection {
  return {
    regionId: region().id, revision: REVISION, wholeNodes: [],
    partialSegments: [{
      id: 'segment_middle', revision: REVISION, nodeId: 'shared_path' as GeometryId,
      kind: 'vertex-range', vertexRange: [1, 2], start: [10, 0], end: [20, 0],
      bounds: { minX: 10, minY: 0, maxX: 20, maxY: 0 }, adjacentSegmentIds: [],
    }],
    crossingNodes: ['shared_path' as GeometryId], protectedNodes: ['target_line', 'protected_line'],
    boundaryAnchors: [], classifications: [], uncertainParts: [],
    splitPlan: [{
      nodeId: 'shared_path' as GeometryId, revision: REVISION,
      ranges: [
        { range: [0, 1], role: 'protected' },
        { range: [1, 2], role: 'target' },
        { range: [2, 3], role: 'protected' },
      ],
      cutParameters: [1, 2],
    }],
  };
}

function emptySelection(regionId: string): SpatialSelection {
  return {
    regionId, revision: REVISION, wholeNodes: [], partialSegments: [], crossingNodes: [],
    protectedNodes: document().geometry.map((node) => node.id), boundaryAnchors: [],
    classifications: [], uncertainParts: [], splitPlan: [],
  };
}

function authorizationFor(selection: SpatialSelection): SpatialEditAuthorization {
  return {
    id: 'authorization_test', revision: selection.revision, regionId: selection.regionId,
    editableTargetIds: [
      ...selection.wholeNodes.map((id) => `node:${id}`),
      ...selection.partialSegments.map((segment) => segment.id),
    ],
    protectedTargetIds: selection.protectedNodes.map((id) => `node:${id}`),
    boundaryAnchorIds: selection.boundaryAnchors.map((anchor) => anchor.id),
    protectedHashes: {}, topologyResolutionId: 'topology_resolution_test',
    locality: {
      areaRatio: 0.1, widthRatio: 0.2, heightRatio: 0.3, targetCenterDistanceRatio: null,
      wholeNodes: selection.wholeNodes.length, crossingNodes: selection.crossingNodes.length,
      boundaryAnchors: selection.boundaryAnchors.length,
      candidateFragments: selection.wholeNodes.length + selection.partialSegments.length,
    },
  };
}

function emptySplit() {
  return { commands: [], fragments: [], lineage: [], fidelityWarnings: [] };
}

function line(id: string, start: [number, number], end: [number, number]) {
  return {
    id: id as GeometryId, type: 'line' as const, start, end, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
  };
}

function previewResult(documentValue: DrawingDocument, commands: Parameters<typeof previewTransaction>[1]['commands']) {
  return previewTransaction({ document: documentValue, currentRevision: REVISION }, {
    id: 'transaction_compile', baseRevision: REVISION,
    actor: { type: 'AI', id: 'test' }, commands,
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
  });
}
