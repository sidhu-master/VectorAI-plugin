// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type GeometryId } from '@vectorai/drawing-core';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { renderDrawingObservation, renderReviewComparison } from './review-renderer';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function document(y: number) {
  const value = createEmptyDrawing({ idFactory: { next: () => 'drawing-review' }, now: () => 1 });
  value.geometry = [{
    id: 'arm' as GeometryId,
    type: 'line',
    start: [0, y],
    end: [100, y],
    visible: true,
    quality,
  }];
  return value;
}

describe('renderReviewComparison', () => {
  it('renders model-only candidate labels at their exact geometry anchors', async () => {
    const source = document(0);
    const plain = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
    });
    const marked = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
      candidateMarkers: [{ key: 'c1', nodeIds: ['arm'] }],
    });

    expect(marked.manifest).toMatchObject({
      overlays: ['selection', 'candidate-labels'],
      candidateMarkers: [{ key: 'c1', nodeCount: 1 }],
    });
    expect(marked.contentDigest).not.toBe(plain.contentDigest);
    expect(marked.png.byteLength).toBeGreaterThan(plain.png.byteLength);
  });

  it('renders the resolved model selection as a distinct feedback image', async () => {
    const source = document(0);
    const unselected = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
      candidateMarkers: [{ key: 'c1', nodeIds: ['arm'] }],
    });
    const selected = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
      selectedNodeIds: ['arm'],
      candidateMarkers: [{ key: 'c1', nodeIds: ['arm'] }],
    });

    expect(selected.manifest.selectedNodeCount).toBe(1);
    expect(selected.contentDigest).not.toBe(unselected.contentDigest);
  });

  it('renders a real same-viewport before-after PNG with changed-node overlays', async () => {
    const rendered = await renderReviewComparison({
      before: document(0),
      after: document(40),
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
      changedNodeIds: ['arm'],
    });
    const metadata = await sharp(rendered.png).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1280);
    expect(metadata.height).toBe(720);
    expect(rendered.manifest).toMatchObject({
      rendererVersion: 'vectorai-review-svg-v1',
      width: 1280,
      height: 720,
      comparisonLayout: 'before | after',
      overlays: ['changed-nodes', 'motion-vectors'],
    });
    expect(rendered.contentDigest).toMatch(/^sha256:/);
    expect(rendered.png.byteLength).toBeGreaterThan(1_000);
  });
});
