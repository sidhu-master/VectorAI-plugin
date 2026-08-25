// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
  type DrawingRelation,
  type GeometryId,
} from '@vectorai/drawing-core';
import {
  createDrawingWorkspaceStore,
  type DrawingWorkspaceCommitResult,
  type DrawingGroundingOverlay,
  type DrawingWorkspacePort,
  type DrawingWorkspaceSnapshot,
} from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DrawingWorkspaceProvider } from '../provider';
import { Canvas } from './Canvas';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

function workspaceSnapshot(): DrawingWorkspaceSnapshot {
  const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
  document.geometry = [{
    id: 'line-1' as GeometryId,
    type: 'line', start: [0, 0], end: [100, 0], visible: true, quality,
  }, {
    id: 'circle-1' as GeometryId,
    type: 'circle', center: [50, 40], radius: 12, visible: true, quality,
  }, {
    id: 'spline-1' as GeometryId,
    type: 'spline', degree: 2,
    controlPoints: [[1, 0], [1, 1], [0, 1]],
    knots: [0, 0, 0, 1, 1, 1], weights: [1, Math.SQRT1_2, 1],
    closed: false, periodic: false, visible: true, quality,
  }];
  document.annotations = [{
    id: 'text-1' as AnnotationId,
    type: 'text', content: '长度 100', position: [20, 20], height: 6,
    rotation: 0, alignment: 'left', verticalAlignment: 'baseline', visible: true, quality,
  }];
  document.relations = [{
    id: 'relation-1',
    type: 'topology', plane: 'topology', kind: 'connected',
    nodeIds: ['line-1', 'circle-1'], visible: true, quality,
  } as DrawingRelation, {
    id: 'relation-2',
    type: 'association', plane: 'association', kind: 'annotation-target',
    annotationId: 'text-1', geometryIds: ['line-1'], visible: true, quality,
  } as DrawingRelation];
  document.coordinateFrames.push({
    id: 'frame_source_source-1',
    kind: 'source',
    parentId: 'frame_document',
    transform: [5, 0, 0, -5, 0, 400],
  });
  return {
    version: 1,
    ref: { drawingId: 'drawing-1', revision: 4 },
    document,
    source: { id: 'source-1', mediaType: 'image/png', width: 100, height: 80 },
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
  };
}

class CanvasPort implements DrawingWorkspacePort {
  readonly value = workspaceSnapshot();
  groundingOverlay: DrawingGroundingOverlay | null = null;

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(): Promise<DrawingWorkspaceCommitResult> {
    return { status: 'committed', snapshot: this.value };
  }

  async loadGroundingOverlay(): Promise<DrawingGroundingOverlay | null> {
    return this.groundingOverlay;
  }

  async loadSource() {
    return { url: 'blob:source-1', dispose() {} };
  }
}

async function loadedStore() {
  const store = createDrawingWorkspaceStore({ port: new CanvasPort() });
  await store.getState().load();
  store.getState().setViewport({ x: 400, y: 300, scale: 2, width: 800, height: 600 });
  return store;
}

