/**
 * Canvas - SVG 几何渲染器
 * 坐标系：CAD 约定（Y 轴向上），通过 transform 翻转 SVG 的 Y 轴。
 * 支持：鼠标拖动平移、滚轮缩放、自动适配视图、Ctrl+多选、Ctrl+框选。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useStore } from '@/hooks/useStore';
import type { DrawingAgentCanvasOverlay } from '@/contracts/drawing-agent';
import type { DrawingRelation } from '@/drawing';
import type { SpatialRegionPreviewOverlay } from '@/drawing/preview/types';
import EntityRenderer from './canvas/EntityRenderer';
import PartitionLayer from './canvas/PartitionLayer';
import { filterCanvasAnnotations } from './canvas/annotation-visibility';
import { gridPatternMetrics } from './canvas/grid-pattern';
import { createCanvasPanSession } from './canvas/pan-interaction';
import { selectGeometryIdsInBox } from './canvas/path-selection';
import { filterCanvasRelations, isCanvasSelectable } from './canvas/canvas-policies';
import {
  annotationLabelBounds,
  applyDimensionTextDrag,
  extractAnnotationTextHandles,
  resolveNewAnnotationTextOffsets,
  type AnnotationLabelBounds,
  type AnnotationTextHandle,
} from './canvas/annotation-text-utils';
import {
  entityCenter,
  fitBoundsToViewport,
  modelBounds,
  type DrawingRenderable,
} from './canvas/geometry';

const MIN_SCALE = 0.1;
const MAX_SCALE = 100_000;
const FIT_PADDING = 1.3;
const DRAG_THRESHOLD = 4; // 拖动判定阈值（像素）

export function CadGridPattern({
  visible,
  transform,
  minorPatternRef,
  majorPatternRef,
}: {
  visible: boolean;
  transform: { scale: number; offsetX: number; offsetY: number };
  minorPatternRef?: Ref<SVGPatternElement>;
  majorPatternRef?: Ref<SVGPatternElement>;
}) {
  if (!visible) return null;
  const metrics = gridPatternMetrics(transform);
  return (
    <g data-cad-grid="true" pointerEvents="none">
      <defs>
        <pattern
          ref={minorPatternRef}
          id="cad-grid-minor"
          data-grid-pattern="minor"
          patternUnits="userSpaceOnUse"
          x={metrics.minorX}
          y={metrics.minorY}
          width={metrics.minorSize}
          height={metrics.minorSize}
        >
          <path
            d={`M ${metrics.minorSize} 0 H 0 V ${metrics.minorSize}`}
            fill="none"
            stroke="rgba(148,163,184,0.025)"
            strokeWidth={1}
          />
        </pattern>
        <pattern
          ref={majorPatternRef}
          id="cad-grid-major"
          data-grid-pattern="major"
          patternUnits="userSpaceOnUse"
          x={metrics.majorX}
          y={metrics.majorY}
          width={metrics.majorSize}
          height={metrics.majorSize}
        >
          <path
            d={`M ${metrics.majorSize} 0 H 0 V ${metrics.majorSize}`}
            fill="none"
            stroke="rgba(148,163,184,0.075)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#cad-grid-minor)" />
      <rect width="100%" height="100%" fill="url(#cad-grid-major)" />
    </g>
  );
}

export function PerceptionPreviewLayer({
  entities,
  labelsByNodeId,
  stageByNodeId,
  scale,
  viewport,
}: {
  entities: DrawingRenderable[];
  labelsByNodeId: Record<string, string>;
  stageByNodeId?: Record<string, 'outline' | 'detail' | 'annotation' | 'reconciliation' | 'edit-preview'>;
  scale: number;
  viewport: { minX: number; minY: number; maxX: number; maxY: number };
}) {
  const outlineIds = entities
    .filter((entity) => stageByNodeId?.[entity.id] === 'outline')
    .map((entity) => entity.id);
  const outlineOrder = new Map(outlineIds.map((id, index) => [id, index]));
  return (
    <g data-perception-preview="true" pointerEvents="none">
      {entities.map((entity) => {
        const revealIndex = outlineOrder.get(entity.id);
        return (
          <EntityRenderer
            key={`preview:${entity.id}`}
            entity={entity}
            scale={scale}
            viewport={viewport}
            provisional
            perceptionStage={stageByNodeId?.[entity.id]}
            label={labelsByNodeId[entity.id]}
            {...(revealIndex === undefined ? {} : {
              revealIndex,
              revealCount: outlineIds.length,
            })}
          />
        );
      })}
    </g>
  );
}

export function SpatialRegionOverlayLayer({
  overlay,
  scale,
}: {
  overlay: SpatialRegionPreviewOverlay | null;
  scale: number;
}) {
  if (!overlay) return null;
  const rejected = overlay.status === 'rejected';
  const accepted = overlay.status === 'accepted';
  const regionStroke = rejected
    ? 'rgba(239, 91, 91, 0.95)'
    : accepted ? 'rgba(87, 196, 154, 0.95)' : 'rgba(109, 169, 210, 0.9)';
  const regionFill = rejected
    ? 'rgba(239, 91, 91, 0.10)'
    : accepted ? 'rgba(87, 196, 154, 0.10)' : 'rgba(67, 149, 217, 0.14)';
  const path = [...overlay.contours, ...overlay.holes].map((polygon) => polygon
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`)
    .join(' ') + ' Z').join(' ');
  return (
    <g
      data-spatial-region-overlay={overlay.previewVersionId}
      data-region-id={overlay.id}
      data-overlay-status={overlay.status}
      data-overlay-attempt={overlay.attempt}
      pointerEvents="none"
    >
      <path
        d={path}
        fill={regionFill}
        fillRule="evenodd"
        stroke={regionStroke}
        strokeWidth={1.5 / scale}
        strokeDasharray={`${6 / scale} ${4 / scale}`}
      />
      {overlay.paths.map((path, index) => (
        <polyline
          key={path.id}
          data-topology-path={path.id}
          data-path-role={path.role}
          points={path.points.map((point) => point.join(',')).join(' ')}
          fill="none"
          stroke={rejected ? '#ef5b5b' : path.role === 'protected' ? '#667582' : '#69c4e8'}
          strokeWidth={2.4 / scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={0}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="1"
            to="0"
            dur="420ms"
            begin={`${Math.max(path.order, index) * 90}ms`}
            fill="freeze"
          />
        </polyline>
      ))}
      {overlay.anchors.map((anchor) => {
        const color = anchorColor(anchor.role, rejected);
        return (
          <g key={anchor.id} data-anchor-status={anchor.snapStatus}>
            {anchor.snappedPoint && (
              <>
                <line
                  data-anchor-snap={anchor.id}
                  x1={anchor.point[0]}
                  y1={anchor.point[1]}
                  x2={anchor.snappedPoint[0]}
                  y2={anchor.snappedPoint[1]}
                  stroke={color}
                  strokeWidth={1 / scale}
                  strokeDasharray={`${2 / scale} ${2 / scale}`}
                />
                <circle
                  cx={anchor.snappedPoint[0]}
                  cy={anchor.snappedPoint[1]}
                  r={2.5 / scale}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.2 / scale}
                />
              </>
            )}
            <circle
              data-region-anchor={anchor.id}
              cx={anchor.point[0]}
              cy={anchor.point[1]}
              r={anchor.role === 'boundary' ? 4.5 / scale : 4 / scale}
              fill={anchor.snapStatus === 'missed' ? '#09131b' : color}
              stroke={color}
              strokeWidth={1.5 / scale}
            />
          </g>
        );
      })}
    </g>
  );
}

export function AgentCanvasOverlayLayer({
  overlay,
  entities,
  scale,
}: {
  overlay: DrawingAgentCanvasOverlay | null;
  entities: DrawingRenderable[];
  scale: number;
}) {
  if (!overlay || overlay.kind === 'clear') return null;
  if (overlay.kind === 'spatial') {
    return <SpatialInteractionFrameLayer frame={overlay} scale={scale} />;
  }
  const byId = new Map<string, DrawingRenderable>(entities.map((entity) => [entity.id, entity]));
  const nodeIds = overlay.kind === 'nodes'
    ? overlay.nodeIds
    : overlay.kind === 'preview'
      ? overlay.affectedNodeIds
      : overlay.kind === 'diagnostics' ? overlay.nodeIds : [];
  const nodeStroke = overlay.kind === 'diagnostics'
    ? '#ef9a67'
    : overlay.kind === 'preview' ? '#8ab4d6' : '#7399b6';
  const safeScale = Math.max(scale, 0.001);
  const viewport = modelBounds(entities) ?? {
    minX: -1_000, minY: -1_000, maxX: 1_000, maxY: 1_000,
  };
  const focusedEntities = nodeIds.flatMap((id) => {
    const entity = byId.get(id);
    return entity ? [entity] : [];
  });
  const activityLabel = overlay.kind === 'diagnostics'
    ? 'AI 正在校验'
    : overlay.kind === 'preview'
      ? 'AI 修改候选'
      : overlay.kind === 'nodes' && overlay.role === 'observed'
        ? 'AI 正在观察'
        : 'AI 正在处理';
  return (
    <g data-agent-overlay={overlay.kind} pointerEvents="none" opacity={0.88}>
      {focusedEntities.map((entity, index) => (
        <g key={`agent-shape:${entity.id}`} data-agent-overlay-node-shape={entity.id}>
          <EntityRenderer
            entity={entity}
            scale={scale}
            viewport={viewport}
            provisional
            perceptionStage="edit-preview"
            label={index === 0 ? activityLabel : undefined}
          />
        </g>
      ))}
      {focusedEntities.flatMap((entity) => {
        const center = entityCenter(entity);
        if (!center) return [];
        return [(
          <circle
            key={`agent-node:${entity.id}`}
            data-agent-overlay-node={entity.id}
            cx={center[0]}
            cy={center[1]}
            r={7 / safeScale}
            fill="none"
            stroke={nodeStroke}
            strokeWidth={1.5 / safeScale}
            strokeDasharray={`${3 / safeScale} ${3 / safeScale}`}
          >
            <animate
              data-agent-overlay-animation="focus"
              attributeName="r"
              values={`${5 / safeScale};${8 / safeScale};${5 / safeScale}`}
              dur="1.1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.35;1;0.35"
              dur="1.1s"
              repeatCount="indefinite"
            />
          </circle>
        )];
      })}
      {overlay.kind === 'paths' && overlay.paths.map((path) => {
        const points = path.points ?? path.nodeIds
          .map((id) => byId.get(id))
          .filter((entity): entity is DrawingRenderable => Boolean(entity))
          .map(entityCenter)
          .filter((point): point is readonly [number, number] => Boolean(point));
        if (points.length < 2) return null;
        return (
          <polyline
            key={path.id}
            data-agent-path={path.id}
            points={points.map((point) => point.join(',')).join(' ')}
            fill="none"
            stroke="#76b7d5"
            strokeWidth={2 / safeScale}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={0}
          >
            <animate
              attributeName="stroke-dashoffset"
              from="1"
              to="0"
              dur="520ms"
              fill="freeze"
            />
          </polyline>
        );
      })}
      {overlay.kind === 'points' && overlay.points.map((point) => (
        <g key={point.id} data-agent-point={point.id}>
          <circle
            cx={point.point[0]}
            cy={point.point[1]}
            r={4 / safeScale}
            fill="#76b7d5"
            stroke="#0b1117"
            strokeWidth={1 / safeScale}
          >
            <animate
              data-agent-overlay-animation="point-pulse"
              attributeName="r"
              values={`${2.5 / safeScale};${5 / safeScale};${4 / safeScale}`}
              dur="420ms"
              fill="freeze"
            />
          </circle>
        </g>
      ))}
    </g>
  );
}

function SpatialInteractionFrameLayer({
  frame,
  scale,
}: {
  frame: Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>;
  scale: number;
}) {
  const safeScale = Math.max(scale, 0.001);
  const labelAnchor = frame.strokes.find((stroke) => (
    stroke.role === 'target' || stroke.role === 'after' || stroke.role === 'boundary'
  ))?.points[0] ?? frame.markers[0]?.point;
  return (
    <g
      data-agent-overlay="spatial"
      data-agent-spatial-phase={frame.phase}
      data-agent-spatial-truncated={frame.truncated ? 'true' : undefined}
      pointerEvents="none"
    >
      {frame.strokes.map((stroke) => {
        const style = spatialStrokeStyle(stroke.role, safeScale, stroke.confidence);
        const confidenceBand = spatialConfidenceBand(stroke.confidence);
        if (stroke.points.length === 1) {
          return (
            <circle
              key={stroke.id}
              data-agent-spatial-stroke={stroke.id}
              data-agent-spatial-role={stroke.role}
              data-agent-spatial-confidence={confidenceBand}
              cx={stroke.points[0][0]}
              cy={stroke.points[0][1]}
              r={3.2 / safeScale}
              fill={style.color}
              opacity={style.opacity}
            />
          );
        }
        if (stroke.points.length < 2) return null;
        const points = stroke.points.map((point) => point.join(',')).join(' ');
        const emphasized = stroke.role === 'target'
          || stroke.role === 'boundary'
          || stroke.role === 'interface'
          || stroke.role === 'after';
        return (
          <g
            key={stroke.id}
            data-agent-spatial-stroke={stroke.id}
            data-agent-spatial-role={stroke.role}
            data-agent-spatial-confidence={confidenceBand}
          >
            {emphasized ? (
              <polyline
                points={points}
                fill="none"
                stroke={style.color}
                strokeWidth={6 / safeScale}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.11}
              />
            ) : null}
            <polyline
              points={points}
              fill="none"
              stroke={style.color}
              strokeWidth={style.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={emphasized ? 1 : style.dash}
              opacity={style.opacity}
              pathLength={emphasized ? 1 : undefined}
              strokeDashoffset={emphasized ? 0 : undefined}
            >
              {emphasized ? (
                <animate
                  data-agent-overlay-animation="span-reveal"
                  attributeName="stroke-dashoffset"
                  from="1"
                  to="0"
                  dur="460ms"
                  fill="freeze"
                />
              ) : null}
            </polyline>
          </g>
        );
      })}
      {frame.vectors.map((vector) => {
        const color = vector.role === 'constraint' ? '#d7ad6d' : '#82bad2';
        return (
          <g key={vector.id} data-agent-spatial-vector={vector.id}>
            <line
              x1={vector.from[0]}
              y1={vector.from[1]}
              x2={vector.to[0]}
              y2={vector.to[1]}
              stroke={color}
              strokeWidth={1.35 / safeScale}
              strokeDasharray={`${5 / safeScale} ${4 / safeScale}`}
              opacity={0.82}
            >
              <animate
                data-agent-overlay-animation="motion-flow"
                attributeName="stroke-dashoffset"
                from={9 / safeScale}
                to={0}
                dur="620ms"
                repeatCount="indefinite"
              />
            </line>
            <circle
              cx={vector.to[0]}
              cy={vector.to[1]}
              r={2.6 / safeScale}
              fill={color}
              stroke="#101820"
              strokeWidth={0.8 / safeScale}
            />
          </g>
        );
      })}
      {frame.markers.map((marker) => {
        const color = spatialMarkerColor(marker.role);
        return (
          <g
            key={marker.id}
            data-agent-spatial-marker={marker.id}
            data-agent-spatial-role={marker.role}
          >
            <circle
              cx={marker.point[0]}
              cy={marker.point[1]}
              r={6 / safeScale}
              fill="none"
              stroke={color}
              strokeWidth={1.2 / safeScale}
              opacity={0.34}
            >
              <animate
                data-agent-overlay-animation="interface-pulse"
                attributeName="r"
                values={`${4.5 / safeScale};${8 / safeScale};${4.5 / safeScale}`}
                dur="1.15s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={marker.point[0]}
              cy={marker.point[1]}
              r={2.6 / safeScale}
              fill="#101820"
              stroke={color}
              strokeWidth={1.5 / safeScale}
            />
          </g>
        );
      })}
      {frame.label && labelAnchor ? (
        <g
          data-agent-spatial-label="true"
          transform={`translate(${labelAnchor[0]}, ${labelAnchor[1]}) scale(${1 / safeScale}, ${-1 / safeScale})`}
        >
          <rect
            x={10}
            y={-29}
            width={Math.max(76, Math.min(220, compactSpatialLabel(frame.label).length * 7.4 + 24))}
            height={24}
            rx={8}
            fill="#111a22"
            stroke="#38566a"
            strokeWidth={1}
            opacity={0.96}
          />
          <text
            x={22}
            y={-13}
            fill="#b9d6e5"
            fontSize={12}
            fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.02em"
          >
            {compactSpatialLabel(frame.label)}
          </text>
        </g>
      ) : null}
    </g>
  );
}

function spatialStrokeStyle(
  role: Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>['strokes'][number]['role'],
  scale: number,
  confidence?: number,
) {
  if (confidence !== undefined && confidence < 0.6
    && role !== 'context' && role !== 'excluded' && role !== 'before') {
    return { color: '#d98a70', width: 2.35 / scale, opacity: 0.98, dash: undefined };
  }
  switch (role) {
    case 'target': return { color: '#83c5df', width: 2.35 / scale, opacity: 0.98, dash: undefined };
    case 'boundary': return { color: '#d7ad6d', width: 2.15 / scale, opacity: 0.96, dash: undefined };
    case 'interface': return { color: '#d7ad6d', width: 2.35 / scale, opacity: 1, dash: undefined };
    case 'after': return { color: '#91cce3', width: 2.45 / scale, opacity: 1, dash: undefined };
    case 'before': return {
      color: '#667b8a', width: 1.35 / scale, opacity: 0.55,
      dash: `${5 / scale} ${4 / scale}`,
    };
    case 'excluded': return {
      color: '#53616c', width: 1.2 / scale, opacity: 0.48,
      dash: `${3 / scale} ${5 / scale}`,
    };
    case 'context': return {
      color: '#61717e', width: 1.15 / scale, opacity: 0.42,
      dash: `${2 / scale} ${5 / scale}`,
    };
  }
}

function spatialConfidenceBand(confidence?: number): 'low' | 'confirmed' | undefined {
  if (confidence === undefined) return undefined;
  return confidence < 0.6 ? 'low' : 'confirmed';
}

function spatialMarkerColor(
  role: Extract<DrawingAgentCanvasOverlay, { kind: 'spatial' }>['markers'][number]['role'],
): string {
  if (role === 'interface') return '#d7ad6d';
  if (role === 'warning') return '#d98a70';
  if (role === 'anchor') return '#718491';
  return '#83c5df';
}

function compactSpatialLabel(label: string): string {
  const compact = label.replace(/\s+/g, ' ').trim();
  return compact.length > 28 ? `${compact.slice(0, 27)}…` : compact;
}

function anchorColor(role: string, rejected: boolean): string {
  if (rejected) return '#ef5b5b';
  if (role === 'boundary') return '#e6ad5c';
  if (role === 'required') return '#a98be6';
  if (role === 'protected-seed') return '#71808c';
  return '#69c4e8';
}

export default function Canvas() {
  const document = useStore((s) => s.document);
  const perceptionPreview = useStore((s) => s.perceptionPreview);
  const agentCanvasOverlay = useStore((s) => s.agentCanvasOverlay);
  const selectedIds = useStore((s) => s.selectedIds);
  const showGrid = useStore((s) => s.showGrid);
  const showRelations = useStore((s) => s.showRelations);
  const showAnnotations = useStore((s) => s.showAnnotations);
  const canvasTransform = useStore((s) => s.canvasTransform);
  const setCanvasTransform = useStore((s) => s.setCanvasTransform);
  const setViewportSize = useStore((s) => s.setViewportSize);
  const selectEntity = useStore((s) => s.selectEntity);
  const selectEntities = useStore((s) => s.selectEntities);
  const clearSelection = useStore((s) => s.clearSelection);
  const setMouseCoords = useStore((s) => s.setMouseCoords);
  const updateNode = useStore((s) => s.updateNode);

  const { scale, offsetX, offsetY } = canvasTransform;
  const entities = useMemo<DrawingRenderable[]>(() => {
    const hidden = new Set(perceptionPreview.hiddenCommittedIds ?? []);
    return filterCanvasAnnotations(document
      ? [...document.geometry, ...document.annotations].filter((node) => !hidden.has(node.id))
      : [], showAnnotations);
  }, [document, perceptionPreview.hiddenCommittedIds, showAnnotations]);
  const previewEntities = useMemo<DrawingRenderable[]>(
    () => filterCanvasAnnotations(Object.values(perceptionPreview.nodes), showAnnotations),
    [perceptionPreview.nodes, showAnnotations],
  );
  const fittedEntities = useMemo(
    () => [...entities, ...previewEntities],
    [entities, previewEntities],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldGroupRef = useRef<SVGGElement>(null);
  const screenOverlayRef = useRef<SVGGElement>(null);
  const minorGridPatternRef = useRef<SVGPatternElement>(null);
  const majorGridPatternRef = useRef<SVGPatternElement>(null);
  const committedAxisLabelsRef = useRef<SVGGElement>(null);
  const liveAxisLabelsRef = useRef<SVGGElement>(null);
  const axisLineXRef = useRef<SVGLineElement>(null);
  const axisLineYRef = useRef<SVGLineElement>(null);
  const liveAxisLabelRafRef = useRef<number | null>(null);
  const pendingLiveTransformRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // 交互状态
  const isDraggingRef = useRef(false);
  const isSelectingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const [cursor, setCursor] = useState('grab');
  const userAdjustedViewRef = useRef(false);
  const previewRunRef = useRef<string | null>(null);
  const panSessionRef = useRef<ReturnType<typeof createCanvasPanSession> | null>(null);
  const annotationDragRef = useRef<{
    nodeId: string;
    kind: 'text' | 'dimension' | 'leader';
    axis: 'x' | 'y' | null;
    startWorld: { x: number; y: number };
    basePoint: readonly [number, number];
  } | null>(null);
  const annotationDragOffsetsRef = useRef<Record<string, readonly [number, number]>>({});
  const [annotationDragTick, setAnnotationDragTick] = useState(0);

  // 交互视口节流：拖动/缩放时用 requestAnimationFrame 合并高频更新，
  // 每帧最多提交一次 setCanvasTransform，避免整块 SVG 逐事件重渲染导致闪烁。
  const transformRef = useRef(canvasTransform);
  transformRef.current = canvasTransform;
  const pendingTransformRef = useRef(canvasTransform);
  const rafRef = useRef<number | null>(null);
  const scheduleTransform = useCallback((next: typeof canvasTransform) => {
    transformRef.current = next;
    pendingTransformRef.current = next;
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingTransformRef.current;
        if (pending) setCanvasTransform(pending);
      });
    }
  }, [setCanvasTransform]);
  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (liveAxisLabelRafRef.current != null) cancelAnimationFrame(liveAxisLabelRafRef.current);
  }, []);

  // 框选状态
  const [selBox, setSelBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // 标记鼠标是否移动过（区分点击和拖动）
  const hasMovedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      setSize({ w: width, h: height });
      if (width > 0 && height > 0) setViewportSize({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewportSize]);

  const { w, h } = size;

  useEffect(() => {
    if (perceptionPreview.runId && perceptionPreview.runId !== previewRunRef.current) {
      userAdjustedViewRef.current = false;
    }
    previewRunRef.current = perceptionPreview.runId;
  }, [perceptionPreview.runId]);

  // 自动适配
  useEffect(() => {
    if (fittedEntities.length > 0 && !userAdjustedViewRef.current && w > 0 && h > 0) {
      const bbox = modelBounds(fittedEntities);
      if (bbox) {
        const fitted = fitBoundsToViewport(bbox, { width: w, height: h, padding: FIT_PADDING });
        const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitted.scale));
        const ratio = clamped / fitted.scale;
        setCanvasTransform({
          scale: clamped,
          offsetX: w / 2 + (fitted.offsetX - w / 2) * ratio,
          offsetY: h / 2 + (fitted.offsetY - h / 2) * ratio,
        });
      }
    }
    if (fittedEntities.length === 0) userAdjustedViewRef.current = false;
  }, [fittedEntities, w, h, setCanvasTransform]);

  // 屏幕坐标 -> 世界坐标
  const toWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - offsetX) / scale,
    y: (offsetY - sy) / scale,
  }), [offsetX, offsetY, scale]);

  // 按给定变换向目标 <g> 重建坐标轴标签（用于拖拽中实时更新，避免依赖 React state）
  const applyAxisLabels = useCallback((target: SVGGElement, transform: { scale: number; offsetX: number; offsetY: number }) => {
    const { scale: sc, offsetX: ox, offsetY: oy } = transform;
    while (target.firstChild) target.removeChild(target.firstChild);
    if (!w || !h) return;
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (x: number, y: number, text: string, anchor: string) => {
      const el = window.document.createElementNS(NS, 'text');
      el.setAttribute('x', String(x));
      el.setAttribute('y', String(y));
      el.setAttribute('class', 'fill-slate-700 font-mono');
      el.setAttribute('font-size', '9');
      el.setAttribute('text-anchor', anchor);
      el.textContent = text;
      return el;
    };
    const worldLeft = -ox / sc;
    const worldRight = (w - ox) / sc;
    const worldBottom = (oy - h) / sc;
    const worldTop = oy / sc;
    const x0 = Math.ceil(worldLeft / 50) * 50;
    const x1 = Math.floor(worldRight / 50) * 50;
    for (let x = x0; x <= x1; x += 50) {
      if (x === 0) continue;
      target.appendChild(mk(ox + x * sc, oy + 12, String(x), 'middle'));
    }
    const y0 = Math.ceil(worldBottom / 50) * 50;
    const y1 = Math.floor(worldTop / 50) * 50;
    for (let y = y0; y <= y1; y += 50) {
      if (y === 0) continue;
      target.appendChild(mk(ox + 4, oy - y * sc - 3, String(y), 'start'));
    }
  }, [w, h]);

  // 拖拽结束后恢复已提交标签、清空实时标签
  const resetLiveAxisLabels = useCallback(() => {
    if (liveAxisLabelRafRef.current != null) {
      cancelAnimationFrame(liveAxisLabelRafRef.current);
      liveAxisLabelRafRef.current = null;
    }
    pendingLiveTransformRef.current = null;
    const committed = committedAxisLabelsRef.current;
    if (committed) committed.style.display = '';
    const live = liveAxisLabelsRef.current;
    if (live) {
      live.style.display = 'none';
      while (live.firstChild) live.removeChild(live.firstChild);
    }
  }, []);

  const worldLeft = w ? -offsetX / scale : 0;
  const worldRight = w ? (w - offsetX) / scale : 0;
  const worldBottom = h ? (offsetY - h) / scale : 0;
  const worldTop = offsetY / scale;
  // 自动避让只在标注首次出现时计算一次并冻结；后续任何更新（拖动提交等）都不再触发
  const annotationAvoidanceRef = useRef<{
    drawingId: string | null;
    handled: Set<string>;
    offsets: Record<string, { x: number; y: number }>;
  }>({ drawingId: null, handled: new Set(), offsets: {} });
  const staticAnnotationTextOffsets = useMemo(
    () => {
      const state = annotationAvoidanceRef.current;
      const drawingId = document?.id ?? null;
      if (drawingId !== state.drawingId) {
        state.drawingId = drawingId;
        state.handled = new Set();
        state.offsets = {};
      }
      const handles = extractAnnotationTextHandles(entities)
        .filter((item) => item.width > 0 && item.height > 0);
      // 角度标注文字必须钉在角平分线上：不参与避让位移，仅作为其他标签的避让障碍
      const angularIds = new Set<string>(entities
        .filter((entity) => entity.type === 'dimension' && entity.dimensionKind === 'angular')
        .map((entity) => entity.id));
      const placed: AnnotationLabelBounds[] = [];
      const pending: AnnotationTextHandle[] = [];
      for (const handle of handles) {
        if (angularIds.has(handle.id)) {
          state.handled.add(handle.id);
          placed.push(annotationLabelBounds(handle, { x: 0, y: 0 }));
        } else if (state.handled.has(handle.id)) {
          placed.push(annotationLabelBounds(handle, state.offsets[handle.id] ?? { x: 0, y: 0 }));
        } else {
          pending.push(handle);
        }
      }
      if (pending.length > 0) {
        const fresh = resolveNewAnnotationTextOffsets(pending, placed);
        for (const handle of pending) {
          state.handled.add(handle.id);
          state.offsets[handle.id] = fresh[handle.id] ?? { x: 0, y: 0 };
        }
      }
      return { ...state.offsets };
    },
    [document?.id, entities],
  );
  const annotationTextOffsets = useMemo(() => {
    const combined = { ...staticAnnotationTextOffsets };
    const draggingOffsets = annotationDragOffsetsRef.current;
    for (const [nodeId, offset] of Object.entries(draggingOffsets)) {
      const base = staticAnnotationTextOffsets[nodeId];
      combined[nodeId] = {
        x: (base?.x ?? 0) + (offset[0] ?? 0),
        y: (base?.y ?? 0) + (offset[1] ?? 0),
      };
    }
    return combined;
  }, [annotationDragTick, staticAnnotationTextOffsets]);

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

  const annotationTextOffset = (id: string): readonly [number, number] | undefined => {
    const point = annotationTextOffsets[id];
    if (!point) return undefined;
    return [point.x, point.y];
  };

  const clearAnnotationDragState = useCallback(() => {
    annotationDragRef.current = null;
    if (Object.keys(annotationDragOffsetsRef.current).length > 0) {
      annotationDragOffsetsRef.current = {};
      setAnnotationDragTick((prev) => prev + 1);
    }
    setCursor('grab');
  }, []);

  const startAnnotationTextDrag = useCallback((entity: DrawingRenderable, event: React.MouseEvent<SVGGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = event.target as Element | null;
    if (!target || !target.closest('[data-annotation-text="true"]')) return;
    const resolvedAnchor = (() => {
      if (entity.type === 'text') return { kind: 'text' as const, basePoint: entity.position };
      if (entity.type === 'dimension') return { kind: 'dimension' as const, basePoint: entity.textPosition };
      if (entity.type === 'leader') return { kind: 'leader' as const, basePoint: entity.points.at(-1) };
      return null;
    })();
    const basePoint = resolvedAnchor?.basePoint;
    if (!basePoint) return;
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const startWorld = toWorld(sx, sy);
    annotationDragRef.current = {
      nodeId: entity.id,
      kind: resolvedAnchor?.kind,
      axis: null,
      startWorld,
      basePoint,
    };
    annotationDragOffsetsRef.current = {
      ...annotationDragOffsetsRef.current,
      [entity.id]: [0, 0],
    };
    setAnnotationDragTick((prev) => prev + 1);
    hasMovedRef.current = false;
    setCursor('grabbing');
    event.preventDefault();
    event.stopPropagation();
  }, [toWorld]);

  const commitAnnotationTextDrag = useCallback(async () => {
    const drag = annotationDragRef.current;
    if (!drag) return;
    const entity = entityById(drag.nodeId);
    if (!entity) {
      clearAnnotationDragState();
      return;
    }
    const offset = annotationDragOffsetsRef.current[drag.nodeId];
    annotationDragOffsetsRef.current = {};
    clearAnnotationDragState();
    if (!offset) return;
    const [offsetX, offsetY] = offset;
    const dx = Number(offsetX);
    const dy = Number(offsetY);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (Math.hypot(dx, dy) < 1e-6) return;
    // 把冻结的避让偏移一并写入文档（预览时它已叠加显示），实现所见即所得
    const frozen = annotationAvoidanceRef.current.offsets[drag.nodeId] ?? { x: 0, y: 0 };
    const next: number[] = [drag.basePoint[0] + frozen.x + dx, drag.basePoint[1] + frozen.y + dy];
    // 提交成功后移除该标注的避让偏移，且不再为其重新计算（已记录为已处理）
    const consumeAvoidance = () => {
      delete annotationAvoidanceRef.current.offsets[drag.nodeId];
    };

    const applyOffset = (point: readonly [number, number]): [number, number] => [
      point[0] + frozen.x + dx,
      point[1] + frozen.y + dy,
    ];

    if (entity.type === 'text') {
      await updateNode(entity.id, { position: next as [number, number] });
      consumeAvoidance();
      return;
    }
    if (entity.type === 'dimension') {
      // 延长线起点等锚定在几何上的定义点不动；标注线（箭头）与文字跟随新位置
      const nextDimension = applyDimensionTextDrag(entity, next as [number, number]);
      await updateNode(entity.id, {
        textPosition: nextDimension.textPosition as [number, number],
        definitionPoints: nextDimension.definitionPoints,
      });
      consumeAvoidance();
      return;
    }
    if (entity.type === 'leader') {
      // 箭头端固定在几何上，仅移动引线其余节点与文字
      await updateNode(entity.id, {
        points: entity.points.map((point, index) => (index === 0 ? point : applyOffset(point))),
      });
      consumeAvoidance();
      return;
    }
  }, [clearAnnotationDragState, entityById, updateNode]);

  // 渲染实体（含透明点击区域）
  const renderEntity = (e: DrawingRenderable) => {
    const canDragAnnotationText = e.type === 'text' || e.type === 'dimension' || e.type === 'leader';
    const selectable = isCanvasSelectable(e);
    const onClick = (ev: React.MouseEvent<SVGGElement>) => {
      ev.stopPropagation();
      if (!hasMovedRef.current) {
        selectEntity(e.id, ev.ctrlKey || ev.metaKey);
      }
    };
    const onPointerDown = canDragAnnotationText ? (ev: React.MouseEvent<SVGGElement>) => startAnnotationTextDrag(e, ev) : undefined;
    return (
      <EntityRenderer
        key={e.id}
        entity={e}
        scale={scale}
        viewport={{ minX: worldLeft, minY: worldBottom, maxX: worldRight, maxY: worldTop }}
        selected={selectable && selectedIds.includes(e.id)}
        onSelect={selectable ? onClick : undefined}
        onPointerDown={onPointerDown}
        annotationTextOnly={canDragAnnotationText}
        textOffset={canDragAnnotationText ? annotationTextOffset(e.id) : undefined}
      />
    );
  };

  // 关系连线
  const relationLines: React.ReactElement[] = [];
  const relationLabels: React.ReactElement[] = [];
  if (showRelations) {
    filterCanvasRelations(document?.relations ?? []).forEach((relation: DrawingRelation, i) => {
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
    userAdjustedViewRef.current = true;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const current = transformRef.current;
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    const ratio = next / current.scale;
    scheduleTransform({
      scale: next,
      offsetX: px - (px - current.offsetX) * ratio,
      offsetY: py + (current.offsetY - py) * ratio,
    });
  };

  // 鼠标按下：决定是拖动还是框选
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = e.target as Element | null;
    if (target?.closest('[data-annotation-text="true"]')) {
      return;
    }
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
      panSessionRef.current = createCanvasPanSession(
        { x: e.clientX, y: e.clientY },
        transformRef.current,
        (transform) => setCanvasTransform(transform),
      );
      setCursor('grabbing');
    }
  };

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const textDrag = annotationDragRef.current;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (textDrag) {
        if (e.buttons === 0) {
          // 没有按键按住却仍处于拖动状态（mouseup 发生在画布外等）：直接取消，避免文字跟随悬停鼠标
          annotationDragOffsetsRef.current = {};
          clearAnnotationDragState();
          return;
        }
        const world = toWorld(sx, sy);
        const deltaWorld = {
          x: world.x - textDrag.startWorld.x,
          y: world.y - textDrag.startWorld.y,
        };
        // 尺寸标注文字自由拖动（标注线沿垂直分量跟随）；纯文字/引线仍按主轴锁定移动
        const freeDrag = textDrag.kind === 'dimension';
        const axis = textDrag.axis
          ?? (Math.abs(deltaWorld.x) > Math.abs(deltaWorld.y) ? 'x' : 'y');
        const lockedAxis = freeDrag ? null : textDrag.axis ?? axis;
        if (!freeDrag && textDrag.axis === null) {
          annotationDragRef.current = {
            ...textDrag,
            axis: lockedAxis,
          };
        }
        const current = textDrag.basePoint;
        const next = lockedAxis === 'x'
          ? [current[0] + deltaWorld.x, current[1]]
          : lockedAxis === 'y'
            ? [current[0], current[1] + deltaWorld.y]
            : [current[0] + deltaWorld.x, current[1] + deltaWorld.y];
        annotationDragOffsetsRef.current = {
          ...annotationDragOffsetsRef.current,
          [textDrag.nodeId]: next.map((value, index) => value - current[index]) as [number, number],
        };
        hasMovedRef.current = true;
        setAnnotationDragTick((prev) => prev + 1);
        return;
      }

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
      }

      if (isSelectingRef.current) {
        // 框选：更新选框
        setSelBox({ x1: dragStartRef.current.x - rect.left, y1: dragStartRef.current.y - rect.top, x2: sx, y2: sy });
      } else if (isDraggingRef.current) {
        // 平移
        userAdjustedViewRef.current = true;
        const preview = panSessionRef.current?.preview({ x: e.clientX, y: e.clientY });
        if (preview) {
          transformRef.current = preview.transform;
          worldGroupRef.current?.setAttribute(
            'transform',
            `translate(${preview.transform.offsetX}, ${preview.transform.offsetY}) scale(${preview.transform.scale}, ${-preview.transform.scale})`,
          );
          const grid = gridPatternMetrics(preview.transform);
          minorGridPatternRef.current?.setAttribute('x', String(grid.minorX));
          minorGridPatternRef.current?.setAttribute('y', String(grid.minorY));
          majorGridPatternRef.current?.setAttribute('x', String(grid.majorX));
          majorGridPatternRef.current?.setAttribute('y', String(grid.majorY));
          screenOverlayRef.current?.setAttribute(
            'transform',
            `translate(${preview.deltaX}, ${preview.deltaY})`,
          );
          // 隐藏已提交标签，改用实时标签跟随（rAF 节流，每帧重建一次）
          const committed = committedAxisLabelsRef.current;
          if (committed) committed.style.display = 'none';
          const live = liveAxisLabelsRef.current;
          if (live) live.style.display = '';
          pendingLiveTransformRef.current = preview.transform;
          if (liveAxisLabelRafRef.current == null) {
            liveAxisLabelRafRef.current = requestAnimationFrame(() => {
              liveAxisLabelRafRef.current = null;
              const t = pendingLiveTransformRef.current;
              if (t && liveAxisLabelsRef.current) applyAxisLabels(liveAxisLabelsRef.current, t);
            });
          }
          // 坐标轴线条始终满屏:原点越界时贴到屏幕边缘
          const axisY = Math.max(0, Math.min(h, preview.transform.offsetY));
          const axisX = Math.max(0, Math.min(w, preview.transform.offsetX));
          axisLineXRef.current?.setAttribute('y1', String(axisY));
          axisLineXRef.current?.setAttribute('y2', String(axisY));
          axisLineYRef.current?.setAttribute('x1', String(axisX));
          axisLineYRef.current?.setAttribute('x2', String(axisX));
        }
      } else {
        // 悬停：更新坐标
        setMouseCoords(toWorld(sx, sy));
      }
    },
    [applyAxisLabels, clearAnnotationDragState, h, setMouseCoords, toWorld, w],
  );

  const onMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (annotationDragRef.current) {
      const drag = annotationDragRef.current;
      if (!hasMovedRef.current) {
        selectEntity(drag.nodeId, e.ctrlKey || e.metaKey);
        clearAnnotationDragState();
      } else {
        void commitAnnotationTextDrag();
      }
      return;
    }

    if (isSelectingRef.current) {
      // 框选结束：计算选中的实体
      isSelectingRef.current = false;
      setCursor('grab');

      if (selBox) {
        // 选框屏幕坐标 -> 世界坐标
        const w1 = toWorld(Math.min(selBox.x1, selBox.x2), Math.min(selBox.y1, selBox.y2));
        const w2 = toWorld(Math.max(selBox.x1, selBox.x2), Math.max(selBox.y1, selBox.y2));
        const selBBox = { minX: Math.min(w1.x, w2.x), minY: Math.min(w1.y, w2.y), maxX: Math.max(w1.x, w2.x), maxY: Math.max(w1.y, w2.y) };

        const hits = selectGeometryIdsInBox(entities, selBBox, {
          minX: worldLeft, minY: worldBottom, maxX: worldRight, maxY: worldTop,
        });

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
      panSessionRef.current?.finish();
      panSessionRef.current = null;
      screenOverlayRef.current?.removeAttribute('transform');
      resetLiveAxisLabels();
      setCursor('grab');
      // 如果没移动过，视为点击背景 -> 清空选择
      if (!hasMovedRef.current) {
        clearSelection();
      }
    }
  };

  const onMouseLeave = () => {
    if (annotationDragRef.current) {
      annotationDragOffsetsRef.current = {};
      clearAnnotationDragState();
    }
    if (isDraggingRef.current) {
      panSessionRef.current?.finish();
      panSessionRef.current = null;
      screenOverlayRef.current?.removeAttribute('transform');
      resetLiveAxisLabels();
    }
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
        <CadGridPattern
          visible={showGrid}
          transform={canvasTransform}
          minorPatternRef={minorGridPatternRef}
          majorPatternRef={majorGridPatternRef}
        />
        {/* 坐标轴线条(屏幕坐标,始终满屏;原点越界时贴边) */}
        <g data-cad-axes="true" pointerEvents="none">
          <line
            ref={axisLineXRef}
            x1={0}
            y1={Math.max(0, Math.min(h, offsetY))}
            x2={w}
            y2={Math.max(0, Math.min(h, offsetY))}
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={1}
          />
          <line
            ref={axisLineYRef}
            x1={Math.max(0, Math.min(w, offsetX))}
            y1={0}
            x2={Math.max(0, Math.min(w, offsetX))}
            y2={h}
            stroke="rgba(148,163,184,0.3)"
            strokeWidth={1}
          />
        </g>
        {/* 世界坐标组 */}
        <g ref={worldGroupRef} transform={`translate(${offsetX}, ${offsetY}) scale(${scale}, ${-scale})`}>
          <SpatialRegionOverlayLayer overlay={perceptionPreview.activeOverlay} scale={scale} />
          <PartitionLayer scale={scale} offsetX={offsetX} offsetY={offsetY} />
          {entities.map(renderEntity)}
          <PerceptionPreviewLayer
            entities={previewEntities}
            labelsByNodeId={perceptionPreview.labelsByNodeId}
            stageByNodeId={perceptionPreview.stageByNodeId}
            scale={scale}
            viewport={{ minX: worldLeft, minY: worldBottom, maxX: worldRight, maxY: worldTop }}
          />
          <AgentCanvasOverlayLayer
            overlay={agentCanvasOverlay}
            entities={fittedEntities}
            scale={scale}
          />
          {relationLines}
        </g>

        {/* 屏幕坐标叠加层 */}
        <g ref={screenOverlayRef}>
          <g ref={committedAxisLabelsRef}>{axisLabels}</g>
          <g>{relationLabels}</g>
        </g>
        {/* 拖拽中实时更新的坐标轴标签（独立于叠加层平移，按实时变换重建） */}
        <g ref={liveAxisLabelsRef} style={{ display: 'none' }} />

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
