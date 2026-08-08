import { describe, expect, it } from 'vitest';
import { compileDrawingCommands, createEmptyDrawing } from '../../../src/drawing/index.js';
import {
  buildObservationCommandBatches,
  stableDrawingNodeId,
} from './build-patches.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  GeometryObservation,
} from './types.js';

describe('observation-to-DrawingCommand resolver', () => {
  it('creates stable Drawing commands with evidence-linked candidate quality', () => {
    const geometry = [circle('repeat_2', 0.45), circle('repeat_1', 0.92)];
    const input = {
      geometry,
      annotations: [] as AnnotationObservation[], associations: [] as DimensionAssociation[],
      topology: { components: [{
        id: 'component_repeats', viewId: 'view_1',
        observationIds: ['repeat_1', 'repeat_2'], closed: false,
      }] },
    };

    const first = buildObservationCommandBatches(input);
    const second = buildObservationCommandBatches({ ...input, geometry: [...geometry].reverse() });

    expect(first).toEqual(second);
    expect(first.warnings).toEqual([]);
    expect(first.batches[0].observationIds).toEqual(['repeat_1', 'repeat_2']);
    expect(first.batches[0].lowConfidenceCount).toBe(1);
    expect(first.batches[0].commands).toEqual([
      expect.objectContaining({
        type: 'geometry.create', value: expect.objectContaining({
          id: stableDrawingNodeId('source_1', 'repeat_1'),
          quality: { status: 'confirmed', confidence: 0.92, evidenceRefs: ['evidence_repeat_1'] },
        }),
      }),
      expect.objectContaining({
        type: 'geometry.create', value: expect.objectContaining({
          id: stableDrawingNodeId('source_1', 'repeat_2'),
          quality: { status: 'candidate', confidence: 0.45, evidenceRefs: ['evidence_repeat_2'] },
        }),
      }),
    ]);
    expect(compileDrawingCommands(createEmptyDrawing(), first.batches[0].commands).success)
      .toBe(true);
  });

  it('orders larger closed contours first and splits batches at 25 commands', () => {
    const geometry = Array.from({ length: 53 }, (_, index) => (
      circle(`circle_${String(index).padStart(2, '0')}`, 0.9)
    ));
    const result = buildObservationCommandBatches({
      geometry, annotations: [], associations: [],
      topology: { components: [{
        id: 'component_large', viewId: 'view_1',
        observationIds: geometry.map((item) => item.id), closed: true,
      }] },
    });

    expect(result.batches.map((batch) => batch.commands.length)).toEqual([25, 25, 3]);
    expect(result.batches.map((batch) => batch.componentId)).toEqual([
      'component_large', 'component_large:2', 'component_large:3',
    ]);
  });

  it('creates text and ambiguous dimensions after geometry using stable Drawing IDs', () => {
    const geometry = [circle('circle_1', 0.9)];
    const annotations: AnnotationObservation[] = [annotation({
      id: 'ann_text', kind: 'text', rawText: '技术要求', confidence: 0.8,
    }), annotation({
      id: 'ann_diameter', kind: 'diameter', rawText: 'Ø10', value: 10,
      unit: 'mm', confidence: 0.55, arrowheads: [[0.3, 0.4]],
    })];
    const associations: DimensionAssociation[] = [{
      annotationId: 'ann_diameter', targets: [], score: 0.72,
      reasons: ['two-close-candidates'], status: 'ambiguous',
      candidates: [{
        targets: [{ geometryObservationId: 'circle_1', anchor: { kind: 'center' } }],
        score: 0.72, reasons: ['near-annotation'],
      }],
    }];

    const result = buildObservationCommandBatches({
      geometry, annotations, associations,
      topology: { components: [{
        id: 'component_circle', viewId: 'view_1', observationIds: ['circle_1'], closed: true,
      }] },
    });

    expect(result.batches).toHaveLength(2);
    expect(result.batches[1].commands).toEqual([
      expect.objectContaining({ type: 'annotation.create', value: expect.objectContaining({ type: 'text' }) }),
      expect.objectContaining({
        type: 'annotation.create',
        value: expect.objectContaining({
          type: 'dimension', associationStatus: 'ambiguous', targets: [],
          candidates: [{ targets: [{
            geometryId: stableDrawingNodeId('source_1', 'circle_1'), anchor: { kind: 'center' },
          }], score: 0.72, reasons: ['near-annotation'] }],
        }),
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/base64|prompt|token|"image":/i);
  });

  it('applies view transforms and omits observations with missing required parameters', () => {
    const valid: GeometryObservation = {
      ...baseObservation('line_1', 0.9), type: 'line',
      imageBounds: [0.1, 0.1, 0.4, 0.2],
      measuredParams: { start: [0.1, 0.2], end: [0.5, 0.4] },
    };
    const invalid: GeometryObservation = {
      ...baseObservation('circle_missing_radius', 0.8), type: 'circle',
      measuredParams: { center: [0.5, 0.5] },
    };

    const result = buildObservationCommandBatches({
      geometry: [valid, invalid], annotations: [], associations: [],
      topology: { components: [{
        id: 'component', viewId: 'view_1',
        observationIds: ['line_1', 'circle_missing_radius'], closed: false,
      }] },
      viewTransforms: { view_1: { scaleX: 100, scaleY: -100, offsetX: 0, offsetY: 100 } },
    });

    expect(result.batches[0].commands).toEqual([
      expect.objectContaining({
        type: 'geometry.create',
        value: expect.objectContaining({ start: [10, 80], end: [50, 60] }),
      }),
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining('circle_missing_radius'),
    ]);
  });
});

function baseObservation(id: string, confidence: number) {
  return {
    id, sourceId: 'source_1', evidenceRefs: [`evidence_${id}`], viewId: 'view_1',
    imageBounds: [0.1, 0.1, 0.1, 0.1] as [number, number, number, number], confidence,
  };
}

function circle(id: string, confidence: number): GeometryObservation {
  return {
    ...baseObservation(id, confidence), type: 'circle',
    measuredParams: { center: [0.25, 0.25], radius: 0.05 },
  };
}

function annotation(input: Partial<AnnotationObservation> & Pick<AnnotationObservation, 'id' | 'kind' | 'rawText' | 'confidence'>): AnnotationObservation {
  return {
    ...baseObservation(input.id, input.confidence),
    imageBounds: [0.2, 0.4, 0.2, 0.1], arrowheads: [],
    ...input,
  };
}
