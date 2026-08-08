/**
 * Home - 三栏工作区主布局
 */
import TopToolbar from '@/components/TopToolbar';
import AIDialog from '@/components/AIDialog';
import Canvas from '@/components/Canvas';
import { CanvasErrorBoundary } from '@/components/CanvasErrorBoundary';
import ObjectList from '@/components/ObjectList';
import ParameterEditor from '@/components/ParameterEditor';
import StatusBar from '@/components/StatusBar';
import { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

export default function Home() {
  const initializeDrawing = useStore((state) => state.initializeDrawing);
  const drawingStatus = useStore((state) => state.drawingStatus);
  const drawingError = useStore((state) => state.drawingError);
  const canvasResetKey = useStore((state) => (
    `${state.revision ?? 'none'}:${state.document?.geometry.length ?? 0}:${state.document?.annotations.length ?? 0}`
  ));

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

  return <HomeWorkspace canvasResetKey={canvasResetKey} />;
}

export function HomeWorkspace({ canvasResetKey }: { canvasResetKey: string }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-base-900 text-slate-200" aria-label="CAD 工作区">
      <TopToolbar />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左栏：实体列表 + 参数编辑 */}
        <aside data-panel="inspector" className="hidden w-60 shrink-0 flex-col border-r border-white/[0.07] bg-base-700 lg:flex">
          <ObjectList />
          <ParameterEditor />
        </aside>

        {/* 中栏：SVG 画布 */}
        <CanvasErrorBoundary resetKey={canvasResetKey}>
          <Canvas />
        </CanvasErrorBoundary>

        {/* 右栏：AI 对话 */}
        <AIDialog />
      </main>

      <StatusBar />
    </div>
  );
}
