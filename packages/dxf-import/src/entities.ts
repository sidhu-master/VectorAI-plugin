// SPDX-License-Identifier: Apache-2.0

import type {
  AnnotationNode,
  AnnotationId,
  ArcGeometry,
  DimensionAnnotation,
  GeometryId,
  GeometryNode,
  LineGeometry,
  SplineGeometry,
} from '@vectorai/drawing-core';

import { projectHatch } from './hatch';
import type { DxfImportDiagnostic, DxfPair } from './types';

export interface DxfEntityRecord {
  type: string;
  pairs: DxfPair[];
  index: number;
}

export interface DxfEntityContext {
  sourceId: string;
  lengthUnit: 'mm' | 'cm' | 'm' | 'in';
  nodeId(record: DxfEntityRecord, plane: 'geometry' | 'annotation'): string;
  diagnostics: DxfImportDiagnostic[];
}

export interface DxfEntityProjection {
  geometry?: GeometryNode;
  annotation?: AnnotationNode;
}

export function readEntityRecords(pairs: readonly DxfPair[]): DxfEntityRecord[] {
  const records: DxfEntityRecord[] = [];
  let current: DxfEntityRecord | null = null;
  for (const pair of pairs) {
    if (pair.code === 0) {
      if (current !== null) records.push(current);
      current = { type: pair.value.toUpperCase(), pairs: [], index: records.length };
    } else if (current !== null) {
      current.pairs.push(pair);
    }
  }
  if (current !== null) records.push(current);
  return records;
}

export function projectEntity(
  record: DxfEntityRecord,
  context: DxfEntityContext,
): DxfEntityProjection | null {
  if (number(record, 67, 0) === 1) {
    context.diagnostics.push(diagnostic(record, 'info', 'DXF_PAPER_SPACE_ENTITY_IGNORED', 'Paper-space entity ignored'));
    return null;
  }
  try {
    if (record.type === 'LINE') return { geometry: line(record, context) };
    if (record.type === 'ARC') return { geometry: arc(record, context) };
    if (record.type === 'SPLINE') return { geometry: spline(record, context) };
    if (record.type === 'HATCH') return { annotation: projectHatch(record, context) };
    if (record.type === 'DIMENSION') return { annotation: dimension(record, context) };
    if (record.type === 'VIEWPORT') {
      context.diagnostics.push(diagnostic(record, 'info', 'DXF_VIEWPORT_IGNORED', 'DXF VIEWPORT is presentation metadata, not drawing geometry'));
      return null;
    }
    context.diagnostics.push(diagnostic(record, 'warning', 'DXF_ENTITY_UNSUPPORTED', `Unsupported DXF entity ${record.type}`));
    return null;
  } catch (error) {
    context.diagnostics.push(diagnostic(
      record,
      'error',
      'DXF_ENTITY_INVALID',
      error instanceof Error ? error.message : String(error),
    ));
    return null;
  }
}

export function value(record: DxfEntityRecord, code: number): string | undefined {
  return record.pairs.find((pair) => pair.code === code)?.value;
}

export function values(record: DxfEntityRecord, code: number): string[] {
  return record.pairs.filter((pair) => pair.code === code).map((pair) => pair.value);
}

export function number(record: DxfEntityRecord, code: number, fallback?: number): number {
  const raw = value(record, code);
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    throw new TypeError(`DXF_${record.type}_${code}_REQUIRED`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new TypeError(`DXF_${record.type}_${code}_INVALID`);
  return parsed;
}

export function numbers(record: DxfEntityRecord, code: number): number[] {
  return values(record, code).map((raw) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new TypeError(`DXF_${record.type}_${code}_INVALID`);
    return parsed;
  });
}

export function coordinates(record: DxfEntityRecord, xCode = 10, yCode = 20): Array<[number, number]> {
  const output: Array<[number, number]> = [];
  let pendingX: number | undefined;
  for (const pair of record.pairs) {
    if (pair.code === xCode) {
      const x = Number(pair.value);
      if (!Number.isFinite(x)) throw new TypeError(`DXF_${record.type}_${xCode}_INVALID`);
      pendingX = x;
    } else if (pair.code === yCode && pendingX !== undefined) {
      const y = Number(pair.value);
      if (!Number.isFinite(y)) throw new TypeError(`DXF_${record.type}_${yCode}_INVALID`);
      output.push([pendingX, y]);
      pendingX = undefined;
    }
  }
  return output;
}

export function sourceRef(record: DxfEntityRecord, sourceId: string) {
  return {
    sourceId,
    ...(value(record, 5) === undefined ? {} : { objectId: value(record, 5) }),
    objectType: record.type,
    layer: value(record, 8) ?? '0',
  };
}

