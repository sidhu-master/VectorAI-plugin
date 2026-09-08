// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEmptyDrawing, exportDrawingDxf, type AnnotationId, type DimensionAnnotation, type DrawingDocument, type GeometryId, type Vec2 } from '@vectorai/drawing-core';
import { analyzeShaftPartition, buildAxialTopology, generateAxialDimensionCandidates, inferAxialDimensionScheme, inferRegularShaftRegions, parseEngineeringDocument, planEngineeringAnnotations, SHAFT_HIERARCHICAL_DIMENSIONING_V1 } from '@vectorai/engineering-annotation';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';
import { describe, expect, it } from 'vitest';

import { importDxf } from '../../dxf-import/src/index';
import { measureCadDimensionFootprint, projectCadDimensionLayout } from './cad-dimension-layout';
import { CAXA_COMPATIBLE_DXF_PROFILE as profile } from './gb-cad-profile';
import { projectEngineeringCadDrawing } from './engineering-dxf-export';

describe('CAD dimension paper layout', () => {
  it('preserves legacy/manual positions, source geometry, targets and measurements on an export clone', () => {
    const source = plate();
    const manual = dimension('manual', [[0, 0], [30, 0], [0, -17], [30, -17]], { layout: { mode: 'manual' }, displayText: 'CUSTOM 30.1234567' });
    const legacy = dimension('legacy', [[0, 0], [60, 0], [0, -25], [60, -25]], { layout: undefined });
    source.annotations.push(manual, legacy);
    const before = structuredClone(source);
    const result = projectCadDimensionLayout(source, profile);
    expect(result.document).toEqual(before);
    expect(result.document).not.toBe(source);
    expect(result.placements.every(({ automatic }) => !automatic)).toBe(true);
    expect(source).toEqual(before);
  });

  it('packs disjoint plate edge dimensions into one row and their enclosing dimension into the next', () => {
    const source = plate();
    source.annotations.push(
      dimension('left', [[0, 0], [20, 0], [0, -70], [20, -70]]),
      dimension('right', [[40, 0], [60, 0], [40, -80], [60, -80]]),
      dimension('overall', [[0, 0], [60, 0], [0, -90], [60, -90]]),
    );
    const result = projectCadDimensionLayout(source, profile);
    const byId = new Map(result.placements.map((entry) => [entry.annotationId, entry]));
    expect(byId.get('left')!.line!.start[1]).toBe(byId.get('right')!.line!.start[1]);
    expect(byId.get('overall')!.line!.start[1]).toBeLessThan(byId.get('left')!.line!.start[1]);
    expect(Math.abs(byId.get('overall')!.line!.start[1])).toBeLessThan(30);
    for (const node of result.document.annotations as DimensionAnnotation[]) {
      const original = source.annotations.find(({ id }) => id === node.id) as DimensionAnnotation;
      expect(node.definitionPoints.slice(0, 2)).toEqual(original.definitionPoints.slice(0, 2));
      expect(node.computedValue).toBe(original.computedValue);
      expect(node.targets).toEqual(original.targets);
    }
    expectNoTextOverlap(result.placements);
  });

  it('measures actual custom labels and tolerance stacks using the profile font width and converted deviations', () => {
    const ordinary = dimension('ordinary', [[0, 0], [8, 0]], { displayText: '8' });
    const tolerance = { mode: 'unilateral' as const, upperDeviation: 0.000123456, lowerDeviation: 0, unit: 'm' as const, status: 'confirmed' as const, source: 'manual' as const, evidenceRefs: [] };
    const withTolerance = measureCadDimensionFootprint({ ...ordinary, toleranceProjection: tolerance }, profile, 'mm');
    const basic = measureCadDimensionFootprint(ordinary, profile, 'mm');
    const custom = measureCadDimensionFootprint({ ...ordinary, displayText: 'SPECIAL 8.1234567' }, profile, 'mm');
    const symmetric = measureCadDimensionFootprint({ ...ordinary, tolerance: { upper: 0.1, lower: -0.1 } }, profile, 'mm');
    expect(withTolerance.width).toBeGreaterThan(basic.width);
    expect(withTolerance.height).toBeGreaterThan(basic.height);
    expect(symmetric.height).toBe(basic.height);
    expect(symmetric.width).toBeGreaterThan(basic.width);
    expect(custom.width).toBeGreaterThan(withTolerance.width);
    const widerProfile = { ...profile, textStyles: profile.textStyles.map((style) => ({ ...style, widthFactor: style.widthFactor * 2 })) };
    expect(measureCadDimensionFootprint(ordinary, widerProfile, 'mm').width).toBeCloseTo(basic.width * 2);
  });

  it('derives compact tiers from adjacent segments and their containing spans', () => {
    const source = plate();
    if (source.geometry[0].type === 'polyline') source.geometry[0].vertices.forEach((vertex) => { vertex.point = [vertex.point[0] * 3, vertex.point[1]]; });
    const spans = [['a', 0, 12], ['b', 12, 30], ['parent', 12, 35], ['next', 35, 42], ['remote', 80, 130], ['end', 130, 133], ['stack', 35, 133], ['overall', 0, 155]] as const;
    source.annotations.push(...spans.map(([id, a, b]) => dimension(id, [[a, 21], [b, 21], [a, 40], [b, 40]], id === 'a' ? { tolerance: { upper: 0.2, lower: 0 } } : {})));
    const result = projectCadDimensionLayout(source, profile);
    const row = (id: string) => result.placements.find((item) => item.annotationId === id)!.line!.start[1];
    expect(row('a')).toBe(row('b'));
    expect(row('parent')).toBeGreaterThan(row('b'));
    expect(row('next')).toBe(row('parent'));
    expect(row('remote')).toBe(row('next'));
    expect(row('end')).toBe(row('remote'));
    expect(row('stack')).toBeGreaterThan(row('remote'));
    expect(row('overall')).toBeGreaterThan(row('stack'));
    expectNoTextOverlap(result.placements);
  });

  it('keeps short internal opening dimensions in their local channel near each end', () => {
    const source = plate();
    source.geometry.push(...[5, 15].map((y, index) => ({ id: `channel-${index}` as GeometryId, type: 'line' as const, visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] }, start: [0, y] as Vec2, end: [60, y] as Vec2 })));
    source.annotations.push(...[[0, 1], [0, 3], [59, 60], [60, 57]].map(([a, b], index) => dimension(`depth-${index}`, [[a, 10], [b, 10], [a, 5], [b, 5]], { displayText: String(Math.abs(b - a)) })));
    const before = structuredClone(source);
    const result = projectCadDimensionLayout(source, profile);
    for (const item of result.placements) {
      expect(item.textBounds.minY).toBeGreaterThan(5);
      expect(item.textBounds.maxY).toBeLessThan(15);
      expect(item.textBounds.minX).toBeGreaterThan(0);
      expect(item.textBounds.maxX).toBeLessThan(60);
      expect(item.line!.start[0]).toBe(item.line!.witnessA[0]);
      expect(item.line!.end[0]).toBe(item.line!.witnessB[0]);
    }
    expectNoTextOverlap(result.placements);
    expect(source).toEqual(before);
  });

  it('keeps a real circle diameter and attaches an outside label to its nearest measured endpoint', () => {
    const source = plate();
    source.geometry.push({ id: 'hole' as GeometryId, type: 'circle', visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, center: [30, 10], radius: 1 });
    source.annotations.push(dimension('hole-diameter', [[29, 10], [31, 10]], { dimensionKind: 'diameter', displayText: '⌀2', targets: [{ geometryId: 'hole' as GeometryId, anchor: { kind: 'center' } }] }));
    const result = projectCadDimensionLayout(source, profile);
    expect((result.document.annotations[0] as DimensionAnnotation).definitionPoints).toEqual([[29, 10], [31, 10]]);
    expect(result.placements[0].leader).toEqual({ start: [31, 10], end: result.placements[0].textPosition });
    expect(result.placements[0].footprint.dimensionStyle).toBe('GB_RADIAL');
  });

  it('uses the plain-text compatibility width for plate note obstacles while retaining leader typography', () => {
    const source = plate();
    source.annotations.push({ id: 'plain-note' as AnnotationId, type: 'text', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, content: 'QC', height: 3.5,
      position: [20, 30], rotation: 0, alignment: 'right', verticalAlignment: 'middle',
    }, { id: 'leader-note' as AnnotationId, type: 'leader', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, content: 'QC', textHeight: 3.5,
      target: { geometryId: 'plate' as GeometryId, anchor: { kind: 'nearest', point: [50, 20] } },
      points: [[50, 20], [50, 30]],
    });
    const before = structuredClone(source);
    const caxa = projectCadDimensionLayout(source, profile);
    const legacy = projectCadDimensionLayout(source, { ...profile, plainTextWidthFactor: undefined });
    const width = (layout: typeof caxa, id: string) => {
      const box = layout.textObstacles.find((item) => item.annotationId === id)!.textBounds;
      return box.maxX - box.minX;
    };
    // Two 0.62-em glyphs at 3.5 mm, plus the profile's 1.5 mm paper gap.
    expect(width(caxa, 'plain-note')).toBeCloseTo(4.39478, 6);
    expect(width(legacy, 'plain-note')).toBeCloseTo(4.56838, 6);
    expect(width(caxa, 'leader-note')).toBeCloseTo(width(legacy, 'leader-note'), 8);
    expect(source).toEqual(before);
    expect(caxa.document).toEqual(before);
  });

  it('formats only unchanged generated text according to the export profile', () => {
    const source = plate();
    source.annotations.push(
      dimension('generated', [[0, 0], [12.123456, 0]], { computedValue: 12.123456, displayText: '12.123456', layout: { mode: 'automatic', generatedText: '12.123456' } }),
      dimension('customized', [[20, 0], [32.123456, 0]], { computedValue: 12.123456, displayText: 'nominal 12.123456', layout: { mode: 'automatic', generatedText: '12.123456' } }),
    );
    const result = projectCadDimensionLayout(source, profile);
    expect((result.document.annotations[0] as DimensionAnnotation).displayText).toBe('12.12');
    expect((result.document.annotations[1] as DimensionAnnotation).displayText).toBe('nominal 12.123456');
    expect((result.document.annotations[0] as DimensionAnnotation).computedValue).toBe(12.123456);
    expect((source.annotations[0] as DimensionAnnotation).displayText).toBe('12.123456');
  });

  it('places small spans with outside arrow fit and enough clearance for long tolerance labels', () => {
    const source = plate();
    source.annotations.push(dimension('tiny', [[0, 0], [2, 0], [0, -10], [2, -10]], { displayText: '2', tolerance: { upper: 0.12345, lower: -0.00012 } }));
    const result = projectCadDimensionLayout(source, profile);
    const placement = result.placements[0]!;
    expect(placement.arrowsOutside).toBe(true);
    expect(placement.textBounds.minY).toBeGreaterThan(placement.line!.start[1]);
    expect(placement.textBounds.maxY).toBeLessThan(0);
  });

  it('fits an automatic arrow pair inside a clear span when an outside tail would pierce fixed text', () => {
    const source = plate();
    source.annotations.push(dimension('short-edge', [[10, 20], [18, 20], [10, 45], [18, 45]], { displayText: '8' }));
    const baseline = projectCadDimensionLayout(source, profile).placements[0];
    expect(baseline.arrowsOutside).toBe(true);
    source.annotations.push({
      id: 'fixed-note' as AnnotationId, type: 'text', content: 'QC', height: 3.5,
      position: [19, baseline.line!.start[1]], rotation: 0, alignment: 'left', verticalAlignment: 'middle',
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    });
    const before = structuredClone(source);
    const result = projectCadDimensionLayout(source, profile);
    const actual = result.placements[0];
    expect(actual.arrowsOutside).toBe(false);
    expect(actual.textGapOverride).toBe(0.5);
    expect(actual.footprint.textGap).toBe(0.5);
    expect(actual.line).toEqual(baseline.line);
    expect(actual.textPosition).toEqual(baseline.textPosition);
    expect(result.document.annotations[1]).toEqual(before.annotations[1]);
    expect(source).toEqual(before);
    const dxf = exportDrawingDxf(result.document, { profile, dimensionPresentation: {
      'short-edge': { arrowsOutside: actual.arrowsOutside, textBounds: actual.textBounds },
    } });
    const pairs = dxf.split(/\r?\n/);
    const arrows: number[][] = [];
    let xs: number[] | undefined;
    for (let index = 0; index + 1 < pairs.length; index += 2) {
      const code = Number(pairs[index].trim());
      if (code === 0) {
        xs = pairs[index + 1] === 'HATCH' ? [] : undefined;
        if (xs) arrows.push(xs);
      }
      if (code === 10) xs?.push(Number(pairs[index + 1]));
    }
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      expect(Math.min(...arrow.slice(1))).toBeGreaterThanOrEqual(10);
      expect(Math.max(...arrow.slice(1))).toBeLessThanOrEqual(18);
    }
  });

  it.each(['text', 'manual-dimension'])('moves a crowded row around %s when the span cannot physically hold both arrows', (obstacle) => {
    const source = plate();
    source.annotations.push(dimension('short-edge', [[10, 20], [16, 20], [10, 45], [16, 45]], { displayText: '6' }));
    const baseline = projectCadDimensionLayout(source, profile).placements[0];
    source.annotations.push(obstacle === 'manual-dimension' ? dimension('fixed-note', [[50, 0], [60, 0], [50, 5], [60, 5]], {
      displayText: 'QC', textPosition: [19, baseline.line!.start[1]], layout: { mode: 'manual' },
    }) : {
      id: 'fixed-note' as AnnotationId, type: 'text', content: 'QC', height: 3.5,
      position: [17, baseline.line!.start[1]], rotation: 0, alignment: 'left', verticalAlignment: 'middle',
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    });
    const actual = projectCadDimensionLayout(source, profile).placements[0];
    expect(actual.arrowsOutside).toBe(true);
    expect(actual.line!.start[1]).toBeGreaterThan(baseline.line!.start[1]);
    expect(actual.line!.witnessA).toEqual(baseline.line!.witnessA);
    expect(actual.line!.witnessB).toEqual(baseline.line!.witnessB);
    expect(projectCadDimensionLayout(source, profile).document.annotations[1]).toEqual(source.annotations[1]);
  });

  it('keeps profile diameter witnesses and semantic kind while grouping exterior dimensions at each end', () => {
    const source = plate();
    source.annotations.push(
      dimension('outside-big', [[-50, 0], [-50, 20], [5, 0], [5, 20]], { dimensionKind: 'diameter', computedValue: 20, displayText: '⌀20' }),
      dimension('outside-small', [[-40, 2], [-40, 18], [10, 2], [10, 18]], { dimensionKind: 'diameter', computedValue: 16, displayText: '⌀16' }),
      dimension('inside', [[30, 5], [30, 15], [30, 5], [30, 15]], { dimensionKind: 'diameter', computedValue: 10, displayText: '⌀10' }),
    );
    const result = projectCadDimensionLayout(source, profile);
    const byId = new Map((result.document.annotations as DimensionAnnotation[]).map((node) => [String(node.id), node]));
    expect(byId.get('outside-big')!.textPosition[0]).toBeLessThan(byId.get('outside-small')!.textPosition[0]);
    expect(byId.get('outside-small')!.textPosition[0]).toBeLessThan(0);
    expect(byId.get('inside')!.textPosition[0]).toBeGreaterThan(0);
    expect(byId.get('inside')!.textPosition[0]).toBeLessThan(60);
    for (const node of byId.values()) {
      expect(node.dimensionKind).toBe('diameter');
      expect(node.definitionPoints.slice(2)).toEqual((source.annotations.find(({ id }) => id === node.id) as DimensionAnnotation).definitionPoints.slice(2));
    }
    expectNoTextOverlap(result.placements);
  });

  it('moves crowded sectional diameters together instead of scattering their labels across unrelated stations', () => {
    const source = plate();
    source.annotations.push(
      dimension('section-inner', [[18, 3], [18, 17], [15, 3], [15, 17]], { dimensionKind: 'diameter', computedValue: 14, displayText: '⌀14' }),
      dimension('section-outer', [[25, 2], [25, 18], [16, 2], [16, 18]], { dimensionKind: 'diameter', computedValue: 16, displayText: '⌀16' }),
    );
    const result = projectCadDimensionLayout(source, profile);
    expect(result.placements[0].textBounds.maxX).toBeLessThan(0);
    expect(result.placements[1].textPosition[0]).toBeLessThan(result.placements[0].textPosition[0]);
    expectNoTextOverlap(result.placements);
  });

  it('preserves the paper lane arrangement when a non-shaft drawing is rigidly rotated and translated', () => {
    const source = plate();
    source.annotations.push(dimension('edge', [[0, 0], [60, 0], [0, -50], [60, -50]]));
    const angle = 37 * Math.PI / 180;
    const transform = (point: Vec2): Vec2 => [110 + point[0] * Math.cos(angle) - point[1] * Math.sin(angle), -40 + point[0] * Math.sin(angle) + point[1] * Math.cos(angle)];
    const moved = structuredClone(source);
    const outline = moved.geometry[0];
    if (outline.type !== 'polyline') return;
    outline.vertices.forEach((vertex) => { vertex.point = transform(vertex.point); });
    const node = moved.annotations[0] as DimensionAnnotation;
    node.definitionPoints = node.definitionPoints.map(transform);
    node.textPosition = transform(node.textPosition);
    const initial = projectCadDimensionLayout(source, profile).placements[0];
    const result = projectCadDimensionLayout(moved, profile).placements[0];
    const expected = transform(initial.textPosition);
    expect(result.textPosition[0]).toBeCloseTo(expected[0], 6);
    expect(result.textPosition[1]).toBeCloseTo(expected[1], 6);
    expect(result.rotation).toBeCloseTo(37, 6);
  });

  it('fits angular arrows into the measured sector while retaining both angular rays', () => {
    const source = plate();
    const vertex: Vec2 = [0, 10];
    const first: Vec2 = [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)];
    const second: Vec2 = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    const at = (ray: Vec2, radius: number): Vec2 => [vertex[0] + ray[0] * radius, vertex[1] + ray[1] * radius];
    source.annotations.push(dimension('angle', [vertex, at(first, 4), at(second, 4), at(first, 2), at(second, 2)], { dimensionKind: 'angular', displayText: '60°', computedValue: 60, textPosition: [-2, 10] }));
    const result = projectCadDimensionLayout(source, profile);
    const placed = result.document.annotations[0] as DimensionAnnotation;
    const radius = Math.hypot(placed.definitionPoints[3][0], placed.definitionPoints[3][1] - 10);
    expect(radius * Math.PI / 3).toBeGreaterThan(2 * result.placements[0].footprint.arrowSize);
    expect(placed.definitionPoints.slice(0, 3)).toEqual((source.annotations[0] as DimensionAnnotation).definitionPoints.slice(0, 3));
    expect(placed.textPosition[0]).toBeLessThan(0);
    expect(placed.textPosition[1]).toBeCloseTo(10);
    expect(result.placements[0].rotation).toBe(0);
    expect(placed.definitionPoints[3][1]).toBeLessThan(10);
    expect(placed.definitionPoints[4][1]).toBeGreaterThan(10);
  });

  it('leaves real circle diameter endpoints fixed and creates readable small-radius leader clearance', () => {
    const source = plate();
    source.geometry.push({ id: 'hole' as GeometryId, type: 'circle', visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, center: [30, 10], radius: 3 });
    source.annotations.push(
      dimension('hole-diameter', [[27, 10], [33, 10]], { dimensionKind: 'diameter', targets: [{ geometryId: 'hole' as GeometryId, anchor: { kind: 'center' } }], computedValue: 6, displayText: '⌀6' }),
      dimension('fillet', [[60, 20], [61, 21], [61.2, 21.2]], { dimensionKind: 'radius', computedValue: Math.SQRT2, displayText: 'R1.41', textPosition: [61.2, 21.2] }),
    );
    const result = projectCadDimensionLayout(source, profile);
    expect((result.document.annotations[0] as DimensionAnnotation).definitionPoints).toEqual([[27, 10], [33, 10]]);
    const radius = result.placements.find(({ annotationId }) => annotationId === 'fillet')!;
    expect(Math.hypot(radius.textPosition[0] - 61, radius.textPosition[1] - 21)).toBeGreaterThan(radius.footprint.arrowSize + radius.footprint.width / 2);
    expectNoTextOverlap(result.placements);
  });

  it('keeps an exterior profile-diameter column beside a nonoverlapping note and reserves a DXF line gap', () => {
    const source = plate();
    if (source.geometry[0].type === 'polyline') source.geometry[0].vertices.forEach((vertex) => { vertex.point = [vertex.point[0], vertex.point[1] * 2]; });
    source.annotations.push(dimension('profile', [[80, 0], [80, 40], [60, 0], [60, 40]], {
      dimensionKind: 'diameter', computedValue: 40, displayText: '⌀40',
      targets: [{ geometryId: 'plate' as GeometryId, anchor: { kind: 'vertex', index: 1 } }],
    }));
    const original = projectCadDimensionLayout(source, profile).placements[0];
    source.annotations.push({ id: 'inspection-note' as AnnotationId, type: 'text', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] }, content: 'QC', height: 3.5,
      position: [original.line!.start[0], original.textBounds.maxY + original.footprint.textGap * 2],
      rotation: 90, alignment: 'left', verticalAlignment: 'middle',
    });
    const placed = projectCadDimensionLayout(source, profile);
    expect(placed.placements[0].line).toEqual(original.line);
    expect(placed.textObstacles).toHaveLength(1);
    expect(placed.textObstacles[0].textBounds.minY).toBeGreaterThan(original.textBounds.maxY);
    expect(placed.textObstacles[0].textBounds.maxY).toBeLessThan(original.line!.end[1] - original.footprint.arrowSize);
    expect(placed.document.annotations[1]).toEqual(source.annotations[1]);
    const scene = projectEngineeringCadDrawing(source, { version: 1, phase: 'idle',
      drawingRef: { drawingId: source.id, revision: 1 }, canUndo: false, canRedo: false, updatedAt: 1 }, { profile });
    const pairs = exportDrawingDxf(scene.document, scene).split(/\r?\n/);
    const lines: Map<number, string>[] = [];
    let record: Map<number, string> | undefined;
    for (let index = 0; index + 1 < pairs.length; index += 2) {
      const code = Number(pairs[index].trim());
      if (code === 0) {
        record = pairs[index + 1] === 'LINE' ? new Map() : undefined;
        if (record) lines.push(record);
      }
      record?.set(code, pairs[index + 1]);
    }
    const column = lines.filter((line) => Math.abs(Number(line.get(10)) - original.line!.start[0]) < 1e-6
      && Math.abs(Number(line.get(11)) - original.line!.start[0]) < 1e-6);
    const note = placed.textObstacles[0].textBounds;
    expect(column.some((line) => Math.abs(Number(line.get(21)) - note.minY) < 1e-6)).toBe(true);
    expect(column.every((line) => Math.max(Number(line.get(20)), Number(line.get(21))) <= note.minY + 1e-6
      || Math.min(Number(line.get(20)), Number(line.get(21))) >= note.maxY - 1e-6)).toBe(true);
  });

  it('puts a concave radius label in exterior white space when the original radial direction points into the plate', () => {
    const source = plate();
    source.annotations.push(dimension('corner-radius', [[50, 22], [49, 21], [48.5, 20.5]], { dimensionKind: 'radius', computedValue: Math.SQRT2, displayText: 'R1.41', textPosition: [48.5, 20.5] }));
    const result = projectCadDimensionLayout(source, profile);
    expect(result.placements[0].textBounds.minY).toBeGreaterThan(20);
    expect(result.placements[0].leader!.start).toEqual([49, 21]);
    expect((result.document.annotations[0] as DimensionAnnotation).definitionPoints.slice(0, 2)).toEqual([[50, 22], [49, 21]]);
  });

  it('keeps a radius near its feature even when a fixed manual label covers the leader origin', () => {
    const source = plate();
    source.annotations.push(
      dimension('fixed-label', [[0, 0], [20, 0]], { textPosition: [49, 21], displayText: 'manual 20', layout: { mode: 'manual' } }),
      dimension('blocked-radius', [[50, 22], [49, 21]], { dimensionKind: 'radius', computedValue: Math.SQRT2, displayText: 'R1.41', textPosition: [48, 20] }),
    );
    const result = projectCadDimensionLayout(source, profile);
    const radius = result.placements.find(({ annotationId }) => annotationId === 'blocked-radius')!;
    expect(Math.hypot(radius.textPosition[0] - 49, radius.textPosition[1] - 21)).toBeLessThan(50);
    expect(result.placements.find(({ annotationId }) => annotationId === 'fixed-label')!.textPosition).toEqual([49, 21]);
    expectNoTextOverlap(result.placements);
  });

  it('reserves visible notes and leader text as fixed paper obstacles without moving either annotation', () => {
    const source = plate();
    source.annotations.push(
      dimension('edge', [[0, 0], [60, 0], [0, -50], [60, -50]]),
      { id: 'note' as AnnotationId, type: 'text', content: 'C0.5两侧', position: [30, -8.25], height: 3.5, rotation: 0, alignment: 'center', verticalAlignment: 'middle', visible: true, quality: { status: 'confirmed', evidenceRefs: [] } },
      { id: 'radius-note' as AnnotationId, type: 'leader', content: 'R1', points: [[60, 20], [28, -15.916667]], textHeight: 3.5, target: { geometryId: 'plate' as GeometryId, anchor: { kind: 'vertex', index: 2 } }, visible: true, quality: { status: 'confirmed', evidenceRefs: [] } },
    );
    const original = structuredClone(source.annotations.slice(1));
    const result = projectCadDimensionLayout(source, profile);
    expect(result.textObstacles).toHaveLength(2);
    expect(result.document.annotations.slice(1)).toEqual(original);
    for (const { textBounds: other } of result.textObstacles) {
      const dimension = result.placements[0].textBounds;
      expect(dimension.maxX <= other.minX || other.maxX <= dimension.minX || dimension.maxY <= other.minY || other.maxY <= dimension.minY).toBe(true);
    }
  });

  it('lays out the real golden geometry without changing its generated semantic inventory or intersecting dimension labels', () => {
    const imported = importDxf({ bytes: readFileSync(resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001/initial.dxf')), source: { name: 'initial.dxf', digest: 'sha256:paper-layout-golden' }, drawingId: 'paper-layout-golden', now: () => 1 });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    const plan = planEngineeringAnnotations({ document: imported.document, ref: { drawingId: String(imported.document.id), revision: 1 }, objective: '全部自动标注', annotationKinds: ['opening-angle', 'diameter', 'radius'] });
    imported.document.annotations.push(...plan.annotations);
    const before = structuredClone(imported.document);
    const result = projectCadDimensionLayout(imported.document, profile);
    expectNoTextOverlap(result.placements);
    expect(imported.document).toEqual(before);
    expect(result.document.geometry).toEqual(before.geometry);
    expect(result.placements.filter(({ automatic }) => automatic)).toHaveLength(plan.annotations.length);
    for (const node of result.document.annotations as DimensionAnnotation[]) {
      const original = before.annotations.find(({ id }) => id === node.id) as DimensionAnnotation;
      expect({ kind: node.dimensionKind, targets: node.targets, observed: node.observedValue, computed: node.computedValue }).toEqual({ kind: original.dimensionKind, targets: original.targets, observed: original.observedValue, computed: original.computedValue });
    }
    for (const entry of result.placements.filter(({ kind }) => kind === 'angular')) {
      const node = result.document.annotations.find(({ id }) => id === entry.annotationId) as DimensionAnnotation;
      const lines = node.targets.map(({ geometryId }) => result.document.geometry.find(({ id }) => id === geometryId)).filter((geometry) => geometry?.type === 'line');
      const endpoints = lines.flatMap((line) => [line.start, line.end]);
      const center = entry.arc!.center;
      const interior = Math.abs(node.computedValue ?? 0) < 90;
      const controlDistances = endpoints.map((point) => Math.hypot(point[0] - center[0], point[1] - center[1]));
      if (interior) {
        expect(entry.arc!.radius).toBeLessThan(Math.min(...controlDistances));
        expect(entry.textBounds.minX).toBeGreaterThan(523);
        expect(entry.textBounds.maxX).toBeLessThan(697);
      } else expect(entry.arc!.radius).toBeGreaterThan(Math.max(...controlDistances));
      expect(entry.arc!.witnesses).toHaveLength(2);
      entry.arc!.witnesses!.forEach((witness) => {
        expect(endpoints).toContainEqual(witness.start);
        expect(Math.hypot(witness.end[0] - center[0], witness.end[1] - center[1])).toBeCloseTo(entry.arc!.radius + entry.footprint.extension * (interior ? -1 : 1), 6);
      });
    }
    const engineeringText = readFileSync(resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001/engineering-data.ini'), 'utf8');
    const drawingRef = { drawingId: String(imported.document.id), revision: 1 };
    const analyzed = analyzeShaftPartition({ document: imported.document, drawingRef, engineeringText, drawingSourceName: 'initial.dxf' });
    expect(analyzed.status).toBe('drafted');
    if (analyzed.status !== 'drafted') return;
    const partition = inferRegularShaftRegions(analyzed.draft);
    const engineering = parseEngineeringDocument(engineeringText);
    const topology = buildAxialTopology({ document: imported.document, partition, unit: engineering.drawing.unit ?? 'mm' });
    const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: engineering });
    const axialScheme = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });
    const snapshot = { version: 1, phase: 'confirmed', drawingRef, canUndo: false, canRedo: false, updatedAt: 1, confirmed: { version: 1, drawingRef, id: 'paper-layout', generationOrder: [], confirmedAt: 1, datums: [], intents: [], tolerances: [], chains: [], dependencies: [], diagnostics: [], geometricTolerances: [], axialScheme } } as unknown as DimensionPlanSessionSnapshot;
    const complete = projectEngineeringCadDrawing(imported.document, snapshot, { profile: 'caxa-compatible' });
    expect(complete.dimensionPlacements.length).toBeGreaterThan(result.placements.length);
    expectNoTextOverlap(complete.dimensionPlacements);
    const ys = complete.dimensionPlacements.map(({ textPosition }) => textPosition[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(120);
    expect(imported.document).toEqual(before);
    if (process.env.CAD_LAYOUT_DEBUG) console.log(JSON.stringify(result.placements.map((item) => ({ id: item.annotationId, kind: item.kind, at: item.textPosition, rotation: item.rotation, line: item.line, bounds: item.textBounds })), null, 2));
  });
});

