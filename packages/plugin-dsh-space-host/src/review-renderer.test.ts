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
  it('renders the additional branch and detail circle in the authoritative observation', async () => {
    const source = document(0);
    source.annotations = [{ id: 'leader' as never, type: 'leader', visible: true, quality,
      target: { geometryId: 'arm' as never, anchor: { kind: 'start' } }, points: [[0, 0], [20, 10]], content: 'I', textHeight: 3.5 }];
    const viewport = { minX: -10, minY: -30, maxX: 110, maxY: 60 };
    const before = await renderDrawingObservation({ document: source, viewport });
    const node = source.annotations[0];
    if (node.type !== 'leader') throw new Error('fixture');
    node.callout = { type: 'detail', radius: 4 };
    const detail = await renderDrawingObservation({ document: source, viewport });
    node.branches = [{ target: { geometryId: 'arm' as never, anchor: { kind: 'end' } }, points: [[100, 0], [20, 10]] }];
    const branched = await renderDrawingObservation({ document: source, viewport });
    expect(detail.contentDigest).not.toBe(before.contentDigest);
    expect(branched.contentDigest).not.toBe(detail.contentDigest);
  });

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

  it('renders bounded world-space polygons with stable labels for extension observations', async () => {
    const source = document(0);
    const plain = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
    });
    const marked = await renderDrawingObservation({
      document: source,
      viewport: { minX: -10, minY: -10, maxX: 110, maxY: 60 },
      worldOverlays: [{
        id: 'segment:1',
        label: 'S1',
        polygon: [[0, -5], [50, -5], [50, 5], [0, 5]],
      }],
    });

    expect(marked.contentDigest).not.toBe(plain.contentDigest);
    expect(marked.manifest.worldOverlays).toEqual([{
      id: 'segment:1',
      label: 'S1',
      polygon: [[0, -5], [50, -5], [50, 5], [0, 5]],
    }]);
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
