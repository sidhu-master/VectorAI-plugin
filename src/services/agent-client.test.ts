import { describe, expect, it, vi } from 'vitest';
import type { DrawingId, RevisionId } from '@/drawing';
import { AgentClient, type AgentProgressEvent, type EventSourceLike } from './agent-client';

class FakeEventSource implements EventSourceLike {
  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  readonly close = vi.fn();

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: AgentProgressEvent): void {
    const message = { data: JSON.stringify(event) } as MessageEvent<string>;
    for (const listener of this.listeners.get(type) ?? []) listener(message);
  }
}

describe('AgentClient', () => {
  it('starts from the canonical drawing identity without serializing a document', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetcher.mockResolvedValue(jsonResponse(202, { success: true, runId: 'run_1' }));
    const client = new AgentClient({ fetcher, eventSourceFactory: () => new FakeEventSource() });

    await expect(client.start({
      drawingId: 'drawing_1' as DrawingId,
      baseRevision: 'revision_1' as RevisionId,
      goal: '创建圆',
      selectedIds: ['circle_1'],
    })).resolves.toEqual({ runId: 'run_1' });
    const body = JSON.parse(String(fetcher.mock.calls.at(0)![1]?.body));
    expect(body).toEqual({
      drawingId: 'drawing_1', baseRevision: 'revision_1',
      goal: '创建圆', selectedIds: ['circle_1'],
    });
    expect(body).not.toHaveProperty('spatialModel');
    expect(body).not.toHaveProperty('image');
  });

  it('surfaces structured server errors without leaking protocol details', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetcher.mockResolvedValue(jsonResponse(409, {
      success: false,
      error: { code: 'DRAWING_REVISION_MISMATCH', message: '图纸版本已变化' },
    }));
    const client = new AgentClient({ fetcher, eventSourceFactory: () => new FakeEventSource() });

    await expect(client.start({
      drawingId: 'drawing_1' as DrawingId,
      baseRevision: 'revision_1' as RevisionId,
      goal: '分析图纸',
    })).rejects.toThrow('图纸版本已变化');
  });

  it('projects ordered progress once and closes at a terminal event', () => {
    const source = new FakeEventSource();
    const client = new AgentClient({
      fetcher: vi.fn(),
      eventSourceFactory: () => source,
    });
    const received: string[] = [];
    client.subscribe('run_1', (event) => received.push(event.id));

    source.emit('progress', progress('event_1', 'accepted'));
    source.emit('progress', progress('event_1', 'accepted'));
    source.emit('progress', progress('event_2', 'planning'));
    source.emit('progress', progress('event_3', 'completed'));

    expect(received).toEqual(['event_1', 'event_2', 'event_3']);
    expect(source.close).toHaveBeenCalledOnce();
  });

  it('sends pause, resume, stop, and queued instructions to run controls', async () => {
    const fetcher = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetcher.mockResolvedValue(jsonResponse(202, { success: true, run: { status: 'pause_requested' } }));
    const client = new AgentClient({ fetcher, eventSourceFactory: () => new FakeEventSource() });

    await expect(client.pause('run_1')).resolves.toMatchObject({ status: 'pause_requested' });
    await client.resume('run_1');
    await client.stop('run_1');
    await client.addInstruction('run_1', '把孔径改成 8mm');

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/api/agent/runs/run_1/pause',
      '/api/agent/runs/run_1/resume',
      '/api/agent/runs/run_1/stop',
      '/api/agent/runs/run_1/instructions',
    ]);
    expect(JSON.parse(String(fetcher.mock.calls.at(3)![1]?.body))).toEqual({ instruction: '把孔径改成 8mm' });
  });
});

function progress(id: string, type: AgentProgressEvent['type']): AgentProgressEvent {
  return { id, runId: 'run_1', type, title: type, timestamp: 1_000, elapsedMs: 0 };
}

function jsonResponse(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
