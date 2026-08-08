/**
 * ObjectList - 左侧实体列表（支持多选）
 */
import { useMemo } from 'react';
import { Circle, Dot, Eye, EyeOff, Minus, Shapes, Trash2 } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { AnnotationNode, GeometryNode } from '@/drawing';

type ListedNode = GeometryNode | AnnotationNode;

function typeIcon(type: ListedNode['type']) {
  const cls = 'text-slate-500';
  switch (type) {
    case 'circle': return <Circle size={14} className={cls} />;
    case 'line': return <Minus size={14} className={cls} />;
    case 'point': return <Dot size={16} className={cls} />;
    default: return <span className="w-4 text-center font-mono text-[8px] uppercase text-slate-500">{type.slice(0, 2)}</span>;
  }
}

export default function ObjectList() {
  const document = useStore((s) => s.document);
  const entities = useMemo<ListedNode[]>(() => document
    ? [...document.geometry, ...document.annotations]
    : [], [document]);
  const selectedIds = useStore((s) => s.selectedIds);
  const selectEntity = useStore((s) => s.selectEntity);
  const updateNode = useStore((s) => s.updateNode);
  const deleteNode = useStore((s) => s.deleteNode);

  const toggleVisible = (e: ListedNode, ev: React.MouseEvent) => {
    ev.stopPropagation();
    void updateNode(e.id, { visible: !e.visible });
  };

  const onDelete = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    void deleteNode(id);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-11 items-center justify-between border-b border-white/[0.06] px-3">
        <span className="text-[11px] font-medium text-slate-300">
          对象
        </span>
        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-500">
          {entities.length}
          {selectedIds.length > 0 && ` · 已选 ${selectedIds.length}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <Shapes size={20} className="mb-2 text-slate-700" />
            <p className="text-[11px] text-slate-500">暂无图元</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-700">通过 AI 对话导入或创建二维图纸</p>
          </div>
        ) : (
          entities.map((e) => {
            const selected = selectedIds.includes(e.id);
            return (
              <div
                key={e.id}
                className={`group flex cursor-pointer items-center gap-2 border-l-2 px-3 py-2 transition hover:bg-white/[0.035] ${
                  selected ? 'border-accent bg-accent/[0.07]' : 'border-transparent'
                }`}
                onClick={(ev) => selectEntity(e.id, ev.ctrlKey || ev.metaKey)}
              >
                {typeIcon(e.type)}
                <span className={`flex-1 truncate font-mono text-[10px] ${selected ? 'text-slate-200' : 'text-slate-400'}`}>
                  {e.id}
                </span>
                <button
                  className="text-slate-700 opacity-0 transition hover:text-accent group-hover:opacity-100"
                  onClick={(ev) => toggleVisible(e, ev)}
                  title={e.visible ? '隐藏' : '显示'}
                >
                  {e.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  className="text-slate-700 opacity-0 transition hover:text-danger group-hover:opacity-100"
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
