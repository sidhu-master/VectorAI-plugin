// SPDX-License-Identifier: Apache-2.0

import {
  createEmptyDrawing,
  type AnnotationId,
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
import { ObjectList } from './ObjectList';
import { PropertyInspector } from './PropertyInspector';
import { WorkspaceStatus } from './WorkspaceStatus';
import { WorkspaceToolbar } from './WorkspaceToolbar';

const quality = { status: 'confirmed' as const, evidenceRefs: [] };

class PanelPort implements DrawingWorkspacePort {
  readonly value: DrawingWorkspaceSnapshot;
  groundingOverlay: DrawingGroundingOverlay | null = null;

  constructor() {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-panels' }, now: () => 1 });
    document.geometry = [{
      id: 'circle-1' as GeometryId,
      type: 'circle', center: [10, 20], radius: 8, visible: true, quality,
    }, {
      id: 'line-1' as GeometryId,
      type: 'line', start: [0, 0], end: [30, 0], visible: false, quality,
    }];
    document.annotations = [{
      id: 'text-1' as AnnotationId,
      type: 'text', content: '孔', position: [10, 20], height: 4, rotation: 0,
      alignment: 'center', verticalAlignment: 'middle', visible: true, quality,
    }];
    this.value = {
      version: 1,
      ref: { drawingId: 'drawing-panels', revision: 12 },
      document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
  }

  async load(): Promise<DrawingWorkspaceSnapshot> {
    return this.value;
  }

  async commit(): Promise<DrawingWorkspaceCommitResult> {
    return { status: 'committed', snapshot: this.value };
  }

  async loadGroundingOverlay(): Promise<DrawingGroundingOverlay | null> {
    return this.groundingOverlay;
  }
}

describe('shared drawing workspace panels', () => {
  it('renders grouped objects with visibility and delete controls', async () => {
    const store = createDrawingWorkspaceStore({ port: new PanelPort() });
    await store.getState().load();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <ObjectList />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('几何图元');
    expect(markup).toContain('标注');
    expect(markup).toContain('circle-1');
    expect(markup).toContain('line-1');
    expect(markup).toContain('text-1');
    expect(markup).toContain('aria-label="隐藏 circle-1"');
    expect(markup).toContain('aria-label="显示 line-1"');
    expect(markup).toContain('aria-label="删除 text-1"');
  });

  it('shows editable properties for the selected node', async () => {
    const store = createDrawingWorkspaceStore({ port: new PanelPort() });
    await store.getState().load();
    store.getState().setSelection(['circle-1']);

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <PropertyInspector />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('图元属性');
    expect(markup).toContain('circle-1');
    expect(markup).toContain('圆心 X');
    expect(markup).toContain('圆心 Y');
    expect(markup).toContain('半径');
    expect(markup).toContain('value="8"');
  });

  it('shows display tools and precise workspace status', async () => {
    const store = createDrawingWorkspaceStore({ port: new PanelPort() });
    await store.getState().load();
    store.getState().setViewport({ x: 0, y: 0, scale: 2, width: 800, height: 600 });
    store.getState().setMouseWorld([50, 25]);

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <WorkspaceToolbar />
        <WorkspaceStatus />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('适配图纸');
    expect(markup).toContain('网格');
    expect(markup).toContain('坐标轴');
    expect(markup).toContain('关系');
    expect(markup).toContain('标注');
    expect(markup).toContain('X 50.000');
    expect(markup).toContain('Y 25.000');
    expect(markup).toContain('200%');
    expect(markup).toContain('Revision 12');
  });

  it('shows AI-grounded objects with a transient row state distinct from user selection', async () => {
    const port = new PanelPort();
    port.groundingOverlay = {
      version: 1,
      drawingRef: structuredClone(port.value.ref),
      taskId: 'task-pose',
      groups: [{
        groundingId: 'ground-arm', partKey: 'arm', label: '左臂', colorIndex: 2,
        nodeIds: ['line-1'], interfaces: [],
      }],
    };
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <ObjectList />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toMatch(/class="vai-object-row vai-object-row--ai-grounded"[^>]*data-object-id="line-1"/);
    expect(markup).not.toContain('vai-object-row--selected');
    expect(markup).not.toContain('data-grounding-object');
    expect(markup).not.toContain('AI 识别：左臂');
    expect(store.getState().selectedIds).toEqual([]);
  });
});
