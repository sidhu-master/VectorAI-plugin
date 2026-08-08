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
import { useStore } from '@/hooks/useStore';

export default function Home() {
  const canvasResetKey = useStore((state) => (
    `${state.model.metadata.timestamp}:${state.history.cursor}:${state.model.entities.length}`
  ));

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
