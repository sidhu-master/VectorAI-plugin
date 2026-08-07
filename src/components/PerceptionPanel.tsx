/**
 * PerceptionPanel - 图片感知结果展示面板
 */
import { useState } from 'react';
import { Check, CheckCheck, X } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { GeometryEntity } from '@/core/types';

function entitySummary(e: GeometryEntity): string {
  switch (e.type) {
    case 'point':
      return `x=${e.x}, y=${e.y}`;
    case 'line':
      return `start=[${e.start[0]},${e.start[1]}], end=[${e.end[0]},${e.end[1]}]`;
    case 'circle':
      return `center=[${e.center[0]},${e.center[1]}], r=${e.radius}`;
    default:
      return '';
  }
}

function confidenceColor(c: number): string {
  if (c > 0.8) return '#22c55e';
  if (c >= 0.6) return '#eab308';
  return '#ef4444';
}

export default function PerceptionPanel() {
  const perceptionResults = useStore((s) => s.perceptionResults);
  const confirmAll = useStore((s) => s.confirmAll);
  const confirmResults = useStore((s) => s.confirmResults);
  const rejectResult = useStore((s) => s.rejectResult);

  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkedIds = perceptionResults
    .filter((r) => checked.has(r.resultId))
    .map((r) => r.resultId);

  return (
    <div className="border-b border-accent/20 bg-base-800">
      <div className="flex items-center justify-between border-b border-white/5 p-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">识别结果</span>
          <span className="rounded bg-base-600 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {perceptionResults.length}
          </span>
        </div>
        <button
          className="flex items-center gap-1 rounded border border-accent/40 px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
          onClick={confirmAll}
        >
          <CheckCheck size={12} />
          全部确认
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {perceptionResults.map((r) => (
          <div
            key={r.resultId}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-base-700"
          >
            <input
              type="checkbox"
              className="h-3 w-3 shrink-0 accent-[#22d3ee]"
              checked={checked.has(r.resultId)}
              onChange={() => toggle(r.resultId)}
            />
            <span className="flex-1 truncate font-mono text-xs text-slate-400">
              <span className="text-slate-500">{r.entity.type}: </span>
              {entitySummary(r.entity)}
            </span>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: confidenceColor(r.confidence) }}
              title={`置信度 ${Math.round(r.confidence * 100)}%`}
            />
            <button
              className="shrink-0 text-slate-500 hover:text-danger"
              onClick={() => rejectResult(r.resultId)}
              title="拒绝"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-2">
        <button
          className="w-full rounded border border-accent/40 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
          onClick={() => confirmResults(checkedIds)}
          disabled={checkedIds.length === 0}
        >
          <span className="flex items-center justify-center gap-1">
            <Check size={12} />
            确认选中 ({checkedIds.length})
          </span>
        </button>
      </div>
    </div>
  );
}
