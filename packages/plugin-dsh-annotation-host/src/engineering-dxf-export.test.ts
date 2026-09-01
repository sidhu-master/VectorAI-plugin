// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation } from '@vectorai/drawing-core';
import { createGbt1800Provider, type EngineeringAnnotationDraft } from '@vectorai/engineering-annotation';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { exportEngineeringDrawingDxf } from './engineering-dxf-export';
import { inspectCadContract } from './cad-test-inspector';
import { DimensionPlanStore } from './dimension-plan-store';
import { createToleranceReconciler, ToleranceService } from './tolerance-service';

const ref = { drawingId: 'drawing-golden', revision: 2 };

describe('exportEngineeringDrawingDxf', () => {
  it('uses the generic GB profile by default instead of leaking CAXA fixture styles', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'generic-cad' }, now: () => 1 });

    const dxf = exportEngineeringDrawingDxf(document, {
      version: 1, phase: 'idle', drawingRef: { drawingId: document.id, revision: 1 },
      canUndo: false, canRedo: false, updatedAt: 1,
    });

    expect(dxf).not.toContain('SLDTEXTSTYLE0');
    expect(dxf).not.toContain('ZWISOGDT');
  });

  it('preserves ordered UTF-8 tolerance XDATA chunks through CAD normalization', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-long-tolerance-xdata' }, now: () => 1 });
    const standardRef = { id: '国家标准公差数据'.repeat(80), edition: '二〇二六版'.repeat(30) };
    document.annotations = [{
      id: 'dimension-long-tolerance' as never, type: 'dimension', dimensionKind: 'diameter',
      associationStatus: 'resolved', targets: [], computedValue: 13, displayText: '⌀13', unit: 'mm',
      textPosition: [0, 5], definitionPoints: [[-6.5, 0], [6.5, 0]], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      toleranceProjection: {
        mode: 'bilateral', fitDesignation: 'u6', upperDeviation: .044, lowerDeviation: .033,
        unit: 'mm', source: 'standard', status: 'confirmed', featureClass: 'external',
        standardRef, displayPreference: 'both', evidenceRefs: ['standard:u6'],
      },
    }];
    const expected = JSON.stringify({
      version: 1, designation: 'u6', upperDeviation: .044, lowerDeviation: .033,
      unit: 'mm', featureClass: 'external', standardRef,
    });

    const dxf = exportEngineeringDrawingDxf(document, {
      version: 1, phase: 'idle', drawingRef: { drawingId: document.id, revision: 1 },
      canUndo: false, canRedo: false, updatedAt: 1,
    });
    const values = vectorAiXDataStrings(dxf);
    const metadata = JSON.parse(values[0]!);
    const encoder = new TextEncoder();

    expect(values.length).toBeGreaterThan(2);
    expect(values.every((value) => encoder.encode(value).byteLength <= 254)).toBe(true);
    expect(metadata).toMatchObject({
      version: 1, format: 'vectorai-tolerance-json', encoding: 'utf-8',
      chunkCount: values.length - 1, byteLength: encoder.encode(expected).byteLength,
    });
    expect(values.slice(1).join('')).toBe(expected);
  });

  it('uses native dimensions and anonymous symbol blocks like the golden CAD sample', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-golden' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const plan = snapshot({
      datumStatus: 'confirmed', gdtStatus: 'confirmed', computedStatus: 'resolved', computedValue: 0.015,
    });

    const dxf = exportEngineeringDrawingDxf(document, plan, { profile: 'caxa-compatible' });

    expect(entityCount(dxf, 'DIMENSION')).toBeGreaterThanOrEqual(1);
    expect(entityCount(dxf, 'INSERT')).toBeGreaterThanOrEqual(2);
    expect(dxf).toContain('0.015');
    expect(dxf).toContain('A');
    expect(dxf).toContain('{\\Famgdt;h}');
    expect(dxf).toContain('{\\Fisocp,GBCBIG;\\W0.707;A}');
    expect(entityCount(dxf, 'HATCH')).toBeGreaterThanOrEqual(3);
    expect(entityCount(dxf, 'TOLERANCE')).toBe(0);
    expect(dxf).toContain('$HANDSEED');
    expect(dxf).toContain('OBJECTS');
    expect(dxf).toContain('UTF-8');
    expect(dxf).toMatch(/\r\n330\r\n/);
    const golden = inspectCadContract(readFileSync(resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001/target.dxf'), 'utf8'));
    expect(inspectCadContract(dxf).symbolPictureColors).toEqual(golden.symbolPictureColors);
  });

  it('preserves confirmed-plan datum and unresolved GD&T structure without inventing a tolerance value', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-golden' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];

    const dxf = exportEngineeringDrawingDxf(document, snapshot({
      datumStatus: 'candidate', gdtStatus: 'pending-calculation', computedStatus: 'pending',
    }));

    expect(dxf).toContain('待计算');
    expect(dxf).toContain('A');
    expect(dxf).not.toMatch(/0\.00[0-9]/);
    expect(entityCount(dxf, 'INSERT')).toBe(2);
  });

  it('does not inject legacy tolerance magnitudes into unresolved bearing controls', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-gdt-pending' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const plan = snapshot({ datumStatus: 'confirmed', gdtStatus: 'pending-calculation', computedStatus: 'pending' });
    const base = plan.confirmed!.geometricTolerances[0]!;
    plan.confirmed!.geometricTolerances = [
      { ...structuredClone(base), id: 'bearing:circularity', characteristic: 'circularity' },
      { ...structuredClone(base), id: 'bearing:cylindricity', characteristic: 'cylindricity' },
      { ...structuredClone(base), id: 'bearing:runout', characteristic: 'total-runout' },
    ];

    const dxf = exportEngineeringDrawingDxf(document, plan);

    expect(dxf).toContain('待计算');
    expect(dxf).not.toMatch(/0\.(003|005|01|015)/);
  });

  it('preserves a dimension-chain closure as a native dimension on a dashed CAD layer', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-closure' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const plan = snapshot({
      datumStatus: 'confirmed', gdtStatus: 'confirmed', computedStatus: 'resolved', computedValue: 0.015,
    });
    plan.confirmed!.axialScheme = {
      ...plan.confirmed!.axialScheme!,
      topology: {
        ...plan.confirmed!.axialScheme!.topology,
        axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
        stations: [
          { id: 's0', coordinate: 0, sourceCoordinate: 0, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
          { id: 's1', coordinate: 60, sourceCoordinate: 60, unit: 'mm', kinds: ['step'], geometryNodeIds: ['shaft'], evidenceIds: [] },
          { id: 's2', coordinate: 100, sourceCoordinate: 100, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
        ],
      },
      candidates: [
        { id: 'shown', startStationId: 's0', endStationId: 's1', nominalValue: 60, roles: ['functional'], evidenceIds: [], required: true },
        { id: 'closure', startStationId: 's1', endStationId: 's2', nominalValue: 40, roles: ['closure'], evidenceIds: [], required: true },
      ],
      displayedCandidateIds: ['shown'],
      closureCandidateIds: ['closure'],
      chains: [{
        id: 'chain', parentCandidateId: 'shown', childCandidateIds: [], closureCandidateId: 'closure',
        alternativeClosureCandidateIds: [], status: 'resolved',
      }],
    } as NonNullable<typeof plan.confirmed>['axialScheme'];

    const dxf = exportEngineeringDrawingDxf(document, plan);

    expect(dxf).toMatch(/0\r\nLAYER[\s\S]*?2\r\n7标注缺省层[\s\S]*?6\r\nDASHED2/);
    expect(dxf).toMatch(/0\r\nDIMENSION[\s\S]*?8\r\n7标注缺省层/);
  });

  it('places longer axial dimensions farther outside than shorter dimensions regardless of input order', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-length-order' }, now: () => 1 });
    document.geometry = [{
      id: 'shaft' as never, type: 'line', start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const plan = snapshot({
      datumStatus: 'confirmed', gdtStatus: 'confirmed', computedStatus: 'resolved', computedValue: 0.015,
    });
    plan.confirmed!.axialScheme = {
      ...plan.confirmed!.axialScheme!,
      topology: {
        ...plan.confirmed!.axialScheme!.topology,
        stations: [
          { id: 's0', coordinate: 0, sourceCoordinate: 0, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
          { id: 's1', coordinate: 10, sourceCoordinate: 10, unit: 'mm', kinds: ['step'], geometryNodeIds: ['shaft'], evidenceIds: [] },
          { id: 's2', coordinate: 100, sourceCoordinate: 100, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
        ],
      },
      candidates: [
        { id: 'long', startStationId: 's0', endStationId: 's2', nominalValue: 100, roles: ['overall'], evidenceIds: [], required: true },
        { id: 'short', startStationId: 's0', endStationId: 's1', nominalValue: 10, roles: ['functional'], evidenceIds: [], required: true },
      ],
      displayedCandidateIds: ['long', 'short'], closureCandidateIds: [], chains: [],
    } as NonNullable<typeof plan.confirmed>['axialScheme'];

    const dimensions = nativeDimensions(exportEngineeringDrawingDxf(document, plan));
    const long = dimensions.find(({ measurement }) => measurement === 100);
    const short = dimensions.find(({ measurement }) => measurement === 10);

    expect(long).toBeDefined();
    expect(short).toBeDefined();
    expect(Math.abs(long!.normalCoordinate)).toBeGreaterThan(Math.abs(short!.normalCoordinate));
  });

  it('applies, exports, undoes, and redoes u6 while preserving every unrelated annotation family', () => {
    const workflowRef = { drawingId: 'drawing-tolerance-workflow', revision: 1 } as const;
    const document = createEmptyDrawing({ idFactory: { next: () => workflowRef.drawingId }, now: () => 1 });
    document.geometry = [
      { id: 'shaft-edge' as never, type: 'line', start: [0, 0], end: [13, 0], visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, sourceRef: { sourceId: 'source', layer: '1轮廓实线层' } },
      { id: 'datum-edge' as never, type: 'line', start: [0, -5], end: [0, 5], visible: true, quality: { status: 'confirmed', evidenceRefs: [] }, sourceRef: { sourceId: 'source', layer: '3中心线层' } },
    ];
    const dimension = (
      id: string,
      engineeringIntentId: string,
      dimensionKind: DimensionAnnotation['dimensionKind'],
      value: number,
      y: number,
    ): DimensionAnnotation => ({
      id: id as never, type: 'dimension', dimensionKind, associationStatus: 'resolved', targets: [],
      computedValue: value, displayText: String(value), unit: dimensionKind === 'angular' ? 'deg' : 'mm',
      textPosition: [6.5, y], definitionPoints: [[0, 0], [13, 0]], engineeringIntentId,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
      sourceRef: { sourceId: 'source', layer: dimensionKind === 'angular' ? '8符号标注层' : '7标注层' },
    });
    document.annotations = [
      dimension('dimension-target', 'intent-target', 'linear', 13, 5),
      {
        ...dimension('dimension-diameter', 'intent-diameter', 'diameter', 13, 10),
        toleranceProjection: {
          mode: 'bilateral' as const, fitDesignation: 'H7', upperDeviation: .018, lowerDeviation: 0,
          unit: 'mm' as const, source: 'standard' as const, status: 'confirmed' as const,
          featureClass: 'internal' as const, standardRef: { id: 'GB/T 1800', edition: '2020' },
          displayPreference: 'both' as const, evidenceRefs: ['existing:H7'],
        },
      },
      {
        ...dimension('dimension-opening-angle', 'intent-angle', 'angular', 45, 15),
        toleranceProjection: {
          mode: 'bilateral' as const, fitDesignation: 'OLD9', upperDeviation: .123, lowerDeviation: -.111,
          unit: 'deg' as const, source: 'document' as const, status: 'confirmed' as const,
          displayPreference: 'both' as const, evidenceRefs: ['existing:stale'],
        },
      },
      {
        id: 'section' as never, type: 'section-hatch', pattern: 'ANSI31', angle: 45, spacing: 2,
        segments: [{ start: [1, -1], end: [3, 1] }], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] }, sourceRef: { sourceId: 'source', layer: '5剖面线层' },
      },
    ];
    const draft: EngineeringAnnotationDraft = {
      version: 1,
      drawingRef: workflowRef,
      datums: [{
        id: 'datum:A', drawingRef: workflowRef, name: 'A', geometryId: 'datum-edge' as never,
        anchor: { kind: 'start' }, role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum'],
      }],
      intents: [
        { id: 'intent-target', drawingRef: workflowRef, kind: 'linear', targets: [], datumIds: ['datum:A'], nominalValue: 13, unit: 'mm', functionalRole: 'functional', source: 'manual', status: 'confirmed', evidenceIds: [] },
        { id: 'intent-diameter', drawingRef: workflowRef, kind: 'diameter', targets: [], datumIds: [], nominalValue: 13, unit: 'mm', functionalRole: 'inspection', source: 'geometry', status: 'confirmed', evidenceIds: [] },
        { id: 'intent-angle', drawingRef: workflowRef, kind: 'angular', targets: [], datumIds: [], nominalValue: 45, unit: 'deg', functionalRole: 'inspection', source: 'geometry', status: 'resolved', evidenceIds: [] },
      ],
      tolerances: [{
        id: 'tolerance:stale-angle', dimensionIntentId: 'intent-angle', mode: 'bilateral', source: 'document',
        inputs: {}, status: 'stale', evidenceIds: ['stale:angle'], diagnostics: [],
      }],
      fitAssignments: [],
      geometricTolerances: [{
        id: 'gdt:runout', drawingRef: workflowRef, characteristic: 'circular-runout',
        controlledTargets: [{ geometryId: 'shaft-edge' as never, anchor: { kind: 'end' } }],
        toleranceZone: { shape: 'linear' }, datumReferenceFrame: [{ datumId: 'datum:A' }],
        computed: { status: 'resolved', value: .01, unit: 'mm', diagnostics: [] },
        source: 'manual', status: 'confirmed', evidenceIds: [],
      }],
      chains: [{
        id: 'chain:target', drawingRef: workflowRef, datumIds: ['datum:A'],
        members: [
          { dimensionIntentId: 'intent-target', coefficient: 1, role: 'component' },
          { dimensionIntentId: 'intent-diameter', coefficient: -1, role: 'closure' },
        ],
        equation: { closureIntentId: 'intent-diameter' }, analysisMode: 'reference-only',
        status: 'resolved', evidenceIds: [], diagnostics: [],
      }],
      dependencies: [{ beforeIntentId: 'intent-target', afterIntentId: 'intent-diameter', reason: 'component-before-closure', evidenceIds: [] }],
      diagnostics: [],
    };
    const provider = createGbt1800Provider();
    const plans = new DimensionPlanStore(undefined, { now: () => 7, id: () => 'revision-workflow' }, createToleranceReconciler(provider));
    plans.begin('workflow', workflowRef);
    plans.setDraft('workflow', draft);
    const service = new ToleranceService(plans, provider);
    const before = plans.get('workflow').draft!;

    const applied = service.edit('workflow', {
      type: 'standard.single.apply', expectedDrawingRef: workflowRef, dimensionIntentId: 'intent-target',
      featureClass: 'external', designation: 'u6', selectionSource: 'manual', displayPreference: 'both',
      evidenceRefs: ['manual:u6'],
    });
    const appliedWithoutTargetTolerance = {
      ...applied.draft!,
      tolerances: applied.draft!.tolerances.filter(({ dimensionIntentId }) => dimensionIntentId !== 'intent-target'),
    };
    expect(appliedWithoutTargetTolerance).toEqual(before);
    const appliedDxf = exportEngineeringDrawingDxf(document, applied);
    expect(appliedDxf).toContain('u6');
    expect(appliedDxf).toContain('\\S+0.044^+0.033;');
    expect(appliedDxf).toContain('H7');
    expect(appliedDxf).not.toContain('OLD9');
    expect(appliedDxf).toContain('VECTORAI');
    expect(appliedDxf).toContain('1轮廓实线层');
    expect(appliedDxf).toContain('3中心线层');
    expect(appliedDxf).toContain('5剖面线层');
    expect(appliedDxf).toContain('8符号标注层');
    expect(entityCount(appliedDxf, 'DIMENSION')).toBe(3);
    expect(appliedDxf).toContain('100\r\nAcDbDiametricDimension');
    expect(entityCount(appliedDxf, 'HATCH')).toBeGreaterThanOrEqual(1);
    expect(appliedDxf).toContain('0.01');
    expect(appliedDxf).toContain('A');

    const undone = plans.undo('workflow', workflowRef);
    expect(undone.draft).toEqual(before);
    const undoneDxf = exportEngineeringDrawingDxf(document, undone);
    expect(undoneDxf).not.toContain('"designation":"u6"');
    expect(undoneDxf).toContain('"designation":"H7"');
    expect(undoneDxf).not.toContain('OLD9');

    const redone = plans.redo('workflow', workflowRef);
    expect(redone.draft).toEqual(applied.draft);
    expect(exportEngineeringDrawingDxf(document, redone)).toContain('"designation":"u6"');
  });
});

