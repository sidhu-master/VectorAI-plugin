import type {
  RenderScene,
  ScenePathCommand,
  ScenePrimitive,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';

export type AffineTransform = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
];

export type RgbaColor = readonly [number, number, number, number];

export interface RasterizeSceneOptions {
  width: number;
  height: number;
  worldToImage: AffineTransform;
  background: RgbaColor;
  colorForPrimitive: (primitive: ScenePrimitive, index: number) => RgbaColor;
  strokeWidthPixels: (primitive: ScenePrimitive) => number;
  include?: (primitive: ScenePrimitive) => boolean;
}

export interface RasterizedScene {
  rgba: Uint8Array;
  nodeBounds: Map<string, SourcePixelRect>;
}

export function rasterizeScene(
  scene: RenderScene,
  options: RasterizeSceneOptions,
): RasterizedScene {
  const writer = new PixelWriter(options.width, options.height, options.background);
  scene.primitives.forEach((primitive, index) => {
    if (options.include && !options.include(primitive)) return;
    const color = options.colorForPrimitive(primitive, index);
    const radius = Math.max(0, Math.ceil(options.strokeWidthPixels(primitive)));
    if (primitive.kind === 'marker') {
      writer.stamp(transformPoint(options.worldToImage, primitive.position), color, Math.max(1, radius), primitive.nodeId);
      return;
    }
    if (primitive.kind === 'text') {
      drawTextBox(writer, primitive, options.worldToImage, color, Math.max(1, radius));
      return;
    }
    drawPath(writer, primitive.commands, options.worldToImage, color, radius, primitive.nodeId);
  });
  return { rgba: writer.rgba, nodeBounds: writer.bounds() };
}

function drawPath(
  writer: PixelWriter,
  commands: readonly ScenePathCommand[],
  transform: AffineTransform,
  color: RgbaColor,
  radius: number,
  nodeId: string,
): void {
  let current: Vec2 | null = null;
  let subpathStart: Vec2 | null = null;
  for (const command of commands) {
    if (command.op === 'M') {
      current = command.point;
      subpathStart = command.point;
      continue;
    }
    if (command.op === 'L') {
      if (current) writer.segment(transformPoint(transform, current), transformPoint(transform, command.point), color, radius, nodeId);
      current = command.point;
      continue;
    }
    if (command.op === 'Q') {
      if (!current) continue;
      const samples = sampleQuadratic(current, command.control, command.end);
      drawPolyline(writer, samples, transform, color, radius, nodeId);
      current = command.end;
      continue;
    }
    if (command.op === 'A') {
      const samples = sampleArc(command);
      drawPolyline(writer, samples, transform, color, radius, nodeId);
      current = samples.at(-1) ?? current;
      continue;
    }
    if (command.op === 'Z' && current && subpathStart) {
      writer.segment(transformPoint(transform, current), transformPoint(transform, subpathStart), color, radius, nodeId);
      current = subpathStart;
    }
  }
}

function drawPolyline(
  writer: PixelWriter,
  points: readonly Vec2[],
  transform: AffineTransform,
  color: RgbaColor,
  radius: number,
  nodeId: string,
): void {
  for (let index = 1; index < points.length; index += 1) {
    writer.segment(
      transformPoint(transform, points[index - 1]),
      transformPoint(transform, points[index]),
      color,
      radius,
      nodeId,
    );
  }
}

function sampleQuadratic(start: Vec2, control: Vec2, end: Vec2): Vec2[] {
  const length = Math.hypot(control[0] - start[0], control[1] - start[1])
    + Math.hypot(end[0] - control[0], end[1] - control[1]);
  const count = Math.max(8, Math.min(256, Math.ceil(length * 2)));
  return Array.from({ length: count + 1 }, (_, index): Vec2 => {
    const t = index / count;
    const inverse = 1 - t;
    return [
      inverse ** 2 * start[0] + 2 * inverse * t * control[0] + t ** 2 * end[0],
      inverse ** 2 * start[1] + 2 * inverse * t * control[1] + t ** 2 * end[1],
    ];
  });
}

