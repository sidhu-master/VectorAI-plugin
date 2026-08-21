// SPDX-License-Identifier: Apache-2.0

import type { DrawingId, GeometryId, RevisionId, Vec2 } from '@vectorai/drawing-core';
import type { SpatialBounds2D } from './query';

export type SemanticAnchorRole = 'target-seed' | 'boundary' | 'required' | 'protected-seed';

export interface SemanticAnchor {
  id: string;
  role: SemanticAnchorRole;
  point: Vec2;
  confidence: number;
}

export interface AtomicSegmentRef {
  id: string;
  revision: RevisionId;
  nodeId: GeometryId;
  kind: 'whole-node' | 'vertex-range' | 'parameter-range';
  vertexRange?: readonly [number, number];
  parameterRange?: readonly [number, number];
  start: Vec2;
  end: Vec2;
  bounds: SpatialBounds2D;
  adjacentSegmentIds: string[];
}

export interface SpatialBoundaryAnchor {
  id: string;
  role: 'entry' | 'exit' | 'shared-boundary' | 'semantic-anchor';
  point: Vec2;
  targetSegmentId?: string;
  protectedSegmentId?: string;
  confidence: number;
}

export type SpatialSelectionClassification = 'inside' | 'outside' | 'crossing' | 'shared-boundary' | 'uncertain';

export interface SelectionCandidate {
  nodeId: GeometryId;
  segmentId?: string;
  classification: SpatialSelectionClassification;
  confidence: number;
  evidenceRefs: string[];
}

export interface VirtualSplitRange {
  range: readonly [number, number];
  role: 'target' | 'protected';
}

export interface VirtualSplitPlan {
  nodeId: GeometryId;
  revision: RevisionId;
  ranges: VirtualSplitRange[];
  cutParameters: number[];
}

export interface SpatialSelection {
  regionId: string;
  revision: RevisionId;
  wholeNodes: GeometryId[];
  partialSegments: AtomicSegmentRef[];
  crossingNodes: GeometryId[];
  protectedNodes: string[];
  boundaryAnchors: SpatialBoundaryAnchor[];
  classifications: SelectionCandidate[];
  uncertainParts: SelectionCandidate[];
  splitPlan: VirtualSplitPlan[];
}

export interface SemanticRegion {
  id: string;
  drawingId: DrawingId;
  revision: RevisionId;
  label: string;
  operation: 'modify-existing' | 'add-new' | 'replace-existing';
  preferredEditMode: 'geometric-edit' | 'generative-redraw' | 'hybrid-edit';
  sourceViewIds: string[];
  maskHandle: string;
  worldContours: Vec2[][];
  worldHoles: Vec2[][];
  anchors: SemanticAnchor[];
  confidence: number;
  evidenceRefs: string[];
}