function snapshot(options: {
  datumStatus: 'candidate' | 'confirmed';
  gdtStatus: 'pending-calculation' | 'confirmed';
  computedStatus: 'pending' | 'resolved';
  computedValue?: number;
}): DimensionPlanSessionSnapshot {
  return {
    version: 1, phase: 'confirmed', drawingRef: ref, canUndo: false, canRedo: false, updatedAt: 1,
    confirmed: {
      version: 1, drawingRef: ref, id: 'revision-1', generationOrder: [], confirmedAt: 1,
      datums: [{
        id: 'datum:A', drawingRef: ref, name: 'A', geometryId: 'shaft', anchor: { kind: 'start' },
        role: 'primary', source: 'geometry', status: options.datumStatus, evidenceIds: [],
      }],
      intents: [], tolerances: [], chains: [], dependencies: [], diagnostics: [],
      geometricTolerances: [{
        id: 'gdt:1', drawingRef: ref, characteristic: 'circular-runout',
        controlledTargets: [{ geometryId: 'shaft', anchor: { kind: 'start' } }],
        toleranceZone: { shape: 'linear' }, datumReferenceFrame: [{ datumId: 'datum:A' }],
        computed: {
          status: options.computedStatus, unit: 'mm', diagnostics: [],
          ...(options.computedValue === undefined ? {} : { value: options.computedValue }),
        },
        source: 'geometry', status: options.gdtStatus, evidenceIds: [],
      }],
      axialScheme: {
        version: 1, drawingRef: ref, policy: { id: 'shaft-hierarchical-dimensioning-v1', version: '1' },
        inputDigest: 'digest', evidence: [], decisions: [], diagnostics: [], status: 'resolved',
        topology: {
          drawingRef: ref, unit: 'mm', elementarySpans: [],
          axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100, orientation: 'forward' },
          stations: [
            { id: 's0', coordinate: 0, sourceCoordinate: 0, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
            { id: 's1', coordinate: 100, sourceCoordinate: 100, unit: 'mm', kinds: ['drawing-end'], geometryNodeIds: ['shaft'], evidenceIds: [] },
          ],
        },
        candidates: [{ id: 'c1', startStationId: 's0', endStationId: 's1', nominalValue: 100, roles: ['overall'], evidenceIds: [], required: true }],
        displayedCandidateIds: ['c1'], closureCandidateIds: [], chains: [],
      },
    },
  } as unknown as DimensionPlanSessionSnapshot;
}

