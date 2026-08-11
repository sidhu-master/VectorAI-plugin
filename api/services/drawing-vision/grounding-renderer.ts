/**
 * Grounding Renderer —— 把当前 Drawing IR 渲染成彩色图片,并输出确定性的
 * "nodeId ↔ 图像区域" 接地映射(含选区高亮),供视觉决策模型定位用户指代。
 *
 * 与 source-renderer(掩码平面,仅供像素残差比较)不同,这里输出的是
 * 可直接发给视觉 LLM 的 PNG 图,且每个节点用其 id 派生的颜色绘制,
 * 因此渲染器精确知道"哪块像素属于哪个 nodeId",接地为零误差。
 */
import sharp from 'sharp';
import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import {
  sampleArc,
  sampleCircle,
  sampleEllipse,
  sampleSpline,
  transformPoint,
  type AffineTransform,
} from '../drawing-feedback/source-renderer.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';

export interface GroundingNode {
  nodeId: string;
  type: string;
  bounds: SourcePixelRect;
  /** 相对整幅图的归一化坐标(0~1),便于模型判断节点在整图中的位置 */
  normalized: { left: number; top: number; right: number; bottom: number };
  selected: boolean;
}

export interface GroundingSnapshot {
  width: number;
  height: number;
  imageDataUrl: string;
  nodes: GroundingNode[];
}

export interface RenderGroundingSnapshotInput {
  document: DrawingDocument;
  /** 画布缩放(世界单位 → 屏幕像素) */
  scale: number;
  /** 画布平移(屏幕像素),world x=0 的屏幕 x */
  offsetX: number;
  /** 画布平移(屏幕像素),world y=0 的屏幕 y(Y 轴向上翻转) */
  offsetY: number;
  /** 画布视口尺寸(px),即前端实际 w×h */
  width: number;
  height: number;
  /** 当前被选中的节点 id */
  selectedIds?: string[];
  /** 输出图片最大边长,超时按比例缩小(用于控制模型输入体积) */
  maxDimension?: number;
  background?: readonly [number, number, number];
}

const SELECTED_COLOR: readonly [number, number, number] = [255, 80, 80];