function plate(): DrawingDocument {
  const source = createEmptyDrawing({ now: () => 1 });
  source.geometry = [{ id: 'plate' as GeometryId, type: 'polyline', visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, closed: true, vertices: [[0, 0], [60, 0], [60, 20], [0, 20]].map((point) => ({ point: point as unknown as Vec2 })) }];
  return source;
}

function dimension(id: string, definitionPoints: Vec2[], overrides: Partial<DimensionAnnotation> = {}): DimensionAnnotation {
  return { id: id as AnnotationId, type: 'dimension', visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, dimensionKind: 'linear', associationStatus: 'resolved', targets: [{ geometryId: 'plate' as GeometryId, anchor: { kind: 'vertex', index: 0 } }], computedValue: Math.hypot(definitionPoints[1][0] - definitionPoints[0][0], definitionPoints[1][1] - definitionPoints[0][1]), textPosition: definitionPoints.at(-1)!, definitionPoints, layout: { mode: 'automatic' }, ...overrides };
}

function expectNoTextOverlap(placements: ReturnType<typeof projectCadDimensionLayout>['placements']): void {
  placements.forEach((first, index) => placements.slice(index + 1).forEach((second) => {
    expect(first.textBounds.maxX <= second.textBounds.minX || second.textBounds.maxX <= first.textBounds.minX || first.textBounds.maxY <= second.textBounds.minY || second.textBounds.maxY <= first.textBounds.minY, `${first.annotationId}/${second.annotationId} text overlaps`).toBe(true);
  }));
}
