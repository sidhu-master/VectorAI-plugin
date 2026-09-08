// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEmptyDrawing, projectDimensionPicture, type DimensionAnnotation } from '@vectorai/drawing-core';
import { analyzeShaftPartition, inferRegularShaftRegions } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { importDxf } from '../../dxf-import/src';
import { projectEngineeringCadDrawing, projectCadEngineeringSymbols, CAXA_COMPATIBLE_DXF_PROFILE } from '@vectorai/drawing-cad';
import { resolveShaftGdtRules } from './shaft-gdt-rules';
import { groundSegmentRecommendation } from './gdt-reviewer';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };
const profile = CAXA_COMPATIBLE_DXF_PROFILE;
const options = { caxaCompatible: true, includeCandidates: true, planConfirmed: false };
function fixture() {
  const document = createEmptyDrawing();
  document.geometry = [10, -10].map((y, index) => ({ id: `face${index}` as never, type: 'line', start: [0, y], end: [20, y], visible: true, quality }));
  const draft: EngineeringAnnotationDraft = { version: 1, drawingRef: { drawingId: 'test', revision: 1 },
    datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [], surfaceTextures: [], chains: [], dependencies: [], diagnostics: [] };
  return { document, draft };
}

describe('real engineering binding and paper regressions', () => {
  it.each([-1, 0, 1])('keeps a dimension line continuous below an above-line label with near-horizontal slope %s', (sign) => {
    const slope = sign * 7.920909e-6;
    const node: DimensionAnnotation = { id: 'd' as never, type: 'dimension', dimensionKind: 'linear', associationStatus: 'resolved',
      visible: true, quality, targets: [], computedValue: 173, textPosition: [86.5, 23.25],
      definitionPoints: [[0, 0], [173, 0], [0, 20 - 86.5 * slope], [173, 20 + 86.5 * slope]], unit: 'mm' };
    const presentation = { textBounds: { minX: 82.7, maxX: 90.3, minY: 20, maxY: 26.5 } };
    const graphics = projectDimensionPicture(node, profile, 'mm', presentation, [presentation.textBounds]);
    const lines = graphics.filter((g) => g.type === 'line' && g.color === undefined);
    expect(lines).toEqual([{ type: 'line', layer: profile.semanticLayers.dimension,
      start: node.definitionPoints[2], end: node.definitionPoints[3] }]);
  });

  it('retains a datum diameter attachment when its marker becomes manually positioned', () => {
    const { document, draft } = fixture();
    document.annotations = [{ id: 'diameter' as never, type: 'dimension', dimensionKind: 'diameter', visible: true, quality,
      associationStatus: 'resolved', computedValue: 20, targets: [{ geometryId: 'face0' as never, anchor: { kind: 'start' } }],
      definitionPoints: [[10, 10], [10, -10], [30, 10], [30, -10]], textPosition: [30, 0], layout: { mode: 'manual' } }];
    draft.datums = [{ id: 'A', name: 'A', geometryId: 'face0', anchor: { kind: 'nearest', point: [10, 10] },
      drawingRef: draft.drawingRef, role: 'primary', status: 'candidate', source: 'ai-candidate', evidenceIds: [] }];
    const scene = projectEngineeringCadDrawing(document, { version: 1, phase: 'editing', draft, canUndo: false, canRedo: false, updatedAt: 1 }, { profile: 'caxa-compatible', purpose: 'canvas' });
    const before = scene.symbolPlacements[0];
    draft.datums[0].labelPosition = [before.position[0] + 5, before.position[1] - 3];
    const after = projectCadEngineeringSymbols(draft, scene.document, profile, { ...options, dimensionPlacements: scene.dimensionPlacements }).placements[0];
    expect(after.leader[0]).toEqual(before.leader[0]);
    expect(after.attachedToDimensionId).toBe('diameter');
    expect(after.position).toEqual(draft.datums[0].labelPosition);
  });

  it('keeps a datum on its real surface when the associated diameter was laid out far away', () => {
    const { document, draft } = fixture();
    document.annotations = [{ id: 'far-diameter' as never, type: 'dimension', dimensionKind: 'diameter', visible: true, quality,
      associationStatus: 'resolved', computedValue: 20, targets: [{ geometryId: 'face0' as never, anchor: { kind: 'start' } }],
      definitionPoints: [[10, 10], [10, -10], [150, 10], [150, -10]], textPosition: [150, 0], layout: { mode: 'automatic' } }];
    draft.datums = [{ id: 'A', name: 'A', geometryId: 'face0', anchor: { kind: 'nearest', point: [10, 10] },
      drawingRef: draft.drawingRef, role: 'primary', status: 'candidate', source: 'ai-candidate', evidenceIds: [] }];
    const projected = projectCadEngineeringSymbols(draft, document, profile, {
      ...options,
      dimensionPlacements: [{
        annotationId: 'far-diameter', kind: 'diameter', automatic: true, textPosition: [150, 0], rotation: 90,
        textBounds: { minX: 145, minY: -2, maxX: 155, maxY: 2 },
        footprint: { width: 10, height: 3.5, textHeight: 3.5, textGap: 1.5, arrowSize: 3.5, dimensionStyle: 'GB_LINEAR', extension: 1, originOffset: 0 },
        arrowsOutside: false, line: { witnessA: [10, 10], witnessB: [10, -10], start: [150, 10], end: [150, -10] },
      }],
    }).placements[0];
    expect(projected.anchor).toEqual([10, 10]);
    expect(projected.leader[0]).toEqual([10, 10]);
    expect(projected.attachedToDimensionId).toBeUndefined();
  });

  it('keeps different controlled surfaces in separate frames even at the same manual position', () => {
    const { document, draft } = fixture();
    draft.geometricTolerances = document.geometry.map((geometry, index) => ({ id: `g${index}`, drawingRef: draft.drawingRef,
      characteristic: 'circularity', controlledTargets: [{ geometryId: geometry.id, anchor: { kind: 'start' } }],
      toleranceZone: { shape: 'linear' }, datumReferenceFrame: [], framePosition: [50, 40],
      computed: { status: 'pending', unit: 'mm', diagnostics: [] }, status: 'pending-calculation', source: 'ai-candidate', evidenceIds: [] }));
    const projected = projectCadEngineeringSymbols(draft, document, profile, options);
    expect(projected.placements.map(({ ids }) => ids)).toEqual([['g0'], ['g1']]);
  });

  it('grounds initial DXF plus document on distinct bearing cylinders without substituting golden target bindings', () => {
    const dir = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');
    const imported = importDxf({ bytes: readFileSync(resolve(dir, 'initial.dxf')), source: { name: 'initial.dxf', digest: 'sha256:binding-regression' }, drawingId: 'binding-regression', now: () => 1 });
    if (imported.status !== 'imported') throw new Error('import failed');
    const analyzed = analyzeShaftPartition({ document: imported.document, drawingRef: { drawingId: 'binding-regression', revision: 1 },
      engineeringText: readFileSync(resolve(dir, 'engineering-data.ini'), 'utf8'), drawingSourceName: 'initial.dxf' });
    if (analyzed.status !== 'drafted') throw new Error('partition failed');
    const partition = inferRegularShaftRegions(analyzed.draft);
    const recommendation = resolveShaftGdtRules(partition).recommendation;
    const grounded = groundSegmentRecommendation(imported.document.geometry, partition, recommendation);
    const nodeById = new Map(imported.document.geometry.map((node) => [String(node.id), node]));
    const cylinder = (id: string, side?: number) => {
      const node = nodeById.get(id)!;
      expect(node.type).toBe('line');
      if (node.type !== 'line') throw new Error('not line');
      const x = (node.start[0] + node.end[0]) / 2 - partition.axis.origin[0];
      const y = (node.start[1] + node.end[1]) / 2 - partition.axis.origin[1];
      const signedRadius = x * partition.axis.normal[0] + y * partition.axis.normal[1];
      expect(Math.abs(signedRadius)).toBeCloseTo(17.5, 2);
      if (side !== undefined) expect(Math.sign(signedRadius)).toBe(side);
      return x * partition.axis.direction[0] + y * partition.axis.direction[1];
    };
    const stations = grounded.datums.map(({ geometryId }) => cylinder(geometryId, -1)).sort((a, b) => a - b);
    expect(stations[0]).toBeGreaterThan(0); expect(stations[0]).toBeLessThan(17);
    expect(stations[1]).toBeGreaterThan(150); expect(stations[1]).toBeLessThan(173);
    for (const control of grounded.controls.filter(({ characteristic }) => characteristic !== 'circular-runout')) {
      expect(control.geometryIds).toHaveLength(1);
      cylinder(control.geometryIds[0], 1);
    }
    for (const texture of grounded.surfaceTextures ?? []) {
      expect(texture.geometryIds).toHaveLength(1); cylinder(texture.geometryIds[0], 1);
    }
  });
});
