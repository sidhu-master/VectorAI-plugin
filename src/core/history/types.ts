import type { SpatialPatch } from '../patch/types';
import type { SpatialModel } from '../types';

export interface SpatialCommit {
  id: string;
  runId: string;
  parentCommitId?: string;
  stepId: string;
  source: 'AI' | 'user' | 'system';
  patch: SpatialPatch;
  inversePatch: SpatialPatch;
  validation: { valid: true; errors: [] };
  confidence?: number;
  timestamp: number;
}

export interface SpatialHistory {
  model: SpatialModel;
  commits: SpatialCommit[];
  cursor: number;
}

export interface CommitPatchInput {
  id: string;
  runId: string;
  stepId: string;
  source: SpatialCommit['source'];
  patch: SpatialPatch;
  confidence?: number;
  timestamp: number;
}
