// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationId, HatchBoundaryEdge, HatchBoundaryPath, HatchPatternLine,
  ParametricHatch, SectionHatchAnnotation, Vec2,
} from '@vectorai/drawing-core';
import { normalizeHatchRegion } from '@vectorai/drawing-hatch';

import { sourceRef, type DxfEntityContext, type DxfEntityRecord } from './entities';
import type { DxfPair } from './types';

const EPSILON = 1e-8;

export interface ProjectedHatchPattern {
  pattern: string;
  angle: number;
  spacing: number;
  hatch: ParametricHatch;
}

type ParsedBoundaryEdge =
  | { kind: 'line'; start: Vec2; end: Vec2 }
  | { kind: 'arc'; center: Vec2; radius: number; startAngle: number; endAngle: number; counterClockwise: boolean }
  | { kind: 'ellipse'; center: Vec2; majorAxis: Vec2; ratio: number; startParam: number; endParam: number; counterClockwise: boolean }
  | {
      kind: 'spline'; degree: number; rational: boolean; periodic: boolean;
      controlPoints: Vec2[]; knots: number[]; weights?: number[]; fitPoints?: Vec2[];
    };

interface ParsedBoundaryPath { edges: ParsedBoundaryEdge[]; closed: boolean }

/** Parse the authoritative DXF HATCH boundary and line-family definition. */
export function projectHatchPattern(pairs: DxfPair[]): ProjectedHatchPattern | null {
  const subclassIndex = pairs.findIndex((pair) => pair.code === 100 && pair.value.trim() === 'AcDbHatch');
  if (subclassIndex < 0) return null;
  const header = pairs.slice(subclassIndex + 1);
  const boundaryCountIndex = header.findIndex((pair) => pair.code === 91);
  if (boundaryCountIndex < 0 || integerValue(header.slice(0, boundaryCountIndex), 70, 0) !== 0) return null;

  const pattern = value(header.slice(0, boundaryCountIndex), 2)?.trim() || 'USER';
  const cursor = new PairCursor(header, boundaryCountIndex + 1);
  const boundaryCount = integer(header[boundaryCountIndex]?.value, 0);
  const boundaryPaths: HatchBoundaryPath[] = [];
  for (let index = 0; index < boundaryCount; index += 1) {
    const flagsValue = cursor.number(92);
    if (flagsValue === undefined) return null;
    const flags = Math.trunc(flagsValue);
    const parsed = (flags & 2) === 2 ? parsePolylineBoundary(cursor) : parseEdgeBoundary(cursor);
    if (parsed === null) return null;
    boundaryPaths.push({ flags, closed: parsed.closed, edges: parsed.edges.map(toHatchBoundaryEdge) });
    if (!skipBoundaryReferences(cursor)) return null;
  }
  if (boundaryPaths.length === 0) return null;

  const remaining = header.slice(cursor.index);
  const patternAngle = numberValue(remaining, 52, 0);
  const patternScale = numberValue(remaining, 41, 1);
  if (!(patternScale > 0)) return null;
  const patternLineCountOffset = remaining.findIndex((pair) => pair.code === 78);
  if (patternLineCountOffset < 0) return null;
  cursor.index += patternLineCountOffset;
  const patternLineCount = Math.max(0, Math.trunc(cursor.number(78) ?? 0));
  const patternLines: HatchPatternLine[] = [];
  for (let index = 0; index < patternLineCount; index += 1) {
    const angle = cursor.number(53);
    const base = cursor.point(43, 44, false);
    const offset = cursor.point(45, 46, false);
    const dashCount = Math.max(0, Math.trunc(cursor.number(79) ?? 0));
    if (angle === undefined || base === undefined || offset === undefined) return null;
    const dashLengths: number[] = [];
    for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
      const dash = cursor.number(49);
      if (dash === undefined) return null;
      dashLengths.push(dash);
    }
    patternLines.push({ angle, base, offset, dashLengths });
  }
  if (patternLines.length === 0) return null;

  const hatch: ParametricHatch = {
    version: 1,
    style: hatchStyle(integerValue(remaining, 75, 0)),
    elevation: numberValue(header.slice(0, boundaryCountIndex), 30, 0),
    extrusion: [
      numberValue(header.slice(0, boundaryCountIndex), 210, 0),
      numberValue(header.slice(0, boundaryCountIndex), 220, 0),
      numberValue(header.slice(0, boundaryCountIndex), 230, 1),
    ],
    boundaryPaths,
    patternLines,
    patternAngle,
    patternScale,
    double: integerValue(remaining, 77, 0) !== 0,
  };
  const representative = transformPatternLine(patternLines[0]!, patternAngle, patternScale);
  const radians = representative.angle * Math.PI / 180;
  const spacing = Math.abs(dot(representative.offset, [-Math.sin(radians), Math.cos(radians)]));
  if (!(spacing > EPSILON)) return null;
  return { pattern, angle: clean(normalizeDegrees(representative.angle)), spacing: clean(spacing), hatch };
}

