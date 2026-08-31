// SPDX-License-Identifier: Apache-2.0

import type { Context } from '@deepseek-ai/cordis';
import { exportDrawingDxf } from '@vectorai/drawing-core';
import { DRAWING_DXF_EXPORT_PATH } from '@vectorai/plugin-space-contracts';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { InMemoryDrawingRepository } from './repository';

interface DrawingExportConnection {
  readonly fetch: {
    register(route: {
      readonly path: string;
      readonly methods: readonly ('GET' | 'HEAD' | 'POST')[];
      readonly fetch: (request: Request) => Promise<Response>;
    }): () => Promise<void>;
  };
}

/** Register the first-layer, Host-owned DXF download endpoint. */
export function registerDrawingDxfExport(
  ctx: Context,
  drawings: InMemoryDrawingRepository,
): void {
  connectionOf(ctx).fetch.register({
    path: DRAWING_DXF_EXPORT_PATH,
    methods: ['GET', 'HEAD', 'POST'],
    fetch: async (request) => drawingDxfExportResponse(drawings, request),
  });
}

function connectionOf(ctx: Context): DrawingExportConnection {
  return Reflect.get(ctx, 'connection') as DrawingExportConnection;
}

function drawingDxfExportResponse(
  drawings: InMemoryDrawingRepository,
  request: Request,
): Response | Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');
  if (sessionId === null || sessionId.length === 0) {
    return new Response('missing sessionId query parameter', { status: 400 });
  }
  const snapshot = drawings.getSnapshot(sessionId);
  if (snapshot === null) return new Response('drawing not found', { status: 404 });

  const expectedDrawingId = url.searchParams.get('drawingId');
  const expectedRevision = url.searchParams.get('revision');
  if (
    (expectedDrawingId !== null && expectedDrawingId !== snapshot.ref.drawingId)
    || (expectedRevision !== null && expectedRevision !== String(snapshot.ref.revision))
  ) {
    return new Response('drawing revision is stale', { status: 409 });
  }

  const body = exportDrawingDxf(snapshot.document);
  const filename = `${safeFilenamePart(snapshot.ref.drawingId)}-R${snapshot.ref.revision}.dxf`;
  if (request.method === 'POST') return saveDxfToDownloads(body, filename);
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'application/dxf; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
}

async function saveDxfToDownloads(body: string, requestedFilename: string): Promise<Response> {
  try {
    const directory = join(homedir(), 'Downloads');
    await mkdir(directory, { recursive: true });
    const filename = await writeWithoutOverwrite(directory, requestedFilename, body);
    const path = join(directory, filename);
    return jsonResponse({ status: 'saved', filename, path }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ status: 'error', message }, 500);
  }
}

async function writeWithoutOverwrite(
  directory: string,
  requestedFilename: string,
  body: string,
): Promise<string> {
  const stem = requestedFilename.endsWith('.dxf')
    ? requestedFilename.slice(0, -'.dxf'.length)
    : requestedFilename;
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

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function safeFilenamePart(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9._-]/g, '_');
  return safe.length === 0 ? 'drawing' : safe;
}
