import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import type { SourcePixelRect } from '../drawing-cv/types.js';

export type AffineTransform = readonly [
  a: number, b: number, c: number, d: number, e: number, f: number,
];

export interface RenderDrawingRegionRequest {
  region: SourcePixelRect;
  documentToSource: AffineTransform;
  strokeWidthPixels?: number;
}

export interface RenderedSemanticPlanes {
  width: number;
  height: number;
  region: SourcePixelRect;
  planes: {
    geometry: Uint8Array;
    construction: Uint8Array;
    annotation: Uint8Array;
    text: Uint8Array;
  };
  combined: Uint8Array;
}

type SemanticPlane = keyof RenderedSemanticPlanes['planes'];

export function renderDrawingRegion(
  document: DrawingDocument,
  request: RenderDrawingRegionRequest,
): RenderedSemanticPlanes {
  assertRequest(request);
  const area = request.region.width * request.region.height;
  const planes: RenderedSemanticPlanes['planes'] = {
    geometry: new Uint8Array(area),
    construction: new Uint8Array(area),
    annotation: new Uint8Array(area),
    text: new Uint8Array(area),
  };
  const renderer = new MaskRenderer(planes, request);
  document.geometry.filter((node) => node.visible).forEach((node) => renderer.geometry(node));
  document.annotations.filter((node) => node.visible).forEach((node) => renderer.annotation(node));
  const combined = new Uint8Array(area);
  for (let index = 0; index < area; index += 1) {
    combined[index] = planes.geometry[index] || planes.construction[index]
      || planes.annotation[index] || planes.text[index] ? 1 : 0;
  }
  return {
    width: request.region.width,
    height: request.region.height,
    region: { ...request.region },
    planes,
    combined,
  };
}

class MaskRenderer {
  readonly #radius: number;

  constructor(
    readonly planes: RenderedSemanticPlanes['planes'],
    readonly request: RenderDrawingRegionRequest,
  ) {
    this.#radius = Math.max(0, Math.floor((request.strokeWidthPixels ?? 1) / 2));
  }

  geometry(node: GeometryNode): void {
    const plane: SemanticPlane = node.type === 'ray' || node.type === 'xline'
      ? 'construction'
      : 'geometry';
    switch (node.type) {
      case 'point':
        this.#stamp(plane, this.#point([node.x, node.y]), Math.max(1, this.#radius));
        return;
      case 'line':
        this.#segment(plane, this.#point(node.start), this.#point(node.end));
        return;
      case 'ray':
      case 'xline':
        this.#extended(plane, node.origin, node.direction, node.type === 'ray');
        return;
      case 'circle':
        this.#curve(plane, sampleCircle(node.center, node.radius));
        return;
      case 'arc':
        this.#curve(plane, sampleArc(
          node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise,
        ));
        return;
      case 'ellipse':
        this.#curve(plane, sampleEllipse(node));
        return;
      case 'polyline':
        this.#polyline(plane, node.vertices.map((vertex) => vertex.point), node.closed);
        return;
      case 'spline':
        this.#curve(plane, sampleSpline(node.controlPoints, node.closed));
        return;
    }
  }

  annotation(node: AnnotationNode): void {
    if (node.type === 'text') {
      this.#textBox(node.position, node.content, node.height, node.rotation);
      return;
    }
    this.#polyline('annotation', node.definitionPoints, false);
    for (const point of node.definitionPoints) this.#stamp('annotation', this.#point(point), 2);
    const text = node.displayText
      ?? String(node.observedValue ?? node.computedValue ?? '—');
    this.#textBox(node.textPosition, text, Math.max(4, (this.request.strokeWidthPixels ?? 1) * 6), 0);
  }

  #curve(plane: SemanticPlane, points: Vec2[]): void {
    this.#polyline(plane, points, false);
  }

  #polyline(plane: SemanticPlane, points: readonly Vec2[], closed: boolean): void {
    if (points.length === 1) this.#stamp(plane, this.#point(points[0]), this.#radius);
    for (let index = 1; index < points.length; index += 1) {
      this.#segment(plane, this.#point(points[index - 1]), this.#point(points[index]));
    }
    if (closed && points.length > 2) {
      this.#segment(plane, this.#point(points.at(-1)!), this.#point(points[0]));
    }
  }

  #extended(plane: SemanticPlane, origin: Vec2, direction: Vec2, ray: boolean): void {
    const sourceOrigin = this.#point(origin);
    const sourceDirection = transformDirection(this.request.documentToSource, direction);
    const length = Math.hypot(sourceDirection[0], sourceDirection[1]);
    if (!(length > 0)) return;
    const unit: Vec2 = [sourceDirection[0] / length, sourceDirection[1] / length];
    const span = Math.hypot(this.request.region.width, this.request.region.height) * 2;
    const start: Vec2 = ray
      ? sourceOrigin
      : [sourceOrigin[0] - unit[0] * span, sourceOrigin[1] - unit[1] * span];
    const end: Vec2 = [sourceOrigin[0] + unit[0] * span, sourceOrigin[1] + unit[1] * span];
    this.#segment(plane, start, end);
  }

  #textBox(position: Vec2, text: string, height: number, rotationDegrees: number): void {
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
    this.#polyline('text', corners, true);
  }

  #segment(plane: SemanticPlane, start: Vec2, end: Vec2): void {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const steps = Math.max(1, Math.ceil(length * 2));
    for (let step = 0; step <= steps; step += 1) {
      const fraction = step / steps;
      this.#stamp(plane, [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ], this.#radius);
    }
  }

  #stamp(plane: SemanticPlane, source: Vec2, radius: number): void {
    const centerX = Math.round(source[0] - this.request.region.x);
    const centerY = Math.round(source[1] - this.request.region.y);
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      if (y < 0 || y >= this.request.region.height) continue;
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (x < 0 || x >= this.request.region.width) continue;
        this.planes[plane][y * this.request.region.width + x] = 1;
      }
    }
  }

  #point(point: Vec2): Vec2 {
    return transformPoint(this.request.documentToSource, point);
  }
}

