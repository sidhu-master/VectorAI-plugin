/**
 * ObjectList - 左侧实体列表（支持多选）
 */
import { Circle, Dot, Eye, EyeOff, Minus, Trash2 } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { EntityType, GeometryEntity } from '@/core/types';

function typeIcon(type: EntityType) {
  const cls = 'text-slate-500';
  switch (type) {
    case 'circle': return <Circle size={14} className={cls} />;
    case 'line': return <Minus size={14} className={cls} />;
    case 'point': return <Dot size={16} className={cls} />;
    default: return null;
  }
}

export default function ObjectList() {
  const entities = useStore((s) => s.model.entities);
  const selectedIds = useStore((s) => s.selectedIds);
  const selectEntity = useStore((s) => s.selectEntity);
  const updateEntity = useStore((s) => s.updateEntity);
  const deleteEntity = useStore((s) => s.deleteEntity);

  const toggleVisible = (e: GeometryEntity, ev: React.MouseEvent) => {
    ev.stopPropagation();
    updateEntity(e.id, { visible: !e.visible });
  };

  const onDelete = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    deleteEntity(id);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 p-3">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
          实体列表
        </span>
        <span className="rounded bg-base-600 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {entities.length} entities
          {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-600">No entities yet</p>
        ) : (
          entities.map((e) => {
            const selected = selectedIds.includes(e.id);
            return (
              <div
                key={e.id}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-base-600 ${
                  selected ? 'border-l-2 border-accent bg-base-600' : 'border-l-2 border-transparent'
                }`}
                onClick={(ev) => selectEntity(e.id, ev.ctrlKey || ev.metaKey)}
              >
                {typeIcon(e.type)}
                <span className="flex-1 truncate font-mono text-xs text-slate-300">
                  {e.id}
                </span>
                <button
                  className="text-slate-500 hover:text-accent"
                  onClick={(ev) => toggleVisible(e, ev)}
                  title={e.visible ? '隐藏' : '显示'}
                >
                  {e.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  className="text-slate-500 hover:text-danger"
                  onClick={(ev) => onDelete(e.id, ev)}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
