// SPDX-License-Identifier: Apache-2.0

import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
} from '@vectorai/drawing-viewer-react';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceStore,
} from '@vectorai/drawing-workspace';
import { useMemo } from 'react';

import { createBrowserLocalDrawingWorkspacePort } from '@/adapters/browser-local-drawing-workspace-port';

export default function Home() {
  return <HomeWorkspace />;
}

export function HomeWorkspace({ workspaceStore }: { workspaceStore?: DrawingWorkspaceStore } = {}) {
  const browserWorkspaceStore = useMemo(
    () => createDrawingWorkspaceStore({ port: createBrowserLocalDrawingWorkspacePort() }),
    [],
  );
  const activeWorkspaceStore = workspaceStore ?? browserWorkspaceStore;

  return (
    <main className="preview-shell" aria-label="二维空间预览">
      <section
        className="preview-workspace"
        data-panel="drawing-workspace"
        data-host-adapter="browser-local"
      >
        <DrawingWorkspaceProvider store={activeWorkspaceStore}>
          <DrawingWorkspace />
        </DrawingWorkspaceProvider>
      </section>
    </main>
  );
}
