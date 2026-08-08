import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunProgressChannel } from './progress';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
});

afterEach(() => vi.useRealTimers());

describe('RunProgressChannel', () => {
  it('publishes accepted synchronously to subscribers', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const events: string[] = [];
    channel.subscribe((event) => events.push(event.type));

    channel.publish('accepted', '任务已受理');

    expect(events).toEqual(['accepted']);
    channel.close();
  });

  it('publishes heartbeat after 25 seconds of silence', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const events: string[] = [];
    channel.subscribe((event) => events.push(event.type));
    channel.publish('planning', '正在规划');

    vi.advanceTimersByTime(25_000);

    expect(events).toEqual(['planning', 'heartbeat']);
    channel.close();
  });

  it('resets the heartbeat deadline after a real event', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const events: string[] = [];
    channel.subscribe((event) => events.push(event.type));
    channel.publish('planning', '正在规划');
    vi.advanceTimersByTime(20_000);
    channel.publish('tool_started', '开始工具');
    vi.advanceTimersByTime(6_000);

    expect(events).toEqual(['planning', 'tool_started']);
    vi.advanceTimersByTime(19_000);
    expect(events.at(-1)).toBe('heartbeat');
    channel.close();
  });

  it('stops heartbeat after a terminal event', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const events: string[] = [];
    channel.subscribe((event) => events.push(event.type));
    channel.publish('completed', '完成');

    vi.advanceTimersByTime(60_000);

    expect(events).toEqual(['completed']);
  });

  it('unsubscribes listeners without affecting other subscribers', () => {
    const channel = new RunProgressChannel('run_1', 1_000);
    const first: string[] = [];
    const second: string[] = [];
    const unsubscribe = channel.subscribe((event) => first.push(event.type));
    channel.subscribe((event) => second.push(event.type));
    unsubscribe();

    channel.publish('accepted', '任务已受理');

    expect(first).toEqual([]);
    expect(second).toEqual(['accepted']);
    channel.close();
  });

  it('retains structured model metadata without converting it to text', () => {
    const channel = new RunProgressChannel('run_models', 1_000);

    const event = channel.publish('model_finished', '模型调用完成', {
      role: 'executor',
      model: 'doubao-seed-2.0-lite',
      attempt: 2,
      durationMs: 320,
      status: 'success',
    });

    expect(event.detail).toEqual({
      role: 'executor',
      model: 'doubao-seed-2.0-lite',
      attempt: 2,
      durationMs: 320,
      status: 'success',
    });
    channel.close();
  });
});
