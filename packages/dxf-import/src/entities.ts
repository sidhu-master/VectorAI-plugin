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
  ToleranceProjection,
} from '@vectorai/drawing-core';
import { validateToleranceProjection } from '@vectorai/drawing-core';

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
    : dimensionKind === 'diameter'
      ? [definitionPoint, [number(record, 15, definitionPoint[0]), number(record, 25, definitionPoint[1])]]
    : [first, second, definitionPoint];
  const toleranceProjection = readToleranceProjection(record, context, rawText);

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
    ...(toleranceProjection === undefined ? {} : { toleranceProjection }),
  };
}

const VECTORAI_XDATA_MAX_BYTES = 16_383;
const VECTORAI_XDATA_MAX_STRING_BYTES = 254;
const VECTORAI_XDATA_MAX_CHUNKS = 64;

function readToleranceProjection(
  record: DxfEntityRecord,
  context: DxfEntityContext,
  rawText: string,
): ToleranceProjection | undefined {
  const vectorAi = applicationSegments(record, 'VECTORAI');
  const acad = applicationSegments(record, 'ACAD');
  let native: { upperDeviation: number; lowerDeviation: number } | undefined;
  let portable: ToleranceProjection | undefined;

  try {
    assertToleranceXdataAggregateLimit(acad, vectorAi);
  } catch (error) {
    context.diagnostics.push(diagnostic(
      record,
      'warning',
      'DXF_TOLERANCE_XDATA_INVALID',
      error instanceof Error ? error.message : String(error),
    ));
    return undefined;
  }

  if (acad.length > 0) {
    try {
      native = readAcadDstyle(acad);
    } catch (error) {
      context.diagnostics.push(diagnostic(
        record,
        'warning',
        'DXF_TOLERANCE_DSTYLE_INVALID',
        error instanceof Error ? error.message : String(error),
      ));
    }
  }
  if (vectorAi.length > 0) {
    try {
      portable = readVectorAiTolerance(vectorAi, rawText, native !== undefined);
    } catch (error) {
      context.diagnostics.push(diagnostic(
        record,
        'warning',
        'DXF_TOLERANCE_XDATA_INVALID',
        error instanceof Error ? error.message : String(error),
      ));
    }
  }
  if (portable !== undefined) return portable;
  if (native === undefined) return undefined;
  const projection: ToleranceProjection = {
    mode: 'bilateral',
    ...native,
    unit: context.lengthUnit,
    source: 'document',
    status: 'confirmed',
    displayPreference: 'deviations',
    evidenceRefs: ['dxf:acad-dstyle'],
  };
  validateToleranceProjection(projection);
  return projection;
}

function assertToleranceXdataAggregateLimit(
  acad: readonly (readonly DxfPair[])[],
  vectorAi: readonly (readonly DxfPair[])[],
): void {
  const aggregateBytes = applicationAggregateBytes('ACAD', acad)
    + applicationAggregateBytes('VECTORAI', vectorAi);
  if (aggregateBytes > VECTORAI_XDATA_MAX_BYTES) {
    throw new RangeError('DXF_TOLERANCE_XDATA_AGGREGATE_TOO_LONG');
  }
}

function applicationAggregateBytes(
  application: string,
  segments: readonly (readonly DxfPair[])[],
): number {
  const encoder = new TextEncoder();
  return segments.reduce((total, pairs) => total
    + 40
    + encoder.encode(application).byteLength + 1
    + pairs.reduce((pairTotal, pair) => pairTotal + xdataPairBytes(pair, encoder), 0), 0);
}

function xdataPairBytes(pair: DxfPair, encoder: TextEncoder): number {
  if ([1000, 1002, 1003, 1005].includes(pair.code)) return encoder.encode(pair.value).byteLength + 1;
  if (pair.code === 1004) return Math.ceil(pair.value.length / 2);
  if (pair.code >= 1010 && pair.code <= 1059) return 8;
  if (pair.code === 1070) return 2;
  if (pair.code === 1071) return 4;
  return encoder.encode(pair.value).byteLength + 1;
}

function applicationSegments(record: DxfEntityRecord, application: string): readonly (readonly DxfPair[])[] {
  const segments: DxfPair[][] = [];
  let current: DxfPair[] | undefined;
  for (const pair of record.pairs) {
    if (pair.code === 1001) {
      current = pair.value === application ? [] : undefined;
      if (current !== undefined) segments.push(current);
    } else if (current !== undefined) {
      current.push(pair);
    }
  }
  return segments;
}

