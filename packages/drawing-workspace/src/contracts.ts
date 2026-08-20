// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, Vec2 } from '@vectorai/drawing-core';

export interface DrawingWorkspaceRef {
  drawingId: string;
  revision: number;
}

export interface DrawingSourceRef {
  id: string;
  mediaType: string;
  bytes?: number;
  width: number;
  height: number;
  name?: string;
}

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
}

export type DrawingWorkspaceCommand =
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

export interface DrawingWorkspacePort {
  load(signal?: AbortSignal): Promise<DrawingWorkspaceSnapshot | null>;
  commit(
    request: DrawingWorkspaceCommitRequest,
    signal?: AbortSignal,
  ): Promise<DrawingWorkspaceCommitResult>;
  loadSource?(
    source: DrawingSourceRef,
    signal?: AbortSignal,
  ): Promise<DrawingSourceResource>;
  subscribe?(listener: () => void): () => void;
}
