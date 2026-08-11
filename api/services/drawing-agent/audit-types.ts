import type { GoalSpec } from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingCommit,
  DrawingId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { DrawingAgentModelProfile } from './types.js';

export type DrawingAgentAuditEventType =
  | 'instruction'
  | 'plan'
  | 'decision'
  | 'model'
  | 'tool_call'
  | 'cv_tool'
  | 'preview'
  | 'validation'
  | 'observation'
  | 'grounding'
  | 'region'
  | 'atomic_graph'
  | 'selection'
  | 'strategy'
  | 'generation'
  | 'split'
  | 'lineage'
  | 'episode'
  | 'intent'
  | 'verification'
  | 'commit'
  | 'replan'
  | 'perception'
  | 'state';

export interface DrawingAgentAuditManifest {
  schemaVersion: 1;
  runId: string;
  drawingId: DrawingId;
  baseRevision: RevisionId;
  startedAt: number;
  drawingProtocolVersion: string;
  commandSchemaVersion: string;
  toolSchemaVersion: string;
  promptHashes: { planner: string; decision: string };
  modelProfile: DrawingAgentModelProfile;
  goalSpec: GoalSpec | null;
}

export interface DrawingAgentAuditEvent {
  schemaVersion: 1;
  id: string;
  runId: string;
  type: DrawingAgentAuditEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  timing?: {
    modelMs?: number;
    toolMs?: number;
    validationMs?: number;
    persistMs?: number;
  };
}

export interface DrawingAgentAuditRun {
  manifest: DrawingAgentAuditManifest;
  events: DrawingAgentAuditEvent[];
  commits: DrawingCommit[];
}

export interface DrawingAgentAuditStore {
  startRun(manifest: DrawingAgentAuditManifest): Promise<void>;
  updateManifest(manifest: DrawingAgentAuditManifest): Promise<void>;
  appendEvent(event: DrawingAgentAuditEvent): Promise<void>;
  saveCommit(runId: string, commit: DrawingCommit): Promise<void>;
  readRun(runId: string): Promise<DrawingAgentAuditRun>;
}