function entityCount(dxf: string, type: string): number {
  return (dxf.match(new RegExp(`(?:^|\\r?\\n)\\s*0\\r?\\n${type}\\r?\\n`, 'g')) ?? []).length;
}

function vectorAiXDataStrings(dxf: string): string[] {
  const lines = dxf.split(/\r?\n/);
  const appIndex = lines.findIndex((value, index) => value.trim() === '1001' && lines[index + 1] === 'VECTORAI');
  if (appIndex < 0) return [];
  const values: string[] = [];
  for (let index = appIndex + 2; index + 1 < lines.length; index += 2) {
    if (lines[index]!.trim() !== '1000') break;
    values.push(lines[index + 1]!);
  }
  return values;
}

function nativeDimensions(dxf: string): Array<{ measurement: number; normalCoordinate: number }> {
  const lines = dxf.split(/\r?\n/);
  const result: Array<{ measurement: number; normalCoordinate: number }> = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    if (lines[index]?.trim() !== '0' || lines[index + 1]?.trim() !== 'DIMENSION') continue;
    let measurement: number | undefined;
    let normalCoordinate: number | undefined;
    for (let cursor = index + 2; cursor + 1 < lines.length; cursor += 2) {
      const code = lines[cursor]?.trim();
      if (code === '0') break;
      if (code === '42') measurement = Number(lines[cursor + 1]);
      if (code === '20' && normalCoordinate === undefined) normalCoordinate = Number(lines[cursor + 1]);
    }
    if (measurement !== undefined && normalCoordinate !== undefined) result.push({ measurement, normalCoordinate });
  }
  return result;
}