function parsePolylineBoundary(cursor: PairCursor): ParsedBoundaryPath | null {
  const hasBulge = Math.trunc(cursor.number(72) ?? 0) !== 0;
  const closed = Math.trunc(cursor.number(73) ?? 0) !== 0;
  const vertexCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const vertices: Array<{ point: Vec2; bulge: number }> = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const point = cursor.point(10, 20);
    const bulge = hasBulge && cursor.peekCode() === 42 ? cursor.number(42) ?? 0 : 0;
    if (point === undefined) return null;
    vertices.push({ point, bulge });
  }
  if (vertices.length < (closed ? 3 : 2)) return null;
  const edges: ParsedBoundaryEdge[] = [];
  const edgeCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < edgeCount; index += 1) {
    const current = vertices[index]!;
    const next = vertices[(index + 1) % vertices.length]!;
    edges.push(Math.abs(current.bulge) <= EPSILON
      ? { kind: 'line', start: current.point, end: next.point }
      : bulgeArc(current.point, next.point, current.bulge));
  }
  return { edges, closed };
}

function parseEdgeBoundary(cursor: PairCursor): ParsedBoundaryPath | null {
  const edgeCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const edges: ParsedBoundaryEdge[] = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const type = Math.trunc(cursor.number(72) ?? 0);
    if (type === 1) {
      const start = cursor.point(10, 20);
      const end = cursor.point(11, 21);
      if (start === undefined || end === undefined) return null;
      edges.push({ kind: 'line', start, end });
    } else if (type === 2) {
      const center = cursor.point(10, 20);
      const radius = cursor.number(40);
      const startAngle = cursor.number(50);
      const endAngle = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (center === undefined || !(radius && radius > 0) || startAngle === undefined || endAngle === undefined) return null;
      edges.push({ kind: 'arc', center, radius, startAngle, endAngle, counterClockwise });
    } else if (type === 3) {
      const center = cursor.point(10, 20);
      const majorAxis = cursor.point(11, 21);
      const ratio = cursor.number(40);
      const startParam = cursor.number(50);
      const endParam = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (center === undefined || majorAxis === undefined || !(ratio && ratio > 0)
        || startParam === undefined || endParam === undefined) return null;
      edges.push({ kind: 'ellipse', center, majorAxis, ratio, startParam, endParam, counterClockwise });
    } else if (type === 4) {
      const spline = parseSplineEdge(cursor);
      if (spline === null) return null;
      edges.push(spline);
    } else return null;
  }
  return edges.length === 0 ? null : { edges, closed: true };
}

