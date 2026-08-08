import type { AgentRunState } from '@/core/runtime/state-machine';
import type { SpatialModel } from '@/core/types';

export type AgentProgressEventType =
  | 'accepted'
  | 'planning'
  | 'model_started'
  | 'model_finished'
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

export interface AgentModelEventDetail {
  role: 'planner' | 'executor' | 'repair';
  model: string;
  attempt: number;
  durationMs?: number;
  status?: 'success' | 'aborted' | 'failed';
}

export interface AgentProgressEvent {
  id: string;
  runId: string;
  type: AgentProgressEventType;
  title: string;
  detail?: string | AgentModelEventDetail;
  timestamp: number;
  elapsedMs: number;
}

export interface StartAgentInput {
  goal: string;
  spatialModel: SpatialModel;
  stableRules?: string[];
  image?: string;
  mimeType?: string;
  models?: {
    planner?: string;
    vision?: string;
    executor?: string;
    repair?: string;
  };
}

export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type EventSourceFactory = (url: string) => EventSourceLike;

export interface AgentClientOptions {
  fetcher?: Fetcher;
  eventSourceFactory?: EventSourceFactory;
}

const TERMINAL_EVENTS = new Set<AgentProgressEventType>(['stopped', 'completed', 'failed']);

export class AgentClient {
  private readonly fetcher: Fetcher;
  private readonly eventSourceFactory: EventSourceFactory;

  constructor(options: AgentClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch.bind(globalThis);
    this.eventSourceFactory = options.eventSourceFactory
      ?? ((url) => new EventSource(url));
  }

  async start(input: StartAgentInput): Promise<{ runId: string }> {
    const data = await this.request<{ success: true; runId: string }>('/api/agent/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!data.runId) throw new Error('Agent 启动响应缺少 runId');
    return { runId: data.runId };
  }

  subscribe(
    runId: string,
    onEvent: (event: AgentProgressEvent) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const source = this.eventSourceFactory(`/api/agent/runs/${encodeURIComponent(runId)}/events`);
    const seenEventIds = new Set<string>();
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      source.removeEventListener('progress', handleProgress);
      source.close();
    };
    const handleProgress = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as AgentProgressEvent;
        if (!event.id || seenEventIds.has(event.id)) return;
        seenEventIds.add(event.id);
        onEvent(event);
        if (TERMINAL_EVENTS.has(event.type)) close();
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };
    source.addEventListener('progress', handleProgress);
    return close;
  }

  async getRun(runId: string): Promise<AgentRunState> {
    const data = await this.request<{ success: true; run: AgentRunState }>(
      `/api/agent/runs/${encodeURIComponent(runId)}`,
    );
    return data.run;
  }

  pause(runId: string): Promise<AgentRunState> {
    return this.control(runId, 'pause');
  }

  resume(runId: string): Promise<AgentRunState> {
    return this.control(runId, 'resume');
  }

  stop(runId: string): Promise<AgentRunState> {
    return this.control(runId, 'stop');
  }

  addInstruction(runId: string, instruction: string): Promise<AgentRunState> {
    return this.control(runId, 'instructions', { instruction });
  }

  private async control(runId: string, action: string, body?: unknown): Promise<AgentRunState> {
    const data = await this.request<{ success: true; run: AgentRunState }>(
      `/api/agent/runs/${encodeURIComponent(runId)}/${action}`, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      },
    );
    return data.run;
  }

  private async request<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(url, init);
    const data = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || `Agent API 请求失败 (${response.status})`);
    return data;
  }
}

export const agentClient = new AgentClient();
