// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DrawingDocument, type DxfBlockGraphic, type Vec2 } from '@vectorai/drawing-core';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { describe, expect, it } from 'vitest';

import type { CadDimensionPlacement, CadTextBounds } from './cad-dimension-layout';
import { projectCadEngineeringSymbols } from './cad-symbol-layout';
import { CAXA_COMPATIBLE_DXF_PROFILE } from './gb-cad-profile';

const profile = CAXA_COMPATIBLE_DXF_PROFILE;
const options = { planConfirmed: true, caxaCompatible: true };
const quality = { status: 'confirmed' as const, evidenceRefs: [] };
const ref = { drawingId: 'paper-symbols', revision: 1 };

function fixture(): { document: DrawingDocument; plan: EngineeringAnnotationDraft } {
  const document = createEmptyDrawing({ idFactory: { next: () => ref.drawingId }, now: () => 1 });
  document.geometry = [0, 1, 2, 3].map((index) => ({
    id: `surface-${index}` as never, type: 'line', start: [index * 40, -10], end: [index * 40 + 20, -10], visible: true, quality,
  }));
  document.geometry.push({ id: 'top' as never, type: 'line', start: [0, 10], end: [140, 10], visible: true, quality });
  const plan: EngineeringAnnotationDraft = {
    version: 1, drawingRef: ref, datums: [], intents: [], tolerances: [], fitAssignments: [],
    geometricTolerances: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [],
  };
  for (let index = 0; index < 4; index++) {
    plan.geometricTolerances.push(...(['circularity', 'cylindricity'] as const).map((characteristic, row) => ({
      id: `control:${index}:${row}`, drawingRef: ref, characteristic,
      controlledTargets: [{ geometryId: `surface-${index}`, anchor: { kind: 'nearest' as const, point: [index * 40 + 10, -10] as [number, number] } }],
      toleranceZone: { shape: 'linear' as const }, datumReferenceFrame: [],
      computed: { status: 'resolved' as const, value: row ? 0.005 : 0.003, unit: 'mm' as const, diagnostics: [] },
      source: 'document' as const, status: 'confirmed' as const, evidenceIds: [],
    })));
  }
  return { document, plan };
}

function pictures(entities: ReturnType<typeof projectCadEngineeringSymbols>['entities']): readonly DxfBlockGraphic[][] {
  return entities.map((entity) => entity.type === 'block-reference' ? [...entity.picture] : []);
}
function texts(picture: readonly DxfBlockGraphic[]): string[] { return picture.flatMap((item) => item.type === 'mtext' ? [item.content] : []); }
function overlap(a: CadTextBounds, b: CadTextBounds): boolean { return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY; }

