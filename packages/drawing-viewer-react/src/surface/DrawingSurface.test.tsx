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

  it('reports exact geometry and annotation context-menu targets without canvas side effects', () => {
    const value = snapshot();
    value.document.annotations = [{
      id: 'annotation-dimension-1' as AnnotationId,
      type: 'dimension',
      dimensionKind: 'linear',
      associationStatus: 'resolved',
      targets: [],
      computedValue: 100,
      displayText: '100 mm',
      unit: 'mm',
      textPosition: [50, 10],
      definitionPoints: [[0, 0], [0, 10], [100, 10], [100, 0]],
      visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    const onNodeContextMenu = vi.fn();
    const onViewportChange = vi.fn();
    const onSelectionChange = vi.fn();
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={value}
        viewport={viewport}
        selectedIds={[]}
        onViewportChange={onViewportChange}
        onSelectionChange={onSelectionChange}
        onNodeContextMenu={onNodeContextMenu}
      />,
    );
    const geometry = renderer.root.findByProps({ 'data-entity-id': 'line-1' });
    const annotation = renderer.root.findByProps({ 'data-entity-id': 'annotation-dimension-1' });
    const geometryEvent = {
      preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 120, clientY: 80,
    };
    const annotationEvent = {
      preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 320, clientY: 180,
    };

    act(() => geometry.props.onContextMenu(geometryEvent));
    act(() => annotation.props.onContextMenu(annotationEvent));

    expect(onNodeContextMenu).toHaveBeenNthCalledWith(1, 'line-1', geometryEvent);
    expect(onNodeContextMenu).toHaveBeenNthCalledWith(2, 'annotation-dimension-1', annotationEvent);
    expect(geometryEvent.preventDefault).toHaveBeenCalledOnce();
    expect(geometryEvent.stopPropagation).toHaveBeenCalledOnce();
    expect(annotationEvent.preventDefault).toHaveBeenCalledOnce();
    expect(annotationEvent.stopPropagation).toHaveBeenCalledOnce();
    expect(onViewportChange).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('does not arm canvas interaction during a macOS Control-click context-menu gesture', () => {
    const onNodeContextMenu = vi.fn();
    const onViewportChange = vi.fn();
    const onSelectionChange = vi.fn();
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={[]}
        onViewportChange={onViewportChange}
        onSelectionChange={onSelectionChange}
        onNodeContextMenu={onNodeContextMenu}
      />,
    );
    const geometry = renderer.root.findByProps({ 'data-entity-id': 'line-1' });
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const svgTarget = {
      tagName: 'svg',
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };
    const groupTarget = { tagName: 'g', ownerSVGElement: svgTarget };
    const mouseDownStopPropagation = vi.fn();
    const mouseDownEvent = {
      currentTarget: groupTarget,
      target: groupTarget,
      clientX: 380,
      clientY: 320,
      button: 0,
      metaKey: false,
      ctrlKey: true,
      preventDefault: vi.fn(),
      stopPropagation: mouseDownStopPropagation,
    };

    act(() => {
      geometry.props.onMouseDown?.(mouseDownEvent);
      if (mouseDownStopPropagation.mock.calls.length === 0) {
        svg.props.onMouseDown({ ...mouseDownEvent, currentTarget: svgTarget });
      }
    });
    const contextMenuEvent = {
      preventDefault: vi.fn(), stopPropagation: vi.fn(), clientX: 380, clientY: 320,
    };
    act(() => geometry.props.onContextMenu(contextMenuEvent));
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 620, clientY: 280 }));
    act(() => svg.props.onMouseUp({ currentTarget: svgTarget, clientX: 620, clientY: 280 }));

    expect(mouseDownStopPropagation).toHaveBeenCalledOnce();
    expect(onNodeContextMenu).toHaveBeenCalledWith('line-1', contextMenuEvent);
    expect(onViewportChange).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  it('still pans from an entity on an ordinary left drag when context menus are enabled', () => {
    const onViewportChange = vi.fn();
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={[]}
        onViewportChange={onViewportChange}
        onSelectionChange={() => undefined}
        onNodeContextMenu={() => undefined}
      />,
    );
    const geometry = renderer.root.findByProps({ 'data-entity-id': 'line-1' });
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });
    const svgTarget = {
      tagName: 'svg',
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    };
    const groupTarget = { tagName: 'g', ownerSVGElement: svgTarget };
    const mouseDownStopPropagation = vi.fn();
    const mouseDownEvent = {
      currentTarget: groupTarget,
      target: groupTarget,
      clientX: 100,
      clientY: 100,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      preventDefault: vi.fn(),
      stopPropagation: mouseDownStopPropagation,
    };

    act(() => {
      geometry.props.onMouseDown?.(mouseDownEvent);
      if (mouseDownStopPropagation.mock.calls.length === 0) {
        svg.props.onMouseDown({ ...mouseDownEvent, currentTarget: svgTarget });
      }
    });
    act(() => svg.props.onMouseMove({ currentTarget: svgTarget, clientX: 130, clientY: 140 }));

    expect(mouseDownStopPropagation).not.toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalledWith(expect.objectContaining({ x: 430, y: 340 }));
    act(() => renderer.unmount());
  });

  it('leaves entity context menus to the browser when no callback is provided', () => {
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={[]}
        onViewportChange={() => undefined}
        onSelectionChange={() => undefined}
      />,
    );

    const entity = renderer.root.findByProps({ 'data-entity-id': 'line-1' });
    expect(entity.props.onContextMenu).toBeUndefined();
    expect(entity.props.onMouseDown).toBeUndefined();
    act(() => renderer.unmount());
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

  it('does not request viewport fitting when the canvas is double-clicked', () => {
    const onViewportChange = vi.fn();
    const renderer = TestRenderer.create(
      <DrawingSurface
        snapshot={snapshot()}
        viewport={viewport}
        selectedIds={[]}
        onViewportChange={onViewportChange}
        onSelectionChange={() => undefined}
      />,
    );
    const svg = renderer.root.findByProps({ 'aria-label': '图纸画布' });

    act(() => svg.props.onDoubleClick?.({}));

    expect(onViewportChange).not.toHaveBeenCalled();
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
