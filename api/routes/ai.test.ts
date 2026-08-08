import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import aiRoutes from './ai';

const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);
app.use((_req, res) => res.status(404).json({ success: false, error: 'API not found' }));
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => new Promise<void>((resolve) => server.close(() => resolve())));

describe('AI compatibility surface', () => {
  it('keeps connection status for the toolbar', async () => {
    const response = await fetch(`${baseUrl}/api/ai/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
  });

  it.each(['/generate', '/perceive', '/agent/plan', '/agent/execute'])(
    'does not expose the legacy SpatialModel endpoint %s',
    async (path) => {
      const response = await fetch(`${baseUrl}/api/ai${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'legacy' }),
      });
      expect(response.status).toBe(404);
    },
  );
});
