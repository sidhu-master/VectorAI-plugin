/**
 * StatusBar - 底部状态栏
 */
import { useStore } from '@/hooks/useStore';

export default function StatusBar() {
  const mouseCoords = useStore((s) => s.mouseCoords);
  const scale = useStore((s) => s.canvasTransform.scale);
  const unit = useStore((s) => s.document?.unitSystem.length ?? 'mm');
  const geometryCount = useStore((s) => s.document?.geometry.length ?? 0);
  const annotationCount = useStore((s) => s.document?.annotations.length ?? 0);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/[0.06] bg-base-900 px-3.5">
      <div className="font-mono text-[9px] text-slate-600">
        {mouseCoords ? (
          <span>
            X: {fmt(mouseCoords.x)}&nbsp;&nbsp;Y: {fmt(mouseCoords.y)}
          </span>
        ) : (
          <span>X: --&nbsp;&nbsp;Y: --</span>
        )}
      </div>

      <div className="text-[9px] uppercase tracking-wider text-slate-700">{unit}</div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[9px] text-slate-600">
          {Math.round(scale * 100)}%
        </span>
        <span className="border-l border-white/[0.07] pl-3 font-mono text-[9px] text-slate-600">
          {geometryCount} 个图元
          {annotationCount > 0 ? ` · ${annotationCount} 个标注` : ''}
        </span>
      </div>
    </footer>
  );
}
