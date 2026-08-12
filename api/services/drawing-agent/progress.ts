import type {
  DrawingAgentCanvasOverlay,
  DrawingAgentProgressEvent,
  DrawingAgentProgressEventType,
  PerceptionPreviewDelta,
} from '../../../src/contracts/drawing-agent.js';

export type AgentProgressEventType = DrawingAgentProgressEventType;
export type AgentProgressEvent = DrawingAgentProgressEvent;

type ProgressListener = (event: AgentProgressEvent) => void;

export interface AgentProgressMetadata {
  candidateAttempt?: number;
  maxCandidateAttempts?: number;
  overlay?: DrawingAgentCanvasOverlay;
}

const TERMINAL_TYPES = new Set<AgentProgressEventType>(['stopped', 'completed', 'failed']);

export class RunProgressChannel {
  private static readonly MAX_REPLAY_EVENTS = 2_000;
  private readonly listeners = new Set<ProgressListener>();
  private readonly history: AgentProgressEvent[] = [];
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private sequence = 0;
  private terminal = false;
  private latest: AgentProgressEvent | null = null;

  constructor(
    private readonly runId: string,
    private readonly startedAt: number,
    private readonly heartbeatMs = 25_000,
    private readonly now: () => number = Date.now,
  ) {}

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(
    type: AgentProgressEventType,
    title: string,
    detail?: string,
    perceptionDelta?: PerceptionPreviewDelta,
    metadata?: AgentProgressMetadata,
  ): AgentProgressEvent {
    this.clearHeartbeat();
    const timestamp = this.now();
    const event: AgentProgressEvent = {
      id: `${this.runId}_${++this.sequence}`,
      runId: this.runId,
      type,
      title,
      ...(detail === undefined ? {} : { detail }),
      ...(perceptionDelta === undefined
        ? {}
        : { perceptionDelta: structuredClone(perceptionDelta) }),
      ...(metadata?.candidateAttempt === undefined
        ? {}
        : { candidateAttempt: metadata.candidateAttempt }),
      ...(metadata?.maxCandidateAttempts === undefined
        ? {}
        : { maxCandidateAttempts: metadata.maxCandidateAttempts }),
      ...(metadata?.overlay === undefined
        ? {}
        : { overlay: structuredClone(metadata.overlay) }),
      timestamp,
      elapsedMs: Math.max(0, timestamp - this.startedAt),
    };
    this.latest = event;
    this.history.push(event);
    if (this.history.length > RunProgressChannel.MAX_REPLAY_EVENTS) this.history.shift();
    for (const listener of this.listeners) listener(event);
    this.terminal = TERMINAL_TYPES.has(type);
    if (!this.terminal) this.scheduleHeartbeat();
    return event;
  }

  latestEvent(): AgentProgressEvent | null { return this.latest; }
  events(): AgentProgressEvent[] { return [...this.history]; }

  close(): void {
    this.terminal = true;
    this.clearHeartbeat();
    this.listeners.clear();
  }

  private scheduleHeartbeat(): void {
    this.heartbeatTimer = setTimeout(() => {
      this.publish(
        'heartbeat',
        '任务仍在处理中',
        `已运行 ${Math.floor((this.now() - this.startedAt) / 1000)} 秒`,
      );
    }, this.heartbeatMs);
    (this.heartbeatTimer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
