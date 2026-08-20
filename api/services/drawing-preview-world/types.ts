import type {
  Bounds2D,
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { WorldModelSlice } from '../drawing-world-model/types.js';

export interface CounterfactualWorldDelta {
  changedNodeIds: string[];
  addedNodeIds: string[];
  updatedNodeIds: string[];
  deletedNodeIds: string[];
  unchangedNodeCount: number;
  beforeSourceSpanCount: number;
  afterSourceSpanCount: number;
  incidenceDelta: number;
  connectedDelta: number;
  diagnosticCodes: string[];
}

export interface CounterfactualWorldBranch {
  id: string;
  runId?: string;
  episodeId?: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  transactionDigest: string;
  affectedScope: {
    nodeIds: string[];
    bounds: Bounds2D;
  };
  beforeWorld: WorldModelSlice;
  afterWorld: WorldModelSlice;
  delta: CounterfactualWorldDelta;
  createdAt: number;
}

export interface CounterfactualWorldBranchSnapshot extends CounterfactualWorldBranch {
  beforeDocumentHandle: string;
  afterDocumentHandle: string;
}
