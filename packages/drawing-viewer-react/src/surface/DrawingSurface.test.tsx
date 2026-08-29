// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type AnnotationId, type GeometryId } from '@vectorai/drawing-core';
import type { DrawingWorkspaceSnapshot } from '@vectorai/drawing-workspace';
import TestRenderer, { act } from 'react-test-renderer';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DrawingSurface } from './DrawingSurface';
import { GeometryLayer } from './layers';

const viewport = { x: 400, y: 300, scale: 2, width: 800, height: 600 };

function snapshot(): DrawingWorkspaceSnapshot {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.geometry = [{
    id: 'line-1' as GeometryId,
    type: 'line', start: [0, 0], end: [100, 0], visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  }];
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision: 1 },
    document,
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: false },
  };
}

describe('controlled DrawingSurface', () => {
  it('renders without a shared Provider and keeps attention separate from selection', () => {
    const markup = renderToStaticMarkup(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={[]}
        attentionIds={['line-1']}
        onViewportChange={() => undefined}
        onSelectionChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-controlled-drawing-surface="true"');
    expect(markup).toContain('data-cad-grid="true"');
    expect(markup).toContain('data-entity-id="line-1"');
    expect(markup).toContain('data-ai-grounded="true"');
    expect(markup).not.toContain('data-selected="true"');
  });

  it('supports a plugin-owned layer without mutating primary selection', () => {
    const value = snapshot();
    const markup = renderToStaticMarkup(
      <DrawingSurface
        snapshot={value}
        viewport={viewport}
        selectedIds={['line-1']}
        onViewportChange={() => undefined}
        onSelectionChange={() => undefined}
        worldLayers={<g data-plugin-layer="annotation-candidates" />}
      />,
    );

    expect(markup).toContain('data-plugin-layer="annotation-candidates"');
    expect(markup).toContain('data-selected="true"');
  });

  it('reports zoom and blank-canvas deselection through callbacks', () => {
    const onViewportChange = vi.fn();
    const onSelectionChange = vi.fn();
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={['line-1']}
        onViewportChange={onViewportChange}
        onSelectionChange={onSelectionChange}
      />,
    );
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const svgTarget = {
      tagName: 'svg',
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };
    const backgroundTarget = { dataset: { canvasBackground: 'true' } };

    act(() => svg.props.onWheel({
      currentTarget: svgTarget, clientX: 500, clientY: 240, deltaY: -1,
      preventDefault() {}, stopPropagation() {},
    }));
    act(() => svg.props.onMouseDown({
      currentTarget: svgTarget, target: backgroundTarget,
      clientX: 700, clientY: 500, button: 0, metaKey: false, ctrlKey: false,
      preventDefault() {},
    }));
    act(() => svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 700, clientY: 500 }));

    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ scale: 2.2 }));
    expect(onSelectionChange).toHaveBeenCalledWith([]);
    act(() => renderer.unmount());
  });

  it('fits the drawing to the measured controlled surface when requested', () => {
    const onViewportChange = vi.fn();
    const value = snapshot();
    value.document.annotations = [{
      id: 'far-label' as AnnotationId,
      type: 'text',
      position: [10_000, 10_000],
      content: 'remote annotation',
      height: 10,
      rotation: 0,
      alignment: 'left',
      verticalAlignment: 'baseline',
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    class ResizeObserverStub {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() { this.callback([], this as unknown as ResizeObserver); }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);

    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <DrawingSurface
          snapshot={value}
          viewport={viewport}
          selectedIds={[]}
          fitToDrawingOnResize="geometry"
          fitPadding={2}
          onViewportChange={onViewportChange}
          onSelectionChange={() => undefined}
        />,
        {
          createNodeMock: (element) => element.props['data-canvas-root'] === 'true' ? {
            getBoundingClientRect: () => ({ width: 240, height: 600 }),
            addEventListener() {},
            removeEventListener() {},
          } : {},
        },
      );
    });

    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({
      width: 240,
      height: 600,
      x: expect.any(Number),
      y: expect.any(Number),
    }));
    expect(onViewportChange.mock.calls.at(-1)?.[0].x).not.toBe(viewport.x);
    expect(onViewportChange.mock.calls.at(-1)?.[0].scale).toBeCloseTo(1.2);
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });

  it('exports independently composable geometry layers', () => {
    const value = snapshot();
    const markup = renderToStaticMarkup(
      <svg><g>
        <GeometryLayer
          nodes={value.document.geometry}
          viewport={viewport}
          selectedIds={[]}
          attentionIds={[]}
          onSelect={() => undefined}
        />
      </g></svg>,
    );
    expect(markup).toContain('data-layer="geometry"');
  });
});
