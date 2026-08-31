// SPDX-License-Identifier: Apache-2.0

import type { DrawingWorkspaceSnapshot } from '@vectorai/drawing-workspace';
import { DRAWING_DXF_EXPORT_PATH } from '@vectorai/plugin-space-contracts';

/** First-layer download capability shared by the default and extended workspaces. */
export interface DrawingFileExport {
  download(sessionId: string, snapshot: DrawingWorkspaceSnapshot, endpoint?: string): Promise<DrawingFileExportResult>;
}

export interface DrawingFileExportResult {
  status: 'saved';
  filename: string;
  path: string;
}

/** DSH-standard same-origin download backed by the first-layer Host. */
export function createDrawingFileExport(): DrawingFileExport {
  return {
    async download(sessionId, snapshot, endpoint = DRAWING_DXF_EXPORT_PATH) {
      const url = new URL(endpoint, hostBase());
      url.searchParams.set('sessionId', sessionId);
      url.searchParams.set('drawingId', snapshot.ref.drawingId);
      url.searchParams.set('revision', String(snapshot.ref.revision));
      const response = await fetch(url, { method: 'POST' });
      const result = await response.json() as {
        status: 'saved' | 'error';
        filename?: string;
        path?: string;
        message?: string;
      };
      if (!response.ok || result.status !== 'saved' || result.path === undefined) {
        throw new Error(result.message ?? `DXF export failed: HTTP ${response.status}`);
      }
      return { status: 'saved', filename: result.filename ?? 'drawing.dxf', path: result.path };
    },
  };
}

function hostBase(): string {
  const origin = globalThis.location?.origin;
  return origin !== undefined && origin !== 'null' ? origin : 'http://dsh.internal';
}
