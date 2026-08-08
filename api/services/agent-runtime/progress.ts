export type AgentProgressEventType =
  | 'accepted'
  | 'planning'
  | 'tool_started'
  | 'tool_finished'
  | 'validation'
  | 'commit'
  | 'heartbeat'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'completed'
  | 'failed';

export interface AgentProgressEvent {
  id: string;
  runId: string;
  type: AgentProgressEventType;
  title: string;
  detail?: string;
  timestamp: number;
  elapsedMs: number;
}

type ProgressListener = (event: AgentProgressEvent) => void;

const TERMINAL_TYPES = new Set<AgentProgressEventType>(['stopped', 'completed', 'failed']);

export class RunProgressChannel {
  private readonly listeners = new Set<ProgressListener>();
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

  publish(type: AgentProgressEventType, title: string, detail?: string): AgentProgressEvent {
    this.clearHeartbeat();
    const timestamp = this.now();
    const event: AgentProgressEvent = {
      id: `${this.runId}_${++this.sequence}`,
      runId: this.runId,
      type,
      title,
      detail,
      timestamp,
      elapsedMs: Math.max(0, timestamp - this.startedAt),
    };
    this.latest = event;
    for (const listener of this.listeners) listener(event);

    this.terminal = TERMINAL_TYPES.has(type);
    if (!this.terminal) this.scheduleHeartbeat();
    return event;
  }

  latestEvent(): AgentProgressEvent | null {
    return this.latest;
  }

  close(): void {
    this.terminal = true;
    this.clearHeartbeat();
    this.listeners.clear();
  }

  private scheduleHeartbeat(): void {
    this.heartbeatTimer = setTimeout(() => {
      this.publish('heartbeat', '任务仍在处理中', `已运行 ${Math.floor((this.now() - this.startedAt) / 1000)} 秒`);
    }, this.heartbeatMs);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
