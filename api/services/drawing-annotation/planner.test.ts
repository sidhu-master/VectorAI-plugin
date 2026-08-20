import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { DrawingId, EvidenceId } from '../../../src/drawing/index.js';
import { parseEngineeringDocument } from '../drawing-dxf/engineering-document.js';
import { projectDxfToDrawing } from '../drawing-dxf/projector.js';
import { parseAsciiDxf } from '../drawing-dxf/raw-parser.js';
import { measureDeterministicAnnotations } from './measurement.js';
import { planDeterministicAnnotations } from './planner.js';

describe('planDeterministicAnnotations', () => {
  it('creates only formal, stable annotations from confirmed initial-geometry facts', () => {
    const input = realInput();
    const first = planDeterministicAnnotations(input);
    const second = planDeterministicAnnotations(input);
    const dimensions = first.annotations.filter((node) => node.type === 'dimension');
    const values = dimensions.map((node) => Math.round((node.computedValue ?? 0) * 100) / 100);

    expect(second).toEqual(first);
    expect(first.annotations.some((node) => node.type === 'centerline')).toBe(true);
    expect(values).toEqual(expect.arrayContaining([8, 17, 24.5, 55, 173, 35, 44.59, 57.03, 2, 3, 60, 120]));
    expect(dimensions.every((node) => node.tolerance === undefined)).toBe(true);
    expect(first.annotations.every((node) => node.quality.status === 'confirmed')).toBe(true);
    expect(first.annotations.every((node) => node.type !== 'text' && node.type !== 'leader')).toBe(true);
    expect(first.consumedFactKeys).toHaveLength(first.annotations.length);
    expect(new Set(first.consumedFactKeys).size).toBe(first.consumedFactKeys.length);
    expect(Object.keys(first.factKeysByAnnotationId).sort())
      .toEqual(first.annotations.map((node) => node.id).sort());
    const radiusValues = dimensions
      .filter((node) => node.dimensionKind === 'radius')
      .map((node) => round(node.computedValue));
    const angleValues = dimensions
      .filter((node) => node.dimensionKind === 'angular')
      .map((node) => round(node.computedValue));
    const openingAngles = dimensions.filter((node) => node.dimensionKind === 'angular');
    expect(angleValues.sort((left, right) => left - right)).toEqual([60, 60, 120, 120]);
    expect(openingAngles.every((node) => (
      node.targets.length === 2 && node.definitionPoints.length === 5
    ))).toBe(true);
    for (const suppressed of [0.8, 1]) {
      expect(radiusValues).not.toContain(suppressed);
    }
    for (const suppressed of [5.02, 20, 45, 90, 135, 160]) {
      expect(angleValues).not.toContain(suppressed);
    }
    expect(first.suppressedFactKeys.length).toBeGreaterThan(0);
    expect(Object.keys(first.suppressionReasons).sort()).toEqual([...first.suppressedFactKeys].sort());
  });

  it('corroborates B01 while isolating the S01 document conflict from committed values', () => {
    const plan = planDeterministicAnnotations(realInput());
    const dimensions = plan.annotations.filter((node) => node.type === 'dimension');

    expect(dimensions.some((node) => node.dimensionKind === 'linear' && round(node.computedValue) === 17))
      .toBe(true);
    expect(dimensions.some((node) => node.dimensionKind === 'diameter' && round(node.computedValue) === 35))
      .toBe(true);
    expect(dimensions.some((node) => (
      node.dimensionKind === 'diameter' && round(node.computedValue) === 45
    ))).toBe(false);
    expect(plan.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'region:S01:outer-diameter', category: 'conflict' }),
    ]));
    expect(plan.conflicts.find((item) => item.key === 'region:S01:outer-diameter')?.reason)
      .toMatch(/45.*44\.59|44\.59.*45/);
    expect(plan.pendingAnnotations.map((item) => item.category)).toEqual(expect.arrayContaining([
      'tolerance', 'roughness', 'datum', 'geometric-tolerance', 'section-marker',
    ]));
  });
});

function realInput() {
  const projection = projectDxfToDrawing(
    parseAsciiDxf(fs.readFileSync('初始图.dxf', 'utf8')),
    { sourceId: 'initial-planner-fixture' },
  );
  const engineeringDocument = parseEngineeringDocument(
    fs.readFileSync('样本图001# DXF工程数据文档.txt', 'utf8'),
  );
  return {
    drawingId: 'drawing_annotation_fixture' as DrawingId,
    geometry: projection.geometry,
    measurements: measureDeterministicAnnotations({ geometry: projection.geometry, unit: 'mm' }),
    engineeringDocument,
    engineeringEvidenceRef: 'engineering:fixture' as EvidenceId,
  };
}

function round(value: number | undefined): number {
  return Math.round((value ?? 0) * 100) / 100;
}
