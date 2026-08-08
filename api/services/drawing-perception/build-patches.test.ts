import { describe, expect, it } from 'vitest';

import { compileIntent } from '../../../src/core/compiler.js';
import { buildObservationPatchBatches, stableEntityId } from './build-patches.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  GeometryObservation,
} from './types.js';

describe('observation-to-patch builder', () => {
  it('orders the primary closed contour before independent internal features', () => {
    const geometry = [
      circle('hole', [0.4, 0.4, 0.1, 0.1], 0.9),
      polyline('outline', [0.1, 0.1, 0.8, 0.8], true, 0.95),
      circle('separate', [0.92, 0.1, 0.05, 0.05], 0.8),
    ];
    const batches = buildObservationPatchBatches({
      geometry,
      annotations: [],
      associations: [],
      topology: { components: [
        { id: 'component_hole', viewId: 'view_1', observationIds: ['hole'], closed: true },
        { id: 'component_outline', viewId: 'view_1', observationIds: ['outline'], closed: true },
        { id: 'component_separate', viewId: 'view_1', observationIds: ['separate'], closed: true },
      ] },
    });

    expect(batches.map((batch) => batch.componentId)).toEqual([
      'component_outline', 'component_hole', 'component_separate',
    ]);
    expect(batches[0].intent.objects[0].id).toBe(stableEntityId('outline'));
  });

  it('keeps repeated observations, stable ids, entity confidence, and real compiler compatibility', () => {
    const geometry = [
      circle('repeat_2', [0.3, 0.2, 0.1, 0.1], 0.45),
      circle('repeat_1', [0.1, 0.2, 0.1, 0.1], 0.92),
    ];
    const input = {
      geometry,
      annotations: [] as AnnotationObservation[],
      associations: [] as DimensionAssociation[],
      topology: { components: [{
        id: 'component_repeats', viewId: 'view_1',
        observationIds: ['repeat_1', 'repeat_2'], closed: false,
      }] },
    };

    const first = buildObservationPatchBatches(input);
    const second = buildObservationPatchBatches({ ...input, geometry: [...geometry].reverse() });

    expect(first).toEqual(second);
    expect(first[0].observationIds).toEqual(['repeat_1', 'repeat_2']);
    expect(first[0].lowConfidenceCount).toBe(1);
    expect(first[0].intent.objects.map((object) => object.confidence)).toEqual([0.92, 0.45]);
    expect(compileIntent(first[0].intent).errors).toEqual([]);
  });

  it('splits large components into batches of at most 25 entities', () => {
    const geometry = Array.from({ length: 53 }, (_, index) =>
      circle(`circle_${String(index).padStart(2, '0')}`, [0.1, 0.1, 0.01, 0.01], 0.9));
    const batches = buildObservationPatchBatches({
      geometry,
      annotations: [],
      associations: [],
      topology: { components: [{
        id: 'component_large', viewId: 'view_1',
        observationIds: geometry.map((item) => item.id), closed: false,
      }] },
    });

    expect(batches.map((batch) => batch.intent.objects.length)).toEqual([25, 25, 3]);
    expect(batches.every((batch) => compileIntent(batch.intent).errors.length === 0)).toBe(true);
  });

  it('places text and unresolved dimensions after geometry with stable target ids', () => {
    const geometry = [circle('circle_1', [0.2, 0.2, 0.2, 0.2], 0.9)];
    const annotations: AnnotationObservation[] = [
      {
        id: 'ann_text', viewId: 'view_1', kind: 'text', rawText: '技术要求',
        imageBounds: [0.1, 0.8, 0.3, 0.1], arrowheads: [], confidence: 0.8,
      },
      {
        id: 'ann_diameter', viewId: 'view_1', kind: 'diameter', rawText: 'Ø10', value: 10,
        unit: 'mm', imageBounds: [0.2, 0.42, 0.2, 0.08], arrowheads: [[0.3, 0.4]],
        confidence: 0.55,
      },
    ];
    const associations: DimensionAssociation[] = [{
      annotationId: 'ann_diameter', targets: [], score: 0.72,
      reasons: ['two-close-candidates'], status: 'ambiguous',
      candidates: [{
        targets: [{ geometryObservationId: 'circle_1', anchor: { kind: 'center' } }],
        score: 0.72, reasons: ['near-annotation'],
      }],
    }];
    const batches = buildObservationPatchBatches({
      geometry, annotations, associations,
      topology: { components: [{
        id: 'component_circle', viewId: 'view_1', observationIds: ['circle_1'], closed: true,
      }] },
    });

    expect(batches).toHaveLength(2);
    expect(batches[1].componentId).toBe('annotations:view_1');
    expect(batches[1].intent.objects.map((object) => object.type)).toEqual(['text', 'dimension']);
    expect(batches[1].intent.objects[1].params).toMatchObject({
      associationStatus: 'ambiguous', targets: [],
      candidates: [{ targets: [{ entityId: stableEntityId('circle_1') }] }],
    });
    expect(compileIntent(batches[1].intent).errors).toEqual([]);
    expect(JSON.stringify(batches)).not.toMatch(/base64|prompt|token|"image":/i);
  });

  it('applies view coordinate transforms to explicit geometry params', () => {
    const geometry: GeometryObservation[] = [{
      id: 'line_1', viewId: 'view_1', type: 'line', imageBounds: [0.1, 0.1, 0.4, 0.2],
      measuredParams: { start: [0.1, 0.2], end: [0.5, 0.4] }, confidence: 0.9,
    }];
    const [batch] = buildObservationPatchBatches({
      geometry, annotations: [], associations: [],
      topology: { components: [{
        id: 'component_line', viewId: 'view_1', observationIds: ['line_1'], closed: false,
      }] },
      viewTransforms: { view_1: { scaleX: 100, scaleY: -100, offsetX: 0, offsetY: 100 } },
    });

    expect(batch.intent.objects[0].params).toEqual({ start: [10, 80], end: [50, 60] });
  });

  it('maps annotation positions into CAD coordinates independently from stitched geometry', () => {
    const annotations: AnnotationObservation[] = [{
      id: 'text_ratio', viewId: 'view_1', kind: 'text', rawText: 'NOTE',
      imageBounds: [0.2, 0.4, 0.2, 0.1], arrowheads: [], confidence: 0.9,
    }];
    const [batch] = buildObservationPatchBatches({
      geometry: [], annotations, associations: [], topology: { components: [] },
      annotationTransforms: {
        view_1: { scaleX: 1, scaleY: 1.5, offsetX: 0, offsetY: 0 },
      },
    });

    expect(batch.intent.objects[0].params).toMatchObject({
      position: [0.3, 0.675], height: 0.15,
    });
  });
});

function circle(
  id: string,
  imageBounds: [number, number, number, number],
  confidence: number,
): GeometryObservation {
  return {
    id, viewId: 'view_1', type: 'circle', imageBounds,
    measuredParams: {
      center: [imageBounds[0] + imageBounds[2] / 2, imageBounds[1] + imageBounds[3] / 2],
      radius: imageBounds[2] / 2,
    },
    confidence,
  };
}

function polyline(
  id: string,
  imageBounds: [number, number, number, number],
  closed: boolean,
  confidence: number,
): GeometryObservation {
  const [x, y, width, height] = imageBounds;
  return {
    id, viewId: 'view_1', type: 'polyline', imageBounds,
    measuredParams: {
      vertices: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]], closed,
    },
    confidence,
  };
}
