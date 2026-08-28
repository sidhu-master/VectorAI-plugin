// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingLayerCategory,
  DrawingLayerDefinition,
  DrawingLayerIcon,
} from '@vectorai/drawing-surface-api';
import {
  Boxes,
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
        {items.map(({ definition, visible }) => {
          const LayerIcon = definition.icon === undefined ? Layers : LAYER_ICONS[definition.icon];
          return <button
            key={definition.id}
            type="button"
            className="vai-layer-manager__item"
            aria-label={`${visible ? '隐藏' : '显示'}${definition.label}`}
            aria-pressed={visible}
            onClick={() => onVisibilityChange(definition.id, !visible)}
          >
            <LayerIcon size={15} aria-hidden="true" />
            <span>{definition.label}</span>
            {visible
              ? <Eye size={15} aria-hidden="true" />
              : <EyeOff size={15} aria-hidden="true" />}
          </button>;
        })}
      </section>)}
    </div>}
  </div>;
}

