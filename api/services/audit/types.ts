import type { SpatialCommit } from '../../../src/core/history/types.js';
import type { SpatialModel } from '../../../src/core/types.js';

export interface AuditTiming {
  queuedMs?: number;
  modelMs?: number;
  toolMs?: number;
  validationMs?: number;
  persistMs?: number;
}

export interface AuditEvent {
  id: string;
  runId: string;
  type: string;
  timestamp: number;
  payload: Record<string, unknown>;
  timing?: AuditTiming;
}

export interface AuditRunManifest {
  runId: string;
  startedAt: number;
  protocolVersion: string;
  [key: string]: unknown;
}

export interface AuditStore {
  startRun(manifest: AuditRunManifest): Promise<void>;
  appendEvent(event: AuditEvent): Promise<void>;
  saveCommit(commit: SpatialCommit): Promise<void>;
  finishRun(runId: string, model: SpatialModel): Promise<void>;
  readEvents(runId: string): Promise<AuditEvent[]>;
}
