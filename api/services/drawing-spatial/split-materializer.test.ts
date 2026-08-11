import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  GeometryId,
  GeometryNode,
  RevisionId,
} from '../../../src/drawing/index.js';
import { previewTransaction } from '../../../src/drawing/index.js';
import type { SpatialSelection } from '../../../src/contracts/drawing-spatial-region.js';
import { buildAtomicGeometryGraph } from './atomic-graph.js';
import { polygonRegionBounds } from './polygon.js';
import { RegionResolver } from './region-resolver.js';
import { materializeSpatialSplits } from './split-materializer.js';
import {
  TEST2_REVISION,
  TEST2_SHARED_POLYLINE_ID,
  TEST2_SHARED_POLYLINE_POINTS,
  test2RightArmRegion,
  test2SharedPolylineDocument,
} from './test2-fixture.js';

describe('materializeSpatialSplits', () => {
  it('keeps test2 body on the original id and creates a target lower-arm fragment', () => {
    const document = test2SharedPolylineDocument();
    const region = test2RightArmRegion();
    const graph = buildAtomicGeometryGraph({
      document, revision: TEST2_REVISION,
      regionBounds: polygonRegionBounds(region.worldContours), padding: 2,
    });
    const selection = new RegionResolver().resolve({
      document, revision: TEST2_REVISION, region, graph, tolerance: 0.01,
    });

    const result = materializeSpatialSplits({ document, selection });
    const protectedFragment = result.fragments.find((node) => node.id === TEST2_SHARED_POLYLINE_ID);
    const targetLineage = result.lineage.find((entry) => entry.role === 'target');
    const targetFragment = result.fragments.find((node) => node.id === targetLineage?.fragmentId);

    expect(protectedFragment).toMatchObject({
      type: 'polyline',
      vertices: TEST2_SHARED_POLYLINE_POINTS.slice(3).map((point) => ({ point })),
    });
    expect(targetFragment).toMatchObject({
      type: 'polyline',
      vertices: TEST2_SHARED_POLYLINE_POINTS.slice(0, 4).map((point) => ({ point })),
    });
    expect(targetFragment?.id).not.toBe(TEST2_SHARED_POLYLINE_ID);
    expect(result.lineage.map((entry) => ({ range: entry.sourceRange, role: entry.role })))
      .toEqual([
        { range: [0, 3], role: 'target' },
        { range: [3, 4], role: 'protected' },
      ]);

    const preview = applyPreview(document, TEST2_REVISION, result.commands);
    expect(preview.status).toBe('ready');
    if (preview.status !== 'ready') return;
    expect(preview.resultingDocument.geometry.find((node) => (
      node.id === TEST2_SHARED_POLYLINE_ID
    ))).toEqual(protectedFragment);
  });

  it.each([
    ['line', line('source', [0, 0], [10, 0]), ['line', 'line']],
    ['arc', arc('source'), ['arc', 'arc']],
    ['circle', circle('source'), ['arc', 'arc']],
    ['ellipse', ellipse('source'), ['ellipse', 'ellipse']],
  ] as const)('splits %s into analytic fragments with complete lineage', (_name, geometry, types) => {
    const document = documentWith(geometry);
    const selection = splitSelection('source', 'revision_split', [
      { range: [0, 0.5], role: 'target' },
      { range: [0.5, 1], role: 'protected' },
    ]);

    const result = materializeSpatialSplits({ document, selection });

    expect(result.fragments.map((node) => node.type).sort()).toEqual([...types].sort());
    expect(result.lineage.map((entry) => entry.sourceRange)).toEqual([[0, 0.5], [0.5, 1]]);
    expect(result.fragments.some((node) => node.id === 'source')).toBe(true);
    expect(applyPreview(document, selection.revision, result.commands).status).toBe('ready');
  });

  it('falls back from an exact Spline slice to candidate Polylines with a fidelity warning', () => {
    const document = documentWith(spline('source'));
    const selection = splitSelection('source', 'revision_split', [
      { range: [0, 0.5], role: 'target' },
      { range: [0.5, 1], role: 'protected' },
    ]);

    const result = materializeSpatialSplits({ document, selection });

    expect(result.fragments.every((node) => node.type === 'polyline')).toBe(true);
    expect(result.fragments.every((node) => node.quality.status === 'candidate')).toBe(true);
    expect(result.fidelityWarnings).toContain('SPLINE_SPLIT_APPROXIMATED_AS_POLYLINE:source');
    expect(applyPreview(document, selection.revision, result.commands).status).toBe('ready');
  });
});

function applyPreview(document: DrawingDocument, revision: RevisionId, commands: ReturnType<typeof materializeSpatialSplits>['commands']) {
  return previewTransaction({ document, currentRevision: revision }, {
    id: 'transaction_split', baseRevision: revision,
    actor: { type: 'AI', id: 'test' }, commands,
    preconditions: [], postconditions: [{ type: 'document.valid' }], evidenceRefs: [],
  });
}

function splitSelection(
  nodeId: string,
  revision: string,
  ranges: SpatialSelection['splitPlan'][number]['ranges'],
): SpatialSelection {
  return {
    regionId: 'region_split', revision: revision as RevisionId,
    wholeNodes: [], partialSegments: [], crossingNodes: [nodeId as GeometryId],
    protectedNodes: [], boundaryAnchors: [], classifications: [], uncertainParts: [],
    splitPlan: [{
      nodeId: nodeId as GeometryId,
      revision: revision as RevisionId,
      ranges,
      cutParameters: ranges.slice(1).map((item) => item.range[0]),
    }],
  };
}

function documentWith(geometry: GeometryNode): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_split' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [geometry], annotations: [], relations: [], features: [],
  };
}

function common(id: string) {
  return {
    id: id as GeometryId, visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
  };
}

function line(id: string, start: readonly [number, number], end: readonly [number, number]): GeometryNode {
  return { ...common(id), type: 'line', start, end };
}

function arc(id: string): GeometryNode {
  return {
    ...common(id), type: 'arc', center: [0, 0], radius: 10,
    startAngle: 0, endAngle: 180, counterClockwise: true,
  };
}

function circle(id: string): GeometryNode {
  return { ...common(id), type: 'circle', center: [0, 0], radius: 10 };
}

function ellipse(id: string): GeometryNode {
  return { ...common(id), type: 'ellipse', center: [0, 0], majorAxis: [10, 0], ratio: 0.5 };
}

function spline(id: string): GeometryNode {
  return {
    ...common(id), type: 'spline', degree: 2,
    controlPoints: [[0, 0], [5, 10], [10, 0]], knots: [0, 0, 0, 1, 1, 1],
    closed: false, periodic: false,
  };
}
