// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
  Vec2,
} from '@vectorai/drawing-core';
import type { MotionRigDefinition } from '@vectorai/drawing-edit-core';

export interface DrawingWorkspaceRef {
  drawingId: string;
  revision: number;
}

export interface DrawingSelectionProjection {
  selectionProjectionId: string;
  drawingRef: DrawingWorkspaceRef;
  nodeIds: string[];
  projectionDigest: string;
  expiresAt: number;
}

export type DrawingSelectionProjectionResult =
  | { status: 'projected'; projection: DrawingSelectionProjection }
  | { status: 'cleared' }
  | { status: 'stale'; currentRef: DrawingWorkspaceRef }
  | { status: 'rejected'; code: string; message: string };

export interface DrawingMotionRigProjection extends MotionRigDefinition {
  version: 1;
  drawingRef: DrawingWorkspaceRef;
  state: 'ready' | 'needs-correction';
  message?: string;
}

export interface DrawingMotionRigWorkspaceState {
  projection: DrawingMotionRigProjection;
  phase: 'ready' | 'dragging' | 'preview';
  message?: string;
}

export type DrawingMotionRigResult =
  | { status: 'ready'; projection: DrawingMotionRigProjection }
  | { status: 'needs-correction'; projection?: DrawingMotionRigProjection; message: string }
  | { status: 'stale'; currentRef: DrawingWorkspaceRef }
  | { status: 'rejected'; code: string; message: string };

export type DrawingMotionRigDiscardResult =
  | { status: 'discarded' }
  | { status: 'stale'; currentRef: DrawingWorkspaceRef }
  | { status: 'rejected'; code: string; message: string };

export interface DrawingGroundingOverlayInterface {
  interfaceId: string;
  nodeId: string;
  endpoint: 'start' | 'end';
}

export interface DrawingGroundingOverlayGroup {
  groundingId: string;
  partKey: string;
  label: string;
  role?: 'target' | 'reference';
  colorIndex: number;
  nodeIds: string[];
  interfaces: DrawingGroundingOverlayInterface[];
}

export interface DrawingGroundingOverlay {
  version: 1;
  drawingRef: DrawingWorkspaceRef;
  taskId: string;
  stateEpoch: number;
  disposition: 'active' | 'committed' | 'discarded' | 'failed';
  groups: DrawingGroundingOverlayGroup[];
}

export type DrawingSourceRef =
  | {
    id: string;
    mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    bytes?: number;
    width: number;
    height: number;
    name?: string;
  }
  | {
    id: string;
    mediaType: 'application/dxf';
    bytes?: number;
    name?: string;
  };

export interface DrawingSourceResource {
  url: string;
  dispose(): void;
}

export interface DrawingWorkspaceCapabilities {
  edit: boolean;
  delete: boolean;
  annotations: boolean;
  sourceUnderlay: boolean;
}

export interface DrawingWorkspaceSnapshot {
  version: 1;
  ref: DrawingWorkspaceRef;
  document: DrawingDocument;
  source?: DrawingSourceRef;
  capabilities: DrawingWorkspaceCapabilities;
  provisional?: boolean;
  lastCommit?: {
    commitId: string;
    mode: 'auto-safe' | 'confirmed' | 'interactive' | 'undo' | 'redo';
    undoable: boolean;
    redoable?: boolean;
  };
}

export type DrawingWorkspaceCommand =
  | { type: 'node.create'; plane: 'geometry'; node: GeometryNode }
  | { type: 'node.create'; plane: 'annotation'; node: AnnotationNode }
  | { type: 'node.create'; plane: 'relation'; node: DrawingRelation }
  | { type: 'node.create'; plane: 'feature'; node: SemanticFeature }
  | { type: 'node.update'; id: string; changes: Record<string, unknown>; expected: Record<string, unknown> }
  | { type: 'node.delete'; id: string }
  | { type: 'annotation.move-text'; id: string; position: Vec2; expectedPosition: Vec2 };

