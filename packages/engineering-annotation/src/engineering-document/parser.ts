// SPDX-License-Identifier: Apache-2.0

import type { PartitionDiagnostic } from '../partition/types';

export interface EngineeringRegionEvidence {
  id: string;
  type: string;
  name?: string;
  interval?: { start: number; end: number };
  outerDiameter?: number;
  sourceLines: number[];
}

export interface ParsedEngineeringDocument {
  drawing: {
    drawingName?: string;
    unit?: 'mm' | 'cm' | 'm' | 'in';
    axisOrigin?: 'left_end' | 'right_end';
    orientation?: 'auto' | 'forward' | 'reversed';
  };
  regions: EngineeringRegionEvidence[];
  unknown: Array<{ section: string; key: string; value: string; line: number }>;
  diagnostics: PartitionDiagnostic[];
}

interface MutableRegion extends EngineeringRegionEvidence { center?: number; width?: number }

export function parseEngineeringDocument(text: string): ParsedEngineeringDocument {
  const result: ParsedEngineeringDocument = { drawing: {}, regions: [], unknown: [], diagnostics: [] };
  const ids = new Set<string>();
  let section = '';
  let region: MutableRegion | undefined;
  for (const [offset, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = offset + 1;
    const value = raw.trim();
    if (!value || value.startsWith('#') || value.startsWith(';')) continue;
    const heading = /^\[([^\]]+)]$/.exec(value);
    if (heading) {
      section = heading[1]!.trim();
      const match = /^region:([^:]+):([^:]+)$/.exec(section);
      region = undefined;
      if (match) {
        const id = match[2]!.trim();
        region = { id, type: match[1]!.trim(), sourceLines: [line] };
        if (ids.has(id)) diagnostic(result, 'DOCUMENT_REGION_DUPLICATE', `Duplicate region ${id}`, line);
        ids.add(id);
        result.regions.push(region);
      }
      continue;
    }
    const separator = value.indexOf('=');
    if (separator < 0) {
      diagnostic(result, 'DOCUMENT_LINE_INVALID', 'Expected key=value', line);
      continue;
    }
    const key = value.slice(0, separator).trim();
    const field = value.slice(separator + 1).trim();
    if (section === 'drawing') parseDrawing(result, key, field, line);
    else if (region) parseRegion(result, region, key, field, line);
    else result.unknown.push({ section, key, value: field, line });
  }
  for (const item of result.regions as MutableRegion[]) {
    if (item.center !== undefined && item.width !== undefined && item.width > 0) {
      item.interval = { start: item.center - item.width / 2, end: item.center + item.width / 2 };
    }
    delete item.center;
    delete item.width;
  }
  return result;
}

function parseDrawing(result: ParsedEngineeringDocument, key: string, value: string, line: number): void {
  if (key === 'drawing_name') { if (value) result.drawing.drawingName = value; return; }
  if (key === 'drawing_id') { if (value) result.unknown.push({ section: 'drawing', key, value, line }); return; }
  if (key === 'unit') {
    if (!value) return;
    if (value === 'mm' || value === 'cm' || value === 'm' || value === 'in') result.drawing.unit = value;
    else diagnostic(result, 'DOCUMENT_UNIT_UNSUPPORTED', `Unsupported unit ${value}`, line);
    return;
  }
  if (key === 'axis_origin') {
    if (!value) return;
    if (value === 'left_end' || value === 'right_end') result.drawing.axisOrigin = value;
    else diagnostic(result, 'DOCUMENT_AXIS_ORIGIN_INVALID', `Invalid axis origin ${value}`, line);
    return;
  }
  if (key === 'orientation') {
    if (!value) return;
    if (value === 'auto' || value === 'forward' || value === 'reversed') result.drawing.orientation = value;
    else diagnostic(result, 'DOCUMENT_ORIENTATION_INVALID', `Invalid orientation ${value}`, line);
    return;
  }
  result.unknown.push({ section: 'drawing', key, value, line });
}

function parseRegion(result: ParsedEngineeringDocument, region: MutableRegion, key: string, value: string, line: number): void {
  region.sourceLines.push(line);
  if (key === 'name') { if (value) region.name = value; return; }
  if (key === 'center_z') { region.center = numeric(result, key, value, line); return; }
  if (key === 'width') {
    region.width = numeric(result, key, value, line);
    if (region.width !== undefined && region.width <= 0) diagnostic(result, 'DOCUMENT_WIDTH_INVALID', 'Region width must be positive', line);
    return;
  }
  if (key === 'outer_diameter') {
    region.outerDiameter = numeric(result, key, value, line);
    if (region.outerDiameter !== undefined && region.outerDiameter <= 0) diagnostic(result, 'DOCUMENT_DIAMETER_INVALID', 'Outer diameter must be positive', line);
    return;
  }
  result.unknown.push({ section: `region:${region.type}:${region.id}`, key, value, line });
}

function numeric(result: ParsedEngineeringDocument, key: string, value: string, line: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    diagnostic(result, 'DOCUMENT_NUMBER_INVALID', `Invalid number for ${key}`, line);
    return undefined;
  }
  return parsed;
}

function diagnostic(result: ParsedEngineeringDocument, code: string, message: string, line: number): void {
  result.diagnostics.push({ id: `document:${line}:${code}`, severity: 'warning', code, message });
}
