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
    <div className="flex h-screen flex-col overflow-hidden bg-base-900">
      <TopToolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* 左栏：实体列表 + 参数编辑 */}
        <div className="flex w-64 flex-col border-r border-white/5 bg-base-700">
          <ObjectList />
          <ParameterEditor />
        </div>

        {/* 中栏：SVG 画布 */}
        <CanvasErrorBoundary resetKey={canvasResetKey}>
          <Canvas />
        </CanvasErrorBoundary>

        {/* 右栏：AI 对话 */}
        <AIDialog />
      </div>

      <StatusBar />
    </div>
  );
}
