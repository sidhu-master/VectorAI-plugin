/**
 * ParameterEditor - 左侧参数编辑器（支持单选/多选）
 */
import { useStore } from '@/hooks/useStore';
import type { CircleEntity, GeometryEntity, LineEntity, PointEntity } from '@/core/types';

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
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        className="w-full rounded border border-white/10 bg-base-800 px-2 py-1 font-mono text-xs text-slate-200 focus:border-accent/50"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}

export default function ParameterEditor() {
  const entities = useStore((s) => s.model.entities);
  const selectedIds = useStore((s) => s.selectedIds);
  const updateEntity = useStore((s) => s.updateEntity);

  const selected = entities.filter((e) => selectedIds.includes(e.id));

  const singleEntity = selected.length === 1 ? selected[0] : null;

  return (
    <div className="flex h-64 flex-col border-t border-white/5 bg-base-700">
      <div className="border-b border-white/5 p-3">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
          参数编辑
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selected.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-600">Select an entity</p>
        ) : selected.length > 1 ? (
          <div className="space-y-2">
            <p className="text-center text-xs text-slate-400">
              {selected.length} entities selected
            </p>
            <div className="flex flex-wrap gap-1">
              {selected.map((e) => (
                <span
                  key={e.id}
                  className="rounded bg-base-600 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                >
                  {e.type}
                </span>
              ))}
            </div>
            <p className="pt-2 text-center text-xs text-slate-600">
              Ctrl+click to toggle individual selection
            </p>
          </div>
        ) : singleEntity ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent">{singleEntity.id}</span>
              <span className="rounded bg-base-600 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {singleEntity.type}
              </span>
            </div>

            {singleEntity.type === 'point' && (
              <PointFields entity={singleEntity as PointEntity} update={updateEntity} />
            )}
            {singleEntity.type === 'line' && (
              <LineFields entity={singleEntity as LineEntity} update={updateEntity} />
            )}
            {singleEntity.type === 'circle' && (
              <CircleFields entity={singleEntity as CircleEntity} update={updateEntity} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type UpdateFn = ReturnType<typeof useStore.getState>['updateEntity'];

function PointFields({ entity, update }: { entity: PointEntity; update: UpdateFn }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="x" value={entity.x} onChange={(v) => update(entity.id, { x: v } as Partial<PointEntity>)} />
      <Field label="y" value={entity.y} onChange={(v) => update(entity.id, { y: v } as Partial<PointEntity>)} />
    </div>
  );
}

function LineFields({ entity, update }: { entity: LineEntity; update: UpdateFn }) {
  const [sx, sy] = entity.start;
  const [ex, ey] = entity.end;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="start.x" value={sx} onChange={(v) => update(entity.id, { start: [v, sy] } as Partial<LineEntity>)} />
        <Field label="start.y" value={sy} onChange={(v) => update(entity.id, { start: [sx, v] } as Partial<LineEntity>)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="end.x" value={ex} onChange={(v) => update(entity.id, { end: [v, ey] } as Partial<LineEntity>)} />
        <Field label="end.y" value={ey} onChange={(v) => update(entity.id, { end: [ex, v] } as Partial<LineEntity>)} />
      </div>
    </div>
  );
}

function CircleFields({ entity, update }: { entity: CircleEntity; update: UpdateFn }) {
  const [cx, cy] = entity.center;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Field label="center.x" value={cx} onChange={(v) => update(entity.id, { center: [v, cy] } as Partial<CircleEntity>)} />
        <Field label="center.y" value={cy} onChange={(v) => update(entity.id, { center: [cx, v] } as Partial<CircleEntity>)} />
      </div>
      <Field label="radius" value={entity.radius} onChange={(v) => update(entity.id, { radius: v } as Partial<CircleEntity>)} />
    </div>
  );
}
