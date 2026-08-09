import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import type { DrawingDocument, GeometryId } from '../../../src/drawing/index.js';
import type { CvSourceImage } from '../drawing-cv/types.js';
import { renderDrawingRegion } from './source-renderer.js';
import { SourceRasterFeedbackComparator } from './source-comparator.js';

describe('SourceRasterFeedbackComparator', () => {
  it('compares a 500-wide CAD document in the immutable source pixel frame', async () => {
    const document = drawing();
    const rendered = renderDrawingRegion(document, {
      region: { x: 0, y: 0, width: 500, height: 700 },
      documentToSource: [1, 0, 0, -1, 0, 700],
      strokeWidthPixels: 1,
    });
    const rgba = Buffer.alloc(500 * 700 * 4, 255);
    rendered.combined.forEach((value, index) => {
      if (!value) return;
      rgba[index * 4] = 0;
      rgba[index * 4 + 1] = 0;
      rgba[index * 4 + 2] = 0;
    });
    const bytes = await sharp(rgba, { raw: { width: 500, height: 700, channels: 4 } })
      .png().toBuffer();
    const source: CvSourceImage = {
      sourceId: 'source_test', mimeType: 'image/png', bytes,
      width: 500, height: 700,
    };
    const comparator = new SourceRasterFeedbackComparator({
      sources: { read: async () => source },
    });

    const report = await comparator.compare(document, undefined, { sourceId: source.sourceId });

    expect(report.geometry.edgeF1).toBe(1);
    expect(report.residualRegions).toHaveLength(0);
  });

  it('scores only the requested verification region and ignores residuals elsewhere', async () => {
    const complete = drawing();
    complete.geometry.push({
      id: 'circle_outside' as GeometryId,
      type: 'circle',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      center: [420, 620],
      radius: 24,
    });
    const rendered = renderDrawingRegion(complete, {
      region: { x: 0, y: 0, width: 500, height: 700 },
      documentToSource: [1, 0, 0, -1, 0, 700],
      strokeWidthPixels: 1,
    });
    const rgba = Buffer.alloc(500 * 700 * 4, 255);
    rendered.combined.forEach((value, index) => {
      if (!value) return;
      rgba[index * 4] = 0;
      rgba[index * 4 + 1] = 0;
      rgba[index * 4 + 2] = 0;
    });
    const bytes = await sharp(rgba, { raw: { width: 500, height: 700, channels: 4 } })
      .png().toBuffer();
    const source: CvSourceImage = {
      sourceId: 'source_region', mimeType: 'image/png', bytes,
      width: 500, height: 700,
    };
    const comparator = new SourceRasterFeedbackComparator({
      sources: { read: async () => source },
    });
    const targetOnly = drawing();

    const report = await comparator.compare(targetOnly, undefined, {
      sourceId: source.sourceId,
      region: { x: 120, y: 400, width: 260, height: 180 },
    });

    expect(report.geometry.edgeF1).toBe(1);
    expect(report.residualRegions).toHaveLength(0);
  });
});

function drawing(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_1' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 }, unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: [{
      id: 'arc_1' as GeometryId, type: 'arc', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      center: [250, 250], radius: 100, startAngle: 20, endAngle: 160,
      counterClockwise: true,
    }],
    annotations: [], relations: [], features: [],
  };
}
