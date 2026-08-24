import { createEmptyDrawing } from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspacePort,
} from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HomeWorkspace } from './Home';

describe('local drawing workspace preview', () => {
  it('renders only the shared viewer through the browser-local adapter', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'home-drawing' }, now: () => 1 });
    const port: DrawingWorkspacePort = {
      async load() {
        return {
          version: 1,
          ref: { drawingId: 'home-drawing', revision: 1 },
          document,
          capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
        };
      },
      async commit() {
        return { status: 'rejected', message: 'read only fixture' };
      },
    };
    const workspaceStore = createDrawingWorkspaceStore({ port });
    await workspaceStore.getState().load();

    const html = renderToStaticMarkup(<HomeWorkspace workspaceStore={workspaceStore} />);

    expect(html).toContain('aria-label="二维空间预览"');
    expect(html).toContain('data-panel="drawing-workspace"');
    expect(html).toContain('data-host-adapter="browser-local"');
    expect(html).toContain('data-workspace-state="ready"');
    expect(html).toContain('class="vai-workspace');
    expect(html).not.toContain('data-panel="assistant"');
    expect(html).not.toContain('AI 助手');
    expect(html).not.toContain('/api');
  });
});
