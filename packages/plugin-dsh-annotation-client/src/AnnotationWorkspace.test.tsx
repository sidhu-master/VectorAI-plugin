// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { DrawingSurfaceRuntime } from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import type { PartitionController } from './partition-controller';

function observable<T>(value: T) {
  return { getSnapshot: () => value, subscribe: () => () => undefined };
}

describe('AnnotationWorkspace', () => {
  it('renders its own controlled professional layout without a shared Provider', () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const snapshot = {
      version: 1 as const,
      ref: { drawingId: 'drawing-1', revision: 1 },
      document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
    const runtime = {
      snapshot: observable(snapshot),
      viewport: observable({ x: 0, y: 0, scale: 1, width: 800, height: 600 }),
      selection: observable([]),
      presentation: observable({
        displaySnapshot: snapshot, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport() {}, setSelection() {} },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const,
      workspaceClaimed: true,
      activationEpoch: 12,
      workflow: { status: 'completed' as const, workflowId: 'workflow-1' },
    });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'editing', drawingRef: snapshot.ref, draft: {
        version: 1, drawingRef: snapshot.ref,
        axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 10, orientation: 'forward' },
        segments: [{ id: 'segment:1', zStart: 0, zEnd: 10, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] }],
        semanticGroups: [], stepCandidates: [], evidence: [], diagnostics: [],
      }, canUndo: false, canRedo: false, updatedAt: 1 }, busy: false, previewHeld: false, error: null }),
      actions: {}, dispose() {},
    } as unknown as PartitionController;

    const markup = renderToStaticMarkup(<AnnotationWorkspace
      sessionId="session-1"
      namespace="engineering-annotation"
      runtime={runtime}
      state={state}
      partition={partition}
    />);
    expect(markup).toContain('data-annotation-workspace="true"');
    expect(markup).toContain('data-controlled-drawing-surface="true"');
    expect(markup).toContain('data-annotation-candidate-layer="true"');
    expect(markup).toContain('已完成');
    expect(markup).toContain('aria-label="取消分区"');
    expect(markup).toContain('aria-label="按住预览分区结果"');
    expect(markup).toContain('aria-label="确认分区"');
    expect(markup).toContain('data-partition-origin="geometry"');
  });
});
