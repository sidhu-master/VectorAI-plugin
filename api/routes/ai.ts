/**
 * AI 路由
 * - POST /api/ai/generate      文字 -> Spatial Intent
 * - POST /api/ai/perceive      图片 -> Spatial Intent
 * - POST /api/ai/agent/plan    任务规划 -> TaskPlan
 * - POST /api/ai/agent/execute 执行单步 -> StepResult
 * - GET  /api/ai/status       AI 连接状态
 */

import { Router, type Request, type Response } from 'express';
import {
  generateSpatialIntent,
  getAIStatus,
  perceiveFromImage,
  planTask,
  executeAgentStep,
} from '../services/ai-gateway.js';
import { executeStep } from '../../src/core/agent.js';

const router = Router();

/**
 * GET /api/ai/status
 */
router.get('/status', (_req: Request, res: Response): void => {
  const status = getAIStatus();
  res.json({
    success: true,
    connected: status.connected,
    mode: status.mode,
  });
});

/**
 * POST /api/ai/generate
 * 文字路径：自然语言 -> Spatial Intent
 */
router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, context, unit, model, selectedEntities } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ success: false, error: 'prompt 不能为空' });
      return;
    }
    if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
      res.status(400).json({ success: false, error: 'model 参数必须是非空字符串' });
      return;
    }
    if (unit !== undefined && !['mm', 'cm', 'm'].includes(unit)) {
      res.status(400).json({ success: false, error: 'unit 必须是 mm / cm / m 之一' });
      return;
    }

    const intent = await generateSpatialIntent({
      prompt: prompt.trim(),
      context,
      unit,
      model: model?.trim() || undefined,
      selectedEntities,
    });

    res.json({ success: true, intent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/ai/perceive
 * 感知路径：图片 -> Vision Pipeline -> Spatial Intent
 *
 * body: { image: base64, mimeType: string, model?: string }
 */
router.post('/perceive', async (req: Request, res: Response): Promise<void> => {
  try {
    const { image, mimeType, model } = req.body;

    console.log('[Perceive Route] 收到请求，mimeType:', mimeType, '图片大小:', image ? Math.round(image.length * 0.75 / 1024) + 'KB' : '空');

    if (!image || typeof image !== 'string') {
      console.log('[Perceive Route] 缺少 image 参数');
      res.status(400).json({ success: false, error: '缺少 image 参数（base64 编码）' });
      return;
    }
    if (!mimeType || typeof mimeType !== 'string') {
      res.status(400).json({ success: false, error: '缺少 mimeType 参数' });
      return;
    }
    if (!mimeType.startsWith('image/')) {
      res.status(400).json({ success: false, error: 'mimeType 必须是 image/* 格式' });
      return;
    }
    if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0)) {
      res.status(400).json({ success: false, error: 'model 参数必须是非空字符串' });
      return;
    }

    console.log('[Perceive Route] 调用 perceiveFromImage...');
    const intent = await perceiveFromImage({
      image,
      mimeType,
      model: model?.trim() || undefined,
    });

    console.log('[Perceive Route] 感知成功，对象数:', intent.objects?.length);
    res.json({ success: true, intent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/ai/agent/plan
 * 任务规划：文字/图片 -> TaskPlan
 * body: { prompt?, image?, mimeType?, model? }
 */
router.post('/agent/plan', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, image, mimeType, model } = req.body;

    if (!prompt && !image) {
      res.status(400).json({ success: false, error: '需要 prompt 或 image 参数' });
      return;
    }

    const plan = await planTask({
      prompt: typeof prompt === 'string' ? prompt : undefined,
      image: typeof image === 'string' ? image : undefined,
      mimeType: typeof mimeType === 'string' ? mimeType : undefined,
      model: typeof model === 'string' ? model.trim() || undefined : undefined,
    });

    res.json({ success: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/ai/agent/execute
 * 执行单步：step + model -> StepResult
 * body: { step, model, plan, model? }
 */
router.post('/agent/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { step, model: currentModel, plan, llmModel, currentView } = req.body;

    if (!step || !plan) {
      res.status(400).json({ success: false, error: '需要 step 和 plan 参数' });
      return;
    }
    if (!currentModel || typeof currentModel !== 'object') {
      res.status(400).json({ success: false, error: '需要 model 参数' });
      return;
    }

    // 1. 调用 LLM 生成此阶段的 Spatial Intent
    const intent = await executeAgentStep({
      step,
      model: currentModel,
      plan,
      llmModel: typeof llmModel === 'string' ? llmModel.trim() || undefined : undefined,
      currentView: typeof currentView === 'string' ? currentView : undefined,
    });

    // 2. Verification Loop + 执行
    const result = executeStep(intent, currentModel, step);

    res.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
