// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionId } from '@deepseek-ai/dsh-session';
import { DRAWING_ANNOTATED_DXF_EXPORT_PATH, type DrawingSpaceExtensionHost } from '@vectorai/plugin-space-contracts';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { DimensionPlanStore } from './dimension-plan-store';
import { exportEngineeringDrawingDxf } from './engineering-dxf-export';

interface ExportConnection {
  readonly fetch: {
    register(route: {
      readonly path: string;
      readonly methods: readonly ('POST')[];
      readonly fetch: (request: Request) => Promise<Response>;
    }): () => Promise<void>;
  };
}

export function registerEngineeringDxfExport(
  ctx: Context,
  drawingSpace: DrawingSpaceExtensionHost<Agent>,
  plans: DimensionPlanStore,
): void {
  connectionOf(ctx).fetch.register({
    path: DRAWING_ANNOTATED_DXF_EXPORT_PATH,
    methods: ['POST'],
    fetch: async (request) => {
      try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return json({ status: 'error', message: 'missing sessionId query parameter' }, 400);
        const agent = ctx.agents.get(sessionId as SessionId);
        if (!agent) return json({ status: 'error', message: 'session not found' }, 404);
        const snapshot = drawingSpace.getSnapshot(agent);
        if (!snapshot) return json({ status: 'error', message: 'drawing not found' }, 404);
        if (url.searchParams.get('drawingId') !== snapshot.ref.drawingId
          || url.searchParams.get('revision') !== String(snapshot.ref.revision)) {
          return json({ status: 'error', message: 'drawing revision is stale' }, 409);
        }
        const body = exportEngineeringDrawingDxf(snapshot.document, plans.get(sessionId), { profile: 'caxa-compatible' });
        const requested = `${safeFilenamePart(snapshot.ref.drawingId)}-R${snapshot.ref.revision}-annotated.dxf`;
        const directory = join(homedir(), 'Downloads');
        await mkdir(directory, { recursive: true });
        const filename = await writeWithoutOverwrite(directory, requested, body);
        return json({ status: 'saved', filename, path: join(directory, filename) }, 200);
      } catch (error: unknown) {
        return json({ status: 'error', message: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
  });
}

function connectionOf(ctx: Context): ExportConnection {
  return Reflect.get(ctx, 'connection') as ExportConnection;
}

async function writeWithoutOverwrite(directory: string, requested: string, body: string): Promise<string> {
  const stem = requested.replace(/\.dxf$/i, '');
  for (let index = 0; index < 10_000; index += 1) {
    const filename = index === 0 ? `${stem}.dxf` : `${stem} (${index}).dxf`;
    try {
      await writeFile(join(directory, filename), body, { encoding: 'utf8', flag: 'wx' });
      return filename;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new Error('DXF_EXPORT_NAME_EXHAUSTED');
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeFilenamePart(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]/g, '_');
  return safe || 'drawing';
}
