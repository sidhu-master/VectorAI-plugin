/**
 * TopToolbar - 顶部工具栏
 * Logo / AI 连接状态 / 缩放控制 / DXF 导出 / 清空
 */
import { useEffect, useState } from 'react';
import { Download, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore } from '@/hooks/useStore';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export default function TopToolbar() {
  const canvasTransform = useStore((s) => s.canvasTransform);
  const setCanvasTransform = useStore((s) => s.setCanvasTransform);
  const exportDXF = useStore((s) => s.exportDXF);
  const clearAll = useStore((s) => s.clearAll);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then((d) => {
        if (active) setConnected(Boolean(d.connected));
      })
      .catch(() => {
        if (active) setConnected(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const scale = canvasTransform.scale;
  const zoomBy = (factor: number) => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    setCanvasTransform({ scale: next });
  };

  return (
    <header className="flex h-12 items-center justify-between border-b border-white/5 bg-base-900 px-4">
      {/* Logo */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-bold text-accent">VectorAI</span>
        <span className="text-xs text-slate-500">Spatial Protocol</span>
      </div>

      {/* AI 状态 */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            connected ? 'bg-green-500' : 'bg-slate-600'
          }`}
        />
        <span className="text-xs text-slate-400">
          {connected ? 'AI Connected' : 'Demo Mode'}
        </span>
      </div>

      {/* 右侧操作 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-slate-400">
          <button
            className="rounded p-1 hover:bg-base-600 hover:text-slate-200"
            onClick={() => zoomBy(1 / 1.2)}
            title="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <span className="font-mono text-xs text-slate-500 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="rounded p-1 hover:bg-base-600 hover:text-slate-200"
            onClick={() => zoomBy(1.2)}
            title="放大"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        <button
          className="flex items-center gap-1 rounded border border-accent/30 px-3 py-1 font-mono text-xs text-accent hover:bg-accent/10"
          onClick={exportDXF}
        >
          <Download size={12} />
          导出 DXF
        </button>

        <button
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-danger"
          onClick={clearAll}
        >
          <Trash2 size={12} />
          清空
        </button>
      </div>
    </header>
  );
}