function sampleArc(command: Extract<ScenePathCommand, { op: 'A' }>): Vec2[] {
  const fullTurn = Math.PI * 2;
  const rawDelta = command.endAngle - command.startAngle;
  const full = Math.abs(rawDelta) >= fullTurn - 1e-10;
  const span = full
    ? command.counterClockwise ? fullTurn : -fullTurn
    : command.counterClockwise
      ? normalizePositive(rawDelta, fullTurn)
      : -normalizePositive(-rawDelta, fullTurn);
  const count = Math.max(12, Math.min(2048, Math.ceil(
    Math.abs(span) * Math.max(command.radiusX, command.radiusY) * 2,
  )));
  const cosRotation = Math.cos(command.rotation);
  const sinRotation = Math.sin(command.rotation);
  return Array.from({ length: count + 1 }, (_, index): Vec2 => {
    const parameter = command.startAngle + span * index / count;
    const x = command.radiusX * Math.cos(parameter);
    const y = command.radiusY * Math.sin(parameter);
    return [
      command.center[0] + x * cosRotation - y * sinRotation,
      command.center[1] + x * sinRotation + y * cosRotation,
    ];
  });
}

function drawTextBox(
  writer: PixelWriter,
  primitive: Extract<ScenePrimitive, { kind: 'text' }>,
  transform: AffineTransform,
  color: RgbaColor,
  radius: number,
): void {
  const width = Math.max(primitive.height * 0.6, primitive.content.length * primitive.height * 0.6);
  const left = primitive.alignment === 'center' ? -width / 2 : primitive.alignment === 'right' ? -width : 0;
  const bottom = primitive.verticalAlignment === 'top'
    ? -primitive.height
    : primitive.verticalAlignment === 'middle' ? -primitive.height / 2 : 0;
  const radians = primitive.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const local: Vec2[] = [
    [left, bottom],
    [left + width, bottom],
    [left + width, bottom + primitive.height],
    [left, bottom + primitive.height],
  ];
  const points = local.map(([x, y]): Vec2 => [
    primitive.position[0] + x * cos - y * sin,
    primitive.position[1] + x * sin + y * cos,
  ]);
  drawPolyline(writer, [...points, points[0]], transform, color, radius, primitive.nodeId);
}

export function transformPoint(transform: AffineTransform, point: Vec2): Vec2 {
  return [
    transform[0] * point[0] + transform[2] * point[1] + transform[4],
    transform[1] * point[0] + transform[3] * point[1] + transform[5],
  ];
}

class PixelWriter {
  readonly rgba: Uint8Array;
  readonly #nodeBounds = new Map<string, SourcePixelRect>();

  constructor(
    readonly width: number,
    readonly height: number,
    background: RgbaColor,
  ) {
    this.rgba = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      this.rgba[index * 4] = background[0];
      this.rgba[index * 4 + 1] = background[1];
      this.rgba[index * 4 + 2] = background[2];
      this.rgba[index * 4 + 3] = background[3];
    }
  }

  segment(start: Vec2, end: Vec2, color: RgbaColor, radius: number, nodeId: string): void {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const steps = Math.max(1, Math.ceil(length * 2));
    for (let step = 0; step <= steps; step += 1) {
      const fraction = step / steps;
      this.stamp([
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ], color, radius, nodeId);
    }
  }

  stamp(point: Vec2, color: RgbaColor, radius: number, nodeId: string): void {
    const centerX = Math.round(point[0]);
    const centerY = Math.round(point[1]);
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      if (y < 0 || y >= this.height) continue;
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || x >= this.width) continue;
        const offset = (y * this.width + x) * 4;
        this.rgba[offset] = color[0];
        this.rgba[offset + 1] = color[1];
        this.rgba[offset + 2] = color[2];
        this.rgba[offset + 3] = color[3];
        this.#include(nodeId, x, y);
      }
    }
  }

  bounds(): Map<string, SourcePixelRect> {
    return new Map([...this.#nodeBounds].map(([nodeId, bounds]) => [nodeId, { ...bounds }]));
  }

  #include(nodeId: string, x: number, y: number): void {
    const current = this.#nodeBounds.get(nodeId);
    if (!current) {
      this.#nodeBounds.set(nodeId, { x, y, width: 1, height: 1 });
      return;
    }
    const maxX = Math.max(current.x + current.width - 1, x);
    const maxY = Math.max(current.y + current.height - 1, y);
    const minX = Math.min(current.x, x);
    const minY = Math.min(current.y, y);
    current.x = minX;
    current.y = minY;
    current.width = maxX - minX + 1;
    current.height = maxY - minY + 1;
  }
}

function normalizePositive(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
