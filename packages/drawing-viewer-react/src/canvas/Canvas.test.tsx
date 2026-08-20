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
  } as DrawingRelation];
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

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(): Promise<DrawingWorkspaceCommitResult> {
    return { status: 'committed', snapshot: this.value };
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
  it('renders an infinite grid, coordinate axes, source raster, entities, and relations', async () => {
    const store = await loadedStore();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <Canvas />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('data-cad-grid="true"');
    expect(markup).toContain('data-axis="x"');
    expect(markup).toContain('data-axis="y"');
    expect(markup).toContain('href="blob:source-1"');
    expect(markup).toContain('data-entity-id="line-1"');
    expect(markup).toContain('data-entity-id="circle-1"');
    expect(markup).toContain('data-entity-id="text-1"');
    expect(markup).toContain('data-relation-id="relation-1"');
    expect(markup).toContain('vector-effect="non-scaling-stroke"');
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
});
