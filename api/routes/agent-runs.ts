import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

import type { DrawingAgentRunStatus } from '../../src/contracts/drawing-agent.js';
import type { DrawingId, RevisionId } from '../../src/drawing/index.js';
import type { AgentProgressEvent } from '../services/drawing-agent/progress.js';
import { DrawingApplication, DrawingApplicationError } from '../services/drawing-application/application.js';
import { DrawingAgentRuntime } from '../services/drawing-agent/runtime.js';
import { toDrawingAgentRunView } from '../services/drawing-agent/state.js';
import type { DrawingAgentModelProfile } from '../services/drawing-agent/types.js';

const TERMINAL_STATUSES = new Set<DrawingAgentRunStatus>(['stopped', 'completed', 'failed']);
const TERMINAL_EVENTS = new Set<AgentProgressEvent['type']>(['stopped', 'completed', 'failed']);
const ATTACHMENT_KEYS = ['image', 'mimeType', 'pdf', 'pdfBody', 'attachment', 'file'];
const ALLOWED_START_KEYS = new Set([
  'drawingId', 'baseRevision', 'goal', 'selectedIds', 'stableRules',
]);

export function createAgentRunsRouter(
  runtime: DrawingAgentRuntime,
  application: DrawingApplication,
  modelProfile: DrawingAgentModelProfile,
): Router {
  const router = Router();

  router.post('/', route(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    if (ATTACHMENT_KEYS.some((key) => key in body)) {
      invalid(
        res,
        409,
        'DRAWING_PERCEPTION_NOT_MIGRATED',
        '图片和 PDF 感知尚未迁移到 Drawing Agent，请先使用文字修改当前图纸',
      );
      return;
    }
    if ('spatialModel' in body) {
      invalid(res, 400, 'LEGACY_SPATIAL_MODEL_FORBIDDEN', 'Agent 不再接受 SpatialModel');
      return;
    }
    const unknownKey = Object.keys(body).find((key) => !ALLOWED_START_KEYS.has(key));
    if (unknownKey) {
      invalid(res, 400, 'INVALID_AGENT_REQUEST', `不支持字段 ${unknownKey}`);
      return;
    }
    const drawingId = nonEmptyString(body.drawingId);
    const baseRevision = nonEmptyString(body.baseRevision);
    const goal = nonEmptyString(body.goal);
    const selectedIds = optionalStringArray(body.selectedIds);
    const stableRules = optionalStringArray(body.stableRules);
    if (!drawingId || !baseRevision || !goal || selectedIds === null || stableRules === null) {
      invalid(
        res,
        400,
        'INVALID_AGENT_REQUEST',
        'drawingId、baseRevision、goal 必填，selectedIds/stableRules 必须是非空字符串数组',
      );
      return;
    }
    const revision = await application.validateRevision({
      drawingId: drawingId as DrawingId,
      revision: baseRevision as RevisionId,
    });
    if (!revision.owned) {
      invalid(
        res,
        409,
        'DRAWING_REVISION_MISMATCH',
        'baseRevision 不属于指定图纸',
      );
      return;
    }

    const runId = `run_${randomUUID()}`;
    runtime.start({
      runId,
      drawingId: drawingId as DrawingId,
      baseRevision: baseRevision as RevisionId,
      goal,
      modelProfile: { ...modelProfile },
      ...(selectedIds ? { selectedIds } : {}),
      ...(stableRules ? { stableRules } : {}),
    });
    res.status(202).json({ success: true, runId });
  }));

  router.get('/:runId/events', (req: Request, res: Response): void => {
    const channel = runtime.getProgress(req.params.runId);
    if (!channel) return notFound(res);
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const replay = channel.events();
    replay.forEach((event) => writeSse(res, event));
    if (replay.some((event) => TERMINAL_EVENTS.has(event.type))) {
      res.end();
      return;
    }
    let unsubscribe = () => undefined;
    unsubscribe = channel.subscribe((event) => {
      writeSse(res, event);
      if (!TERMINAL_EVENTS.has(event.type)) return;
      unsubscribe();
      res.end();
    });
    req.on('close', unsubscribe);
  });

  router.get('/:runId', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return notFound(res);
    res.json({ success: true, run: toDrawingAgentRunView(state) });
  });

  router.post('/:runId/pause', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return notFound(res);
    if (state.status !== 'planning' && state.status !== 'running') {
      return conflict(res, state.status, '暂停');
    }
    res.status(202).json({ success: true, run: toDrawingAgentRunView(runtime.pause(req.params.runId)) });
  });

  router.post('/:runId/resume', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return notFound(res);
    if (state.status !== 'paused') return conflict(res, state.status, '继续');
    res.status(202).json({ success: true, run: toDrawingAgentRunView(runtime.resume(req.params.runId)) });
  });

  router.post('/:runId/stop', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return notFound(res);
    if (TERMINAL_STATUSES.has(state.status)) return conflict(res, state.status, '停止');
    res.status(202).json({ success: true, run: toDrawingAgentRunView(runtime.stop(req.params.runId)) });
  });

  router.post('/:runId/instructions', (req: Request, res: Response): void => {
    const state = runtime.getState(req.params.runId);
    if (!state) return notFound(res);
    const instruction = nonEmptyString(req.body?.instruction);
    if (!instruction) {
      invalid(res, 400, 'INVALID_INSTRUCTION', 'instruction 不能为空');
      return;
    }
    if (TERMINAL_STATUSES.has(state.status) || state.status === 'stopping') {
      return conflict(res, state.status, '追加指令');
    }
    res.status(202).json({
      success: true,
      run: toDrawingAgentRunView(runtime.addInstruction(req.params.runId, instruction)),
    });
  });

  return router;
}

function route(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof DrawingApplicationError) {
        invalid(res, 404, error.code, error.message);
        return;
      }
      next(error);
    });
  };
}

function writeSse(res: Response, event: AgentProgressEvent): void {
  res.write(`id: ${event.id}\nevent: progress\ndata: ${JSON.stringify(event)}\n\n`);
}

function notFound(res: Response): void {
  invalid(res, 404, 'AGENT_RUN_NOT_FOUND', 'Agent run 不存在');
}

function conflict(res: Response, status: DrawingAgentRunStatus, action: string): void {
  invalid(res, 409, 'INVALID_RUN_STATE', `当前 ${status} 状态不能${action}`);
}

function invalid(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ success: false, error: { code, message } });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalStringArray(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) return null;
  const normalized = value.map(nonEmptyString);
  return normalized.some((item) => item === null) ? null : normalized as string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
