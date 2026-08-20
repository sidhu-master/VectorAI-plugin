/**
 * Home - 三栏工作区主布局
 */
import TopToolbar from '@/components/TopToolbar';
import AIDialog from '@/components/AIDialog';
import { useEffect, useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import {
  DrawingWorkspace,
  DrawingWorkspaceProvider,
} from '@vectorai/drawing-viewer-react';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceStore,
} from '@vectorai/drawing-workspace';
import { createWebsiteDrawingWorkspacePort } from '@/adapters/website-drawing-workspace-port';

export default function Home() {
  const initializeDrawing = useStore((state) => state.initializeDrawing);
  const drawingStatus = useStore((state) => state.drawingStatus);
  const drawingError = useStore((state) => state.drawingError);
  useEffect(() => {
    void initializeDrawing();
  }, [initializeDrawing]);

  if (drawingStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-base-900 text-[12px] text-slate-500">
        <Loader2 size={15} className="animate-spin text-accent" />
        正在打开本地图纸…
      </div>
    );
  }

  if (drawingStatus === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-base-900 p-6 text-slate-300">
        <div className="max-w-md rounded-xl border border-danger/20 bg-danger/[0.05] p-5 text-center">
          <AlertTriangle className="mx-auto text-danger" size={20} />
          <p className="mt-3 text-[13px]">无法打开本地图纸</p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{drawingError}</p>
          <button
            type="button"
            className="mt-4 rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/[0.04]"
            onClick={() => void initializeDrawing()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return <HomeWorkspace />;
}

export function HomeWorkspace({ workspaceStore }: { workspaceStore?: DrawingWorkspaceStore } = {}) {
  const websiteWorkspaceStore = useMemo(() => createDrawingWorkspaceStore({
    port: createWebsiteDrawingWorkspacePort(useStore),
  }), []);
  const activeWorkspaceStore = workspaceStore ?? websiteWorkspaceStore;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base-900 text-slate-200" aria-label="CAD 工作区">
      <TopToolbar />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section
          data-panel="drawing-workspace"
          data-host-adapter="website"
          className="min-w-0 flex-1"
        >
          <DrawingWorkspaceProvider store={activeWorkspaceStore}>
            <DrawingWorkspace />
          </DrawingWorkspaceProvider>
        </section>

        <AIDialog />
      </main>
    </div>
  );
}