export interface DrawingWorkspaceCommitRequest {
  expectedRevision: number;
  commands: DrawingWorkspaceCommand[];
}

export type DrawingWorkspaceCommitResult =
  | { status: 'committed'; snapshot: DrawingWorkspaceSnapshot }
  | { status: 'conflict'; message: string; snapshot?: DrawingWorkspaceSnapshot }
  | { status: 'rejected'; message: string; code?: string };

export interface DrawingWorkspacePreviewDiff {
  createdNodeIds: string[];
  updatedNodeIds: string[];
  deletedNodeIds: string[];
}

export interface DrawingWorkspacePreview {
  version: 1;
  handle: string;
  baseRef: DrawingWorkspaceRef;
  commands: DrawingWorkspaceCommand[];
  candidate: DrawingWorkspaceSnapshot;
  diff: DrawingWorkspacePreviewDiff;
  createdAt: number;
  summary?: string;
}

export interface DrawingWorkspacePreviewCreateRequest {
  ref: DrawingWorkspaceRef;
  commands: DrawingWorkspaceCommand[];
  summary?: string;
}

export type DrawingWorkspacePreviewCreateResult =
  | { status: 'previewed'; preview: DrawingWorkspacePreview }
  | { status: 'conflict'; message: string; snapshot?: DrawingWorkspaceSnapshot }
  | { status: 'rejected'; message: string; code?: string };

export interface DrawingWorkspacePreviewControlRequest {
  handle: string;
}

export type DrawingWorkspacePreviewDiscardResult =
  | { status: 'discarded'; ref: DrawingWorkspaceRef }
  | { status: 'rejected'; message: string; code?: string };

export type DrawingInteractiveStageResult =
  | {
    status: 'staged';
    intentId: string;
    intentDigest: string;
    operationId: string;
    operationBindingDigest: string;
    commandLine: string;
  }
  | { status: 'conflict'; message: string; snapshot?: DrawingWorkspaceSnapshot }
  | { status: 'rejected'; message: string; code: string };

export interface DrawingUndoStageRequest {
  targetCommitId: string;
  expectedCurrentRef: DrawingWorkspaceRef;
}

export type DrawingUndoStageResult =
  | {
    status: 'staged';
    targetCommitId: string;
    expectedCurrentRef: DrawingWorkspaceRef;
    operationId: string;
    operationBindingDigest: string;
    commandLine: string;
  }
  | { status: 'rejected'; message: string; code: string };

export type DrawingRedoStageRequest = DrawingUndoStageRequest;
export type DrawingRedoStageResult = DrawingUndoStageResult;

export interface DrawingWorkspacePort {
  load(signal?: AbortSignal): Promise<DrawingWorkspaceSnapshot | null>;
  loadPreview?(signal?: AbortSignal): Promise<DrawingWorkspacePreview | null>;
  loadGroundingOverlay?(signal?: AbortSignal): Promise<DrawingGroundingOverlay | null>;
  loadMotionRig?(signal?: AbortSignal): Promise<DrawingMotionRigProjection | null>;
  rebuildMotionRig?(
    ref: DrawingWorkspaceRef,
    nodeIds: string[],
    signal?: AbortSignal,
  ): Promise<DrawingMotionRigResult>;
  discardMotionRig?(
    ref: DrawingWorkspaceRef,
    signal?: AbortSignal,
  ): Promise<DrawingMotionRigDiscardResult>;
  projectSelection?(
    ref: DrawingWorkspaceRef,
    nodeIds: string[],
    signal?: AbortSignal,
  ): Promise<DrawingSelectionProjectionResult>;
  commit(
    request: DrawingWorkspaceCommitRequest,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  undoLast?(
    snapshot: DrawingWorkspaceSnapshot,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  redoLast?(
    snapshot: DrawingWorkspaceSnapshot,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  loadSource?(
    source: DrawingSourceRef,
    signal?: AbortSignal,
  ): Promise<DrawingSourceResource>;
  subscribe?(listener: () => void): () => void;
}