function parseSplineEdge(cursor: PairCursor): Extract<ParsedBoundaryEdge, { kind: 'spline' }> | null {
  const degree = Math.max(1, Math.trunc(cursor.number(94) ?? 0));
  const rational = Math.trunc(cursor.number(73) ?? 0) !== 0;
  const periodic = Math.trunc(cursor.number(74) ?? 0) !== 0;
  const knotCount = Math.max(0, Math.trunc(cursor.number(95) ?? 0));
  const controlCount = Math.max(0, Math.trunc(cursor.number(96) ?? 0));
  const knots: number[] = [];
  for (let index = 0; index < knotCount; index += 1) {
    const knot = cursor.number(40);
    if (knot === undefined) return null;
    knots.push(knot);
  }
  const controlPoints: Vec2[] = [];
  const weights: number[] = [];
  for (let index = 0; index < controlCount; index += 1) {
    const point = cursor.point(10, 20);
    if (point === undefined) return null;
    controlPoints.push(point);
    if (rational) {
      const weight = cursor.number(42);
      if (!(weight && weight > 0)) return null;
      weights.push(weight);
    } else if (cursor.peekCode() === 42) cursor.number(42);
  }
  const fitPoints: Vec2[] = [];
  if (cursor.peekCode() === 97) {
    const count = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
    for (let index = 0; index < count; index += 1) {
      const point = cursor.point(11, 21);
      if (point === undefined) return null;
      fitPoints.push(point);
    }
  }
  if (controlPoints.length <= degree || knots.length !== controlPoints.length + degree + 1) return null;
  return {
    kind: 'spline', degree, rational, periodic, controlPoints, knots,
    ...(weights.length === controlPoints.length ? { weights } : {}),
    ...(fitPoints.length > 0 ? { fitPoints } : {}),
  };
}

function toHatchBoundaryEdge(edge: ParsedBoundaryEdge): HatchBoundaryEdge {
  if (edge.kind === 'line') return { type: 'line', start: edge.start, end: edge.end };
  if (edge.kind === 'arc') return { type: 'arc', center: edge.center, radius: edge.radius, startAngle: edge.startAngle, endAngle: edge.endAngle, counterClockwise: edge.counterClockwise };
  if (edge.kind === 'ellipse') return { type: 'ellipse', center: edge.center, majorAxis: edge.majorAxis, axisRatio: edge.ratio, startParameter: edge.startParam, endParameter: edge.endParam, counterClockwise: edge.counterClockwise };
  return {
    type: 'spline', degree: edge.degree, rational: edge.rational, periodic: edge.periodic,
    knots: edge.knots, controlPoints: edge.controlPoints,
    ...(edge.weights === undefined ? {} : { weights: edge.weights }),
    ...(edge.fitPoints === undefined ? {} : { fitPoints: edge.fitPoints }),
  };
}

function skipBoundaryReferences(cursor: PairCursor): boolean {
  if (cursor.peekCode() !== 97) return true;
  const count = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
  for (let index = 0; index < count; index += 1) if (cursor.number(330) === undefined) return false;
  return true;
}

function transformPatternLine(line: HatchPatternLine, angle: number, scale: number): HatchPatternLine {
  const radians = angle * Math.PI / 180;
  const rotateScale = ([x, y]: Vec2): Vec2 => [
    scale * (x * Math.cos(radians) - y * Math.sin(radians)),
    scale * (x * Math.sin(radians) + y * Math.cos(radians)),
  ];
  return {
    angle: line.angle + angle, base: rotateScale(line.base), offset: rotateScale(line.offset),
    dashLengths: line.dashLengths.map((value) => value * scale),
  };
}

function bulgeArc(start: Vec2, end: Vec2, bulge: number): Extract<ParsedBoundaryEdge, { kind: 'arc' }> {
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const sweep = 4 * Math.atan(bulge);
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)));
  const midpoint: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const chordAngle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const offset = chord / (2 * Math.tan(sweep / 2));
  const center: Vec2 = [midpoint[0] - Math.sin(chordAngle) * offset, midpoint[1] + Math.cos(chordAngle) * offset];
  return {
    kind: 'arc', center, radius,
    startAngle: Math.atan2(start[1] - center[1], start[0] - center[0]) * 180 / Math.PI,
    endAngle: Math.atan2(end[1] - center[1], end[0] - center[0]) * 180 / Math.PI,
    counterClockwise: bulge > 0,
  };
}

