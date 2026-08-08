import type { SpatialPatch } from '../patch/types';

export interface SpatialToolReceipt {
  toolCallId: string;
  toolName: string;
  status: 'success' | 'error' | 'cancelled';
  summary: string;
  durableFacts: Record<string, unknown>;
  transientSignals: Record<string, unknown>;
  patch?: SpatialPatch;
  validation?: { valid: boolean; errors: string[] };
  needReplan: boolean;
}
