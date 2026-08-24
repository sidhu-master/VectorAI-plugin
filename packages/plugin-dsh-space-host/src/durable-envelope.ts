// SPDX-License-Identifier: Apache-2.0

import type {
  Assessment,
  DrawingTransactionCommand,
  DurableOperationReceipt,
  ReviewEvidence,
} from '@vectorai/drawing-edit-protocol';
import type { SpatialSolverReceipt } from '@vectorai/drawing-edit-core';

import type { DrawingEntry } from './repository';

export interface DrawingSolverProvenance {
  solverVersion: 'spatial-intent-solver-0.1.0';
  canonicalIntentDigest: string;
  selectedPartScopeDigests: Record<string, string>;
  numericEvidenceDigests: string[];
  receipt: SpatialSolverReceipt;
}

export interface DrawingCommitRecord {
  commitId: string;
  mode: 'auto-safe' | 'confirmed' | 'interactive' | 'undo' | 'redo';
  operationId: string;
  operationBindingDigest: string;
  parentRevision: number;
  resultingRevision: number;
  forward: DrawingTransactionCommand[];
  inverse: DrawingTransactionCommand[];
  semanticDigest: string;
  snapshotIntegrityDigest: string;
  candidateDigest?: string;
  targetCommitId?: string;
  assessment?: Assessment;
  reviewEvidence?: ReviewEvidence;
  solverProvenance?: DrawingSolverProvenance;
  committedAt: number;
}

export interface DrawingDurableState {
  version: 2;
  entry: DrawingEntry;
  commits: DrawingCommitRecord[];
  operations: DurableOperationReceipt[];
}

export interface DurableDrawingRepositoryStorage {
  loadDurable(sessionId: string): DrawingDurableState | null;
  saveDurable(sessionId: string, state: DrawingDurableState): void;
}