class PairCursor {
  constructor(readonly pairs: DxfPair[], public index: number) {}
  peekCode(): number | undefined { return this.pairs[this.index]?.code; }
  number(code: number): number | undefined {
    const pair = this.pairs[this.index];
    if (pair?.code !== code) return undefined;
    this.index += 1;
    const parsed = Number.parseFloat(pair.value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  point(xCode: number, yCode: number, consumeZ = true): Vec2 | undefined {
    const x = this.number(xCode);
    const y = this.number(yCode);
    if (x === undefined || y === undefined) return undefined;
    if (consumeZ && this.peekCode() === xCode + 20) this.number(xCode + 20);
    return [x, y];
  }
}

function hatchStyle(value: number): ParametricHatch['style'] { return value === 1 ? 'outer' : value === 2 ? 'ignore' : 'normal'; }
function value(pairs: DxfPair[], code: number): string | undefined { return pairs.find((pair) => pair.code === code)?.value; }
function numberValue(pairs: DxfPair[], code: number, fallback: number): number {
  const parsed = Number.parseFloat(value(pairs, code)?.trim() ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}
function integerValue(pairs: DxfPair[], code: number, fallback: number): number { return Math.trunc(numberValue(pairs, code, fallback)); }
function integer(input: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(input?.trim() ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function dot(first: Vec2, second: Vec2): number { return first[0] * second[0] + first[1] * second[1]; }
function clean(input: number): number {
  const rounded = Math.round(input * 1_000_000_000) / 1_000_000_000;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
function normalizeDegrees(input: number): number { return ((input % 360) + 360) % 360; }

export function projectHatch(record: DxfEntityRecord, context: DxfEntityContext): SectionHatchAnnotation | undefined {
  const projected = projectHatchPattern(record.pairs);
  if (projected === null) {
    context.diagnostics.push({
      severity: 'warning', code: 'DXF_HATCH_UNSUPPORTED', message: 'HATCH semantics could not be parsed safely',
      ...(record.pairs[0] === undefined ? {} : { line: record.pairs[0].line }),
    });
    return undefined;
  }
  const validation = normalizeHatchRegion(projected.hatch, hatchTolerance(projected.hatch));
  if (validation.status !== 'ok') {
    context.diagnostics.push({
      severity: 'warning',
      code: validation.code === 'HATCH_BOUNDARY_OPEN' ? 'DXF_HATCH_BOUNDARY_OPEN' : `DXF_${validation.code}`,
      message: `HATCH semantics retained but its boundary cannot be rendered: ${validation.code}`,
      ...(record.pairs[0] === undefined ? {} : { line: record.pairs[0].line }),
    });
  }
  return {
    id: context.nodeId(record, 'annotation') as AnnotationId,
    type: 'section-hatch', visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
    sourceRef: sourceRef(record, context.sourceId),
    pattern: projected.pattern, angle: projected.angle, spacing: projected.spacing, hatch: projected.hatch,
  };
}

function hatchTolerance(hatch: ParametricHatch): number {
  const coordinates = hatch.boundaryPaths.flatMap(({ edges }) => edges.flatMap((edge) => {
    if (edge.type === 'line') return [...edge.start, ...edge.end];
    if (edge.type === 'arc') return [...edge.center, edge.radius];
    if (edge.type === 'ellipse') return [...edge.center, ...edge.majorAxis];
    return edge.controlPoints.flat();
  }));
  const extent = Math.max(...coordinates.map(Math.abs), 1);
  return Math.min(0.05, Math.max(1e-6, extent * 1e-6));
}
