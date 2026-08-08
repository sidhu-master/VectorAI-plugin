import type { AgentRunState } from '../../../src/core/runtime/state-machine.js';
import type { ObservationPatchBatch } from '../drawing-perception/build-patches.js';
import { RunProgressChannel } from './progress.js';
import type { AgentModelProfile, PreparedAgentAttachment } from './types.js';

export interface AgentRunRecord {
  state: AgentRunState;
  progress: RunProgressChannel;
  activeController: AbortController | null;
  completion: Promise<AgentRunState>;
  resolveCompletion: (state: AgentRunState) => void;
  auditQueue: Promise<void>;
  modelProfile: AgentModelProfile;
  referenceAttachment?: PreparedAgentAttachment;
  drawingBatches?: ObservationPatchBatch[];
}

export class AgentRunRegistry {
  private readonly records = new Map<string, AgentRunRecord>();

  add(runId: string, record: AgentRunRecord): void {
    if (this.records.has(runId)) throw new Error(`Agent run "${runId}" 已存在`);
    this.records.set(runId, record);
  }

  get(runId: string): AgentRunRecord | undefined {
    return this.records.get(runId);
  }

  require(runId: string): AgentRunRecord {
    const record = this.get(runId);
    if (!record) throw new Error(`Agent run "${runId}" 不存在`);
    return record;
  }
}
