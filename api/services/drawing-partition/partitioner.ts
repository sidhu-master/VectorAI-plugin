/**
 * 图纸分区服务：渲染当前图纸 -> 模型只做语义判断（轴向 + 台阶分界线 + 命名） ->
 * 代码按分界线确定性生成分区多边形（跨全图条带矩形）-> 稳定编号/命名 -> 计算每个分区的成员图元。
 */
import type { DrawingDocument, GeometryNode, RevisionId, Vec2 } from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/index.js';
import type { DrawingPartition } from '../../../src/contracts/drawing-partition.js';
import {
  assignPartitionMembers,
  partitionPolygonBounds,
} from '../../../src/contracts/drawing-partition.js';
import { compileDrawingScene } from '../../../src/drawing/scene/compile.js';
import { rasterizeScene } from '../drawing-render/rasterize-scene.js';
import sharp from 'sharp';
import type { DrawingModelCallTelemetry } from '../ai-gateway.js';
import type {
  DrawingPartitionModelAdapter,
  ExistingPartitionSummary,
  RawPartitionPlan,
} from './partition-model.js';

const RENDER_PIXEL_WIDTH = 1400;
const RENDER_MIN_PIXEL_HEIGHT = 240;

export interface PartitionView {
  dataUrl: string;
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface PartitionRequest {
  document: DrawingDocument;
  supplements: string;
  feedback?: string;
  sourceImage?: { id: string; dataUrl: string };
  signal: AbortSignal;
  onTelemetry?: (telemetry: DrawingModelCallTelemetry) => void;
}

export class DrawingPartitionService {
  readonly #model: DrawingPartitionModelAdapter;

  constructor(input: { model: DrawingPartitionModelAdapter }) {
    this.#model = input.model;
  }

  async generate(request: PartitionRequest): Promise<DrawingPartition[]> {
    const { document } = request;
    const view = await renderPartitionView(document);
    const stepCandidates = detectStepCandidates(document.geometry, view.worldBounds);
    const existing = document.features
      .filter((feature) => feature.semanticType === 'drawing-partition');
    const plan = await this.#model.partition({
      primaryImage: { id: 'partition-view', dataUrl: view.dataUrl },
      sourceImage: request.sourceImage,
      worldBounds: view.worldBounds,
      stepCandidates,
      geometrySummary: summarizeGeometry(document.geometry),
      supplements: request.supplements,
      existingPartitions: existing.length > 0
        ? existing.map((feature) => summarizeExistingPartition(feature, view.worldBounds))
        : undefined,
      signal: request.signal,
      onTelemetry: request.onTelemetry,
    });
    return materializePartitions(plan, view.worldBounds, document.geometry);
  }
}

interface StepCandidateGroup {
  position: number;
  maxLength: number;
}

/** 台阶面候选检测（确定性）：轴类视图中，垂直于分区轴的线段即台阶面。
 *  返回按轴向归一化并去重的候选位置（0~1），保证分区边界可精确落在几何突变处。 */
export function detectStepCandidates(
  geometry: GeometryNode[],
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
): { x: number[]; y: number[] } {
  const width = worldBounds.maxX - worldBounds.minX;
  const height = worldBounds.maxY - worldBounds.minY;
  const diagonal = Math.hypot(width, height);
  if (width <= 0 || height <= 0) return { x: [], y: [] };
  const groupTolerance = diagonal * 0.005;
  const minLengthForX = height * 0.03;
  const minLengthForY = width * 0.03;
  const straightnessTolerance = diagonal * 0.002;

  const vertical: StepCandidateGroup[] = [];
  const horizontal: StepCandidateGroup[] = [];
  for (const node of geometry) {
    if (node.type !== 'line') continue;
    const line = node as unknown as { start: Vec2; end: Vec2 };
    const [x0, y0] = line.start;
    const [x1, y1] = line.end;
    if (Math.abs(x1 - x0) <= straightnessTolerance) {
      vertical.push({
        position: (x0 + x1) / 2,
        maxLength: Math.abs(y1 - y0),
      });
    } else if (Math.abs(y1 - y0) <= straightnessTolerance) {
      horizontal.push({
        position: (y0 + y1) / 2,
        maxLength: Math.abs(x1 - x0),
      });
    }
  }

  return {
    x: normalizeCandidatePositions(vertical, groupTolerance, minLengthForX, worldBounds.minX, width),
    y: normalizeCandidatePositions(horizontal, groupTolerance, minLengthForY, worldBounds.maxY, height, true),
  };
}

function normalizeCandidatePositions(
  groups: StepCandidateGroup[],
  tolerance: number,
  minLength: number,
  worldMin: number,
  extent: number,
  flip = false,
): number[] {
  const sorted = [...groups].sort((left, right) => left.position - right.position);
  const merged: StepCandidateGroup[] = [];
  for (const group of sorted) {
    const last = merged[merged.length - 1];
    if (last && group.position - last.position <= tolerance) {
      last.position = (last.position + group.position) / 2;
      last.maxLength = Math.max(last.maxLength, group.maxLength);
    } else {
      merged.push({ ...group });
    }
  }
  const positions = merged
    .filter((group) => group.maxLength >= minLength)
    .map((group) => (group.position - worldMin) / extent)
    .map((value) => (flip ? 1 - value : value))
    .filter((value) => value > 0.02 && value < 0.98)
    .sort((left, right) => left - right);
  const deduped: number[] = [];
  for (const value of positions) {
    if (deduped.length > 0 && value - deduped[deduped.length - 1] < 0.01) continue;
    deduped.push(Number(value.toFixed(4)));
  }
  return deduped;
}

