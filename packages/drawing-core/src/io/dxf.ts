// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../document';

const GEOMETRY_LAYER = 'GEOMETRY';
const ANNOTATION_LAYER = 'ANNOTATIONS';

/** Export the visible canonical drawing as an AutoCAD 2000 ASCII DXF document. */
export function exportDrawingDxf(document: DrawingDocument): string {
  const writer = new DxfWriter();
  writer.section('HEADER', () => {
    writer.pair(9, '$ACADVER');
    writer.pair(1, 'AC1015');
    writer.pair(9, '$INSUNITS');
    writer.pair(70, insertionUnit(document.unitSystem.length));
  });
  writer.section('TABLES', () => {
    writer.pair(0, 'TABLE');
    writer.pair(2, 'LAYER');
    writer.pair(70, 2);
    writeLayer(writer, GEOMETRY_LAYER, 7);
    writeLayer(writer, ANNOTATION_LAYER, 3);
    writer.pair(0, 'ENDTAB');
  });
  writer.section('ENTITIES', () => {
    for (const node of document.geometry) {
      if (node.visible) writeGeometry(writer, node);
    }
    for (const node of document.annotations) {
      if (node.visible) writeAnnotation(writer, node);
    }
  });
  writer.pair(0, 'EOF');
  return writer.toString();
}

class DxfWriter {
  readonly #lines: string[] = [];

  pair(code: number, value: string | number): void {
    this.#lines.push(String(code), typeof value === 'number' ? formatNumber(value) : value);
  }

  section(name: string, write: () => void): void {
    this.pair(0, 'SECTION');
    this.pair(2, name);
    write();
    this.pair(0, 'ENDSEC');
  }

  toString(): string {
    return `${this.#lines.join('\r\n')}\r\n`;
  }
}

function writeLayer(writer: DxfWriter, name: string, color: number): void {
  writer.pair(0, 'LAYER');
  writer.pair(2, name);
  writer.pair(70, 0);
  writer.pair(62, color);
  writer.pair(6, 'CONTINUOUS');
}

function writeGeometry(writer: DxfWriter, node: GeometryNode): void {
  switch (node.type) {
    case 'point':
      entity(writer, 'POINT', GEOMETRY_LAYER);
      point(writer, 10, [node.x, node.y]);
      return;
    case 'line':
      writeLine(writer, node.start, node.end, GEOMETRY_LAYER);
      return;
    case 'ray':
    case 'xline':
      entity(writer, node.type === 'ray' ? 'RAY' : 'XLINE', GEOMETRY_LAYER);
      point(writer, 10, node.origin);
      point(writer, 11, node.direction);
      return;
    case 'circle':
      entity(writer, 'CIRCLE', GEOMETRY_LAYER);
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      return;
    case 'arc': {
      entity(writer, 'ARC', GEOMETRY_LAYER);
      point(writer, 10, node.center);
      writer.pair(40, node.radius);
      // DXF arcs always travel counter-clockwise in their object coordinate system.
      writer.pair(50, normalizeDegrees(node.counterClockwise ? node.startAngle : node.endAngle));
      writer.pair(51, normalizeDegrees(node.counterClockwise ? node.endAngle : node.startAngle));
      return;
    }
    case 'ellipse':
      entity(writer, 'ELLIPSE', GEOMETRY_LAYER);
      point(writer, 10, node.center);
      point(writer, 11, node.majorAxis);
      writer.pair(40, node.ratio);
      writer.pair(41, node.startParam ?? 0);
      writer.pair(42, node.endParam ?? Math.PI * 2);
      return;
    case 'polyline':
      if (node.vertices.length === 0) return;
      entity(writer, 'LWPOLYLINE', GEOMETRY_LAYER);
      writer.pair(90, node.vertices.length);
      writer.pair(70, node.closed ? 1 : 0);
      for (const vertex of node.vertices) {
        writer.pair(10, vertex.point[0]);
        writer.pair(20, vertex.point[1]);
        if (vertex.bulge !== undefined) writer.pair(42, vertex.bulge);
      }
      return;
    case 'spline':
      if (node.controlPoints.length === 0) return;
      entity(writer, 'SPLINE', GEOMETRY_LAYER);
      writer.pair(70, 8 | (node.closed ? 1 : 0) | (node.periodic ? 2 : 0) | (node.weights ? 4 : 0));
      writer.pair(71, node.degree);
      writer.pair(72, node.knots.length);
      writer.pair(73, node.controlPoints.length);
      writer.pair(74, 0);
      for (const knot of node.knots) writer.pair(40, knot);
      for (const weight of node.weights ?? []) writer.pair(41, weight);
      for (const controlPoint of node.controlPoints) point(writer, 10, controlPoint);
  }
}

