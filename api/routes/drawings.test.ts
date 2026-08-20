import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DrawingApplication } from '../services/drawing-application/application';
import { DrawingApplicationError } from '../services/drawing-application/application';
import { DrawingRepositoryLoadError } from '../services/drawing-application/file-drawing-repository';
import { DxfImportError } from '../services/drawing-dxf/coordinator';
import { createDrawingsRouter } from './drawings';
import type { RepositoryCommitResult } from '../../src/drawing';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('drawing routes', () => {
  it('creates a drawing with a 201 workspace response', async () => {
    const application = applicationDouble();
    const baseUrl = await startServer(application);

    const response = await fetch(`${baseUrl}/api/drawings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit: 'cm' }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, workspace: workspace });
    expect(application.create).toHaveBeenCalledWith({ unit: 'cm' });
  });

  it('opens a URL-encoded drawing ID', async () => {
    const application = applicationDouble();
    const baseUrl = await startServer(application);

    const response = await fetch(`${baseUrl}/api/drawings/${encodeURIComponent('drawing / one')}`);

    expect(response.status).toBe(200);
    expect(application.open).toHaveBeenCalledWith('drawing / one');
  });

  it('uses the path drawing ID for transactions and returns domain rejection as HTTP 200', async () => {
    const application = applicationDouble();
    application.execute.mockResolvedValue({
      status: 'rejected',
      errors: [{
        code: 'STALE_REVISION', stage: 'revision', retryable: true,
        nodeIds: [], message: 'stale', suggestedAction: 'requery',
      }],
    });
    const baseUrl = await startServer(application);
    const transaction = {
      id: 'tx_1', baseRevision: 'revision_1',
      actor: { type: 'user', id: 'user' },
      commands: [], preconditions: [], postconditions: [], evidenceRefs: [],
    };

    const response = await fetch(`${baseUrl}/api/drawings/drawing_path/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drawingId: 'drawing_body', transaction }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true, result: { status: 'rejected', errors: [{ code: 'STALE_REVISION' }] },
    });
    expect(application.execute).toHaveBeenCalledWith({
      drawingId: 'drawing_path', transaction,
    });
  });

  it('validates transaction and revert request envelopes', async () => {
    const application = applicationDouble();
    const baseUrl = await startServer(application);

    const [badTransaction, badRevert] = await Promise.all([
      fetch(`${baseUrl}/api/drawings/drawing_1/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: { id: 'tx_missing_fields' } }),
      }),
      fetch(`${baseUrl}/api/drawings/drawing_1/reverts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitId: '', actor: { type: 'root', id: 'user' } }),
      }),
    ]);

    expect([badTransaction.status, badRevert.status]).toEqual([400, 400]);
    expect(application.execute).not.toHaveBeenCalled();
    expect(application.revert).not.toHaveBeenCalled();
  });

  it('stops active drawing runs before atomically clearing the drawing', async () => {
    const application = applicationDouble();
    const stopActiveRuns = vi.fn(async () => ['run_active']);
    const baseUrl = await startServer(application, stopActiveRuns);

    const response = await fetch(`${baseUrl}/api/drawings/drawing_1/clear`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: { type: 'user', id: 'local-user' } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true, workspace, stoppedRunIds: ['run_active'],
    });
    expect(stopActiveRuns).toHaveBeenCalledWith('drawing_1');
    expect(application.clear).toHaveBeenCalledWith({
      drawingId: 'drawing_1', actor: { type: 'user', id: 'local-user' },
    });
    expect(stopActiveRuns.mock.invocationCallOrder[0]).toBeLessThan(
      application.clear.mock.invocationCallOrder[0],
    );
  });

  it('routes a DXF and optional engineering document through the deterministic importer', async () => {
    const application = applicationDouble();
    const dxfImports = {
      import: vi.fn(async () => ({
        workspace,
        receipt: {
          source: { sourceId: 'source_1', fileName: 'shaft.dxf' },
          manifest: { blockCount: 3 },
        },
      })),
    };
    const baseUrl = await startServer(application, undefined, dxfImports);
    const file = {
      fileName: 'shaft.dxf', data: 'MApFT0Y=', mimeType: 'application/dxf',
    };
    const engineeringDocument = {
      fileName: 'shaft.txt', data: 'W2RyYXdpbmdd', mimeType: 'text/plain',
    };

    const response = await fetch(`${baseUrl}/api/drawings/drawing_path/imports/dxf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file, engineeringDocument }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      workspace,
      receipt: { source: { sourceId: 'source_1', fileName: 'shaft.dxf' } },
    });
    expect(dxfImports.import).toHaveBeenCalledWith({
      drawingId: 'drawing_path', ...file, engineeringDocument,
    });
  });

  it('validates DXF envelopes and maps deterministic import failures', async () => {
    const application = applicationDouble();
    const dxfImports = {
      import: vi.fn()
        .mockRejectedValue(new DxfImportError('DXF_PARSE_FAILED', 'DXF 解析失败')),
    };
    const baseUrl = await startServer(application, undefined, dxfImports);

    const invalidResponse = await fetch(`${baseUrl}/api/drawings/drawing_1/imports/dxf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: { fileName: 'bad.dxf' } }),
    });
    const failedResponse = await fetch(`${baseUrl}/api/drawings/drawing_1/imports/dxf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: { fileName: 'bad.dxf', data: 'MA==', mimeType: 'application/dxf' },
      }),
    });

    expect(invalidResponse.status).toBe(400);
    expect(failedResponse.status).toBe(400);
    expect(await failedResponse.json()).toEqual({
      success: false,
      error: { code: 'DXF_PARSE_FAILED', message: 'DXF 解析失败' },
    });
  });

  it('maps missing drawings and corrupt local state to safe status codes', async () => {
    const application = applicationDouble();
    application.open
      .mockRejectedValueOnce(new DrawingApplicationError('DRAWING_NOT_FOUND', '图纸不存在'))
      .mockRejectedValueOnce(new DrawingRepositoryLoadError('快照损坏'));
    const baseUrl = await startServer(application);

    const missing = await fetch(`${baseUrl}/api/drawings/missing`);
    const corrupt = await fetch(`${baseUrl}/api/drawings/corrupt`);

    expect([missing.status, corrupt.status]).toEqual([404, 409]);
    expect(await missing.json()).toEqual({
      success: false, error: { code: 'DRAWING_NOT_FOUND', message: '图纸不存在' },
    });
    expect(await corrupt.json()).toEqual({
      success: false, error: { code: 'CORRUPT_SNAPSHOT', message: '本地图纸数据损坏' },
    });
  });
});

const workspace = {
  document: {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_1',
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [], annotations: [], relations: [], features: [],
  },
  revision: 'revision_1',
  commits: [],
};

function applicationDouble() {
  return {
    create: vi.fn(async () => workspace),
    open: vi.fn(async () => workspace),
    execute: vi.fn(async (input: unknown): Promise<RepositoryCommitResult> => {
      void input;
      return { status: 'already_satisfied', outcome: { satisfied: true, assertions: [] } };
    }),
    revert: vi.fn(async (input: unknown): Promise<RepositoryCommitResult> => {
      void input;
      return { status: 'already_satisfied', outcome: { satisfied: true, assertions: [] } };
    }),
    clear: vi.fn(async (input: unknown) => {
      void input;
      return workspace;
    }),
  };
}

async function startServer(
  application: ReturnType<typeof applicationDouble>,
  stopActiveRuns?: (drawingId: string) => Promise<string[]>,
  dxfImports?: { import(input: unknown): Promise<unknown> },
): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api/drawings', createDrawingsRouter(
    application as unknown as DrawingApplication,
    stopActiveRuns ? { stopActiveRuns } : undefined,
    dxfImports as never,
  ));
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing test server address');
  return `http://127.0.0.1:${address.port}`;
}
