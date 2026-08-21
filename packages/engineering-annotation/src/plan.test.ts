// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
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
      computedValue: 10, quality: { status: 'confirmed' },
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
});
