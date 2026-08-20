import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { EvidenceId, GeometryId, GeometryNode } from '../../../src/drawing/index.js';
import { parseAsciiDxf } from '../drawing-dxf/raw-parser.js';
import { projectDxfToDrawing } from '../drawing-dxf/projector.js';
import { measureDeterministicAnnotations } from './measurement.js';

const confirmed = {
  status: 'confirmed' as const,
  confidence: 1,
  evidenceRefs: ['fixture:shaft' as EvidenceId],
};

describe('measureDeterministicAnnotations', () => {
  it('derives symmetric shaft dimensions, radii, chamfer angles, and centerline facts', () => {
    const result = measureDeterministicAnnotations({ geometry: analyticShaft(), unit: 'mm' });

    expect(result.axis).toMatchObject({ origin: [0, 0], direction: [1, 0], status: 'confirmed' });
    expect(values(result.facts, 'axial-length')).toEqual([20, 30, 50, 100]);
    expect(values(result.facts, 'diameter')).toEqual([16, 20, 30]);
    expect(values(result.facts, 'radius')).toContain(2);
    const openings = result.facts.filter(
      (fact): fact is Extract<(typeof result.facts)[number], { kind: 'angle' }> => fact.kind === 'angle',
    );
    expect(openings).toHaveLength(1);
    expect(openings[0]).toMatchObject({
      value: 120,
      sourceIds: ['chamfer_lower', 'chamfer_upper'],
      method: 'mirrored-line-pair-opening',
    });
    expect(openings[0].vertex[1]).toBeCloseTo(0, 6);
    const geometryById = new Map(analyticShaft().map((node) => [node.id, node]));
    expect(openings[0].rays.every((point, index) => {
      const source = geometryById.get(openings[0].sourceIds[index]);
      return source?.type === 'line'
        && distanceToSegment(point, source.start, source.end) < 1e-6;
    })).toBe(true);
    expect(result.facts.filter((fact) => fact.kind === 'centerline')).toHaveLength(1);
    expect(result.facts.every((fact) => fact.sourceIds.length > 0 && fact.evidenceRefs.length > 0)).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('extracts the hand-checked deterministic subset from the real initial DXF without sample annotations', () => {
    const manifest = parseAsciiDxf(fs.readFileSync('初始图.dxf', 'utf8'));
    const projection = projectDxfToDrawing(manifest, { sourceId: 'initial-fixture' });

    const result = measureDeterministicAnnotations({ geometry: projection.geometry, unit: 'mm' });

    expect(result.axis.status).toBe('confirmed');
    expect(values(result.facts, 'axial-length')).toEqual(expect.arrayContaining([8, 17, 24.5, 55, 173]));
    expect(values(result.facts, 'diameter')).toEqual(expect.arrayContaining([
      20, 35, 38, 40, 42.21, 44.59, 51, 57.03,
    ]));
    expect(values(result.facts, 'diameter')).not.toContain(48);
    expect(values(result.facts, 'radius')).toEqual(expect.arrayContaining([2, 3]));
    const openings = result.facts.filter(
      (fact): fact is Extract<(typeof result.facts)[number], { kind: 'angle' }> => fact.kind === 'angle',
    );
    const targetOpenings = openings.filter((fact) => (
      Math.abs(fact.value - 60) < 0.01 || Math.abs(fact.value - 120) < 0.01
    ));
    expect(targetOpenings.map((fact) => Math.round(fact.value)).sort((left, right) => left - right))
      .toEqual([60, 60, 120, 120]);
    expect(targetOpenings.every((fact) => (
      fact.method === 'mirrored-line-pair-opening'
      && fact.sourceIds.length === 2
      && Math.abs(fact.vertex[1] - result.axis.origin[1]) < 0.01
    ))).toBe(true);
    expect(result.facts.filter((fact) => fact.kind === 'centerline')).toHaveLength(1);
    expect(result.facts.every((fact) => fact.sourceIds.length > 0 && fact.evidenceRefs.length > 0)).toBe(true);
  });

  it('prefers one explicit confirmed construction axis over envelope inference', () => {
    const geometry = analyticShaft();
    geometry.push({
      id: 'explicit_axis' as GeometryId,
      type: 'xline',
      visible: true,
      quality: confirmed,
      origin: [0, 2],
      direction: [1, 0],
    });

    expect(measureDeterministicAnnotations({ geometry, unit: 'mm' }).axis).toMatchObject({
      origin: [0, 2],
      direction: [1, 0],
      status: 'confirmed',
      sourceIds: ['explicit_axis'],
    });
  });
});

function values(
  facts: ReturnType<typeof measureDeterministicAnnotations>['facts'],
  kind: 'axial-length' | 'diameter' | 'radius' | 'angle',
): number[] {
  return [...new Set(facts
    .flatMap((fact) => fact.kind === kind && 'value' in fact
      ? [Math.round(fact.value * 100) / 100]
      : []))]
    .sort((left, right) => left - right);
}

function distanceToSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const denominator = dx * dx + dy * dy;
  const projection = denominator === 0 ? 0 : Math.max(0, Math.min(1, (
    (point[0] - start[0]) * dx + (point[1] - start[1]) * dy
  ) / denominator));
  return Math.hypot(
    point[0] - (start[0] + dx * projection),
    point[1] - (start[1] + dy * projection),
  );
}

function analyticShaft(): GeometryNode[] {
  const nodes: GeometryNode[] = [];
  const addLine = (id: string, start: readonly [number, number], end: readonly [number, number]) => {
    nodes.push({
      id: id as GeometryId,
      type: 'line',
      visible: true,
      quality: confirmed,
      start,
      end,
    });
  };
  const upper: Array<readonly [number, number]> = [[0, 10], [20, 10], [20, 15], [50, 15], [50, 8], [100, 8]];
  const lower = upper.map(([x, y]) => [x, -y] as const).reverse();
  const contour = [...upper, ...lower, upper[0]];
  contour.slice(0, -1).forEach((point, index) => addLine(`profile_${index}`, point, contour[index + 1]));
  addLine('chamfer_upper', [100, 8], [102, 8 + Math.sqrt(3) * 2]);
  addLine('chamfer_lower', [102, -8 - Math.sqrt(3) * 2], [100, -8]);
  nodes.push({
    id: 'fillet_2' as GeometryId,
    type: 'arc',
    visible: true,
    quality: confirmed,
    center: [50, 13],
    radius: 2,
    startAngle: 0,
    endAngle: 90,
    counterClockwise: true,
  });
  return nodes;
}