function readAcadDstyle(segments: readonly (readonly DxfPair[])[]): {
  upperDeviation: number;
  lowerDeviation: number;
} | undefined {
  if (segments.length !== 1) throw new TypeError('DXF_TOLERANCE_DSTYLE_REGAPP_DUPLICATE');
  const pairs = segments[0]!;
  const marker = pairs.findIndex((pair) => pair.code === 1000 && pair.value === 'DSTYLE');
  if (marker < 0) return undefined;
  if (pairs[marker + 1]?.code !== 1002 || pairs[marker + 1]?.value !== '{') {
    throw new TypeError('DXF_TOLERANCE_DSTYLE_OPEN_REQUIRED');
  }
  const variables = new Map<number, DxfPair>();
  let closed = false;
  for (let index = marker + 2; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    if (pair.code === 1002 && pair.value === '}') {
      closed = true;
      break;
    }
    if (pair.code !== 1070) throw new TypeError('DXF_TOLERANCE_DSTYLE_VARIABLE_INVALID');
    const variable = strictInteger(pair.value, 'DXF_TOLERANCE_DSTYLE_VARIABLE_INVALID');
    const variableValue = pairs[index + 1];
    if (variableValue === undefined || ![1040, 1070].includes(variableValue.code)) {
      throw new TypeError('DXF_TOLERANCE_DSTYLE_VALUE_REQUIRED');
    }
    if (variables.has(variable)) throw new TypeError('DXF_TOLERANCE_DSTYLE_VARIABLE_DUPLICATE');
    variables.set(variable, variableValue);
    index += 1;
  }
  if (!closed) throw new TypeError('DXF_TOLERANCE_DSTYLE_CLOSE_REQUIRED');
  if (variables.get(71)?.code !== 1070 || strictNumber(variables.get(71)!.value) !== 1) return undefined;
  const upperPair = variables.get(47);
  const lowerPair = variables.get(48);
  if (upperPair?.code !== 1040 || lowerPair?.code !== 1040) {
    throw new TypeError('DXF_TOLERANCE_DSTYLE_DEVIATIONS_REQUIRED');
  }
  const upperDeviation = strictNumber(upperPair.value);
  const lowerMagnitude = strictNumber(lowerPair.value);
  if (upperDeviation < 0 || lowerMagnitude < 0) {
    throw new TypeError('DXF_TOLERANCE_DSTYLE_DEVIATION_INVALID');
  }
  return { upperDeviation, lowerDeviation: -lowerMagnitude };
}

