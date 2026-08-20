import { createEmptyDrawing } from '@/drawing';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspacePort,
} from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HomeWorkspace } from './Home';

describe('CAD workspace shell', () => {
  it('renders the shared drawing viewer and website assistant as sibling host surfaces', async () => {
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

    expect(html).toContain('aria-label="CAD 工作区"');
    expect(html).toContain('data-panel="drawing-workspace"');
    expect(html).toContain('data-host-adapter="website"');
    expect(html).toContain('data-workspace-state="ready"');
    expect(html).toContain('class="vai-workspace');
    expect(html).toContain('data-panel="assistant"');
    expect(html).toContain('AI 助手');
    expect(html).toContain('<svg');
    expect(html.match(/<textarea/g)).toHaveLength(1);
  });
});