function writeAnnotation(writer: DxfWriter, node: AnnotationNode): void {
  switch (node.type) {
    case 'text':
      writeText(
        writer,
        node.position,
        node.content,
        node.height,
        node.rotation,
        node.alignment,
        node.verticalAlignment,
      );
      return;
    case 'dimension': {
      writePolyline(writer, node.definitionPoints, false, ANNOTATION_LAYER);
      writeText(writer, node.textPosition, dimensionLabel(node), annotationTextHeight(node), 0, 'center', 'middle');
      return;
    }
    case 'leader': {
      writePolyline(writer, node.points, false, ANNOTATION_LAYER);
      const textPosition = node.points.at(-1);
      if (textPosition !== undefined) {
        writeText(writer, textPosition, node.content, node.textHeight, 0, 'left', 'baseline');
      }
      return;
    }
    case 'centerline': {
      const [start, end] = extendLine(node.start, node.end, node.extension);
      writeLine(writer, start, end, ANNOTATION_LAYER, 'CENTER');
      return;
    }
    case 'section-hatch':
      for (const segment of node.segments) {
        writeLine(writer, segment.start, segment.end, ANNOTATION_LAYER);
      }
  }
}

function entity(writer: DxfWriter, type: string, layer: string): void {
  writer.pair(0, type);
  writer.pair(8, layer);
}

function point(writer: DxfWriter, xCode: 10 | 11, value: Vec2): void {
  writer.pair(xCode, value[0]);
  writer.pair(xCode + 10, value[1]);
  writer.pair(xCode + 20, 0);
}

function writeLine(
  writer: DxfWriter,
  start: Vec2,
  end: Vec2,
  layer: string,
  lineType?: string,
): void {
  entity(writer, 'LINE', layer);
  if (lineType !== undefined) writer.pair(6, lineType);
  point(writer, 10, start);
  point(writer, 11, end);
}

function writePolyline(writer: DxfWriter, points: readonly Vec2[], closed: boolean, layer: string): void {
  if (points.length === 0) return;
  entity(writer, 'LWPOLYLINE', layer);
  writer.pair(90, points.length);
  writer.pair(70, closed ? 1 : 0);
  for (const value of points) {
    writer.pair(10, value[0]);
    writer.pair(20, value[1]);
  }
}

function writeText(
  writer: DxfWriter,
  position: Vec2,
  content: string,
  height: number,
  rotation: number,
  alignment: 'left' | 'center' | 'right',
  verticalAlignment: 'baseline' | 'bottom' | 'middle' | 'top',
): void {
  entity(writer, 'TEXT', ANNOTATION_LAYER);
  point(writer, 10, position);
  writer.pair(40, Math.max(height, Number.EPSILON));
  writer.pair(1, dxfText(content));
  writer.pair(50, rotation);
  writer.pair(72, { left: 0, center: 1, right: 2 }[alignment]);
  writer.pair(73, { baseline: 0, bottom: 1, middle: 2, top: 3 }[verticalAlignment]);
  if (alignment !== 'left' || verticalAlignment !== 'baseline') point(writer, 11, position);
}

function extendLine(start: Vec2, end: Vec2, extension: number): [Vec2, Vec2] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !(extension > 0)) return [start, end];
  const extendX = dx / length * extension;
  const extendY = dy / length * extension;
  return [
    [start[0] - extendX, start[1] - extendY],
    [end[0] + extendX, end[1] + extendY],
  ];
}

function annotationTextHeight(node: Extract<AnnotationNode, { type: 'dimension' }>): number {
  const points = node.definitionPoints;
  if (points.length < 2) return 2.5;
  return Math.max(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) * 0.05, 0.1);
}

function dimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  const base = baseDimensionLabel(node);
  const tolerance = toleranceLabel(node);
  return tolerance === undefined ? base : `${base} ${tolerance}`;
}

function baseDimensionLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string {
  if (node.displayText !== undefined) return node.displayText;
  const value = node.observedValue ?? node.computedValue;
  if (value === undefined) return '—';
  return `${node.prefix ?? ''}${value}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
}

function toleranceLabel(node: Extract<AnnotationNode, { type: 'dimension' }>): string | undefined {
  const projection = node.toleranceProjection;
  if (projection && (projection.status === 'resolved' || projection.status === 'confirmed')) {
    switch (projection.mode) {
      case 'bilateral':
      case 'unilateral':
        if (finite(projection.upperDeviation) && finite(projection.lowerDeviation)) {
          return `${signed(projection.upperDeviation)}/${signed(projection.lowerDeviation)}`;
        }
        return undefined;
      case 'limits':
        if (finite(projection.upperLimit) && finite(projection.lowerLimit) && projection.lowerLimit <= projection.upperLimit) {
          return `[${textNumber(projection.upperLimit)}/${textNumber(projection.lowerLimit)}]`;
        }
        return undefined;
      case 'fit':
        return projection.fitDesignation?.trim() || undefined;
      case 'none':
        return undefined;
    }
  }
  const legacy = node.tolerance;
  if (legacy && (finite(legacy.upper) || finite(legacy.lower))) {
    return `${signed(legacy.upper ?? 0)}/${signed(legacy.lower ?? 0)}`;
  }
  return undefined;
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function signed(value: number): string {
  if (Object.is(value, -0) || value === 0) return '0';
  return value > 0 ? `+${textNumber(value)}` : textNumber(value);
}

function textNumber(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function dxfText(value: string): string {
  return [...value.replace(/\r\n|\r|\n/g, '\\P')]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code >= 32 && code !== 127;
    })
    .join('');
}

function insertionUnit(unit: DrawingDocument['unitSystem']['length']): number {
  return { mm: 4, cm: 5, m: 6 }[unit];
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError('DXF values must be finite numbers');
  return Object.is(value, -0) ? '0' : String(value);
}
