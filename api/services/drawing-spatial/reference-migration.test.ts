import { describe, expect, it } from 'vitest';

import type {
  AnnotationId,
  DrawingDocument,
  FeatureId,
  GeometryId,
  RelationId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { SpatialSelection } from '../../../src/contracts/drawing-spatial-region.js';
import { materializeSpatialSplits } from './split-materializer.js';

describe('split reference migration', () => {
  it('migrates anchored dimensions and expands topology/semantic memberships', () => {
    const document = referencedDocument(false);
    const result = materializeSpatialSplits({ document, selection: selection() });
    const targetId = result.lineage.find((entry) => entry.role === 'target')!.fragmentId;
    const protectedId = result.lineage.find((entry) => entry.role === 'protected')!.fragmentId;
    const dimension = result.commands.find((command) => command.type === 'annotation.update');
    const topology = result.commands.find((command) => (
      command.type === 'relation.update' && command.id === 'relation_topology'
    ));
    const feature = result.commands.find((command) => command.type === 'feature.update');

    expect(protectedId).toBe('source');
    expect(dimension).toMatchObject({
      changes: {
        targets: [
          { geometryId: targetId, anchor: { kind: 'vertex', index: 1 } },
          { geometryId: 'source', anchor: { kind: 'vertex', index: 2 } },
        ],
      },
    });
    expect(topology).toMatchObject({ changes: { nodeIds: [targetId, 'source'] } });
    expect(feature).toMatchObject({ changes: { geometryIds: [targetId, 'source'] } });
  });

  it('blocks an unanchored geometric constraint instead of guessing ownership', () => {
    expect(() => materializeSpatialSplits({
      document: referencedDocument(true), selection: selection(),
    })).toThrow('SPLIT_REFERENCE_AMBIGUOUS:relation_constraint');
  });

  it('projects nearest-point dimension anchors onto the owning split fragment', () => {
    const document = referencedDocument(false);
    const dimension = document.annotations[0];
    if (dimension.type !== 'dimension') throw new Error('dimension fixture missing');
    dimension.targets[0] = {
      geometryId: 'source' as GeometryId,
      anchor: { kind: 'nearest', point: [5, 2] },
    };

    const result = materializeSpatialSplits({ document, selection: selection() });
    const targetId = result.lineage.find((entry) => entry.role === 'target')!.fragmentId;
    const update = result.commands.find((command) => command.type === 'annotation.update');

    expect(update).toMatchObject({
      changes: { targets: [
        { geometryId: targetId, anchor: { kind: 'nearest', point: [5, 2] } },
        { geometryId: 'source' },
      ] },
    });
  });

  it('keeps a center dimension on the stable protected analytic fragment', () => {
    const document = referencedDocument(false);
    document.geometry = [{
      id: 'source' as GeometryId, type: 'circle', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, center: [0, 0], radius: 10,
    }];
    const dimension = document.annotations[0];
    if (dimension.type !== 'dimension') throw new Error('dimension fixture missing');
    dimension.targets = [{
      geometryId: 'source' as GeometryId,
      anchor: { kind: 'center' },
    }];
    const splitSelection = selection();
    splitSelection.splitPlan[0].ranges = [
      { range: [0, 0.25], role: 'target' },
      { range: [0.25, 1], role: 'protected' },
    ];
    splitSelection.splitPlan[0].cutParameters = [0.25];

    const result = materializeSpatialSplits({ document, selection: splitSelection });
    const update = result.commands.find((command) => command.type === 'annotation.update');

    expect(update).toMatchObject({
      changes: { targets: [{ geometryId: 'source', anchor: { kind: 'center' } }] },
    });
  });
});

function referencedDocument(includeConstraint: boolean): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0',
    id: 'drawing_references' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'source' as GeometryId, type: 'polyline', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, closed: false,
      vertices: [0, 1, 2, 3, 4].map((value) => ({ point: [value * 10, 0] as const })),
    }],
    annotations: [{
      id: 'dimension_split' as AnnotationId, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'aligned', associationStatus: 'resolved',
      targets: [
        { geometryId: 'source' as GeometryId, anchor: { kind: 'vertex', index: 1 } },
        { geometryId: 'source' as GeometryId, anchor: { kind: 'vertex', index: 4 } },
      ],
      textPosition: [20, 5], definitionPoints: [[10, 0], [40, 0]],
    }],
    relations: [
      {
        id: 'relation_topology' as RelationId, type: 'topology', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        plane: 'topology', kind: 'connected', nodeIds: ['source'],
      },
      {
        id: 'relation_semantic' as RelationId, type: 'semantic', visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
        plane: 'semantic', kind: 'feature-member',
        featureId: 'feature_arm' as FeatureId, nodeIds: ['source'],
      },
      ...(includeConstraint ? [{
        id: 'relation_constraint' as RelationId, type: 'constraint' as const, visible: true,
        quality: { status: 'confirmed' as const, evidenceRefs: [] },
        plane: 'constraint' as const, kind: 'horizontal' as const,
        geometryIds: ['source' as GeometryId], status: 'satisfied' as const,
      }] : []),
    ],
    features: [{
      id: 'feature_arm' as FeatureId, type: 'feature', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, semanticType: 'arm',
      geometryIds: ['source' as GeometryId], annotationIds: [],
      relationIds: ['relation_semantic' as RelationId], properties: {},
    }],
  };
}

function selection(): SpatialSelection {
  const revision = 'revision_references' as RevisionId;
  return {
    regionId: 'region_references', revision,
    wholeNodes: [], partialSegments: [], crossingNodes: ['source' as GeometryId],
    protectedNodes: [], boundaryAnchors: [], classifications: [], uncertainParts: [],
    splitPlan: [{
      nodeId: 'source' as GeometryId, revision,
      ranges: [
        { range: [0, 2], role: 'target' },
        { range: [2, 4], role: 'protected' },
      ],
      cutParameters: [2],
    }],
  };
}