function readVectorAiTolerance(
  segments: readonly (readonly DxfPair[])[],
  rawText: string,
  hasNativeDeviations: boolean,
): ToleranceProjection {
  if (segments.length !== 1) throw new TypeError('DXF_TOLERANCE_XDATA_REGAPP_DUPLICATE');
  const pairs = segments[0]!;
  if (pairs.length === 0 || pairs.some((pair) => pair.code !== 1000)) {
    throw new TypeError('DXF_TOLERANCE_XDATA_STRING_REQUIRED');
  }
  const strings = pairs.map((pair) => pair.value);
  const encoder = new TextEncoder();
  if (strings.some((entry) => encoder.encode(entry).byteLength > VECTORAI_XDATA_MAX_STRING_BYTES)) {
    throw new RangeError('DXF_TOLERANCE_XDATA_STRING_TOO_LONG');
  }
  const aggregateBytes = encoder.encode('VECTORAI').byteLength + 1
    + strings.reduce((total, entry) => total + encoder.encode(entry).byteLength + 1, 40);
  if (aggregateBytes > VECTORAI_XDATA_MAX_BYTES) {
    throw new RangeError('DXF_TOLERANCE_XDATA_AGGREGATE_TOO_LONG');
  }

  let payloadText: string;
  if (strings.length === 1) {
    payloadText = strings[0]!;
  } else {
    const metadata = parseJsonObject(strings[0]!, 'DXF_TOLERANCE_XDATA_METADATA_INVALID');
    requireExactKeys(
      metadata,
      ['version', 'format', 'encoding', 'chunkCount', 'byteLength'],
      'DXF_TOLERANCE_XDATA_METADATA_INVALID',
    );
    if (metadata.version !== 1
      || metadata.format !== 'vectorai-tolerance-json'
      || metadata.encoding !== 'utf-8') {
      throw new TypeError('DXF_TOLERANCE_XDATA_METADATA_INVALID');
    }
    const chunkCount = safePositiveInteger(metadata.chunkCount, 'DXF_TOLERANCE_XDATA_CHUNK_COUNT_INVALID');
    const byteLength = safePositiveInteger(metadata.byteLength, 'DXF_TOLERANCE_XDATA_BYTE_LENGTH_INVALID');
    const chunks = strings.slice(1);
    if (chunkCount > VECTORAI_XDATA_MAX_CHUNKS || chunkCount !== chunks.length || chunks.some((chunk) => chunk.length === 0)) {
      throw new RangeError('DXF_TOLERANCE_XDATA_CHUNK_COUNT_INVALID');
    }
    payloadText = chunks.join('');
    if (encoder.encode(payloadText).byteLength !== byteLength) {
      throw new RangeError('DXF_TOLERANCE_XDATA_BYTE_LENGTH_MISMATCH');
    }
  }

  const payload = parseJsonObject(payloadText, 'DXF_TOLERANCE_XDATA_PAYLOAD_INVALID');
  requireExactKeys(
    payload,
    ['version', 'designation', 'upperDeviation', 'lowerDeviation', 'unit', 'featureClass', 'standardRef'],
    'DXF_TOLERANCE_XDATA_PAYLOAD_INVALID',
  );
  if (payload.version !== 1
    || typeof payload.designation !== 'string'
    || payload.designation !== payload.designation.trim()
    || typeof payload.upperDeviation !== 'number'
    || typeof payload.lowerDeviation !== 'number'
    || typeof payload.unit !== 'string'
    || !['mm', 'cm', 'm', 'in', 'deg'].includes(payload.unit)
    || typeof payload.featureClass !== 'string'
    || !['internal', 'external'].includes(payload.featureClass)) {
    throw new TypeError('DXF_TOLERANCE_XDATA_PAYLOAD_INVALID');
  }
  const upperDeviation = strictNumber(payload.upperDeviation);
  const lowerDeviation = strictNumber(payload.lowerDeviation);
  if (lowerDeviation > upperDeviation) throw new TypeError('DXF_TOLERANCE_XDATA_DEVIATION_ORDER_INVALID');
  const standardRef = objectValue(payload.standardRef, 'DXF_TOLERANCE_XDATA_STANDARD_REF_INVALID');
  requireExactKeys(standardRef, ['id', 'edition'], 'DXF_TOLERANCE_XDATA_STANDARD_REF_INVALID');
  if (typeof standardRef.id !== 'string' || typeof standardRef.edition !== 'string') {
    throw new TypeError('DXF_TOLERANCE_XDATA_STANDARD_REF_INVALID');
  }
  const designation = payload.designation.trim();
  const showDesignation = designation.length > 0 && rawText.includes(designation);
  const showDeviations = hasNativeDeviations || rawText.includes('\\S');
  const displayPreference = showDesignation && showDeviations
    ? 'both'
    : showDesignation
      ? 'designation'
      : 'deviations';
  const projection: ToleranceProjection = {
    mode: designation.includes('/') ? 'fit' : 'bilateral',
    fitDesignation: designation,
    upperDeviation,
    lowerDeviation,
    unit: payload.unit as ToleranceProjection['unit'],
    source: 'standard',
    status: 'confirmed',
    featureClass: payload.featureClass as NonNullable<ToleranceProjection['featureClass']>,
    standardRef: { id: standardRef.id, edition: standardRef.edition },
    displayPreference,
    evidenceRefs: ['dxf:vectorai-tolerance'],
  };
  validateToleranceProjection(projection);
  return projection;
}

function parseJsonObject(value: string, code: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError(code);
  }
  return objectValue(parsed, code);
}

function objectValue(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(code);
  return value as Record<string, unknown>;
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], code: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(code);
  }
}

function strictNumber(value: unknown): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || value.trim().length === 0)) {
    throw new TypeError('DXF_TOLERANCE_NUMBER_INVALID');
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError('DXF_TOLERANCE_NUMBER_INVALID');
  return parsed;
}

function strictInteger(value: unknown, code: string): number {
  const parsed = strictNumber(value);
  if (!Number.isSafeInteger(parsed)) throw new TypeError(code);
  return parsed;
}

function safePositiveInteger(value: unknown, code: string): number {
  if (typeof value !== 'number') throw new TypeError(code);
  const parsed = strictInteger(value, code);
  if (parsed <= 0) throw new TypeError(code);
  return parsed;
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
