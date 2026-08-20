/** Website host header. Drawing viewport controls live in the shared Viewer. */
import {
  DraftingCompass,
  Download,
  Eye,
  EyeOff,
  Trash2,
  Undo2,
} from 'lucide-react';

import { useStore } from '@/hooks/useStore';

export function AnnotationVisibilityButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition ${
        visible
          ? 'border-fuchsia-300/20 bg-fuchsia-300/[0.07] text-fuchsia-200'
          : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:text-slate-200'
      }`}
      onClick={onToggle}
      title={visible ? '隐藏全部标注' : '显示全部标注'}
      aria-pressed={visible}
    >
      {visible ? <Eye size={13} /> : <EyeOff size={13} />}
      标注
    </button>
  );
}

export default function TopToolbar() {
  const clearDrawing = useStore((state) => state.clearDrawing);
  const revertLatest = useStore((state) => state.revertLatest);
  const commits = useStore((state) => state.commits);
  const drawingBusy = useStore((state) => state.drawingBusy);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] bg-base-900 px-3.5">
      <div className="flex min-w-[220px] items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.035] text-accent">
          <DraftingCompass size={15} />
        </span>
        <div className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight text-slate-100">维构 AI</span>
          <span className="block text-[9px] tracking-wide text-slate-600">二维空间编辑器</span>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="text-[10px] text-slate-500">本地模式</span>
      </div>

      <div className="flex min-w-[220px] items-center justify-end gap-2">
        <button
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[10px] font-medium text-slate-600"
          disabled
          title="DXF 导出适配器将在 Drawing Core 迁移后接入"
        >
          <Download size={12} />
          导出 DXF
        </button>
        <button
          className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
          onClick={() => void revertLatest()}
          disabled={drawingBusy || commits.length === 0}
          title="撤销上一次增量修改"
        >
          <Undo2 size={13} />
        </button>
        <button
          className="flex items-center gap-1 rounded-md p-1.5 text-slate-600 transition hover:bg-danger/[0.06] hover:text-red-300"
          onClick={() => void clearDrawing()}
          disabled={drawingBusy}
          title="清空图纸"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </header>
  );
}
