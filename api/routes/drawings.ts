import { Router, type NextFunction, type Request, type Response } from 'express';

import type {
  Actor,
  CommitId,
  DrawingId,
  DrawingTransaction,
} from '../../src/drawing/index.js';
import {
  DrawingApplication,
  DrawingApplicationError,
} from '../services/drawing-application/application.js';
import { DrawingRepositoryLoadError } from '../services/drawing-application/file-drawing-repository.js';

export function createDrawingsRouter(application: DrawingApplication): Router {
  const router = Router();

  router.post('/', route(async (req, res) => {
    const unit = req.body?.unit;
    if (unit !== undefined && !['mm', 'cm', 'm'].includes(unit)) {
      invalid(res, 'INVALID_UNIT', '单位必须是 mm、cm 或 m');
      return;
    }
    const workspace = await application.create(unit === undefined ? {} : { unit });
    res.status(201).json({ success: true, workspace });
  }));

  router.get('/:drawingId', route(async (req, res) => {
    const workspace = await application.open(req.params.drawingId as DrawingId);
    res.status(200).json({ success: true, workspace });
  }));

  router.post('/:drawingId/transactions', route(async (req, res) => {
    if (!isTransaction(req.body?.transaction)) {
      invalid(res, 'INVALID_TRANSACTION', '事务结构无效');
      return;
    }
    const result = await application.execute({
      drawingId: req.params.drawingId as DrawingId,
      transaction: req.body.transaction,
    });
    res.status(200).json({ success: true, result });
  }));

  router.post('/:drawingId/reverts', route(async (req, res) => {
    if (typeof req.body?.commitId !== 'string'
      || !req.body.commitId.trim()
      || !isActor(req.body?.actor)) {
      invalid(res, 'INVALID_REVERT', '撤销请求结构无效');
      return;
    }
    const result = await application.revert({
      drawingId: req.params.drawingId as DrawingId,
      commitId: req.body.commitId as CommitId,
      actor: req.body.actor,
    });
    res.status(200).json({ success: true, result });
  }));

  return router;
}

function route(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof DrawingApplicationError) {
        res.status(404).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (error instanceof DrawingRepositoryLoadError) {
        res.status(409).json({
          success: false,
          error: { code: error.code, message: '本地图纸数据损坏' },
        });
        return;
      }
      next(error);
    });
  };
}

function isTransaction(value: unknown): value is DrawingTransaction {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !value.id.trim()
    || typeof value.baseRevision !== 'string'
    || !value.baseRevision.trim()
    || !isActor(value.actor)
    || !Array.isArray(value.commands)
    || !Array.isArray(value.preconditions)
    || !Array.isArray(value.postconditions)
    || !Array.isArray(value.evidenceRefs)) {
    return false;
  }
  return true;
}

function isActor(value: unknown): value is Actor {
  return isRecord(value)
    && ['AI', 'user', 'system'].includes(String(value.type))
    && typeof value.id === 'string'
    && Boolean(value.id.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(res: Response, code: string, message: string): void {
  res.status(400).json({ success: false, error: { code, message } });
}
