/**
 * ParameterEditor - 左侧参数编辑器（支持单选/多选）
 */
import { useStore } from '@/hooks/useStore';
import type { CircleGeometry, GeometryNode, LineGeometry, PointGeometry } from '@/drawing';

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] text-slate-600">{label}</span>
      <input
        type="number"
        className="w-full rounded-md border border-white/[0.08] bg-base-800 px-2 py-1.5 font-mono text-[10px] text-slate-300 transition focus:border-accent/45"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

export default function ParameterEditor() {
  const entities = useStore((s) => s.document?.geometry ?? []);
  const selectedIds = useStore((s) => s.selectedIds);
  const updateNode = useStore((s) => s.updateNode);

  const selected = entities.filter((e) => selectedIds.includes(e.id));

  const singleEntity = selected.length === 1 ? selected[0] : null;

  return (
    <div className="flex h-64 flex-col border-t border-white/[0.06] bg-base-700">
      <div className="flex h-11 items-center border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-medium text-slate-300">
          属性
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selected.length === 0 ? (
          <p className="py-8 text-center text-[10px] leading-4 text-slate-600">选择一个图元以查看参数</p>
        ) : selected.length > 1 ? (
          <div className="space-y-2">
            <p className="text-center text-[10px] text-slate-400">
              已选择 {selected.length} 个图元
            </p>
            <div className="flex flex-wrap gap-1">
              {selected.map((e) => (
                <span
                  key={e.id}
                  className="rounded-md bg-accent/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-accent"
                >
                  {e.type}
                </span>
              ))}
            </div>
            <p className="pt-2 text-center text-[10px] text-slate-600">
              按住 Ctrl 点击可调整多选
            </p>
          </div>
        ) : singleEntity ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-[10px] text-slate-300">{singleEntity.id}</span>
              <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
                {singleEntity.type}
              </span>
            </div>

            {singleEntity.type === 'point' && (
              <PointFields entity={singleEntity as PointGeometry} update={updateNode} />
            )}
            {singleEntity.type === 'line' && (
              <LineFields entity={singleEntity as LineGeometry} update={updateNode} />
            )}
            {singleEntity.type === 'circle' && (
              <CircleFields entity={singleEntity as CircleGeometry} update={updateNode} />
            )}
            {!['point', 'line', 'circle'].includes(singleEntity.type) && (
              <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] leading-4 text-slate-600">
                当前图元已支持显示与选择，参数编辑将在后续版本逐步开放。
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type UpdateFn = ReturnType<typeof useStore.getState>['updateNode'];

function PointFields({ entity, update }: { entity: PointGeometry; update: UpdateFn }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="x" value={entity.x} onChange={(v) => void update(entity.id, { x: v })} />
      <Field label="y" value={entity.y} onChange={(v) => void update(entity.id, { y: v })} />
    </div>
  );
}

function LineFields({ entity, update }: { entity: LineGeometry; update: UpdateFn }) {
  const [sx, sy] = entity.start;
  const [ex, ey] = entity.end;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="start.x" value={sx} onChange={(v) => void update(entity.id, { start: [v, sy] })} />
        <Field label="start.y" value={sy} onChange={(v) => void update(entity.id, { start: [sx, v] })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="end.x" value={ex} onChange={(v) => void update(entity.id, { end: [v, ey] })} />
        <Field label="end.y" value={ey} onChange={(v) => void update(entity.id, { end: [ex, v] })} />
      </div>
    </div>
  );
}

function CircleFields({ entity, update }: { entity: CircleGeometry; update: UpdateFn }) {
  const [cx, cy] = entity.center;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="center.x" value={cx} onChange={(v) => void update(entity.id, { center: [v, cy] })} />
        <Field label="center.y" value={cy} onChange={(v) => void update(entity.id, { center: [cx, v] })} />
      </div>
      <Field label="radius" value={entity.radius} onChange={(v) => void update(entity.id, { radius: v })} />
    </div>
  );
}
