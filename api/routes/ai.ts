import { Router, type Request, type Response } from 'express';
import { getAIStatus } from '../services/ai-gateway.js';

const router = Router();

// The toolbar keeps this transport-level health check. Drawing work is only
// accepted through /api/drawings and /api/agent/runs.
router.get('/status', (_req: Request, res: Response): void => {
  const status = getAIStatus();
  res.json({ success: true, connected: status.connected, mode: status.mode });
});

export default router;
