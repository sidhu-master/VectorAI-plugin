import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from '@/core/history/history';
import { createEmptyModel } from '@/core/model';
import type { AgentRunState } from '@/core/runtime/state-machine';
import type { AgentClient, AgentProgressEvent } from '@/services/agent-client';
import { createAppStore, useStore } from './useStore';

beforeEach(() => {
  const model = createEmptyModel();
  model.entities.push({
    id: 'c1', type: 'circle', visible: true, center: [0, 0], radius: 5,
  });
  model.relations.push({
    id: 'r1', kind: 'radius', entities: ['c1'], status: 'unsolved', value: 5,
  });
  useStore.setState({ model, history: createHistory(model), selectedIds: [] });
});

describe('useStore history integration', () => {
  it('records a parameter edit and can undo it', () => {
    useStore.getState().updateEntity('c1', { radius: 8 });

    expect(useStore.getState().model.entities[0]).toMatchObject({ radius: 8 });
    expect(useStore.getState().history.commits).toHaveLength(1);

    useStore.getState().undo();
    expect(useStore.getState().model.entities[0]).toMatchObject({ radius: 5 });
  });

  it('undo restores an entity and attached relations after deletion', () => {
    useStore.getState().deleteEntity('c1');
    expect(useStore.getState().model.entities).toEqual([]);
    expect(useStore.getState().model.relations).toEqual([]);

    useStore.getState().undo();
    expect(useStore.getState().model.entities).toHaveLength(1);
    expect(useStore.getState().model.relations).toHaveLength(1);
  });

  it('does not commit an invalid AI intent', () => {
    const errors = useStore.getState().applyIntent({
      objects: [{ type: 'circle', params: { center: [0, 0], radius: 0 } }],
    });

    expect(errors.length).toBeGreaterThan(0);
    expect(useStore.getState().history.commits).toHaveLength(0);
    expect(useStore.getState().model.entities).toHaveLength(1);
  });
});

describe('useStore agent runtime integration', () => {
  it('starts automatically, projects progress, and syncs committed model state', async () => {
    let listener: ((event: AgentProgressEvent) => void) | undefined;
    const remoteModel = createEmptyModel();
    remoteModel.entities.push({ id: 'p1', type: 'point', visible: true, x: 1, y: 2 });
    const remoteState = {
      status: 'running', plan: null, currentStepIndex: 1,
      history: createHistory(remoteModel),
    } as AgentRunState;
    const client = {
      start: vi.fn(async () => ({ runId: 'run_1' })),
      subscribe: vi.fn((_runId: string, next: (event: AgentProgressEvent) => void) => {
        listener = next;
        return () => undefined;
      }),
      getRun: vi.fn(async () => remoteState),
      pause: vi.fn(async () => ({ ...remoteState, status: 'pause_requested' })),
      resume: vi.fn(async () => remoteState),
      stop: vi.fn(async () => ({ ...remoteState, status: 'stopping' })),
      addInstruction: vi.fn(async () => remoteState),
    } as unknown as AgentClient;
    const store = createAppStore(client);

    await store.getState().startAgent('创建一个点');
    listener?.(agentEvent('event_1', 'accepted'));
    listener?.(agentEvent('event_2', 'commit'));
    await vi.waitFor(() => expect(store.getState().model.entities).toHaveLength(1));

    expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ goal: '创建一个点' }));
    expect(store.getState().agentRunId).toBe('run_1');
    expect(store.getState().agentEvents.map((event) => event.id)).toEqual(['event_1', 'event_2']);
  });

  it('forwards run controls and additional instructions', async () => {
    const remoteState = {
      status: 'running', plan: null, currentStepIndex: 0,
      history: createHistory(createEmptyModel()),
    } as AgentRunState;
    const client = {
      start: vi.fn(async () => ({ runId: 'run_2' })),
      subscribe: vi.fn(() => () => undefined),
      getRun: vi.fn(async () => remoteState),
      pause: vi.fn(async () => ({ ...remoteState, status: 'pause_requested' })),
      resume: vi.fn(async () => remoteState),
      stop: vi.fn(async () => ({ ...remoteState, status: 'stopping' })),
      addInstruction: vi.fn(async () => remoteState),
    } as unknown as AgentClient;
    const store = createAppStore(client);
    await store.getState().startAgent('创建一个点');

    await store.getState().pauseAgent();
    await store.getState().resumeAgent();
    await store.getState().addAgentInstruction('移动到原点');
    await store.getState().stopAgent();

    expect(client.pause).toHaveBeenCalledWith('run_2');
    expect(client.resume).toHaveBeenCalledWith('run_2');
    expect(client.addInstruction).toHaveBeenCalledWith('run_2', '移动到原点');
    expect(client.stop).toHaveBeenCalledWith('run_2');
  });
});

function agentEvent(id: string, type: AgentProgressEvent['type']): AgentProgressEvent {
  return { id, runId: 'run_1', type, title: type, timestamp: 1_000, elapsedMs: 0 };
}
