// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingLayerCategory,
  DrawingLayerDefinition,
  DrawingLayerIcon,
} from '@vectorai/drawing-surface-api';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  DraftingCompass,
  Eye,
  EyeOff,
  Gauge,
  Layers,
  Layers3,
  Ruler,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

export interface DrawingLayerManagerItem {
  definition: DrawingLayerDefinition;
  visible: boolean;
  children?: readonly DrawingLayerManagerItem[];
}

export interface DrawingLayerManagerProps {
  layers: readonly DrawingLayerManagerItem[];
  onVisibilityChange(id: string, visible: boolean): void;
}

const CATEGORY_LABELS: Record<DrawingLayerCategory, string> = {
  engineering: '工程信息',
  cad: '原始 CAD 图层',
  assistant: 'AI 信息',
  interaction: '编辑辅助',
};

const CATEGORY_ORDER: readonly DrawingLayerCategory[] = [
  'engineering',
  'cad',
  'assistant',
  'interaction',
];

const LAYER_ICONS: Record<DrawingLayerIcon, LucideIcon> = {
  partition: Boxes,
  angle: DraftingCompass,
  dimension: Ruler,
  tolerance: Gauge,
  cad: Layers,
  assistant: Sparkles,
};

export function DrawingLayerManager({ layers, onVisibilityChange }: DrawingLayerManagerProps) {
  const [open, setOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  if (layers.length === 0) return null;

  const groups = CATEGORY_ORDER.flatMap((category) => {
    const items = layers.filter(({ definition }) => definition.category === category);
    return items.length === 0 ? [] : [{ category, items }];
  });

  const stopPointer = (event: MouseEvent<HTMLDivElement>) => event.stopPropagation();
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setOpen(false);
  };
  const renderItem = ({ definition, visible, children }: DrawingLayerManagerItem, depth = 0) => {
    const LayerIcon = definition.icon === undefined ? Layers : LAYER_ICONS[definition.icon];
    const expandable = Boolean(children?.length);
    const collapsed = collapsedIds.has(definition.id);
    return <div key={definition.id} className="vai-layer-manager__branch" data-layer-depth={depth}>
      <div className="vai-layer-manager__row">
        {expandable
          ? <button
            type="button"
            className="vai-layer-manager__disclosure"
            aria-label={`${collapsed ? '展开' : '收起'}${definition.label}`}
            aria-expanded={!collapsed}
            onClick={() => setCollapsedIds((current) => {
              const next = new Set(current);
              if (collapsed) next.delete(definition.id); else next.add(definition.id);
              return next;
            })}
          >{collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
          : <span className="vai-layer-manager__disclosure-spacer" />}
        <button
          type="button"
          className="vai-layer-manager__item"
          aria-label={`${visible ? '隐藏' : '显示'}${definition.label}`}
          aria-pressed={visible}
          onClick={() => onVisibilityChange(definition.id, !visible)}
        >
          <LayerIcon size={15} aria-hidden="true" />
          <span>{definition.label}</span>
          {visible ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
        </button>
      </div>
      {expandable && !collapsed && <div className="vai-layer-manager__children">
        {children!.map((child) => renderItem(child, depth + 1))}
      </div>}
    </div>;
  };

  return <div
    ref={rootRef}
    className="vai-layer-manager"
    data-layer-manager="true"
    onMouseDown={stopPointer}
    onClick={stopPointer}
    onKeyDown={handleKeyDown}
  >
    <button
      type="button"
      className="vai-layer-manager__trigger"
      aria-label="管理图层"
      aria-expanded={open}
      title="图层显示"
      onClick={() => setOpen((current) => !current)}
    >
      <Layers3 size={17} aria-hidden="true" />
    </button>
    {open && <div className="vai-layer-manager__menu" role="dialog" aria-label="图层显示">
      {groups.map(({ category, items }) => <section key={category} className="vai-layer-manager__group">
        <h3 data-layer-category={category}>{CATEGORY_LABELS[category]}</h3>
        {items.map((item) => renderItem(item))}
      </section>)}
    </div>}
  </div>;
}