export async function renderPartitionView(document: DrawingDocument): Promise<PartitionView> {
  const geometryBoundsList = document.geometry.flatMap((node) => {
    const bounds = geometryBounds(node);
    return bounds ? [bounds] : [];
  });
  const rawBounds = unionBounds(geometryBoundsList)
    ?? { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const diagonal = Math.hypot(
    rawBounds.maxX - rawBounds.minX,
    rawBounds.maxY - rawBounds.minY,
  );
  const pad = Math.max(diagonal * 0.03, 1);
  const worldBounds = {
    minX: rawBounds.minX - pad,
    minY: rawBounds.minY - pad,
    maxX: rawBounds.maxX + pad,
    maxY: rawBounds.maxY + pad,
  };
  const worldWidth = worldBounds.maxX - worldBounds.minX;
  const worldHeight = worldBounds.maxY - worldBounds.minY;
  const scale = RENDER_PIXEL_WIDTH / worldWidth;
  const imageWidth = RENDER_PIXEL_WIDTH;
  const imageHeight = Math.min(
    RENDER_PIXEL_WIDTH,
    Math.max(RENDER_MIN_PIXEL_HEIGHT, Math.round(scale * worldHeight)),
  );
  const scene = compileDrawingScene(document, {
    revision: 'revision_partition_view' as RevisionId,
    viewBounds: worldBounds,
    scale,
  });
  const raster = rasterizeScene(scene, {
    width: imageWidth,
    height: imageHeight,
    worldToImage: [scale, 0, 0, -scale, -scale * worldBounds.minX, scale * worldBounds.maxY],
    background: [255, 255, 255, 255],
    colorForPrimitive: () => [31, 41, 55, 255],
    strokeWidthPixels: () => 2,
  });
  const png = await sharp(raster.rgba, {
    raw: { width: imageWidth, height: imageHeight, channels: 4 },
  }).png().toBuffer();
  return {
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    worldBounds,
  };
}

/** 由分区锚点确定性生成矩形分区（每个分区沿轴向从 start 到 end，跨全图） */
export function materializePartitions(
  plan: RawPartitionPlan,
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
  geometry: GeometryNode[],
): DrawingPartition[] {
  const width = worldBounds.maxX - worldBounds.minX;
  const height = worldBounds.maxY - worldBounds.minY;
  const partitions: DrawingPartition[] = [];
  const usedNames = new Set<string>();
  for (const region of plan.regions) {
    if (partitions.length >= 12) break;
    const start = Math.max(0, Math.min(1, region.start));
    const end = Math.max(0, Math.min(1, region.end));
    if (end - start <= 1e-6) continue;
    let polygon: Vec2[];
    if (plan.axis === 'x') {
      const x0 = worldBounds.minX + start * width;
      const x1 = worldBounds.minX + end * width;
      polygon = [
        [x0, worldBounds.minY],
        [x1, worldBounds.minY],
        [x1, worldBounds.maxY],
        [x0, worldBounds.maxY],
      ];
    } else {
      const y0 = worldBounds.maxY - end * height;
      const y1 = worldBounds.maxY - start * height;
      polygon = [
        [worldBounds.minX, y0],
        [worldBounds.maxX, y0],
        [worldBounds.maxX, y1],
        [worldBounds.minX, y1],
      ];
    }
    let name = region.name || '未命名分区';
    if (usedNames.has(name)) {
      let suffix = 2;
      while (usedNames.has(`${region.name}(${suffix})`)) suffix += 1;
      name = `${region.name}(${suffix})`;
    }
    usedNames.add(name);
    const order = partitions.length;
    partitions.push({
      id: `partition_${order + 1}`,
      name,
      basis: region.basis,
      polygon,
      colorIndex: order,
      order,
      geometryIds: assignPartitionMembers(geometry, polygon),
    });
  }
  return partitions;
}

/** 已有分区 -> 归一化范围摘要（供模型按修改意见调整分界线时参考） */
function summarizeExistingPartition(
  feature: DrawingDocument['features'][number],
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number },
): ExistingPartitionSummary {
  const properties = feature.properties as {
    name?: string;
    basis?: string;
    polygon?: number[][];
  };
  const polygon = Array.isArray(properties.polygon) ? properties.polygon : [];
  const width = Math.max(worldBounds.maxX - worldBounds.minX, 1e-9);
  const height = Math.max(worldBounds.maxY - worldBounds.minY, 1e-9);
  const bounds = polygon.length >= 3
    ? partitionPolygonBounds(polygon.map((point) => [point[0], point[1]] as Vec2))
    : { minX: worldBounds.minX, minY: worldBounds.minY, maxX: worldBounds.maxX, maxY: worldBounds.maxY };
  return {
    name: String(properties.name ?? ''),
    basis: String(properties.basis ?? ''),
    uRange: [
      (bounds.minX - worldBounds.minX) / width,
      (bounds.maxX - worldBounds.minX) / width,
    ],
    vRange: [
      (worldBounds.maxY - bounds.maxY) / height,
      (worldBounds.maxY - bounds.minY) / height,
    ],
  };
}

function summarizeGeometry(geometry: GeometryNode[]): string {
  const counts = new Map<string, number>();
  for (const node of geometry) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  }
  if (counts.size === 0) return '图纸暂无几何图元';
  const labels = new Map<string, string>([
    ['line', '线段'], ['circle', '圆'], ['arc', '圆弧'],
    ['ellipse', '椭圆'], ['polyline', '多段线'], ['spline', '样条'],
  ]);
  return [...counts.entries()]
    .map(([type, count]) => `${labels.get(type) ?? type} ${count}`)
    .join('、');
}
