import { describe, expect, it } from 'vitest';

import {
  validateAnnotationObservation,
  validateDimensionAssociation,
  validateDrawingManifest,
  validateGeometryObservation,
} from './validate.js';
import type {
  AnnotationObservation,
  DimensionAssociation,
  DrawingManifest,
  GeometryObservation,
} from './types.js';

const geometry: GeometryObservation = {
  id: 'obs_geom_view_1_0001',
  viewId: 'view_1',
  type: 'circle',
  imageBounds: [0.1, 0.2, 0.3, 0.4],
  measuredParams: { center: [0.25, 0.4], radius: 0.1 },
  confidence: 0.92,
};

const annotation: AnnotationObservation = {
  id: 'obs_ann_view_1_0001',
  viewId: 'view_1',
  kind: 'diameter',
  rawText: 'Ø10 ±0.1',
  value: 10,
  unit: 'mm',
  tolerance: { upper: 0.1, lower: -0.1 },
  imageBounds: [0.5, 0.2, 0.2, 0.1],
  arrowheads: [[0.5, 0.25], [0.7, 0.25]],
  confidence: 0.88,
};

describe('drawing perception records', () => {
  it('accepts valid manifests, geometry, annotations, and associations', () => {
    const manifest: DrawingManifest = {
      runId: 'run_1',
      page: 1,
      unit: 'mm',
      scale: 1,
      views: [{
        id: 'view_1', kind: 'primary', imageBounds: [0.05, 0.05, 0.9, 0.8],
        confidence: 0.95,
      }],
      warnings: [],
    };
    const association: DimensionAssociation = {
      annotationId: annotation.id,
      targets: [{
        geometryObservationId: geometry.id,
        anchor: { kind: 'center' },
      }],
      score: 0.94,
      reasons: ['diameter-symbol', 'arrow-contact'],
      status: 'resolved',
    };

    expect(validateDrawingManifest(manifest)).toEqual({ valid: true, errors: [] });
    expect(validateGeometryObservation(geometry)).toEqual({ valid: true, errors: [] });
    expect(validateAnnotationObservation(annotation)).toEqual({ valid: true, errors: [] });
    expect(validateDimensionAssociation(association)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [[-0.1, 0, 0.2, 0.2]],
    [[0.9, 0.1, 0.2, 0.2]],
    [[0.1, 0.1, 0, 0.2]],
    [[0.1, 0.1, 0.2]],
  ])('rejects non-normalized image bounds %#', (imageBounds) => {
    const result = validateGeometryObservation({ ...geometry, imageBounds });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('imageBounds');
  });

  it('rejects missing evidence coordinates and confidence outside 0-1', () => {
    const missingBounds = { ...geometry } as Record<string, unknown>;
    delete missingBounds.imageBounds;

    expect(validateGeometryObservation(missingBounds).errors.join(' ')).toContain('imageBounds');
    expect(validateGeometryObservation({ ...geometry, confidence: 1.1 }).errors.join(' '))
      .toContain('confidence');
    expect(validateAnnotationObservation({ ...annotation, confidence: -0.1 }).errors.join(' '))
      .toContain('confidence');
  });

  it('rejects unsupported geometry and annotation kinds', () => {
    expect(validateGeometryObservation({ ...geometry, type: 'dimension' }).errors.join(' '))
      .toContain('type');
    expect(validateAnnotationObservation({ ...annotation, kind: 'hatch' }).errors.join(' '))
      .toContain('kind');
  });

  it.each([
    { ...geometry, image: 'raw-bytes' },
    { ...geometry, measuredParams: { base64: 'raw-bytes' } },
    { ...geometry, measuredParams: { request: { prompt: 'hidden prompt' } } },
    { ...geometry, measuredParams: { authToken: 'secret' } },
    { ...annotation, apiKey: 'secret' },
  ])('rejects media, prompt, token, and credential-like fields %#', (record) => {
    const result = 'rawText' in record
      ? validateAnnotationObservation(record)
      : validateGeometryObservation(record);

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('禁止持久化字段');
  });

  it('rejects duplicate view ids and invalid manifest pages', () => {
    const view = {
      id: 'view_1', kind: 'detail', imageBounds: [0, 0, 0.5, 0.5], confidence: 0.8,
    };
    const result = validateDrawingManifest({
      runId: 'run_1', page: 0, views: [view, view], warnings: [],
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/page|重复/);
  });
});