describe('CAD engineering symbol paper layout', () => {
  it('uses a hatch hole as empty space and preserves manual marker ownership', () => {
    const { document, plan } = fixture();
    const contours: Vec2[][] = [[[-30, -20], [30, -20], [30, 20], [-30, 20]], [[-20, -10], [20, -10], [20, 10], [-20, 10]]];
    document.geometry = [{ id: 'face' as never, type: 'line', start: [-12, 10], end: [12, 10], visible: true, quality }];
    document.annotations = [{ id: 'material' as never, type: 'section-hatch', visible: true, quality, pattern: 'ANSI31', angle: 45, spacing: 2,
      hatch: { version: 1, style: 'normal', elevation: 0, extrusion: [0, 0, 1], patternLines: [], patternAngle: 0, patternScale: 1, double: false,
        boundaryPaths: contours.map((points) => ({ flags: 0, closed: true, edges: points.map((start, index) => ({ type: 'line', start, end: points[(index + 1) % points.length] })) })) } }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [0, 10] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const before = structuredClone({ document, plan });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const triangle = pictures(projected.entities)[0].find((g) => g.type === 'polyline' && g.closed);
    if (triangle?.type !== 'polyline') throw new Error('missing roughness triangle');
    expect((triangle.points[0][1] + triangle.points[2][1]) / 2 - triangle.points[1][1]).toBeCloseTo(-5);
    expect({ document, plan }).toEqual(before);
    plan.surfaceTextures[0].labelPosition = [70, 45];
    const manual = projectCadEngineeringSymbols(plan, document, profile, options).placements[0];
    expect(manual).toMatchObject({ position: [70, 45], anchor: [0, 10], automatic: false });
  });

  it('retains the automatic roughness facing on a manual move while preserving old manual markers', () => {
    const { document, plan } = fixture();
    document.geometry = [
      { id: 'face' as never, type: 'line', start: [-8, 0], end: [8, 0], visible: true, quality },
      { id: 'material' as never, type: 'polyline', closed: true, vertices: [[-8, 0], [8, 0], [8, 12], [-8, 12]].map(([x, y]) => ({ point: [x, y] as Vec2 })), visible: true, quality },
    ];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [0, 0] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const automatic = projectCadEngineeringSymbols(plan, document, profile, options);
    const placed = automatic.placements[0];
    expect(placed.facing).toBe(-1);
    const moved = structuredClone(plan);
    moved.surfaceTextures[0].labelPosition = [placed.position[0] + 3, placed.position[1] - 2];
    moved.surfaceTextures[0].labelFacing = placed.facing;
    const result = projectCadEngineeringSymbols(moved, document, profile, options);
    const triangle = (entities: typeof result.entities) => pictures(entities)[0].find((graphic) => graphic.type === 'polyline' && graphic.closed) as Extract<DxfBlockGraphic, { type: 'polyline' }>;
    expect(result.placements[0].facing).toBe(-1);
    expect(triangle(result.entities).points).toEqual(triangle(automatic.entities).points.map(([x, y]) => [x + 3, y - 2]));
    expect(result.placements[0].anchor).toEqual(placed.anchor);
    expect(result.placements[0].automatic).toBe(false);
    delete moved.surfaceTextures[0].labelFacing;
    const legacy = projectCadEngineeringSymbols(moved, document, profile, options);
    expect(legacy.placements[0].facing).toBe(1);
    expect(legacy.placements[0].position).toEqual(moved.surfaceTextures[0].labelPosition);
    expect(triangle(legacy.entities).points[0][1] - triangle(legacy.entities).points[1][1]).toBeCloseTo(5);
  });

  it('uses the final incoming leader for unmatched internal faces without depending on endpoint order or translation', () => {
    for (const reversed of [false, true]) for (const shift of [[0, 0], [81, -103]] as Vec2[]) {
      const move = ([x, y]: Vec2): Vec2 => [x + shift[0], y + shift[1]];
      const { document, plan } = fixture();
      const start = move([-34, -11]); const end = move([-32, -11 + 2 / Math.sqrt(3)]);
      document.geometry = [{ id: 'face' as never, type: 'line', start: reversed ? end : start, end: reversed ? start : end, visible: true, quality },
        ...[[[-40, -20], [40, -20], [40, 20], [-40, 20]], [[-35, -10], [35, -10], [35, 10], [-35, 10]]].map((points, index) => ({
          id: `closed-${index}` as never, type: 'polyline' as const, closed: true, visible: true, quality, vertices: points.map(([x, y]) => ({ point: move([x, y]) })) }))];
      plan.geometricTolerances = [];
      plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [start[0], start[1]] } }],
        parameter: 'Ra', value: 1.6, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
      const projected = projectCadEngineeringSymbols(plan, document, profile, options);
      const placement = projected.placements[0]; const triangle = pictures(projected.entities)[0].find((g) => g.type === 'polyline' && g.closed);
      if (triangle?.type !== 'polyline') throw new Error('missing roughness triangle');
      const [a, tip, b] = triangle.points; const previous = [...placement.leader].reverse().find((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1]) > 1e-8)!;
      const forward: Vec2 = [(a[0] + b[0]) / 2 - tip[0], (a[1] + b[1]) / 2 - tip[1]];
      expect((tip[0] - previous[0]) * forward[0] + (tip[1] - previous[1]) * forward[1]).toBeGreaterThan(0);
      // The alternative facing needs a long route through the material below
      // the hole. Prefer the route through empty space into this glyph.
      expect(forward[0]).toBeGreaterThan(0);
      expect(forward[1]).toBeLessThan(0);
      expect(placement.anchor).toEqual(start);
      expect(placement.box.minY - shift[1]).toBeGreaterThanOrEqual(-10);
      expect(placement.box.maxY - shift[1]).toBeLessThanOrEqual(10);
      expect(projectCadEngineeringSymbols(plan, document, profile, options)).toEqual(projected);
    }
  });

  it.each([0, 37, 90])('faces away from a closed material region at %s degrees independently of line order and translation', (angle) => {
    const radians = angle * Math.PI / 180;
    const rotate = ([x, y]: Vec2, shift: Vec2): Vec2 => [shift[0] + x * Math.cos(radians) - y * Math.sin(radians), shift[1] + x * Math.sin(radians) + y * Math.cos(radians)];
    for (const reversed of [false, true]) for (const shift of [[0, 0], [123, -456]] as Vec2[]) {
      const { document, plan } = fixture();
      const start = rotate([-8, 0], shift); const end = rotate([8, 0], shift);
      document.geometry = [{ id: 'face' as never, type: 'line', start: reversed ? end : start, end: reversed ? start : end, visible: true, quality },
        { id: 'material' as never, type: 'polyline', closed: true, vertices: [[-8, 0], [8, 0], [8, 12], [-8, 12]].map(([x, y]) => ({ point: rotate([x, y], shift) })), visible: true, quality }];
      plan.geometricTolerances = [];
      plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [shift[0], shift[1]] } }],
        parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
      const projected = projectCadEngineeringSymbols(plan, document, profile, options);
      const triangle = pictures(projected.entities)[0].find((g) => g.type === 'polyline' && g.closed);
      if (triangle?.type !== 'polyline') throw new Error('missing roughness triangle');
      const [a, tip, b] = triangle.points; const normal: Vec2 = [(a[0] + b[0]) / 2 - tip[0], (a[1] + b[1]) / 2 - tip[1]];
      expect(normal[0]).toBeCloseTo(5 * Math.sin(radians));
      expect(normal[1]).toBeCloseTo(-5 * Math.cos(radians));
      expect(projected.placements[0].anchor).toEqual(shift);
      const label = pictures(projected.entities)[0].find((g) => g.type === 'mtext');
      expect(label?.type === 'mtext' && label.rotation).toBeCloseTo(angle);
    }
  });

  it('supports the required three, three, one, one control grouping without equal-row assumptions', () => {
    const { document, plan } = fixture();
    plan.geometricTolerances = plan.geometricTolerances.filter(({ id }) => !['control:2:1', 'control:3:1'].includes(id));
    plan.geometricTolerances.push(...[0, 1].map((index) => ({
      ...structuredClone(plan.geometricTolerances.find(({ id }) => id === `control:${index}:0`)!),
      id: `control:${index}:2`, characteristic: 'circular-runout' as const,
    })));
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.placements.map(({ ids }) => ids.length)).toEqual([3, 3, 1, 1]);
    projected.placements.forEach((placement) => expect(placement.box.maxY - placement.box.minY).toBeCloseTo(placement.ids.length * 3.5 * 1.8));
  });

  it('groups eight controls on four actual surfaces into four compact two-row frames', () => {
    const { document, plan } = fixture();
    const before = structuredClone({ document, plan });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.entities).toHaveLength(4);
    expect(projected.placements.every(({ kind, ids }) => kind === 'gdt' && ids.length === 2)).toBe(true);
    projected.placements.forEach((placement, index) => {
      expect(placement.geometryIds).toEqual([`surface-${index}`]);
      expect(placement.anchor).toEqual([index * 40 + 10, -10]);
      expect(placement.leader[0]).toEqual(placement.anchor);
      expect(placement.box.maxY - placement.box.minY).toBeCloseTo(3.5 * 1.8 * 2);
      expect(placement.box.maxX - placement.box.minX).toBeLessThan(20);
      for (const other of projected.placements.slice(index + 1)) expect(overlap(placement.box, other.box)).toBe(false);
    });
    for (const picture of pictures(projected.entities)) {
      expect(texts(picture)).toEqual(expect.arrayContaining(['{\\Famgdt;e}', '{\\Famgdt;g}', expect.stringContaining('0.003'), expect.stringContaining('0.005')]));
      expect(picture.filter(({ type }) => type === 'mtext').every((node) => node.type === 'mtext' && node.height === 3.5)).toBe(true);
    }
    expect({ document, plan }).toEqual(before);
  });

  it('keeps datum marker, frame top-left, and texture marker manual anchors exactly', () => {
    const { document, plan } = fixture();
    plan.datums = [{ id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'surface-0', anchor: { kind: 'start' },
      labelPosition: [-12, -30], role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: [] }];
    plan.geometricTolerances = plan.geometricTolerances.slice(0, 2).map((intent) => ({ ...intent, framePosition: [15, 36] }));
    plan.surfaceTextures = [{ id: 'texture:0', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'end' } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'manual', status: 'confirmed', evidenceIds: [], labelPosition: [80, 42] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.placements.map(({ kind, position, automatic }) => ({ kind, position, automatic }))).toEqual([
      { kind: 'datum', position: [-12, -30], automatic: false },
      { kind: 'gdt', position: [15, 36], automatic: false },
      { kind: 'surface-texture', position: [80, 42], automatic: false },
    ]);
    expect(projected.placements[0].anchor).toEqual([0, -10]);
    expect(projected.placements[2].anchor).toEqual([20, -10]);
  });

  it('keeps common A-B references together and places numeric Ra above their related frame', () => {
    const { document, plan } = fixture();
    plan.datums = ['A', 'B'].map((name) => ({ id: `datum:${name}`, drawingRef: ref, name, geometryId: 'surface-0', anchor: { kind: 'start' }, role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: [] }));
    plan.geometricTolerances = plan.geometricTolerances.slice(0, 2).map((intent) => ({
      ...intent, datumReferenceFrame: [{ datumId: 'datum:A' }, { datumId: 'datum:B' }],
    }));
    plan.surfaceTextures = [{ id: 'texture:0', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'nearest', point: [10, -10] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const frameIndex = projected.placements.findIndex(({ kind }) => kind === 'gdt');
    const textureIndex = projected.placements.findIndex(({ kind }) => kind === 'surface-texture');
    const frame = projected.placements[frameIndex];
    const texture = projected.placements[textureIndex];
    expect(texts(pictures(projected.entities)[frameIndex]).filter((text) => text.includes('A-B'))).toHaveLength(2);
    expect(texture.attachedToGdtIds).toEqual(frame.ids);
    expect(texture.box.minY).toBeCloseTo(frame.box.maxY);
    expect(texture.leader).toEqual([]);
    expect(texts(pictures(projected.entities)[textureIndex])).toEqual(['{\\Fisocp,GBCBIG;\\W0.707;0.8}']);
  });

  it.each(['required', 'prohibited', 'unspecified'] as const)('draws the %s material-removal symbol and retains non-Ra parameter labels', (materialRemoval) => {
    const { document, plan } = fixture();
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture:0', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'end' } }],
      parameter: 'Rz', value: 6.3, unit: 'um', materialRemoval, source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const picture = pictures(projected.entities)[0];
    expect(texts(picture)).toEqual(['{\\Fisocp,GBCBIG;\\W0.707;Rz 6.3}']);
    const closed = picture.filter((graphic) => graphic.type === 'polyline' && graphic.closed);
    expect(closed).toHaveLength(materialRemoval === 'unspecified' ? 0 : 1);
    if (materialRemoval === 'required') expect(closed[0]).toMatchObject({ points: expect.any(Array) });
    if (materialRemoval === 'prohibited') expect(closed[0]).toMatchObject({ points: expect.arrayContaining([expect.any(Array)]) });
    expect(picture.some((graphic) => graphic.type === 'line')).toBe(materialRemoval === 'required');
  });

  it.each([[0, 0], [30, 30], [90, 90], [-40, -40], [1.4, 0], [89.5, 90], [210, 30]])('rotates the complete surface symbol for a %s degree line to the readable %s degree direction', (sourceDegrees, rotation) => {
    const { document, plan } = fixture();
    const radians = sourceDegrees * Math.PI / 180;
    document.geometry = [{ id: 'surface' as never, type: 'line', start: [-20 * Math.cos(radians), -20 * Math.sin(radians)], end: [20 * Math.cos(radians), 20 * Math.sin(radians)], visible: true, quality }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'surface', anchor: { kind: 'nearest', point: [0, 0] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'manual', status: 'confirmed', evidenceIds: [], labelPosition: [70, 45] }];
    const before = structuredClone({ document, plan });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const placement = projected.placements[0];
    const picture = pictures(projected.entities)[0];
    const label = picture.find((graphic) => graphic.type === 'mtext');
    expect(label?.type === 'mtext' && label.rotation).toBeCloseTo(rotation);
    expect(placement.position).toEqual([70, 45]);
    expect(placement.anchor).toEqual([0, 0]);
    const triangle = picture.find((graphic) => graphic.type === 'polyline' && graphic.closed);
    expect(triangle?.type).toBe('polyline');
    if (triangle?.type !== 'polyline') return;
    const angle = rotation * Math.PI / 180;
    const rotate = ([x, y]: Vec2): Vec2 => [70 + x * Math.cos(angle) - y * Math.sin(angle), 45 + x * Math.sin(angle) + y * Math.cos(angle)];
    const expected = [[-5 / Math.sqrt(3), 5 - 7 / 11], [0, -7 / 11], [5 / Math.sqrt(3), 5 - 7 / 11]].map(([x, y]) => rotate([x, y]));
    triangle.points.forEach((point, index) => { expect(point[0]).toBeCloseTo(expected[index][0]); expect(point[1]).toBeCloseTo(expected[index][1]); });
    const arm = picture.find((graphic) => graphic.type === 'line');
    expect(arm?.type).toBe('line');
    if (arm?.type !== 'line' || label?.type !== 'mtext') return;
    const [shortEnd, tip, barEnd] = triangle.points;
    const length = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const short = length(shortEnd, tip); const long = length(arm.end, tip);
    // Measure each rotated symbol independently; both size and angle differed
    // from the reference despite matching nominal text height.
    expect(short).toBeCloseTo(5.7735026919);
    expect(long).toBeCloseTo(12.7017059222);
    expect(length(shortEnd, barEnd)).toBeCloseTo(5.7735026919);
    const dot = (shortEnd[0] - tip[0]) * (arm.end[0] - tip[0]) + (shortEnd[1] - tip[1]) * (arm.end[1] - tip[1]);
    expect(Math.acos(dot / short / long) * 180 / Math.PI).toBeCloseTo(60);
    expect(label.height).toBe(3.5);
    expect(label.alignment).toBe(8);
    const textBottom = rotate([0, 5 + 1.05 - 7 / 11]);
    expect(label.position[0]).toBeCloseTo(textBottom[0]);
    expect(label.position[1]).toBeCloseTo(textBottom[1]);
    for (const graphic of picture.slice(1)) {
      const points = graphic.type === 'polyline' ? graphic.points : graphic.type === 'line' ? [graphic.start, graphic.end] : graphic.type === 'mtext' ? [graphic.position] : [];
      for (const point of points) { expect(point[0]).toBeGreaterThanOrEqual(placement.box.minX - 1e-8); expect(point[0]).toBeLessThanOrEqual(placement.box.maxX + 1e-8); expect(point[1]).toBeGreaterThanOrEqual(placement.box.minY - 1e-8); expect(point[1]).toBeLessThanOrEqual(placement.box.maxY + 1e-8); }
    }
    if (rotation === 30) expect(placement.box.maxX - placement.box.minX).toBeLessThan(10);
    expect({ document, plan }).toEqual(before);
  });

  it('retains the legacy surface outline and text placement when the optional style is absent', () => {
    const { document, plan } = fixture();
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'start' } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'manual', status: 'confirmed', evidenceIds: [], labelPosition: [70, 45] }];
    const legacy = { ...profile, surfaceTexture: undefined };
    const picture = pictures(projectCadEngineeringSymbols(plan, document, legacy, options).entities)[0];
    const triangle = picture.find((graphic) => graphic.type === 'polyline' && graphic.closed);
    expect(triangle).toMatchObject({ points: [[70 - 42 / 11, 45 + 56 / 11], [70, 45 - 7 / 11], [70 + 42 / 11, 45 + 56 / 11]] });
    expect(picture.find((graphic) => graphic.type === 'mtext')).toMatchObject({ alignment: 5, position: [70, 45 + 80.5 / 11] });
  });

  it('scales the configured surface proportions with paper text height and drawing units', () => {
    const { document, plan } = fixture();
    document.unitSystem.length = 'cm';
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'start' } }],
      parameter: 'Ra', value: 1.6, unit: 'um', materialRemoval: 'required', source: 'manual', status: 'confirmed', evidenceIds: [], labelPosition: [70, 45] }];
    const custom = { ...profile, dimensionStyles: profile.dimensionStyles.map((style) => ({ ...style, textHeight: 5, overallScale: 2 })),
      surfaceTexture: { shortRise: 2, longRise: 4, includedAngle: 50, textGap: 0.4 } };
    const picture = pictures(projectCadEngineeringSymbols(plan, document, custom, options).entities)[0];
    const triangle = picture.find((graphic) => graphic.type === 'polyline' && graphic.closed);
    const arm = picture.find((graphic) => graphic.type === 'line');
    expect(triangle?.type).toBe('polyline'); expect(arm?.type).toBe('line');
    if (triangle?.type !== 'polyline' || arm?.type !== 'line') return;
    const [a, tip, b] = triangle.points;
    expect(a[1] - tip[1]).toBeCloseTo(2);
    expect(arm.end[1] - tip[1]).toBeCloseTo(4);
    expect(b[0] - a[0]).toBeCloseTo(4 * Math.tan(25 * Math.PI / 180));
    expect(picture.find((graphic) => graphic.type === 'mtext')).toMatchObject({ height: 1, alignment: 8, position: [70, tip[1] + 2.4] });
  });

  it('places a vertical-face symbol compactly on its actual surface extension', () => {
    const { document, plan } = fixture();
    document.geometry = [{ id: 'face' as never, type: 'line', start: [0, 10], end: [0, 15], visible: true, quality },
      { id: 'upper' as never, type: 'line', start: [-50, 15], end: [0, 15], visible: true, quality },
      { id: 'lower' as never, type: 'line', start: [-50, -15], end: [0, -15], visible: true, quality }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [0, 12.5] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const texture = projected.placements[0]; const tip = texture.leader[texture.leader.length - 1];
    expect(tip[0]).toBeCloseTo(0);
    expect(tip[1]).toBeGreaterThan(15);
    expect(tip[1] - texture.anchor[1]).toBeLessThan(20);
    expect(texture.box.minY).toBeGreaterThan(15);
    expect(texture.box.maxY).toBeLessThan(40);
  });

  it('fits a face extension between a contour and a witness passing through empty symbol bounds', () => {
    const { document, plan } = fixture();
    document.geometry = [{ id: 'face' as never, type: 'line', start: [0, 0], end: [0, 5], visible: true, quality },
      { id: 'left' as never, type: 'line', start: [-30, 2.5], end: [-3.5, 2.5], visible: true, quality },
      { id: 'right' as never, type: 'line', start: [0, 5], end: [10, 5], visible: true, quality },
      { id: 'lower' as never, type: 'line', start: [-30, -15], end: [10, -15], visible: true, quality }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'face', anchor: { kind: 'nearest', point: [0, 2.5] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const witness: CadDimensionPlacement = { annotationId: 'witness', kind: 'linear', automatic: false, textPosition: [8, 34], rotation: 0,
      textBounds: { minX: 5, maxX: 11, minY: 32, maxY: 36 }, footprint: { width: 6, height: 4, textHeight: 3.5, textGap: 1.5, arrowSize: 3.5, extension: 1, originOffset: 0, dimensionStyle: 'GB_LINEAR' }, arrowsOutside: false,
      line: { start: [-3.5, 30], end: [10, 30], witnessA: [-3.5, 9.75], witnessB: [10, 9.75] } };
    const projected = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [witness] });
    const texture = projected.placements[0]; const tip = texture.leader[texture.leader.length - 1];
    expect(tip[0]).toBeCloseTo(0);
    expect(tip[1]).toBeGreaterThan(6.3);
    expect(tip[1]).toBeLessThan(7);
    expect(texture.box.minY).toBeGreaterThan(2.5);
    expect(texture.box.maxY).toBeGreaterThan(witness.line!.witnessA[1]);
    // Moving the same witness into the actual triangle must reject that pose.
    witness.line!.witnessA = [-3.5, 7];
    const blocked = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [witness] });
    expect(blocked.placements[0].position).not.toEqual(texture.position);
    expect(blocked.placements[0].anchor).toEqual([0, 2.5]);
  });

  it('links an automatic datum to a related diameter extension without changing its geometry anchor', () => {
    const { document, plan } = fixture();
    plan.geometricTolerances = [];
    plan.datums = [{ id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'surface-0', anchor: { kind: 'nearest', point: [10, -10] }, role: 'primary', source: 'document', status: 'confirmed', evidenceIds: [] }];
    document.annotations = [{ id: 'diameter' as never, type: 'dimension', dimensionKind: 'diameter', associationStatus: 'resolved', targets: [{ geometryId: 'surface-0' as never, anchor: { kind: 'nearest', point: [10, -10] } }], textPosition: [-5, 0], definitionPoints: [[-5, -10], [-5, 10], [10, -10], [10, 10]], visible: true, quality }];
    const placement: CadDimensionPlacement = { annotationId: 'diameter', kind: 'diameter', automatic: true, textPosition: [-5, 0], rotation: 90,
      textBounds: { minX: -7, maxX: -3, minY: -5, maxY: 5 }, footprint: { width: 10, height: 3.5, textHeight: 3.5, textGap: 1.5, arrowSize: 3.5, extension: 1, originOffset: 0, dimensionStyle: 'GB_RADIAL' }, arrowsOutside: false,
      line: { start: [-5, -10], end: [-5, 10], witnessA: [10, -10], witnessB: [10, 10] } };
    const projected = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [placement] });
    expect(projected.placements[0]).toMatchObject({ anchor: [10, -10], attachedToDimensionId: 'diameter', leader: expect.arrayContaining([[-5, -10]]) });
    expect(overlap(projected.placements[0].box, placement.textBounds)).toBe(false);
    plan.datums[0].anchor = { kind: 'nearest', point: [10, 10] };
    const upper = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [placement] });
    expect(upper.placements[0]).toMatchObject({ anchor: [10, 10], attachedToDimensionId: 'diameter' });
    expect(upper.placements[0].leader[0]).toEqual([-5, -10]);
    expect(upper.placements[0].box.maxY).toBeLessThanOrEqual(-10);
    document.annotations.push({ id: 'blocked-label' as never, type: 'text', position: [-10, -17], content: 'label', height: 5, alignment: 'left', verticalAlignment: 'baseline', rotation: 0, visible: true, quality });
    const obstructed = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [placement] });
    expect(obstructed.placements[0].position[0]).toBeLessThanOrEqual(-5);
    expect(obstructed.placements[0].box.maxY).toBeLessThanOrEqual(-10);
    expect(obstructed.placements[0].leader[0]).toEqual([-5, -10]);
    document.geometry.push({ id: 'deeper-contour' as never, type: 'line', start: [50, -40], end: [90, -40], visible: true, quality });
    const stepped = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [placement] });
    expect(stepped.placements[0].box.maxY).toBeLessThanOrEqual(-40 - 3.5);
    expect(stepped.placements[0].leader[0]).toEqual([-5, -10]);
  });

  it.each([3.5, 6])('derives an equilateral datum triangle from the configured %s arrow height', (arrowSize) => {
    const { document, plan } = fixture();
    plan.geometricTolerances = [];
    plan.datums = [{ id: 'datum', drawingRef: ref, name: 'A', geometryId: 'surface-0', anchor: { kind: 'start' },
      labelPosition: [5, -30], role: 'primary', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const customProfile = { ...profile, dimensionStyles: profile.dimensionStyles.map((style) => ({ ...style, arrowSize })) };
    const projected = projectCadEngineeringSymbols(plan, document, customProfile, options);
    const triangle = pictures(projected.entities)[0].find((graphic) => graphic.type === 'solid-hatch');
    expect(triangle?.type).toBe('solid-hatch');
    if (triangle?.type !== 'solid-hatch') return;
    triangle.boundary.forEach((point, index) => {
      const next = triangle.boundary[(index + 1) % triangle.boundary.length];
      expect(Math.hypot(point[0] - next[0], point[1] - next[1])).toBeCloseTo(arrowSize * 2 / Math.sqrt(3));
    });
    expect(projected.placements[0].position).toEqual([5, -30]);
  });

  it('keeps upper and lower controlled faces on their respective sides under text pressure', () => {
    const { document, plan } = fixture();
    document.geometry.push({ id: 'upper-face' as never, type: 'line', start: [40, 6], end: [40, 10], visible: true, quality },
      { id: 'lower-face' as never, type: 'line', start: [100, -10], end: [100, -6], visible: true, quality });
    plan.geometricTolerances = [plan.geometricTolerances[0], plan.geometricTolerances[2]].map((intent, index) => ({
      ...intent, controlledTargets: [{ geometryId: index ? 'lower-face' : 'upper-face', anchor: { kind: 'nearest', point: index ? [100, -8] : [40, 8] } }],
    }));
    document.annotations.push({ id: 'upper-label' as never, type: 'text', position: [0, 24], content: 'A long existing upper label', height: 7, alignment: 'left', verticalAlignment: 'baseline', rotation: 0, visible: true, quality });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.placements[0].box.minY).toBeGreaterThan(10);
    expect(projected.placements[1].box.maxY).toBeLessThan(-10);
    expect(projected.placements.map(({ leader }) => leader[0])).toEqual([[40, 8], [100, -8]]);
  });

  it('uses frame ends for associated Ra when a reference label occupies the space above its center', () => {
    const { document, plan } = fixture();
    plan.geometricTolerances = plan.geometricTolerances.slice(0, 2).map((intent) => ({ ...intent, framePosition: [0, 50] }));
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'surface-0', anchor: { kind: 'nearest', point: [10, -10] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    document.annotations.push({ id: 'reference' as never, type: 'text', position: [4, 56], content: '[B]', height: 3.5, alignment: 'left', verticalAlignment: 'baseline', rotation: 0, visible: true, quality });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const frame = projected.placements[0]; const texture = projected.placements[1];
    expect(texture.attachedToGdtIds).toEqual(frame.ids);
    expect(texture.box.minY).toBeCloseTo(frame.box.maxY);
    expect(texture.position[0]).toBeGreaterThanOrEqual(frame.box.minX);
    expect(texture.position[0]).toBeLessThanOrEqual(frame.box.maxX);
  });

  it('keeps a leader when a fallback happens to share the height of a remote related frame', () => {
    const { document, plan } = fixture();
    document.geometry = [{ id: 'upper' as never, type: 'line', start: [-30, 10], end: [30, 10], visible: true, quality },
      { id: 'lower' as never, type: 'line', start: [-30, -10], end: [30, -10], visible: true, quality }];
    plan.geometricTolerances = [{ ...plan.geometricTolerances[0], controlledTargets: [{ geometryId: 'upper', anchor: { kind: 'nearest', point: [0, 10] } }], framePosition: [100, 11.225] }];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'upper', anchor: { kind: 'nearest', point: [0, 10] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    document.annotations.push({ id: 'reserved' as never, type: 'text', position: [100, 16.86136], content: 'RESERVED AREA', height: 12, alignment: 'left', verticalAlignment: 'baseline', rotation: 0, visible: true, quality });
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const texture = projected.placements.find(({ kind }) => kind === 'surface-texture')!;
    expect(texture.position[0]).toBeLessThan(30);
    expect(texture.attachedToGdtIds).toBeUndefined();
    expect(texture.leader[0]).toEqual([0, 10]);
  });

  it.each([false, true])('keeps outer-surface roughness outside the upper contour regardless of line direction (%s)', (reverse) => {
    const { document, plan } = fixture();
    document.geometry = [{ id: 'upper' as never, type: 'line', start: reverse ? [30, 20] : [-30, 20], end: reverse ? [-30, 20] : [30, 20], visible: true, quality },
      { id: 'lower' as never, type: 'line', start: [-30, -20], end: [30, -20], visible: true, quality }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'upper', anchor: { kind: 'nearest', point: [0, 20] } }],
      parameter: 'Ra', value: 0.8, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.placements[0].box.minY).toBeGreaterThanOrEqual(20);
  });

  it('places ungrouped roughness in nearby clear bore space instead of a global annotation row', () => {
    const { document, plan } = fixture();
    document.geometry = [{ id: 'upper' as never, type: 'line', start: [-30, 10], end: [30, 10], visible: true, quality },
      { id: 'lower' as never, type: 'line', start: [-30, -10], end: [30, -10], visible: true, quality },
      { id: 'outer-upper' as never, type: 'line', start: [-30, 20], end: [30, 20], visible: true, quality },
      { id: 'outer-lower' as never, type: 'line', start: [-30, -20], end: [30, -20], visible: true, quality }];
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'bore-texture', drawingRef: ref, controlledTargets: [{ geometryId: 'upper', anchor: { kind: 'nearest', point: [0, 10] } }],
      parameter: 'Ra', value: 1.6, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(projected.placements[0].box.maxY).toBeLessThan(10);
    expect(projected.placements[0].box.minY).toBeGreaterThan(-10);
    expect(projected.placements[0].anchor).toEqual([0, 10]);
  });

  it.each([-1, 1])('places sloped inner-opening roughness inside the nearby bore at either end (%s)', (end) => {
    const { document, plan } = fixture();
    document.geometry = [10, -10, 20, -20].map((y, index) => ({ id: `line:${index}` as never, type: 'line', start: [index < 2 ? -26 : -30, y], end: [index < 2 ? 26 : 30, y], visible: true, quality }));
    document.geometry.push({ id: 'opening' as never, type: 'line', start: [end * 26, 10], end: [end * 30, 14], visible: true, quality });
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'opening', anchor: { kind: 'nearest', point: [end * 28, 12] } }],
      parameter: 'Ra', value: 1.6, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(plan, document, profile, options);
    const texture = projected.placements[0];
    expect(texture.box.minY).toBeGreaterThan(-10);
    expect(texture.box.maxY).toBeLessThan(10);
    expect(texture.box.minX).toBeGreaterThan(-30);
    expect(texture.box.maxX).toBeLessThan(30);
    expect(Math.hypot(texture.position[0] - texture.anchor[0], texture.position[1] - texture.anchor[1])).toBeLessThan(35);
  });

  it('finds bore space between nearby dimension labels and routes its leader around them', () => {
    const { document, plan } = fixture();
    document.geometry = [10, -10, 20, -20].map((y, index) => ({ id: `line:${index}` as never, type: 'line', start: [-40, y], end: [index < 2 ? 36 : 40, y], visible: true, quality }));
    document.geometry.push({ id: 'opening' as never, type: 'line', start: [36, 10], end: [40, 14], visible: true, quality });
    plan.geometricTolerances = [];
    plan.surfaceTextures = [{ id: 'texture', drawingRef: ref, controlledTargets: [{ geometryId: 'opening', anchor: { kind: 'nearest', point: [38, 12] } }],
      parameter: 'Ra', value: 1.6, unit: 'um', materialRemoval: 'required', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const dimensions: CadDimensionPlacement[] = [12, 30].map((x) => ({ annotationId: `obstacle:${x}`, kind: 'linear', automatic: false, textPosition: [x, 0], rotation: 0,
      textBounds: { minX: x, maxX: x + 3, minY: -10, maxY: 10 }, footprint: { width: 3, height: 20, textHeight: 3.5, textGap: 1.5, arrowSize: 3.5, extension: 1, originOffset: 0, dimensionStyle: 'GB_LINEAR' }, arrowsOutside: false }));
    const projected = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: dimensions });
    const texture = projected.placements[0];
    expect(texture.box.minX).toBeGreaterThan(15);
    expect(texture.box.maxX).toBeLessThan(30);
    expect(texture.box.minY).toBeGreaterThan(-10);
    expect(texture.box.maxY).toBeLessThan(10);
    expect(texture.leader[0]).toEqual([38, 12]);
    expect(texture.leader[1][1]).toBe(12);
    for (let index = 1; index < texture.leader.length; index++) {
      const a = texture.leader[index - 1]; const b = texture.leader[index];
      for (let step = 1; step < 25; step++) {
        const x = a[0] + (b[0] - a[0]) * step / 25; const y = a[1] + (b[1] - a[1]) * step / 25;
        expect(x > texture.box.minX + 1e-8 && x < texture.box.maxX - 1e-8 && y > texture.box.minY + 1e-8 && y < texture.box.maxY - 1e-8).toBe(false);
      }
    }
  });

  it('avoids dimension text and manually reserved frame bounds without modifying stored positions', () => {
    const { document, plan } = fixture();
    plan.geometricTolerances = plan.geometricTolerances.slice(0, 4);
    plan.geometricTolerances[0].framePosition = [4, 29.6];
    plan.geometricTolerances[1].framePosition = [4, 29.6];
    const blocked: CadDimensionPlacement = { annotationId: 'reserved', kind: 'linear', automatic: false, textPosition: [50, 29.6], rotation: 0,
      textBounds: { minX: 35, maxX: 65, minY: 15, maxY: 35 }, footprint: { width: 30, height: 20, textHeight: 3.5, textGap: 1.5, arrowSize: 3.5, extension: 1, originOffset: 0, dimensionStyle: 'GB_LINEAR' }, arrowsOutside: false };
    const projected = projectCadEngineeringSymbols(plan, document, profile, { ...options, dimensionPlacements: [blocked] });
    const manual = projected.placements.find(({ automatic }) => !automatic)!;
    const automatic = projected.placements.find(({ automatic }) => automatic)!;
    expect(manual.position).toEqual([4, 29.6]);
    expect(overlap(automatic.box, blocked.textBounds)).toBe(false);
    expect(overlap(automatic.box, manual.box)).toBe(false);
  });

  it('is translation invariant and resolves a curve anchor while refusing missing geometry', () => {
    const { document, plan } = fixture();
    const original = projectCadEngineeringSymbols(plan, document, profile, options);
    const delta: Vec2 = [230, -90];
    document.geometry.forEach((node) => { if (node.type === 'line') { node.start = [node.start[0] + delta[0], node.start[1] + delta[1]]; node.end = [node.end[0] + delta[0], node.end[1] + delta[1]]; } });
    plan.geometricTolerances.forEach((intent) => intent.controlledTargets.forEach((target) => { if (target.anchor?.kind === 'nearest') target.anchor.point = [target.anchor.point[0] + delta[0], target.anchor.point[1] + delta[1]]; }));
    const translated = projectCadEngineeringSymbols(plan, document, profile, options);
    translated.placements.forEach((placement, index) => expect(placement.position).toEqual([original.placements[index].position[0] + delta[0], original.placements[index].position[1] + delta[1]]));
    document.geometry = [{ id: 'round' as never, type: 'circle', center: [5, 7], radius: 4, visible: true, quality }];
    plan.geometricTolerances = [];
    plan.datums = [{ id: 'curve', drawingRef: ref, name: 'A', geometryId: 'round', anchor: { kind: 'curve-parameter', parameter: Math.PI / 2 }, role: 'primary', source: 'document', status: 'confirmed', evidenceIds: [] },
      { id: 'missing', drawingRef: ref, name: 'B', geometryId: 'missing', anchor: { kind: 'nearest', point: [0, 0] }, role: 'secondary', source: 'document', status: 'confirmed', evidenceIds: [] }];
    const curve = projectCadEngineeringSymbols(plan, document, profile, options);
    expect(curve.placements).toHaveLength(1);
    expect(curve.placements[0].anchor[0]).toBeCloseTo(5);
    expect(curve.placements[0].anchor[1]).toBeCloseTo(11);
  });
});
