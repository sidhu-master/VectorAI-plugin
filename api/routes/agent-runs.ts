import { randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';

import type { DrawingAgentRunStatus } from '../../src/contracts/drawing-agent.js';
import type { DrawingId, RevisionId } from '../../src/drawing/index.js';
import type { AgentProgressEvent } from '../services/drawing-agent/progress.js';
import { DrawingApplication, DrawingApplicationError } from '../services/drawing-application/application.js';
import { DrawingAgentRuntime } from '../services/drawing-agent/runtime.js';
import { toDrawingAgentRunView } from '../services/drawing-agent/state.js';
import type { DrawingAgentModelProfile } from '../services/drawing-agent/types.js';
import type { SourceArtifactStore } from '../services/source-artifacts/types.js';

const TERMINAL_STATUSES = new Set<DrawingAgentRunStatus>(['stopped', 'completed', 'failed']);
const TERMINAL_EVENTS = new Set<AgentProgressEvent['type']>(['stopped', 'completed', 'failed']);
const ALLOWED_START_KEYS = new Set([
  'drawingId', 'baseRevision', 'goal', 'selectedIds', 'stableRules', 'viewport', 'attachment',
]);

export function createAgentRunsRouter(
  runtime: DrawingAgentRuntime,
  application: DrawingApplication,
  modelProfile: DrawingAgentModelProfile,
  sourceArtifacts?: SourceArtifactStore,
): Router {
  const router = Router();

  router.post('/', route(async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
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
    const goal = typeof body.goal === 'string' ? body.goal.trim() : null;
    const attachment = parseAttachment(body.attachment);
    const selectedIds = optionalStringArray(body.selectedIds);
    const stableRules = optionalStringArray(body.stableRules);
    const viewport = parseViewport(body.viewport);
    if (
      !drawingId || !baseRevision || goal === null || (!goal && !attachment)
      || attachment === null || selectedIds === null || stableRules === null
      || viewport === null
    ) {
      invalid(
        res,
        400,
        'INVALID_AGENT_REQUEST',
        'drawingId、baseRevision 必填；goal 与 attachment 至少提供一个，attachment 仅支持图片/PDF',
      );
      return;
    }
    if (attachment && !sourceArtifacts) {
      invalid(res, 503, 'DRAWING_PERCEPTION_UNAVAILABLE', '图纸解析服务未配置');
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

    let source;
    try {
      source = attachment ? await sourceArtifacts!.put(attachment) : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('SOURCE_TOO_LARGE')) {
        invalid(res, 413, 'SOURCE_TOO_LARGE', '图纸文件不能超过 20MB');
      } else if (message.startsWith('SOURCE_MIME_UNSUPPORTED')) {
        invalid(res, 415, 'SOURCE_MIME_UNSUPPORTED', '仅支持 PNG、JPEG、WebP 和 PDF');
      } else {
        invalid(res, 400, 'SOURCE_INVALID', '图纸文件为空或内容无效');
      }
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
      ...(viewport ? { viewport } : {}),
      ...(source ? { source } : {}),
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

function parseViewport(value: unknown): {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const scale = finiteNumber(value.scale);
  const offsetX = finiteNumber(value.offsetX);
  const offsetY = finiteNumber(value.offsetY);
  const width = positiveNumber(value.width);
  const height = positiveNumber(value.height);
  if (scale === null || offsetX === null || offsetY === null
    || width === null || height === null || width > 8192 || height > 8192) {
    return null;
  }
  return { scale, offsetX, offsetY, width, height };
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAttachment(value: unknown): {
  data: string;
  mimeType: string;
  page?: number;
} | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.some((key) => !['data', 'mimeType', 'page'].includes(key))) return null;
  const data = nonEmptyString(value.data);
  const mimeType = nonEmptyString(value.mimeType);
  if (!data || !mimeType) return null;
  if (value.page !== undefined && (!Number.isInteger(value.page) || Number(value.page) < 1)) {
    return null;
  }
  return {
    data,
    mimeType,
    ...(value.page === undefined ? {} : { page: Number(value.page) }),
  };
}
