// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createEmptyDrawing, exportDrawingDxf } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { normalizeCadDxf } from './cad-dxf-normalizer';
import { inspectCadContract } from './cad-test-inspector';
import { CAXA_COMPATIBLE_DXF_PROFILE } from './gb-cad-profile';
import { exportEngineeringDrawingDxf } from './engineering-dxf-export';

const goldenPath = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001/target.dxf');

describe('golden CAD export contract', () => {
  it('uses the golden layer, dimension style, entity-kind, arrow and text contracts', () => {
    const golden = inspectCadContract(readFileSync(goldenPath, 'utf8'));
    const document = createEmptyDrawing({ idFactory: { next: () => 'cad-contract' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft-edge' as never, type: 'line', start: [0, -10], end: [50, -10], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    document.annotations = [{
      id: 'diameter' as never, type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'diameter', associationStatus: 'resolved',
      targets: [{ geometryId: 'shaft-edge' as never, anchor: { kind: 'start' } }],
      computedValue: 20, displayText: '⌀20', unit: 'mm',
      textPosition: [-8, 0], definitionPoints: [[0, -10], [0, 10], [-8, 0]],
    }];
    const actual = inspectCadContract(normalizeCadDxf(exportDrawingDxf(document, { profile: CAXA_COMPATIBLE_DXF_PROFILE })));

    expect(actual.version).toBe(golden.version);
    expect(actual.layers['7标注层']).toEqual(golden.layers['7标注层']);
    expect(actual.dimensionStyles.GB_LINEAR).toEqual(golden.dimensionStyles.GB_LINEAR);
    expect(actual.dimensionPictures).toEqual({ hasMText: true, hasHatchArrowheads: true });
    expect(actual.dimensionKinds.diametric).toBe(1);
    expect(actual.dimensionKinds.linear).toBe(0);
  });

  it('preserves the golden 45 degree section hatch through CAD normalization', () => {
    const golden = inspectCadContract(readFileSync(goldenPath, 'utf8'));
    const document = createEmptyDrawing({ idFactory: { next: () => 'cad-hatch' }, now: () => 1 });
    document.annotations = [{
      id: 'section' as never, type: 'section-hatch', visible: true, pattern: 'ANSI31', angle: 45, spacing: 3.175,
      quality: { status: 'confirmed', evidenceRefs: [] },
      hatch: {
        version: 1, style: 'normal', elevation: 0, extrusion: [0, 0, 1], patternAngle: 0,
        patternScale: 1, double: false,
        boundaryPaths: [{ flags: 1, closed: true, edges: [
          { type: 'line', start: [0, 0], end: [10, 0] }, { type: 'line', start: [10, 0], end: [10, 10] },
          { type: 'line', start: [10, 10], end: [0, 10] }, { type: 'line', start: [0, 10], end: [0, 0] },
        ] }],
        patternLines: [{ angle: 45, base: [0, 0], offset: [-2.245064030267287, 2.245064030267287], dashLengths: [] }],
      },
    }];
    const actual = inspectCadContract(exportEngineeringDrawingDxf(document, {
      version: 1, phase: 'idle', drawingRef: { drawingId: document.id, revision: 1 }, canUndo: false, canRedo: false, updatedAt: 1,
    }));
    expect(actual.sectionHatchAngles).toEqual([45]);
    expect(new Set(actual.sectionHatchAngles)).toEqual(new Set(golden.sectionHatchAngles));
  });

  it('writes GB tolerances as a native stacked DIMENSION override', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'cad-tolerance' }, now: () => 1 });
    document.annotations = [{
      id: 'dimension-tolerance' as never, type: 'dimension', dimensionKind: 'linear',
      associationStatus: 'resolved', targets: [], computedValue: 28, displayText: '28', unit: 'mm',
      textPosition: [14, 10], definitionPoints: [[0, 0], [28, 0], [0, 10], [28, 10]],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
      toleranceProjection: {
        mode: 'bilateral', upperDeviation: -0.1, lowerDeviation: -0.2, unit: 'mm',
        source: 'document', status: 'confirmed', evidenceRefs: [],
      },
    }];

    const dxf = exportDrawingDxf(document, { profile: CAXA_COMPATIBLE_DXF_PROFILE });

    expect(dxf).toContain('\\A1;<>{\\C2;{\\H0.71x;\\S-0.1^-0.2;}}');
    expect(dxf).not.toContain('28 -0.1/-0.2');
  });
});
