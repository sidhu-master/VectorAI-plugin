// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type AnnotationNode, type GeometryNode } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';

import { projectCadRadiusAnnotations } from './cad-radius-projector';

describe('projectCadRadiusAnnotations', () => {
  it('trusts planned radius semantics instead of reclassifying by sweep or repetition count', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'radius-cad' }, now: () => 1 });
    const quality = { status: 'confirmed' as const, evidenceRefs: [] };
    const arc = (id: string, radius: number, startAngle: number, endAngle: number): GeometryNode => ({
      id: id as never, type: 'arc', center: [Number(id.at(-1)) * 10 || 0, 0], radius,
      startAngle, endAngle, counterClockwise: true, visible: true, quality,
    });
    document.geometry = [
      arc('r3-1', 3, 0, 90), arc('r3-2', 3, 180, 270),
      arc('r1-1', 1, 0, 90), arc('r1-2', 1, 90, 180), arc('r1-3', 1, 180, 270), arc('r1-4', 1, 270, 360),
      arc('r08-1', 0.8, 0, 115), arc('r08-2', 0.8, 180, 295),
    ];
    const dimension = (id: string, radius: number, geometryId: string): AnnotationNode => ({
      id: id as never, type: 'dimension', dimensionKind: 'radius', associationStatus: 'resolved',
      targets: [{ geometryId: geometryId as never, anchor: { kind: 'center' } }],
      computedValue: radius, displayText: `R${radius}`, unit: 'mm', textPosition: [10, 10],
      definitionPoints: [[0, 0], [radius, 0], [10, 10]], visible: true, quality,
      engineeringIntentId: `intent_radius_${id}`,
    });
    document.annotations = [dimension('r3', 3, 'r3-1'), dimension('r1', 1, 'r1-1'), dimension('r08', 0.8, 'r08-1')];

    const projected = projectCadRadiusAnnotations(document);

    expect(projected.document.annotations.filter((node) => node.type === 'dimension')
      .map((node) => node.type === 'dimension' ? node.displayText : undefined)).toEqual(['R3', 'R1', 'R0.8']);
    expect(projected.entities).toEqual([]);
  });
});
