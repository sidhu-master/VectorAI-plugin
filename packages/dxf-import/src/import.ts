// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  splineBounds,
  type ArcGeometry,
  type DrawingDocument,
  type DrawingId,
  type GeometryNode,
  type Vec2,
} from '@vectorai/drawing-core';

import { decodeDxfPairs } from './group-pairs';
import { projectEntity, readEntityRecords, type DxfEntityRecord } from './entities';
import { indexDxfSections } from './sections';
import type { Bounds2D, DxfImportDiagnostic, DxfImportRequest, DxfImportResult, DxfPair } from './types';

export function importDxf(request: DxfImportRequest): DxfImportResult {
  const decoded = decodeDxfPairs(request.bytes);
  if (decoded.diagnostics.some(({ severity }) => severity === 'error')) {
    return { status: 'rejected', diagnostics: decoded.diagnostics };
  }
  const diagnostics = [...decoded.diagnostics];
  const structureError = validateSectionStructure(decoded.pairs);
  if (structureError !== null) return rejected(diagnostics, 'DXF_SECTION_STRUCTURE_INVALID', structureError);
  const sections = indexDxfSections(decoded.pairs);
  if (sections.header === undefined || sections.entities === undefined) {
    return rejected(diagnostics, 'DXF_REQUIRED_SECTION_MISSING', 'DXF HEADER and ENTITIES sections are required');
  }
  const unit = readUnit(sections.header.pairs);
  if (unit === null) return rejected(diagnostics, 'DXF_UNITS_REQUIRED', 'DXF $INSUNITS must be in, mm, cm, or m');
  const records = readEntityRecords(sections.entities.pairs);
  const counts: Record<string, number> = {};
  for (const record of records) counts[record.type] = (counts[record.type] ?? 0) + 1;
  const sourceId = `source:${request.source.digest}`;
  const document = createEmptyDrawing({
    unit,
    idFactory: { next: () => request.drawingId },
    now: request.now,
  });
  document.id = request.drawingId as DrawingId;
  document.sources = [{
    id: sourceId,
    kind: 'dxf',
    mediaType: 'application/dxf',
    digest: request.source.digest,
    bytes: request.bytes.byteLength,
    ...(request.source.name === undefined ? {} : { name: request.source.name }),
  }];
  for (const record of records) {
    const projected = projectEntity(record, {
      sourceId,
      diagnostics,
      lengthUnit: unit,
      nodeId: stableNodeId(request.source.digest, record),
    });
    if (projected?.geometry !== undefined) document.geometry.push(projected.geometry);
    if (projected?.annotation !== undefined) document.annotations.push(projected.annotation);
  }
  if (diagnostics.some(({ severity }) => severity === 'error')) return { status: 'rejected', diagnostics };
  const validationError = validateDocument(document);
  if (validationError !== null) return rejected(diagnostics, 'DXF_DOCUMENT_INVALID', validationError);
  const bounds = drawingGeometryBounds(document);
  if (bounds === null) return rejected(diagnostics, 'DXF_DRAWABLE_GEOMETRY_REQUIRED', 'DXF contains no supported drawable geometry');
  return { status: 'imported', document, bounds, diagnostics, counts };
}

function validateSectionStructure(pairs: readonly DxfPair[]): string | null {
  let open = false;
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    if (pair.code === 0 && pair.value === 'SECTION') {
      if (open) return 'Nested DXF SECTION is not allowed';
      if (pairs[index + 1]?.code !== 2) return 'DXF SECTION name is missing';
      open = true;
    } else if (pair.code === 0 && pair.value === 'ENDSEC') {
      if (!open) return 'DXF ENDSEC has no matching SECTION';
      open = false;
    }
  }
  return open ? 'DXF SECTION is missing ENDSEC' : null;
}

function validateDocument(document: DrawingDocument): string | null {
  const ids = [...document.geometry.map(({ id }) => String(id)), ...document.annotations.map(({ id }) => String(id))];
  if (new Set(ids).size !== ids.length) return 'Projected entity IDs are not unique';
  const walk = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(walk);
    if (value !== null && typeof value === 'object') return Object.values(value).every(walk);
    return true;
  };
  return walk(document) ? null : 'Projected document contains non-finite values';
}

function readUnit(pairs: readonly DxfPair[]): DrawingDocument['unitSystem']['length'] | null {
  const variable = pairs.findIndex((pair) => pair.code === 9 && pair.value === '$INSUNITS');
  if (variable < 0) return null;
  const code = pairs.slice(variable + 1).find((pair) => pair.code === 70);
  if (code?.value === '1') return 'in';
  if (code?.value === '4') return 'mm';
  if (code?.value === '5') return 'cm';
  if (code?.value === '6') return 'm';
  return null;
}

function stableNodeId(digest: string, record: DxfEntityRecord) {
  const digestPart = digest.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-24) || 'source';
  const handle = record.pairs.find((pair) => pair.code === 5)?.value
    ?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? String(record.index);
  return (_record: DxfEntityRecord, plane: 'geometry' | 'annotation') => (
    `${plane}:${digestPart}:${handle}:${record.index}`
  );
}

function drawingGeometryBounds(document: DrawingDocument): Bounds2D | null {
  const bounds = document.geometry.map(geometryBounds).filter((item): item is Bounds2D => item !== null);
  if (bounds.length === 0) return null;
  return bounds.reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY),
  }));
}

function geometryBounds(node: GeometryNode): Bounds2D | null {
  if (node.type === 'line') return pointsBounds([node.start, node.end]);
  if (node.type === 'arc') return arcBounds(node);
  if (node.type === 'spline') return splineBounds(node);
  if (node.type === 'point') return pointsBounds([[node.x, node.y]]);
  if (node.type === 'circle') return {
    minX: node.center[0] - node.radius, minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius, maxY: node.center[1] + node.radius,
  };
  if (node.type === 'polyline') return pointsBounds(node.vertices.map(({ point }) => point));
  if (node.type === 'ellipse') {
    const major = Math.hypot(...node.majorAxis);
    return {
      minX: node.center[0] - major, minY: node.center[1] - major,
      maxX: node.center[0] + major, maxY: node.center[1] + major,
    };
  }
  return null;
}

function arcBounds(node: ArcGeometry): Bounds2D {
  const angles = [node.startAngle, node.endAngle, ...[0, 90, 180, 270].filter((angle) => angleOnArc(
    angle, node.startAngle, node.endAngle,
  ))];
  return pointsBounds(angles.map((angle): Vec2 => {
    const radians = angle * Math.PI / 180;
    return [node.center[0] + node.radius * Math.cos(radians), node.center[1] + node.radius * Math.sin(radians)];
  }))!;
}

function angleOnArc(angle: number, start: number, end: number): boolean {
  return modulo(angle - start, 360) <= modulo(end - start, 360);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function pointsBounds(points: readonly Vec2[]): Bounds2D | null {
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function rejected(
  diagnostics: DxfImportDiagnostic[],
  code: string,
  message: string,
): DxfImportResult {
  return { status: 'rejected', diagnostics: [...diagnostics, { severity: 'error', code, message }] };
}