function line(record: DxfEntityRecord, context: DxfEntityContext): LineGeometry {
  return {
    ...base(record, context, 'geometry'),
    type: 'line',
    start: [number(record, 10), number(record, 20)],
    end: [number(record, 11), number(record, 21)],
  };
}

function arc(record: DxfEntityRecord, context: DxfEntityContext): ArcGeometry {
  const radius = number(record, 40);
  if (!(radius > 0)) throw new TypeError('DXF_ARC_RADIUS_INVALID');
  return {
    ...base(record, context, 'geometry'),
    type: 'arc',
    center: [number(record, 10), number(record, 20)],
    radius,
    startAngle: number(record, 50),
    endAngle: number(record, 51),
    counterClockwise: true,
  };
}

function spline(record: DxfEntityRecord, context: DxfEntityContext): SplineGeometry {
  const flags = number(record, 70, 0);
  const controlPoints = coordinates(record);
  const degree = number(record, 71);
  const declaredControlPoints = number(record, 73, controlPoints.length);
  if (controlPoints.length !== declaredControlPoints) throw new TypeError('DXF_SPLINE_CONTROL_POINT_COUNT_MISMATCH');
  return {
    ...base(record, context, 'geometry'),
    type: 'spline',
    degree,
    controlPoints,
    knots: numbers(record, 40),
    ...(values(record, 41).length === 0 ? {} : { weights: numbers(record, 41) }),
    closed: (flags & 1) !== 0,
    periodic: (flags & 2) !== 0,
  };
}

function dimension(record: DxfEntityRecord, context: DxfEntityContext): DimensionAnnotation {
  const nativeKind = number(record, 70, 0) & 7;
  const rawText = value(record, 1) ?? '<>';
  const displayText = rawText.replace(/%%[cC]/g, 'Ø');
  const measured = number(record, 42, 0);
  const dimensionKind: DimensionAnnotation['dimensionKind'] = nativeKind === 2
    ? 'angular'
    : nativeKind === 3
      ? 'diameter'
      : nativeKind === 4
        ? 'radius'
        : nativeKind === 6
          ? 'ordinate'
          : /^[Ø⌀]/u.test(displayText)
            ? 'diameter'
            : 'linear';
  const definitionPoint: [number, number] = [number(record, 10, 0), number(record, 20, 0)];
  const first: [number, number] = [number(record, 13, definitionPoint[0]), number(record, 23, definitionPoint[1])];
  const second: [number, number] = [number(record, 14, definitionPoint[0]), number(record, 24, definitionPoint[1])];
  const definitionPoints: Array<[number, number]> = dimensionKind === 'angular'
    ? [
      first,
      second,
      [number(record, 15, first[0]), number(record, 25, first[1])],
      [number(record, 16, second[0]), number(record, 26, second[1])],
      definitionPoint,
    ]
    : [first, second, definitionPoint];

  return {
    ...base(record, context, 'annotation'),
    type: 'dimension',
    dimensionKind,
    associationStatus: 'resolved',
    targets: [],
    computedValue: measured,
    ...(rawText === '<>' ? {} : { displayText }),
    unit: dimensionKind === 'angular' ? 'deg' : context.lengthUnit,
    textPosition: [number(record, 11, definitionPoint[0]), number(record, 21, definitionPoint[1])],
    definitionPoints,
  };
}

function base(record: DxfEntityRecord, context: DxfEntityContext, plane: 'geometry'): {
  id: GeometryId; visible: true; quality: { status: 'confirmed'; evidenceRefs: never[] }; sourceRef: ReturnType<typeof sourceRef>;
};
function base(record: DxfEntityRecord, context: DxfEntityContext, plane: 'annotation'): {
  id: AnnotationId; visible: true; quality: { status: 'confirmed'; evidenceRefs: never[] }; sourceRef: ReturnType<typeof sourceRef>;
};
function base(record: DxfEntityRecord, context: DxfEntityContext, plane: 'geometry' | 'annotation') {
  return {
    id: context.nodeId(record, plane) as GeometryId | AnnotationId,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    sourceRef: sourceRef(record, context.sourceId),
  };
}

function diagnostic(
  record: DxfEntityRecord,
  severity: DxfImportDiagnostic['severity'],
  code: string,
  message: string,
): DxfImportDiagnostic {
  return {
    severity,
    code,
    message,
    ...(record.pairs[0] === undefined ? {} : { line: record.pairs[0].line }),
    ...(value(record, 5) === undefined ? {} : { sourceHandle: value(record, 5) }),
  };
}
