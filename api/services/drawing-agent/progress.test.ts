import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeometryId, PerceptionPreviewDelta } from '../../../src/drawing';
import { RunProgressChannel } from './progress';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000); });
afterEach(() => vi.useRealTimers());

describe('RunProgressChannel', () => {
  it('publishes immediately and emits a heartbeat within 30 seconds of silence', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const events: string[] = [];
    channel.subscribe((event) => events.push(event.type));
    channel.publish('accepted', '任务已受理');
    vi.advanceTimersByTime(25_000);
    expect(events).toEqual(['accepted', 'heartbeat']);
    channel.close();
  });

  it('stops heartbeats after a terminal event', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    channel.publish('completed', '完成');
    vi.advanceTimersByTime(60_000);
    expect(channel.events().map((event) => event.type)).toEqual(['completed']);
  });

  it('keeps a structured perception delta in replay history', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const delta = previewDelta();

    channel.publish('perception_delta', '发现图元 GEO-0001', undefined, delta);

    expect(channel.events()[0]).toMatchObject({
      type: 'perception_delta',
      perceptionDelta: { sequence: 1, action: 'observe' },
    });
    channel.close();
  });
});

function previewDelta(): PerceptionPreviewDelta {
  return {
    runId: 'run_1', sequence: 1, action: 'observe', slotIds: ['GEO-0001'], removeIds: [],
    upserts: [{
      id: 'node_obs_1' as GeometryId, type: 'circle', center: [0, 0], radius: 5,
      visible: true, quality: { status: 'candidate', confidence: 0.8, evidenceRefs: [] },
    }],
    source: { page: 1, viewId: 'view_1', stage: 'detail' },
  };
}
