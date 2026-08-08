import { describe, expect, it } from 'vitest';
import { createEmptyModel } from '../model';
import { createHistory } from '../history/history';
import { createRuntimeContextLedger } from '../runtime/context';
import {
  createAgentRunState,
  reduceAgentRun,
} from '../runtime/state-machine';
import type { TaskPlan } from '../agent';

const plan: TaskPlan = {
  task: 'create_from_text',
  summary: '创建两个孔',
  steps: [
    { id: 1, action: 'extract_outline', description: '创建轮廓', status: 'pending' },
    { id: 2, action: 'detect_features', description: '创建孔', status: 'pending' },
  ],
};

function initial() {
  return createAgentRunState({
    runId: 'run_1',
    goal: '创建两个孔',
    history: createHistory(createEmptyModel()),
    context: createRuntimeContextLedger('创建两个孔', ['单位 mm']),
    createdAt: 1,
  });
}

describe('reduceAgentRun', () => {
  it('moves from planning to automatic running when a plan is ready', () => {
    const result = reduceAgentRun(initial(), { type: 'PLAN_READY', plan });

    expect(result.error).toBeUndefined();
    expect(result.state.status).toBe('running');
    expect(result.state.plan).toEqual(plan);
  });

  it('honors pause only after reaching a safe point', () => {
    const running = reduceAgentRun(initial(), { type: 'PLAN_READY', plan }).state;
    const requested = reduceAgentRun(running, { type: 'PAUSE_REQUESTED' }).state;

    expect(requested.status).toBe('pause_requested');
    expect(reduceAgentRun(requested, { type: 'SAFE_POINT' }).state.status).toBe('paused');
  });

  it('resumes a paused run', () => {
    const running = reduceAgentRun(initial(), { type: 'PLAN_READY', plan }).state;
    const paused = reduceAgentRun(
      reduceAgentRun(running, { type: 'PAUSE_REQUESTED' }).state,
      { type: 'SAFE_POINT' },
    ).state;

    expect(reduceAgentRun(paused, { type: 'RESUME' }).state.status).toBe('running');
  });

  it('queues guidance and consumes it exactly once at a safe point', () => {
    const running = reduceAgentRun(initial(), { type: 'PLAN_READY', plan }).state;
    const instructed = reduceAgentRun(running, {
      type: 'INSTRUCTION_ADDED', instruction: '孔径改成 10',
    }).state;

    const consumed = reduceAgentRun(instructed, { type: 'SAFE_POINT' }).state;
    const consumedAgain = reduceAgentRun(consumed, { type: 'SAFE_POINT' }).state;

    expect(consumed.pendingInstructions).toEqual([]);
    expect(consumed.activeInstruction).toBe('孔径改成 10');
    expect(consumed.needsReplan).toBe(true);
    expect(consumedAgain.activeInstruction).toBe('孔径改成 10');
  });

  it('stops immediately without advancing the current step', () => {
    const running = reduceAgentRun(initial(), { type: 'PLAN_READY', plan }).state;
    const stopping = reduceAgentRun(running, { type: 'STOP_REQUESTED' }).state;
    const stopped = reduceAgentRun(stopping, { type: 'STOPPED' }).state;

    expect(stopping.status).toBe('stopping');
    expect(stopped.status).toBe('stopped');
    expect(stopped.currentStepIndex).toBe(0);
  });

  it('completes after the final step and ignores later transitions', () => {
    let state = reduceAgentRun(initial(), { type: 'PLAN_READY', plan }).state;
    state = reduceAgentRun(state, { type: 'STEP_COMPLETED' }).state;
    state = reduceAgentRun(state, { type: 'STEP_COMPLETED' }).state;

    expect(state.status).toBe('completed');
    expect(reduceAgentRun(state, { type: 'RESUME' }).state).toBe(state);
  });

  it('returns a structured error for an invalid transition', () => {
    const result = reduceAgentRun(initial(), { type: 'RESUME' });

    expect(result.state).toBe(result.previousState);
    expect(result.error).toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
