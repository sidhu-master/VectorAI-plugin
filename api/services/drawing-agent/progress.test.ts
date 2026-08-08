import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
});