describe('shared Canvas rendering', () => {
  it('renders extracted entities and non-topology relations without exposing the source raster or connected labels', async () => {
    const store = await loadedStore();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('data-cad-grid="true"');
    expect(markup).toContain('data-axis="x"');
    expect(markup).toContain('data-axis="y"');
    expect(markup).not.toContain('href="blob:source-1"');
    expect(markup).toContain('data-entity-id="line-1"');
    expect(markup).toContain('data-entity-id="circle-1"');
    expect(markup).toMatch(/data-entity-id="spline-1"[^>]*><path d="M 1 0 L /);
    expect(markup).toContain('data-entity-id="text-1"');
    expect(markup).not.toContain('data-relation-id="relation-1"');
    expect(markup).not.toContain('connected');
    expect(markup).toContain('data-relation-id="relation-2"');
    expect(markup).toContain('vector-effect="non-scaling-stroke"');
  });

  it('shows the source raster only after the source toggle is explicitly enabled', async () => {
    const store = await loadedStore();
    store.getState().setDisplay({ sourceUnderlay: true });

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('href="blob:source-1"');
    expect(markup).toContain('transform="matrix(5 0 0 -5 0 400)"');
  });

  it('applies annotation, relation, source, and selection state from the scoped store', async () => {
    const store = await loadedStore();
    store.getState().setDisplay({ annotations: false, relations: false, sourceUnderlay: false });
    store.getState().setSelection(['circle-1']);

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).not.toContain('href="blob:source-1"');
    expect(markup).not.toContain('data-entity-id="text-1"');
    expect(markup).not.toContain('data-relation-id="relation-1"');
    expect(markup).toContain('data-entity-id="circle-1"');
    expect(markup).toContain('data-selected="true"');
  });

  it('renders grounded nodes with a transient AI state distinct from user selection', async () => {
    const port = new CanvasPort();
    port.groundingOverlay = {
      version: 1,
      drawingRef: structuredClone(port.value.ref),
      taskId: 'task-pose',
      stateEpoch: 1,
      disposition: 'active',
      groups: [{
        groundingId: 'ground-left', partKey: 'left-arm', label: '左臂', colorIndex: 0,
        nodeIds: ['line-1'],
        interfaces: [{ interfaceId: 'left-shoulder', nodeId: 'line-1', endpoint: 'start' }],
      }, {
        groundingId: 'ground-right', partKey: 'right-hand', label: '右手', colorIndex: 1,
        nodeIds: ['circle-1'], interfaces: [],
      }],
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();
    store.getState().setViewport({ x: 400, y: 300, scale: 2, width: 800, height: 600 });

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toMatch(/class="[^"]*vai-entity--ai-grounded[^"]*"[^>]*data-entity-id="line-1"/);
    expect(markup).toMatch(/class="[^"]*vai-entity--ai-grounded[^"]*"[^>]*data-entity-id="circle-1"/);
    expect(markup).toContain('data-ai-grounded="true"');
    expect(markup).not.toContain('data-selected="true"');
    expect(markup).not.toContain('data-grounding-group');
    expect(markup).not.toContain('data-grounding-label');
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('does not flash fixed reference groups as AI-selected geometry', async () => {
    const port = new CanvasPort();
    port.groundingOverlay = {
      version: 1,
      drawingRef: structuredClone(port.value.ref),
      taskId: 'task-motion-reference',
      stateEpoch: 1,
      disposition: 'active',
      groups: [{
        groundingId: 'ground-arm', partKey: 'left-arm', label: '左臂', colorIndex: 0,
        role: 'target', nodeIds: ['line-1'], interfaces: [],
      }, {
        groundingId: 'ground-body', partKey: 'fixed-body', label: '固定身体', colorIndex: 1,
        role: 'reference', nodeIds: ['circle-1'], interfaces: [],
      }],
    } as never;
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toMatch(/class="[^"]*vai-entity--ai-grounded[^"]*"[^>]*data-entity-id="line-1"/);
    expect(markup).not.toMatch(/class="[^"]*vai-entity--ai-grounded[^"]*"[^>]*data-entity-id="circle-1"/);
  });

  it('shows a clean candidate with only changed original positions ghosted while motion preview is held', async () => {
    const store = await loadedStore();
    const formal = store.getState().snapshot;
    if (formal === null) throw new Error('expected drawing');
    const candidate = structuredClone(formal);
    const movedLine = candidate.document.geometry.find(({ id }) => id === 'line-1');
    if (movedLine?.type !== 'line') throw new Error('expected line');
    movedLine.start = [20, 10];
    movedLine.end = [120, 10];
    store.setState({
      displaySnapshot: candidate,
      selectedIds: ['line-1'],
      groundingOverlay: {
        version: 1,
        drawingRef: structuredClone(formal.ref),
        taskId: 'task-preview',
        stateEpoch: 1,
        disposition: 'active',
        groups: [{
          groundingId: 'ground-line', partKey: 'arm', label: '手臂', colorIndex: 0,
          nodeIds: ['line-1'], interfaces: [],
        }],
      },
      motionRig: {
        phase: 'preview',
        projection: {
          version: 1,
          drawingRef: structuredClone(formal.ref),
          state: 'ready',
          controlBodyNodeIds: ['line-1', 'circle-1'],
          connectors: [],
          anchor: [0, 0],
          handle: [20, 10],
          keepAnchorFixed: true,
          keepControlBodyRigid: true,
          preserveConnectivity: true,
          allowControlRotation: false,
        },
      },
    });

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas motionPreviewHeld />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('data-motion-preview-held="true"');
    expect(markup).toContain('data-motion-preview-before="line-1"');
    expect(markup).not.toContain('data-motion-preview-before="circle-1"');
    expect(markup).toContain('<line x1="0" y1="0" x2="100" y2="0"');
    expect(markup).toContain('<line x1="20" y1="10" x2="120" y2="10"');
    expect(markup).not.toContain('data-selected="true"');
    expect(markup).not.toContain('data-ai-grounded="true"');
    expect(markup).not.toContain('data-motion-rig-active="true"');
    expect(markup).not.toContain('data-motion-rig-state');
  });
});