export function transformPoint(transform: AffineTransform, point: Vec2): Vec2 {
  return [
    transform[0] * point[0] + transform[2] * point[1] + transform[4],
    transform[1] * point[0] + transform[3] * point[1] + transform[5],
  ];
}

function transformDirection(transform: AffineTransform, direction: Vec2): Vec2 {
  return [
    transform[0] * direction[0] + transform[2] * direction[1],
    transform[1] * direction[0] + transform[3] * direction[1],
  ];
}

function sampleCircle(center: Vec2, radius: number): Vec2[] {
  const count = Math.max(24, Math.ceil(2 * Math.PI * radius * 2));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  });
}

function sampleArc(
  center: Vec2,
  radius: number,
  startDegrees: number,
  endDegrees: number,
  counterClockwise: boolean,
): Vec2[] {
  const start = normalizeDegrees(startDegrees);
  const end = normalizeDegrees(endDegrees);
  const span = counterClockwise
    ? (end - start + 360) % 360
    : -((start - end + 360) % 360);
  const count = Math.max(8, Math.ceil(Math.abs(span) * Math.PI / 180 * radius * 2));
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = (start + span * index / count) * Math.PI / 180;
    return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
  });
}

function sampleEllipse(node: Extract<GeometryNode, { type: 'ellipse' }>): Vec2[] {
  const majorRadius = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
  if (!(majorRadius > 0)) return [];
  const major: Vec2 = [node.majorAxis[0] / majorRadius, node.majorAxis[1] / majorRadius];
  const minor: Vec2 = [-major[1], major[0]];
  const start = node.startParam ?? 0;
  let span = (node.endParam ?? Math.PI * 2) - start;
  if (span <= 0) span += Math.PI * 2;
  const count = Math.max(24, Math.ceil(span * majorRadius * 2));
  return Array.from({ length: count + 1 }, (_, index) => {
    const parameter = start + span * index / count;
    return [
      node.center[0] + Math.cos(parameter) * node.majorAxis[0]
        + Math.sin(parameter) * minor[0] * majorRadius * node.ratio,
      node.center[1] + Math.cos(parameter) * node.majorAxis[1]
        + Math.sin(parameter) * minor[1] * majorRadius * node.ratio,
    ];
  });
}

function sampleSpline(points: readonly Vec2[], closed: boolean): Vec2[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) return [points[0], points[1]];
  const output: Vec2[] = [points[0]];
  let start = points[0];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    const end: Vec2 = index === points.length - 2
      ? next
      : [(control[0] + next[0]) / 2, (control[1] + next[1]) / 2];
    for (let step = 1; step <= 20; step += 1) {
      const t = step / 20;
      const inverse = 1 - t;
      output.push([
        inverse ** 2 * start[0] + 2 * inverse * t * control[0] + t ** 2 * end[0],
        inverse ** 2 * start[1] + 2 * inverse * t * control[1] + t ** 2 * end[1],
      ]);
    }
    start = end;
  }
  if (closed) output.push(output[0]);
  return output;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function assertRequest(request: RenderDrawingRegionRequest): void {
  const { x, y, width, height } = request.region;
  if (![x, y, width, height].every(Number.isInteger)
    || x < 0 || y < 0 || width < 1 || height < 1
    || !request.documentToSource.every(Number.isFinite)) {
    throw new Error('SOURCE_RENDER_REQUEST_INVALID');
  }
}
