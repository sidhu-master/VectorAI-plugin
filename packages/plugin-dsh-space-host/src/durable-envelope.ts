// SPDX-License-Identifier: Apache-2.0

import type {
  Assessment,
  DrawingTransactionCommand,
  DurableOperationReceipt,
  ReviewEvidence,
} from '@vectorai/drawing-edit-protocol';

import type { DrawingEntry } from './repository';

export interface DrawingCommitRecord {
  commitId: string;
  mode: 'auto-safe' | 'confirmed' | 'interactive' | 'undo';
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
