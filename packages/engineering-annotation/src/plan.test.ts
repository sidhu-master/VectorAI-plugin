// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { planEngineeringAnnotations } from './index';

describe('planEngineeringAnnotations', () => {
  it('creates confirmed resolved diameter annotations and associations from confirmed geometry', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'hole-1' as GeometryId, type: 'circle', center: [20, 20], radius: 5,
      visible: true, quality: { status: 'confirmed', evidenceRefs: ['evidence-1' as never] },
    }];

    const plan = planEngineeringAnnotations({
      document,
      ref: { drawingId: 'drawing-1', revision: 1 },
      objective: '自动标注这张工程图',
    });

    expect(plan.pending).toEqual([]);
    expect(plan.annotations).toHaveLength(1);
    expect(plan.annotations[0]).toMatchObject({
      type: 'dimension', dimensionKind: 'diameter', associationStatus: 'resolved',
      computedValue: 10, quality: { status: 'confirmed' }, generationOrder: 0,
      engineeringIntentId: expect.stringMatching(/^intent_auto_/),
    });
    expect(plan.associations[0]).toMatchObject({
      type: 'association', kind: 'annotation-target', geometryIds: ['hole-1'],
    });
    expect(plan.program.operations[0]).toMatchObject({ kind: 'create_annotation_batch' });
  });

  it('keeps candidate geometry pending and out of the materialized program', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'candidate-hole' as GeometryId, type: 'circle', center: [0, 0], radius: 3,
      visible: true, quality: { status: 'candidate', evidenceRefs: [] },
    }];

    const plan = planEngineeringAnnotations({
      document, ref: { drawingId: 'drawing-1', revision: 1 }, objective: '自动标注',
    });

    expect(plan.annotations).toEqual([]);
    expect(plan.pending).toEqual([{ nodeId: 'candidate-hole', reason: 'SOURCE_NOT_CONFIRMED' }]);
    expect(plan.program).toBeNull();
  });

  it('is deterministic for identical semantic input', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'arc-1' as GeometryId, type: 'arc', center: [0, 0], radius: 4,
      startAngle: 0, endAngle: 90, counterClockwise: true,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const input = { document, ref: { drawingId: 'drawing-1', revision: 1 }, objective: '标注半径' };
    expect(planEngineeringAnnotations(input)).toEqual(planEngineeringAnnotations(input));
  });

  it('adds only deterministic axial-end opening angles to the automatic annotation plan', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    const segments: Array<[string, readonly [number, number], readonly [number, number]]> = [
      ['top', [14, journal], [86, journal]], ['bottom', [14, -journal], [86, -journal]],
      ['left-upper', [10, 12.9], [14, journal]], ['left-lower', [10, -12.9], [14, -journal]],
      ['right-upper', [86, journal], [90, 12.9]], ['right-lower', [86, -journal], [90, -12.9]],
      ['middle-upper', [40, 11], [42, 7.535898]], ['middle-lower', [40, -11], [42, -7.535898]],
    ];
    document.geometry = segments.map(([id, start, end]) => ({
      id: id as GeometryId, type: 'line' as const, start,
      end, visible: true, quality,
    }));

    const plan = planEngineeringAnnotations({
      document, ref: { drawingId: 'drawing-1', revision: 1 }, objective: '自动标注',
    });
    const angular = plan.annotations.filter((item): item is DimensionAnnotation => (
      item.type === 'dimension' && item.dimensionKind === 'angular'
    ));

    expect(angular).toHaveLength(2);
    expect(angular.map((item) => item.displayText)).toEqual(['120°', '120°']);
    expect(angular.every((item) => item.definitionPoints.length === 5)).toBe(true);
    expect(plan.targetNodeIds.sort()).toEqual(['left-lower', 'left-upper', 'right-lower', 'right-upper']);
  });

  it('is idempotent and refreshes only stale automatic opening annotations', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const rise = 4 * Math.sqrt(3);
    const journal = 12.9 - rise;
    document.geometry = [
      { id: 'top' as GeometryId, type: 'line', start: [14, journal], end: [86, journal], visible: true, quality },
      { id: 'bottom' as GeometryId, type: 'line', start: [14, -journal], end: [86, -journal], visible: true, quality },
      { id: 'left-upper' as GeometryId, type: 'line', start: [10, 12.9], end: [14, journal], visible: true, quality },
      { id: 'left-lower' as GeometryId, type: 'line', start: [10, -12.9], end: [14, -journal], visible: true, quality },
    ];
    const input = { document, ref: { drawingId: 'drawing-1', revision: 1 }, objective: '自动标注' };
    const first = planEngineeringAnnotations(input);
    expect(first.annotations).toHaveLength(1);
    const committed = structuredClone(document);
    committed.annotations = structuredClone(first.annotations);
    committed.relations = structuredClone(first.associations);

    expect(planEngineeringAnnotations({ ...input, document: committed }).program).toBeNull();

    const stale = structuredClone(committed);
    const opening = stale.annotations[0] as DimensionAnnotation;
    opening.textPosition = [-999, -999];
    stale.annotations.push({
      ...structuredClone(opening), id: 'manual-angle' as never,
      engineeringIntentId: 'manual-angle-intent', textPosition: [0, 0],
    });
    const refreshed = planEngineeringAnnotations({ ...input, document: stale });
    expect(refreshed.program?.operations).toEqual([
      { kind: 'delete_nodes', nodeIds: expect.arrayContaining([opening.id]) },
      expect.objectContaining({
        kind: 'create_annotation_batch',
        annotations: [expect.objectContaining({ id: opening.id, textPosition: expect.not.arrayContaining([-999]) })],
      }),
    ]);
    expect(refreshed.program?.operations[0]).not.toEqual(expect.objectContaining({ nodeIds: expect.arrayContaining(['manual-angle']) }));
  });
});
