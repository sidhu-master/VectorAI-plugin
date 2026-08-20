/**
 * ObjectList - 左侧实体列表（支持多选）
 */
import { useMemo } from 'react';
import {
  ArrowRight,
  Circle,
  CornerUpRight,
  Crosshair,
  Dot,
  Eye,
  EyeOff,
  Minus,
  MoveHorizontal,
  Ruler,
  Shapes,
  Trash2,
  Type as TypeIcon,
} from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import type { AnnotationNode, GeometryNode } from '@/drawing';
import { isCanvasSelectable } from './canvas/canvas-policies';

type ListedNode = GeometryNode | AnnotationNode;
export type ObjectType = ListedNode['type'];

const ICON_CLASS = 'text-slate-500';
const ICON_SIZE = 15;

function GeometryGlyph({
  shape,
  children,
}: {
  shape: 'arc' | 'ellipse' | 'polyline' | 'spline' | 'section-hatch';
  children: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      data-icon-shape={shape}
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_CLASS}
    >
      {children}
    </svg>
  );
}

export function ObjectTypeIcon({ type }: { type: ObjectType }) {
  let icon: React.ReactNode;

  switch (type) {
    case 'point':
      icon = <Dot size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'line':
      icon = <Minus size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'ray':
      icon = <ArrowRight size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'xline':
      icon = <MoveHorizontal size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'circle':
      icon = <Circle size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'arc':
      icon = <GeometryGlyph shape="arc"><path d="M2.5 12.5A7.5 7.5 0 0 1 13.5 4.5" /></GeometryGlyph>;
      break;
    case 'ellipse':
      icon = <GeometryGlyph shape="ellipse"><ellipse cx="8" cy="8" rx="6" ry="3.8" /></GeometryGlyph>;
      break;
    case 'polyline':
      icon = <GeometryGlyph shape="polyline"><polyline points="2.5,12 5.5,5.5 9,10 13.5,3.5" /></GeometryGlyph>;
      break;
    case 'spline':
      icon = <GeometryGlyph shape="spline"><path d="M2.5 11.5C4 3.5 7.5 3.5 8.5 8.5S12.5 13 13.5 5" /></GeometryGlyph>;
      break;
    case 'text':
      icon = <TypeIcon size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'dimension':
      icon = <Ruler size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'leader':
      icon = <CornerUpRight size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'centerline':
      icon = <Crosshair size={ICON_SIZE} strokeWidth={1.6} className={ICON_CLASS} />;
      break;
    case 'section-hatch':
      icon = (
        <GeometryGlyph shape="section-hatch">
          <path d="M2 12L7 3M6 13L11 4M10 13L14 7" />
        </GeometryGlyph>
      );
      break;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }

  return (
    <span
      aria-hidden="true"
      data-object-type-icon={type}
      className="flex h-4 w-4 shrink-0 items-center justify-center"
    >
      {icon}
    </span>
  );
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
            const selectable = isCanvasSelectable(e);
            const selected = selectable && selectedIds.includes(e.id);
            return (
              <div
                key={e.id}
                className={`group flex items-center gap-2 border-l-2 px-3 py-2 transition hover:bg-white/[0.035] ${selectable ? 'cursor-pointer' : 'cursor-default'} ${
                  selected ? 'border-accent bg-accent/[0.07]' : 'border-transparent'
                }`}
                onClick={selectable
                  ? (ev) => selectEntity(e.id, ev.ctrlKey || ev.metaKey)
                  : undefined}
              >
                <ObjectTypeIcon type={e.type} />
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