export async function renderGroundingSnapshot(
  input: RenderGroundingSnapshotInput,
): Promise<GroundingSnapshot> {
  const {
    document,
    scale,
    offsetX,
    offsetY,
    selectedIds,
    background = [13, 16, 20],
  } = input;

  // 超限时整体缩小,保证内容不变(视觉上等比例)
  const maxDim = Math.max(1, Math.floor(input.maxDimension ?? 2048));
  const sourceMax = Math.max(input.width, input.height);
  const factor = sourceMax > maxDim ? maxDim / sourceMax : 1;
  const width = Math.max(1, Math.round(input.width * factor));
  const height = Math.max(1, Math.round(input.height * factor));

  // world → 图像像素 的仿射(与画布一致:Y 翻转)
  const documentToImage: AffineTransform = [
    scale * factor,
    0,
    0,
    -scale * factor,
    offsetX * factor,
    offsetY * factor,
  ];
  const region: SourcePixelRect = { x: 0, y: 0, width, height };

  const selected = new Set(selectedIds ?? []);
  const raster = new ColorRasterizer(width, height, background, documentToImage, region);

  const grounding: GroundingNode[] = [];
  const add = (nodeId: string, type: string, bounds: SourcePixelRect) => {
    const safeBounds = {
      x: Math.max(0, Math.min(width - 1, bounds.x)),
      y: Math.max(0, Math.min(height - 1, bounds.y)),
      width: Math.max(1, Math.min(width - bounds.x, bounds.width)),
      height: Math.max(1, Math.min(height - bounds.y, bounds.height)),
    };
    grounding.push({
      nodeId,
      type,
      bounds: safeBounds,
      normalized: {
        left: safeBounds.x / width,
        top: safeBounds.y / height,
        right: (safeBounds.x + safeBounds.width) / width,
        bottom: (safeBounds.y + safeBounds.height) / height,
      },
      selected: selected.has(nodeId),
    });
  };

  for (const node of document.geometry) {
    if (!node.visible) continue;
    const color = selected.has(node.id) ? SELECTED_COLOR : rgbFromId(node.id);
    raster.begin();
    raster.geometry(node, color, selected.has(node.id) ? 2 : 1);
    const bounds = raster.bounds();
    if (bounds) add(node.id, node.type, bounds);
  }
  for (const node of document.annotations) {
    if (!node.visible) continue;
    const color = selected.has(node.id) ? SELECTED_COLOR : rgbFromId(node.id);
    raster.begin();
    raster.annotation(node, color);
    const bounds = raster.bounds();
    if (bounds) add(node.id, node.type, bounds);
  }

  const png = await sharp(raster.rgba, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();

  return {
    width,
    height,
    imageDataUrl: `data:image/png;base64,${png.toString('base64')}`,
    nodes: grounding,
  };
}

class ColorRasterizer {
  readonly rgba: Uint8Array;
  readonly #width: number;
  readonly #height: number;
  readonly #transform: AffineTransform;
  readonly #region: SourcePixelRect;
  #minX = Infinity;
  #minY = Infinity;
  #maxX = -Infinity;
  #maxY = -Infinity;

  constructor(
    width: number,
    height: number,
    background: readonly [number, number, number],
    transform: AffineTransform,
    region: SourcePixelRect,
  ) {
    this.#width = width;
    this.#height = height;
    this.#transform = transform;
    this.#region = region;
    this.rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      this.rgba[i * 4] = background[0];
      this.rgba[i * 4 + 1] = background[1];
      this.rgba[i * 4 + 2] = background[2];
      this.rgba[i * 4 + 3] = 255;
    }
  }

  begin(): void {
    this.#minX = Infinity;
    this.#minY = Infinity;
    this.#maxX = -Infinity;
    this.#maxY = -Infinity;
  }

  bounds(): SourcePixelRect | null {
    if (this.#minX > this.#maxX || this.#minY > this.#maxY) return null;
    const x = Math.max(0, Math.min(this.#width - 1, this.#minX));
    const y = Math.max(0, Math.min(this.#height - 1, this.#minY));
    const maxX = Math.max(0, Math.min(this.#width - 1, this.#maxX));
    const maxY = Math.max(0, Math.min(this.#height - 1, this.#maxY));
    return { x, y, width: maxX - x + 1, height: maxY - y + 1 };
  }

  geometry(node: GeometryNode, color: readonly [number, number, number], radius: number): void {
    switch (node.type) {
      case 'point':
        this.#stamp(this.#point([node.x, node.y]), color, Math.max(1, radius));
        return;
      case 'line':
        this.#segment(this.#point(node.start), this.#point(node.end), color, radius);
        return;
      case 'ray':
      case 'xline':
        this.#extended(node.origin, node.direction, node.type === 'ray', color, radius);
        return;
      case 'circle':
        this.#curve(sampleCircle(node.center, node.radius), color, radius);
        return;
      case 'arc':
        this.#curve(sampleArc(
          node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise,
        ), color, radius);
        return;
      case 'ellipse':
        this.#curve(sampleEllipse(node), color, radius);
        return;
      case 'polyline':
        this.#polyline(node.vertices.map((vertex) => vertex.point), node.closed, color, radius);
        return;
      case 'spline':
        this.#curve(sampleSpline(node.controlPoints, node.closed), color, radius);
        return;
    }
  }

  annotation(node: AnnotationNode, color: readonly [number, number, number]): void {
    if (node.type === 'text') {
      this.#textBox(node.position, node.content, node.height, node.rotation, color);
      return;
    }
    this.#polyline(node.definitionPoints, false, color, 1);
    for (const point of node.definitionPoints) this.#stamp(this.#point(point), color, 2);
    const text = node.displayText
      ?? String(node.observedValue ?? node.computedValue ?? '—');
    this.#textBox(node.textPosition, text, 10, 0, color);
  }

  #curve(points: readonly Vec2[], color: readonly [number, number, number], radius: number): void {
    this.#polyline(points, false, color, radius);
  }

  #polyline(
    points: readonly Vec2[],
    closed: boolean,
    color: readonly [number, number, number],
    radius: number,
  ): void {
    if (points.length === 1) {
      this.#stamp(this.#point(points[0]), color, Math.max(1, radius));
      return;
    }
    for (let index = 1; index < points.length; index += 1) {
      this.#segment(this.#point(points[index - 1]), this.#point(points[index]), color, radius);
    }
    if (closed && points.length > 2) {
      this.#segment(this.#point(points.at(-1)!), this.#point(points[0]), color, radius);
    }
  }

  #extended(
    origin: Vec2,
    direction: Vec2,
    ray: boolean,
    color: readonly [number, number, number],
    radius: number,
  ): void {
    const sourceOrigin = this.#point(origin);
    const sourceDirection = transformDirection(this.#transform, direction);
    const length = Math.hypot(sourceDirection[0], sourceDirection[1]);
    if (!(length > 0)) return;
    const unit: Vec2 = [sourceDirection[0] / length, sourceDirection[1] / length];
    const span = Math.hypot(this.#width, this.#height) * 2;
    const start: Vec2 = ray
      ? sourceOrigin
      : [sourceOrigin[0] - unit[0] * span, sourceOrigin[1] - unit[1] * span];
    const end: Vec2 = [sourceOrigin[0] + unit[0] * span, sourceOrigin[1] + unit[1] * span];
    this.#segment(start, end, color, radius);
  }

  #textBox(
    position: Vec2,
    text: string,
    height: number,
    rotationDegrees: number,
    color: readonly [number, number, number],
  ): void {
    const width = Math.max(height * 0.6, text.length * height * 0.6);
    const radians = rotationDegrees * Math.PI / 180;
    const along: Vec2 = [Math.cos(radians) * width, Math.sin(radians) * width];
    const up: Vec2 = [-Math.sin(radians) * height, Math.cos(radians) * height];
    const corners: Vec2[] = [
      position,
      [position[0] + along[0], position[1] + along[1]],
      [position[0] + along[0] + up[0], position[1] + along[1] + up[1]],
      [position[0] + up[0], position[1] + up[1]],
    ];
    this.#polyline(corners, true, color, 1);
  }

  #segment(
    start: Vec2,
    end: Vec2,
    color: readonly [number, number, number],
    radius: number,
  ): void {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const steps = Math.max(1, Math.ceil(length * 2));
    for (let step = 0; step <= steps; step += 1) {
      const fraction = step / steps;
      this.#stamp([
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ], color, radius);
    }
  }

  #stamp(source: Vec2, color: readonly [number, number, number], radius: number): void {
    const centerX = Math.round(source[0] - this.#region.x);
    const centerY = Math.round(source[1] - this.#region.y);
    this.#minX = Math.min(this.#minX, centerX - radius);
    this.#minY = Math.min(this.#minY, centerY - radius);
    this.#maxX = Math.max(this.#maxX, centerX + radius);
    this.#maxY = Math.max(this.#maxY, centerY + radius);
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      if (y < 0 || y >= this.#height) continue;
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || x >= this.#width) continue;
        const offset = (y * this.#width + x) * 4;
        this.rgba[offset] = color[0];
        this.rgba[offset + 1] = color[1];
        this.rgba[offset + 2] = color[2];
        this.rgba[offset + 3] = 255;
      }
    }
  }

  #point(point: Vec2): Vec2 {
    return transformPoint(this.#transform, point);
  }
}

function rgbFromId(id: string): readonly [number, number, number] {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hslToRgb(hash % 360, 0.62, 0.55);
}

function hslToRgb(h: number, s: number, l: number): readonly [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function transformDirection(transform: AffineTransform, direction: Vec2): Vec2 {
  return [
    transform[0] * direction[0] + transform[2] * direction[1],
    transform[1] * direction[0] + transform[3] * direction[1],
  ];
}
