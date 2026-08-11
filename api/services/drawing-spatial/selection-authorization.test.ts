import { describe, expect, it } from 'vitest';

import type {
  LocalityMetrics,
  SelectionProofProposal,
  SpatialSelection,
} from '../../../src/contracts/drawing-spatial-region.js';
import type { DrawingDocument, GeometryId } from '../../../src/drawing/index.js';
import { buildAtomicGeometryGraph } from './atomic-graph.js';
import { polygonRegionBounds } from './polygon.js';
import { RegionResolver } from './region-resolver.js';
import {
  authorizeSelection,
  buildSelectionCandidateSet,
  renderSelectionProofView,
} from './selection-authorization.js';
import {
  TEST2_REVISION,
  TEST2_SHARED_POLYLINE_ID,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

const locality: LocalityMetrics = {
  areaRatio: 0.05, widthRatio: 0.2, heightRatio: 0.25,
  targetCenterDistanceRatio: 0.01,
  wholeNodes: 2, crossingNodes: 1, boundaryAnchors: 1, candidateFragments: 5,
};

describe('fragment selection authorization', () => {
  it('keeps perfectly overlapping source nodes as independently authorized candidates', () => {
    const document = overlappingDocument();
    const rawSelection: SpatialSelection = {
      regionId: 'region_overlap', revision: TEST2_REVISION,
      wholeNodes: ['foreground', 'background'] as GeometryId[],
      partialSegments: [], crossingNodes: [], protectedNodes: [], boundaryAnchors: [],
      classifications: [], uncertainParts: [], splitPlan: [],
    };
    const graph = buildAtomicGeometryGraph({
      document, revision: TEST2_REVISION,
      regionBounds: { minX: -1, minY: -1, maxX: 101, maxY: 1 },
    });
    const candidates = buildSelectionCandidateSet({ document, selection: rawSelection, graph });

    expect(candidates.candidates.map((candidate) => candidate.fragmentId)).toEqual([
      'node:foreground', 'node:background',
    ]);

    const result = authorizeSelection({
      document,
      rawSelection,
      candidates,
      proof: proof(['node:foreground']),
      locality,
      maxEditableFragments: 8,
    });

    expect(result.selection.wholeNodes).toEqual(['foreground']);
    expect(result.selection.protectedNodes).toContain('background');
    expect(result.authorization.editableFragmentIds).toEqual(['node:foreground']);
    expect(result.authorization.protectedFragmentIds).toContain('node:background');
  });

  it('authorizes only the arm ranges of a polyline shared with the protected body', () => {
    const { document, selection, graph } = test2Selection();
    const candidates = buildSelectionCandidateSet({ document, selection, graph });
    const sharedArmIds = candidates.candidates
      .filter((candidate) => candidate.sourceNodeId === TEST2_SHARED_POLYLINE_ID)
      .filter((candidate) => candidate.sourceRange && candidate.sourceRange[1] <= 3)
      .map((candidate) => candidate.fragmentId);
    const handId = 'node:node_test2_hand_outline';

    const result = authorizeSelection({
      document,
      rawSelection: selection,
      candidates,
      proof: proof([...sharedArmIds, handId], selection.boundaryAnchors.map((anchor) => anchor.id)),
      locality,
      maxEditableFragments: 12,
    });

    expect(sharedArmIds).toHaveLength(3);
    expect(result.selection.wholeNodes).toEqual(['node_test2_hand_outline']);
    expect(result.selection.crossingNodes).toEqual([TEST2_SHARED_POLYLINE_ID]);
    expect(result.selection.splitPlan).toEqual([expect.objectContaining({
      nodeId: TEST2_SHARED_POLYLINE_ID,
      ranges: [
        { range: [0, 3], role: 'target' },
        { range: [3, 4], role: 'protected' },
      ],
    })]);
    expect(result.selection.boundaryAnchors).toHaveLength(1);
    expect(Object.keys(result.authorization.protectedHashes)
      .some((key) => key.startsWith(`${TEST2_SHARED_POLYLINE_ID}:`))).toBe(true);
  });

  it('rejects unknown and over-budget fragment selections before materialization', () => {
    const { document, selection, graph } = test2Selection();
    const candidates = buildSelectionCandidateSet({ document, selection, graph });

    expect(() => authorizeSelection({
      document, rawSelection: selection, candidates,
      proof: proof(['fragment_invented']), locality, maxEditableFragments: 12,
    })).toThrow('SELECTION_FRAGMENT_UNKNOWN:fragment_invented');

    expect(() => authorizeSelection({
      document, rawSelection: selection, candidates,
      proof: proof(candidates.candidates.slice(0, 2).map((candidate) => candidate.fragmentId)),
      locality, maxEditableFragments: 1,
    })).toThrow('SELECTION_FRAGMENT_BUDGET_EXCEEDED');
  });

  it('renders a stable color-mapped proof PNG for exact candidate ids', async () => {
    const { document, selection, graph } = test2Selection();
    const candidates = buildSelectionCandidateSet({ document, selection, graph });

    const first = await renderSelectionProofView({ document, candidates });
    const second = await renderSelectionProofView({ document, candidates });

    expect(first.imageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(first.mapping[0]).toMatchObject({
      label: 'F001', fragmentId: expect.any(String), sourceNodeId: expect.any(String),
      rgb: [expect.any(Number), expect.any(Number), expect.any(Number)],
    });
    expect(first.id).toBe(second.id);
    expect(first.mapping.map((item) => item.fragmentId))
      .toEqual(second.mapping.map((item) => item.fragmentId));
    expect(new Set(first.mapping.map((item) => item.rgb.join(','))).size).toBeGreaterThan(1);
  });
});

function test2Selection() {
  const document = test2SharedPolylineDocument();
  const region = test2RightArmRegion();
  const graph = buildAtomicGeometryGraph({
    document,
    revision: TEST2_REVISION,
    regionBounds: polygonRegionBounds(region.worldContours),
    padding: 2,
  });
  const selection = new RegionResolver().resolve({
    document, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
  });
  return { document, region, graph, selection };
}

function proof(editableFragmentIds: string[], anchorIds: string[] = []): SelectionProofProposal {
  return {
    editableFragmentIds,
    anchorIds,
    evidence: editableFragmentIds.map((fragmentId) => ({
      fragmentId, reason: '属于右臂闭合轮廓', confidence: 0.95,
    })),
    confidence: 0.95,
  };
}

function overlappingDocument(): DrawingDocument {
  const line = (id: string) => ({
    id: id as GeometryId,
    type: 'line' as const,
    start: [0, 0] as const,
    end: [100, 0] as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
  });
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_overlap' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [line('foreground'), line('background')],
    annotations: [], relations: [], features: [],
  };
}
