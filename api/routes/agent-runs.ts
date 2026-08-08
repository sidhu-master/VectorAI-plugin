import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { createEmptyModel } from '../../src/core/model.js';
import type { AgentRunStatus } from '../../src/core/runtime/state-machine.js';
import type { SpatialModel } from '../../src/core/types.js';
import { validateModel } from '../../src/core/validator.js';
import type { AgentProgressEvent } from '../services/agent-runtime/progress.js';
import type { AgentRuntime } from '../services/agent-runtime/runtime.js';

const TERMINAL_STATUSES = new Set<AgentRunStatus>(['stopped', 'completed', 'failed']);
const TERMINAL_EVENTS = new Set<AgentProgressEvent['type']>(['stopped', 'completed', 'failed']);

export function createAgentRunsRouter(runtime: AgentRuntime): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response): void => {
    const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';
    if (!goal) {
      res.status(400).json({ success: false, error: 'goal 不能为空' });
      return;
    }
    const model = readSpatialModel(req.body?.spatialModel);
    if (!model) {
      res.status(400).json({ success: false, error: 'spatialModel 格式无效' });
      return;
    }

    const runId = `run_${randomUUID()}`;
    runtime.start({
      runId,
      goal,
      model,
      stableRules: Array.isArray(req.body?.stableRules)
        ? req.body.stableRules.filter((rule: unknown): rule is string => typeof rule === 'string')
        : undefined,
    });
    res.status(202).json({ success: true, runId });
  });

  router.get('/:runId/events', (req: Request, res: Response): void => {
    const channel = runtime.getProgress(req.params.runId);
    if (!channel) {
      res.status(404).json({ success: false, error: 'Agent run 不存在' });
      return;
    }

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const replay = channel.events();
    for (const event of replay) writeSse(res, event);
    if (replay.some((event) => TERMINAL_EVENTS.has(event.type))) {
      res.end();
      return;
    }

    let unsubscribe = () => undefined;
    unsubscribe = channel.subscribe((event) => {
      writeSse(res, event);
      if (TERMINAL_EVENTS.has(event.type)) {
        unsubscribe();
        res.end();
      }
    });
    req.on('close', unsubscribe);
  });

  router.get('/:runId', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) {
      res.status(404).json({ success: false, error: 'Agent run 不存在' });
      return;
    }
    res.json({ success: true, run: state });
  });

  router.post('/:runId/pause', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return sendNotFound(res);
    if (state.status !== 'running') return sendConflict(res, `当前 ${state.status} 状态不能暂停`);
    res.status(202).json({ success: true, run: runtime.pause(req.params.runId) });
  });

  router.post('/:runId/resume', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return sendNotFound(res);
    if (state.status !== 'paused') return sendConflict(res, `当前 ${state.status} 状态不能继续`);
    res.status(202).json({ success: true, run: runtime.resume(req.params.runId) });
  });

  router.post('/:runId/stop', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return sendNotFound(res);
    if (TERMINAL_STATUSES.has(state.status)) return sendConflict(res, `当前 ${state.status} 状态不能停止`);
    res.status(202).json({ success: true, run: runtime.stop(req.params.runId) });
  });

  router.post('/:runId/instructions', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return sendNotFound(res);
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
    if (!instruction) {
      res.status(400).json({ success: false, error: 'instruction 不能为空' });
      return;
    }
    if (TERMINAL_STATUSES.has(state.status) || state.status === 'stopping') {
      return sendConflict(res, `当前 ${state.status} 状态不能追加指令`);
    }
    res.status(202).json({
      success: true,
      run: runtime.addInstruction(req.params.runId, instruction),
    });
  });

  return router;
}

function writeSse(res: Response, event: AgentProgressEvent): void {
  res.write(`id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`);
}

function sendNotFound(res: Response): void {
  res.status(404).json({ success: false, error: 'Agent run 不存在' });
}

function sendConflict(res: Response, error: string): void {
  res.status(409).json({ success: false, error });
}

function readSpatialModel(value: unknown): SpatialModel | null {
  if (value === undefined) return createEmptyModel();
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SpatialModel>;
  if (!Array.isArray(candidate.entities) || !Array.isArray(candidate.relations)) return null;
  try {
    return validateModel(candidate as SpatialModel).valid ? candidate as SpatialModel : null;
  } catch {
    return null;
  }
}
