// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument } from '@vectorai/drawing-core';
import { decodeDxfPairs, importDxf, indexDxfSections, type DxfPair } from '@vectorai/dxf-import';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FIXTURE_DIRECTORY = resolve(import.meta.dirname, '../../test/fixtures/golden-shaft-001');

export async function loadGoldenDrawing(name: 'initial.dxf' | 'target.dxf'): Promise<DrawingDocument> {
  const bytes = await readFile(resolve(FIXTURE_DIRECTORY, name));
  const result = importDxf({
    bytes,
    source: { digest: `sha256:test-${name}`, name },
    drawingId: `golden-${name}`,
    now: () => 1,
  });
  if (result.status !== 'imported') throw new Error(JSON.stringify(result.diagnostics));
  return result.document;
}

export function coreGeometrySignatures(document: DrawingDocument): string[] {
  return document.geometry.map(({ id: _id, visible: _visible, quality: _quality, sourceRef: _sourceRef, ...geometry }) => (
    JSON.stringify(roundFiniteNumbers(geometry, 1e-6))
  )).sort();
}

export async function readGoldenAxialLinearIntervals(
  name: 'target.dxf',
): Promise<Array<[number, number]>> {
  const bytes = await readFile(resolve(FIXTURE_DIRECTORY, name));
  const decoded = decodeDxfPairs(bytes);
  if (decoded.diagnostics.length > 0) throw new Error(JSON.stringify(decoded.diagnostics));
  const entities = indexDxfSections(decoded.pairs).entities?.pairs ?? [];
  const intervals = splitEntities(entities)
    .filter((entity) => entity[0]?.value === 'DIMENSION')
    .flatMap((entity) => axialInterval(entity));
  const origin = Math.min(...intervals.flat());
  return intervals.map(([start, end]) => [start - origin, end - origin]);
}

export function sortIntervals(intervals: readonly (readonly [number, number])[]): Array<[number, number]> {
  return intervals
    .map(([start, end]) => [round(start), round(end)] as [number, number])
    .sort(([leftStart, leftEnd], [rightStart, rightEnd]) => leftStart - rightStart || leftEnd - rightEnd);
}

function splitEntities(pairs: readonly DxfPair[]): DxfPair[][] {
  const entities: DxfPair[][] = [];
  let current: DxfPair[] = [];
  for (const pair of pairs) {
    if (pair.code === 0) {
      if (current.length > 0) entities.push(current);
      current = [pair];
    } else if (current.length > 0) current.push(pair);
  }
  if (current.length > 0) entities.push(current);
  return entities;
}

function axialInterval(entity: readonly DxfPair[]): Array<[number, number]> {
  const dimensionType = Number(value(entity, 70) ?? 0) & 7;
  if (dimensionType !== 0 && dimensionType !== 1) return [];
  const first = point(entity, 13, 23);
  const second = point(entity, 14, 24);
  const dimensionLineY = Number(value(entity, 20));
  if (!first || !second || !Number.isFinite(dimensionLineY)) return [];
  const dx = Math.abs(second[0] - first[0]);
  const dy = Math.abs(second[1] - first[1]);
  if (dx <= dy || dx <= 1e-6 || dimensionLineY <= Math.max(first[1], second[1])) return [];
  return [[Math.min(first[0], second[0]), Math.max(first[0], second[0])]];
}

function point(entity: readonly DxfPair[], xCode: number, yCode: number): [number, number] | undefined {
  const x = Number(value(entity, xCode));
  const y = Number(value(entity, yCode));
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : undefined;
}

function value(entity: readonly DxfPair[], code: number): string | undefined {
  return entity.find((pair) => pair.code === code)?.value;
}

function roundFiniteNumbers(value: unknown, precision: number): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value / precision) * precision : value;
  if (Array.isArray(value)) return value.map((item) => roundFiniteNumbers(item, precision));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundFiniteNumbers(item, precision)]));
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
