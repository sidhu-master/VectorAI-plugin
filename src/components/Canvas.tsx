/**
 * Canvas - SVG 几何渲染器
 * 坐标系：CAD 约定（Y 轴向上），通过 transform 翻转 SVG 的 Y 轴。
 * 支持：鼠标拖动平移、滚轮缩放、自动适配视图、Ctrl+多选、Ctrl+框选。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import type { DrawingRelation } from '@/drawing';
import EntityRenderer from './canvas/EntityRenderer';
import {
  aabbIntersects,
  entityBounds,
  entityCenter,
  modelBounds,
  type DrawingRenderable,
} from './canvas/geometry';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const FIT_PADDING = 1.3;
const DRAG_THRESHOLD = 4; // 拖动判定阈值（像素）

export default function Canvas() {
  const document = useStore((s) => s.document);
  const selectedIds = useStore((s) => s.selectedIds);
  const showGrid = useStore((s) => s.showGrid);
  const showRelations = useStore((s) => s.showRelations);
  const canvasTransform = useStore((s) => s.canvasTransform);
  const setCanvasTransform = useStore((s) => s.setCanvasTransform);
  const selectEntity = useStore((s) => s.selectEntity);
  const selectEntities = useStore((s) => s.selectEntities);
  const clearSelection = useStore((s) => s.clearSelection);
  const setMouseCoords = useStore((s) => s.setMouseCoords);

  const { scale, offsetX, offsetY } = canvasTransform;
  const entities = useMemo<DrawingRenderable[]>(() => document
    ? [...document.geometry, ...document.annotations]
    : [], [document]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // 交互状态
  const isDraggingRef = useRef(false);
  const isSelectingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [cursor, setCursor] = useState('grab');
  const hasAutoFitRef = useRef(false);

  // 框选状态
  const [selBox, setSelBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // 标记鼠标是否移动过（区分点击和拖动）
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;

  // 自动适配
  useEffect(() => {
    if (entities.length > 0 && !hasAutoFitRef.current && w > 0 && h > 0) {
      const bbox = modelBounds(entities);
      if (bbox) {
        const bw = bbox.maxX - bbox.minX || 100;
        const bh = bbox.maxY - bbox.minY || 100;
        const cx = (bbox.minX + bbox.maxX) / 2;
        const cy = (bbox.minY + bbox.maxY) / 2;
        const fitScale = Math.min(w / (bw * FIT_PADDING), h / (bh * FIT_PADDING), 5);
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitScale));
        setCanvasTransform({ scale: clamped, offsetX: w / 2 - cx * clamped, offsetY: h / 2 + cy * clamped });
        hasAutoFitRef.current = true;
      }
    }
    if (entities.length === 0) hasAutoFitRef.current = false;
  }, [entities, w, h, setCanvasTransform]);

  // 屏幕坐标 -> 世界坐标
  const toWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - offsetX) / scale,
    y: (offsetY - sy) / scale,
  }), [offsetX, offsetY, scale]);

  const worldLeft = w ? -offsetX / scale : 0;
  const worldRight = w ? (w - offsetX) / scale : 0;
  const worldBottom = h ? (offsetY - h) / scale : 0;
  const worldTop = offsetY / scale;

  // 网格
  const minorLines: React.ReactElement[] = [];
  const majorLines: React.ReactElement[] = [];
  if (showGrid && w && h) {
    const x0 = Math.floor(worldLeft / 10) * 10;
    const x1 = Math.ceil(worldRight / 10) * 10;
    const y0 = Math.floor(worldBottom / 10) * 10;
    const y1 = Math.ceil(worldTop / 10) * 10;
    for (let x = x0; x <= x1; x += 10) {
      const arr = x % 50 === 0 ? majorLines : minorLines;
      arr.push(<line key={`vx${x}`} x1={x} y1={worldBottom} x2={x} y2={worldTop} vectorEffect="non-scaling-stroke" />);
    }
    for (let y = y0; y <= y1; y += 10) {
      const arr = y % 50 === 0 ? majorLines : minorLines;
      arr.push(<line key={`hy${y}`} x1={worldLeft} y1={y} x2={worldRight} y2={y} vectorEffect="non-scaling-stroke" />);
    }
  }

  // 坐标轴标签
  const axisLabels: React.ReactElement[] = [];
  if (w && h) {
    const x0 = Math.ceil(worldLeft / 50) * 50;
    const x1 = Math.floor(worldRight / 50) * 50;
    for (let x = x0; x <= x1; x += 50) {
      if (x === 0) continue;
    axisLabels.push(<text key={`lx${x}`} x={offsetX + x * scale} y={offsetY + 12} className="fill-slate-700 font-mono" fontSize={9} textAnchor="middle">{x}</text>);
    }
    const y0 = Math.ceil(worldBottom / 50) * 50;
    const y1 = Math.floor(worldTop / 50) * 50;
    for (let y = y0; y <= y1; y += 50) {
      if (y === 0) continue;
      axisLabels.push(<text key={`ly${y}`} x={offsetX + 4} y={offsetY - y * scale - 3} className="fill-slate-700 font-mono" fontSize={9} textAnchor="start">{y}</text>);
    }
  }

  const entityById = (id: string) => entities.find((entity) => entity.id === id);

  // 渲染实体（含透明点击区域）
  const renderEntity = (e: DrawingRenderable) => {
    const onClick = (ev: React.MouseEvent<SVGGElement>) => {
      ev.stopPropagation();
      if (!hasMovedRef.current) {
        selectEntity(e.id, ev.ctrlKey || ev.metaKey);
      }
    };
    const onMouseDown = (ev: React.MouseEvent<SVGGElement>) => {
      hasMovedRef.current = false;
      ev.stopPropagation();
    };
    return (
      <EntityRenderer
        key={e.id}
        entity={e}
        scale={scale}
        viewport={{ minX: worldLeft, minY: worldBottom, maxX: worldRight, maxY: worldTop }}
        selected={selectedIds.includes(e.id)}
        onSelect={onClick}
        onPointerDown={onMouseDown}
      />
    );
  };

  // 关系连线
  const relationLines: React.ReactElement[] = [];
  const relationLabels: React.ReactElement[] = [];
  if (showRelations) {
    (document?.relations ?? []).forEach((relation: DrawingRelation, i) => {
      const pts = relationNodeIds(relation).map(entityById).filter(Boolean) as DrawingRenderable[];
      if (pts.length < 2) return;
      for (let j = 0; j < pts.length - 1; j += 1) {
        const a = entityCenter(pts[j]);
        const b = entityCenter(pts[j + 1]);
        if (!a || !b) continue;
        const [ax, ay] = a;
        const [bx, by] = b;
        relationLines.push(<line key={`rel${i}-${j}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#7893a6" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="breathe" />);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        relationLabels.push(<text key={`rl${i}-${j}`} x={offsetX + mx * scale} y={offsetY - my * scale - 4} className="fill-relation-light font-mono" fontSize={9} textAnchor="middle">{relation.kind}</text>);
      }
    });
  }

  // 滚轮缩放
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    const ratio = next / scale;
    setCanvasTransform({ scale: next, offsetX: px - (px - offsetX) * ratio, offsetY: py + (offsetY - py) * ratio });
  };

  // 鼠标按下：决定是拖动还是框选
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const ctrl = e.ctrlKey || e.metaKey;
    hasMovedRef.current = false;

    dragStartRef.current = { x: e.clientX, y: e.clientY, offsetX, offsetY };

    if (ctrl) {
      // Ctrl+拖动：框选模式
      isSelectingRef.current = true;
      setSelBox({ x1: sx, y1: sy, x2: sx, y2: sy });
      setCursor('crosshair');
    } else {
      // 普通拖动：平移模式
      isDraggingRef.current = true;
      setCursor('grabbing');
    }
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
      }

      if (isSelectingRef.current) {
        // 框选：更新选框
        setSelBox({ x1: dragStartRef.current.x - rect.left, y1: dragStartRef.current.y - rect.top, x2: sx, y2: sy });
      } else if (isDraggingRef.current) {
        // 平移
        setCanvasTransform({ offsetX: dragStartRef.current.offsetX + dx, offsetY: dragStartRef.current.offsetY + dy });
      } else {
        // 悬停：更新坐标
        setMouseCoords(toWorld(sx, sy));
      }
    },
    [setCanvasTransform, setMouseCoords, toWorld],
  );

  const onMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isSelectingRef.current) {
      // 框选结束：计算选中的实体
      isSelectingRef.current = false;
      setCursor('grab');

      if (selBox) {
        // 选框屏幕坐标 -> 世界坐标
        const w1 = toWorld(Math.min(selBox.x1, selBox.x2), Math.min(selBox.y1, selBox.y2));
        const w2 = toWorld(Math.max(selBox.x1, selBox.x2), Math.max(selBox.y1, selBox.y2));
        const selBBox = { minX: Math.min(w1.x, w2.x), minY: Math.min(w1.y, w2.y), maxX: Math.max(w1.x, w2.x), maxY: Math.max(w1.y, w2.y) };

        // 检测相交
        const hits = entities
          .filter((entity) => {
            if (!entity.visible) return false;
            const bounds = entityBounds(entity);
            return bounds !== null && aabbIntersects(bounds, selBBox);
          })
          .map((e) => e.id);

        if (hits.length > 0) {
          // Ctrl+框选：追加到已有选择
          if (e.ctrlKey || e.metaKey) {
            const existing = new Set(selectedIds);
            hits.forEach((id) => existing.add(id));
            selectEntities(Array.from(existing));
          } else {
            selectEntities(hits);
          }
        }
      }
      setSelBox(null);
    }

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setCursor('grab');
      // 如果没移动过，视为点击背景 -> 清空选择
      if (!hasMovedRef.current) {
        clearSelection();
      }
    }
  };

  const onMouseLeave = () => {
    isDraggingRef.current = false;
    isSelectingRef.current = false;
    setCursor('grab');
    setSelBox(null);
    setMouseCoords(null);
  };

  // 框选矩形（屏幕坐标）
  const selRect = selBox
    ? {
        x: Math.min(selBox.x1, selBox.x2),
        y: Math.min(selBox.y1, selBox.y2),
        w: Math.abs(selBox.x2 - selBox.x1),
        h: Math.abs(selBox.y2 - selBox.y1),
      }
    : null;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1 bg-[#080a0d]">
      <svg
        ref={svgRef}
        className="h-full w-full select-none"
        style={{ cursor }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* 世界坐标组 */}
        <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale}, ${-scale})`}>
          {showGrid && <g stroke="rgba(148,163,184,0.025)" strokeWidth={1}>{minorLines}</g>}
          {showGrid && <g stroke="rgba(148,163,184,0.075)" strokeWidth={1}>{majorLines}</g>}
          <line x1={worldLeft} y1={0} x2={worldRight} y2={0} stroke="rgba(148,163,184,0.16)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={worldBottom} x2={0} y2={worldTop} stroke="rgba(148,163,184,0.16)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {entities.map(renderEntity)}
          {relationLines}
        </g>

        {/* 屏幕坐标叠加层 */}
        <g>{axisLabels}</g>
        <g>{relationLabels}</g>

        {/* 框选矩形 */}
        {selRect && selRect.w > 1 && selRect.h > 1 && (
          <rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.w}
            height={selRect.h}
            fill="rgba(109, 169, 210, 0.08)"
            stroke="#6da9d2"
            strokeWidth={1}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

function relationNodeIds(relation: DrawingRelation): string[] {
  switch (relation.type) {
    case 'topology': return relation.nodeIds;
    case 'constraint': return relation.geometryIds;
    case 'association': return [relation.annotationId, ...relation.geometryIds];
    case 'semantic': return relation.nodeIds;
  }
}
