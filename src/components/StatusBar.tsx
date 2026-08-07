/**
 * StatusBar - 底部状态栏
 */
import { useStore } from '@/hooks/useStore';

export default function StatusBar() {
  const mouseCoords = useStore((s) => s.mouseCoords);
  const scale = useStore((s) => s.canvasTransform.scale);
  const unit = useStore((s) => s.model.metadata.unit);
  const entityCount = useStore((s) => s.model.entities.length);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <footer className="flex h-7 items-center justify-between border-t border-white/5 bg-base-900 px-4">
      <div className="font-mono text-xs text-slate-500">
        {mouseCoords ? (
          <span>
            X: {fmt(mouseCoords.x)}&nbsp;&nbsp;Y: {fmt(mouseCoords.y)}
          </span>
        ) : (
          <span>X: --&nbsp;&nbsp;Y: --</span>
        )}
      </div>

      <div className="text-xs text-slate-500">{unit}</div>

      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-slate-500">
          {Math.round(scale * 100)}%
        </span>
        <span className="font-mono text-xs text-slate-500">
          {entityCount} entities
        </span>
      </div>
    </footer>
  );
}
