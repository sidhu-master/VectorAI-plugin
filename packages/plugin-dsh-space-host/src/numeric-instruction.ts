// SPDX-License-Identifier: Apache-2.0

import type { ExplicitNumericConstraint } from '@vectorai/drawing-edit-protocol';

type DrawingLengthUnit = 'mm' | 'cm' | 'm' | 'in';

const NUMBER_SOURCE = String.raw`[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?`;
const UNIT_SOURCE = [
  'millimeters?', 'centimeters?', 'millimetres?', 'centimetres?',
  '毫米', '厘米', '英寸', '弧度', 'degrees?', 'radians?',
  'deg', 'rad', 'mm', 'cm', 'inch(?:es)?', 'in', '°', '米', 'm',
].join('|');

const DISTANCE_CONTEXT = /(?:移动|平移|抬高|降低|升高|向上|向下|向左|向右|move|translate|raise|lower|shift)\s*$/iu;
const ANGLE_CONTEXT = /(?:旋转|转动|rotate|turn)\s*$/iu;

interface LocatedConstraint {
  start: number;
  end: number;
  constraint: Omit<ExplicitNumericConstraint, 'numericKey'>;
}

function normalizeUnit(unit: string | undefined, fallback: DrawingLengthUnit): {
  kind: 'distance' | 'angle';
  unit: string;
} | null {
  if (!unit) return null;
  const normalized = unit.trim().toLowerCase();
  if (['毫米', 'mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'].includes(normalized)) {
    return { kind: 'distance', unit: 'mm' };
  }
  if (['厘米', 'cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'].includes(normalized)) {
    return { kind: 'distance', unit: 'cm' };
  }
  if (['米', 'm'].includes(normalized)) return { kind: 'distance', unit: 'm' };
  if (['英寸', 'in', 'inch', 'inches'].includes(normalized)) return { kind: 'distance', unit: 'in' };
  if (['度', '°', 'deg', 'degree', 'degrees'].includes(normalized)) return { kind: 'angle', unit: 'deg' };
  if (['弧度', 'rad', 'radian', 'radians'].includes(normalized)) return { kind: 'angle', unit: 'rad' };
  return { kind: 'distance', unit: fallback };
}

function parseFinite(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('EDIT_NUMERIC_VALUE_INVALID');
  return parsed;
}

function overlaps(start: number, end: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}

export function extractNumericConstraints(
  instruction: string,
  drawingUnit: DrawingLengthUnit,
): ExplicitNumericConstraint[] {
  const located: LocatedConstraint[] = [];
  const coordinateRanges: Array<readonly [number, number]> = [];
  const coordinatePattern = new RegExp(
    String.raw`(?:坐标|coordinate)\s*(\(\s*(${NUMBER_SOURCE})\s*[,，]\s*(${NUMBER_SOURCE})\s*\))\s*(${UNIT_SOURCE})?`,
    'giu',
  );

  for (const match of instruction.matchAll(coordinatePattern)) {
    const whole = match[0];
    const pair = match[1];
    const unitText = match[4];
    if (match.index === undefined || !pair) continue;
    const pairOffset = whole.indexOf(pair);
    const start = match.index + pairOffset;
    const end = match.index + whole.length;
    const unit = normalizeUnit(unitText, drawingUnit);
    if (unit?.kind === 'angle') continue;
    const value: [number, number] = [parseFinite(match[2] ?? ''), parseFinite(match[3] ?? '')];
    coordinateRanges.push([match.index, end]);
    located.push({
      start,
      end,
      constraint: {
        kind: 'coordinate',
        value,
        unit: unit?.unit ?? drawingUnit,
        userEvidenceSpan: { start, end, text: instruction.slice(start, end) },
      },
    });
  }

  const scalarPattern = new RegExp(String.raw`(${NUMBER_SOURCE})(?:\s*(${UNIT_SOURCE}))?`, 'giu');
  for (const match of instruction.matchAll(scalarPattern)) {
    if (match.index === undefined) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end, coordinateRanges)) continue;

    const explicitUnit = normalizeUnit(match[2], drawingUnit);
    const context = instruction.slice(Math.max(0, start - 24), start);
    const inferred = explicitUnit
      ?? (ANGLE_CONTEXT.test(context)
        ? { kind: 'angle' as const, unit: 'deg' }
        : DISTANCE_CONTEXT.test(context)
          ? { kind: 'distance' as const, unit: drawingUnit }
          : null);
    if (!inferred) continue;

    located.push({
      start,
      end,
      constraint: {
        kind: inferred.kind,
        value: parseFinite(match[1] ?? ''),
        unit: inferred.unit,
        userEvidenceSpan: { start, end, text: instruction.slice(start, end) },
      },
    });
  }

  return located
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .slice(0, 16)
    .map(({ constraint }, index) => ({ ...constraint, numericKey: `n${index + 1}` } as ExplicitNumericConstraint));
}
