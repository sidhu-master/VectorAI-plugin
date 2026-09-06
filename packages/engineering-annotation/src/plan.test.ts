// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation, type GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { planEngineeringAnnotations } from './index';

describe('planEngineeringAnnotations', () => {
  it('does not infer dimensions directly from circle, arc, or ellipse primitives', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'hole-1' as GeometryId, type: 'circle', center: [20, 20], radius: 5,
      visible: true, quality: { status: 'confirmed', evidenceRefs: ['evidence-1' as never] },
    }, {
      id: 'arc-1' as GeometryId, type: 'arc', center: [0, 0], radius: 4,
      startAngle: 0, endAngle: 90, counterClockwise: true,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'ellipse-1' as GeometryId, type: 'ellipse', center: [0, 0], majorAxis: [5, 0], ratio: 0.5,
      startParam: 0, endParam: Math.PI * 2,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];

    const plan = planEngineeringAnnotations({
      document,
      ref: { drawingId: 'drawing-1', revision: 1 },
      objective: '自动标注这张工程图',
    });

    expect(plan.pending).toEqual([]);
    expect(plan.annotations).toEqual([]);
    expect(plan.associations).toEqual([]);
    expect(plan.targetNodeIds).toEqual([]);
    expect(plan.program).toBeNull();
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

  it('adds one shaft centerline and one radius dimension per distinct confirmed radius', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    document.geometry = [
      { id: 'top' as GeometryId, type: 'line', start: [0, 10], end: [100, 10], visible: true, quality },
      { id: 'bottom' as GeometryId, type: 'line', start: [0, -10], end: [100, -10], visible: true, quality },
      { id: 'r2-a' as GeometryId, type: 'arc', center: [20, 8], radius: 2, startAngle: 0, endAngle: 90, counterClockwise: true, visible: true, quality },
      { id: 'r2-b' as GeometryId, type: 'arc', center: [30, -8], radius: 2, startAngle: 180, endAngle: 270, counterClockwise: true, visible: true, quality },
      { id: 'r3' as GeometryId, type: 'arc', center: [70, 7], radius: 3, startAngle: 0, endAngle: 90, counterClockwise: true, visible: true, quality },
      { id: 'r2-a-v' as GeometryId, type: 'line', start: [22, 8], end: [22, 0], visible: true, quality },
      { id: 'r2-a-h' as GeometryId, type: 'line', start: [20, 10], end: [10, 10], visible: true, quality },
      { id: 'r2-b-v' as GeometryId, type: 'line', start: [28, -8], end: [28, 0], visible: true, quality },
      { id: 'r2-b-h' as GeometryId, type: 'line', start: [30, -10], end: [40, -10], visible: true, quality },
      { id: 'r3-v' as GeometryId, type: 'line', start: [73, 7], end: [73, 0], visible: true, quality },
      { id: 'r3-h' as GeometryId, type: 'line', start: [70, 10], end: [60, 10], visible: true, quality },
    ];

    const plan = planEngineeringAnnotations({
      document, ref: { drawingId: 'drawing-1', revision: 1 }, objective: '全部标注',
      annotationKinds: ['centerline', 'radius'],
    });

    expect(plan.annotations.filter(({ type }) => type === 'centerline')).toHaveLength(1);
    expect(plan.annotations.filter((item): item is DimensionAnnotation => item.type === 'dimension' && item.dimensionKind === 'radius')
      .map((item) => item.displayText).sort()).toEqual(['R2', 'R3']);
  });

  it('annotates a topological fillet and ignores an isolated arc with no tangent neighbors', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-fillet' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    document.geometry = [
      { id: 'horizontal' as GeometryId, type: 'line', start: [0, 10], end: [10, 10], visible: true, quality },
      { id: 'vertical' as GeometryId, type: 'line', start: [12, 8], end: [12, 0], visible: true, quality },
      { id: 'fillet' as GeometryId, type: 'arc', center: [10, 8], radius: 2, startAngle: 0, endAngle: 90, counterClockwise: true, visible: true, quality },
      { id: 'isolated' as GeometryId, type: 'arc', center: [30, 30], radius: 7, startAngle: 0, endAngle: 120, counterClockwise: true, visible: true, quality },
    ];

    const plan = planEngineeringAnnotations({
      document, ref: { drawingId: 'drawing-fillet', revision: 1 }, objective: '标注圆角', annotationKinds: ['radius'],
    });

    expect(plan.annotations.filter((item): item is DimensionAnnotation => item.type === 'dimension' && item.dimensionKind === 'radius')
      .map((item) => item.displayText)).toEqual(['R2']);
  });

  it('removes legacy primitive-driven dimensions without touching manual dimensions', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'arc-1' as GeometryId, type: 'arc', center: [0, 0], radius: 4,
      startAngle: 0, endAngle: 90, counterClockwise: true,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const legacy = {
      id: 'legacy-radius' as never, type: 'dimension' as const, dimensionKind: 'radius' as const,
      associationStatus: 'resolved' as const, targets: [{ geometryId: 'arc-1' as GeometryId, anchor: { kind: 'center' as const } }],
      computedValue: 4, displayText: 'R4', unit: 'mm' as const, textPosition: [5, 5] as [number, number],
      definitionPoints: [[0, 0], [4, 0]] as [number, number][], visible: true,
      quality: { status: 'confirmed' as const, confidence: 1, evidenceRefs: [] },
      engineeringIntentId: 'intent_auto_legacy',
    };
    document.annotations = [legacy, {
      ...structuredClone(legacy), id: 'manual-radius' as never, engineeringIntentId: 'manual-radius-intent',
    }];

    const plan = planEngineeringAnnotations({
      document, ref: { drawingId: 'drawing-1', revision: 2 }, objective: '标注开角',
    });

    expect(plan.program?.operations).toEqual([{ kind: 'delete_nodes', nodeIds: ['legacy-radius'] }]);
    expect(plan.targetNodeIds).toEqual(['arc-1', 'legacy-radius']);
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

  it.each(['generated', 'custom', 'legacy'] as const)('preserves a moved diameter and its %s text ownership when annotating again', (textOwnership) => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-diameter' }, now: () => 1 });
    document.geometry = [{
      id: 'hole' as GeometryId, type: 'circle', center: [30, 10], radius: 3,
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const input = {
      document, ref: { drawingId: 'drawing-diameter', revision: 1 },
      objective: '标注直径', annotationKinds: ['diameter' as const],
    };
    const first = planEngineeringAnnotations(input);
    expect(first.annotations).toHaveLength(1);
    document.annotations = structuredClone(first.annotations);
    document.relations = structuredClone(first.associations);
    const moved = document.annotations[0] as DimensionAnnotation;
    expect(moved.displayText).toBe(moved.layout?.generatedText);
    moved.layout = { ...moved.layout, mode: 'manual' };
    moved.textPosition = [-12, 9];
    moved.definitionPoints = moved.definitionPoints.map((point, index) => index < 2 ? [point[0] - 40, point[1]] : point);
    if (textOwnership === 'custom') moved.displayText = 'CUSTOM Ø6';
    if (textOwnership === 'legacy') delete moved.layout;
    const before = structuredClone(moved);

    const repeated = planEngineeringAnnotations(input);
    const dimension = repeated.annotations[0] as DimensionAnnotation;

    expect(dimension.textPosition).toEqual([-12, 9]);
    expect(dimension.definitionPoints).toEqual(before.definitionPoints);
    expect(dimension.displayText).toBe(before.displayText);
    expect(dimension.layout).toEqual(before.layout);
    if (textOwnership === 'generated') expect(dimension.displayText).toBe(dimension.layout?.generatedText);
    expect(repeated.program).toBeNull();
    expect(document.annotations[0]).toEqual(before);
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
    expect(first.annotations[0]).toMatchObject({ layout: { mode: 'automatic', generatedText: '120°' } });
    const committed = structuredClone(document);
    committed.annotations = structuredClone(first.annotations);
    committed.relations = structuredClone(first.associations);

    expect(planEngineeringAnnotations({ ...input, document: committed }).program).toBeNull();
    const customized = structuredClone(committed);
    const custom = customized.annotations[0] as DimensionAnnotation;
    custom.displayText = 'CUSTOM 120°';
    custom.visible = false;
    custom.layout = { mode: 'manual', generatedText: '120°' };
    const repeatedCustom = planEngineeringAnnotations({ ...input, document: customized });
    expect(repeatedCustom.annotations[0]).toMatchObject({ displayText: 'CUSTOM 120°', visible: false, layout: custom.layout });
    expect(repeatedCustom.program).toBeNull();
    for (const mode of [undefined, 'manual'] as const) {
      const placed = structuredClone(committed);
      const opening = placed.annotations[0] as DimensionAnnotation;
      opening.textPosition = [-40, 20];
      opening.definitionPoints[3] = [-30, 15];
      if (mode === undefined) delete opening.layout;
      else opening.layout = { mode, generatedText: opening.displayText };
      const repeated = planEngineeringAnnotations({ ...input, document: placed });
      expect(repeated.program).toBeNull();
      expect(repeated.annotations[0]).toMatchObject({ textPosition: opening.textPosition, definitionPoints: opening.definitionPoints });
      expect((repeated.annotations[0] as DimensionAnnotation).layout).toEqual(opening.layout);
    }
    const reordered = structuredClone(committed);
    const association = reordered.relations[0] as typeof first.associations[number];
    association.geometryIds.reverse();
    association.quality.evidenceRefs.reverse();
    expect(planEngineeringAnnotations({ ...input, document: reordered }).program).toBeNull();

    const stale = structuredClone(committed);
    const opening = stale.annotations[0] as DimensionAnnotation;
    opening.textPosition = [-999, -999];
    stale.annotations.push({
      ...structuredClone(opening), id: 'manual-angle' as never,
      engineeringIntentId: 'manual-angle-intent', textPosition: [0, 0],
    });
    const refreshed = planEngineeringAnnotations({ ...input, document: stale });
    expect(refreshed.program?.operations).toEqual([
      { kind: 'delete_nodes', nodeIds: [first.associations[0]!.id, opening.id] },
      expect.objectContaining({
        kind: 'create_annotation_batch',
        annotations: [expect.objectContaining({ id: opening.id, textPosition: expect.not.arrayContaining([-999]) })],
      }),
    ]);
    expect(refreshed.program?.operations[0]).not.toEqual(expect.objectContaining({ nodeIds: expect.arrayContaining(['manual-angle']) }));

    const staleAssociation = structuredClone(committed);
    const staleRelation = staleAssociation.relations[0] as typeof first.associations[number];
    staleRelation.geometryIds = [];
    const refreshedAssociation = planEngineeringAnnotations({ ...input, document: staleAssociation });
    expect(refreshedAssociation.program?.operations).toEqual([
      { kind: 'delete_nodes', nodeIds: [first.associations[0]!.id, first.annotations[0]!.id] },
      expect.objectContaining({
        kind: 'create_annotation_batch',
        annotations: [expect.objectContaining({ id: first.annotations[0]!.id })],
        associations: [expect.objectContaining({ id: first.associations[0]!.id })],
      }),
    ]);
    expect(refreshedAssociation.targetNodeIds).toEqual(expect.arrayContaining([
      first.annotations[0]!.id,
      first.associations[0]!.id,
    ]));
  });
});
