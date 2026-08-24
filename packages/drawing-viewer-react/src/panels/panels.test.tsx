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

  it('shows drawing actions and precise workspace status', async () => {
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

    expect(markup).toContain('aria-label="适配图纸"');
    expect(markup).toContain('aria-label="撤销"');
    expect(markup).toContain('aria-label="反撤销"');
    expect(markup).toContain('aria-label="上传图纸"');
    expect(markup).toContain('aria-label="导出 DXF"');
    expect(markup).not.toMatch(/>适配图纸<|>撤销<|>反撤销<|>上传<|>导出</);
    expect(markup.match(/<svg/g)).toHaveLength(5);
    expect(markup).toContain('X 50.000');
    expect(markup).toContain('Y 25.000');
    expect(markup).toContain('200%');
    expect(markup).toContain('Revision 12');
  });

  it('renders cancel and confirm in a separate motion-rig toolbar', async () => {
    const store = createDrawingWorkspaceStore({ port: new PanelPort() });
    await store.getState().load();
    store.setState({
      motionRig: {
        projection: {
          version: 1,
          drawingRef: { drawingId: 'drawing-panels', revision: 12 },
          state: 'ready',
          controlBodyNodeIds: ['circle-1'],
          connectors: [],
          anchor: [10, 20],
          handle: [10, 20],
          keepAnchorFixed: true,
          keepControlBodyRigid: true,
          preserveConnectivity: true,
          allowControlRotation: false,
        },
        phase: 'preview',
      },
    });

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <WorkspaceToolbar />
      </DrawingWorkspaceProvider>,
    );

    const motionToolbarIndex = markup.indexOf('aria-label="姿态编辑操作"');
    const mainToolbarIndex = markup.indexOf('aria-label="图纸操作工具"');
    const cancelIndex = markup.indexOf('aria-label="取消姿态"');
    const previewIndex = markup.indexOf('aria-label="按住预览修改效果"');
    const separatorIndexes = [...markup.matchAll(/vai-toolbar__separator--motion-rig/g)]
      .map(({ index }) => index);
    const confirmIndex = markup.indexOf('aria-label="确认姿态"');
    expect(markup.match(/role="toolbar"/g)).toHaveLength(2);
    expect(motionToolbarIndex).toBeGreaterThan(-1);
    expect(cancelIndex).toBeGreaterThan(motionToolbarIndex);
    expect(separatorIndexes).toHaveLength(2);
    expect(separatorIndexes[0]).toBeGreaterThan(cancelIndex);
    expect(previewIndex).toBeGreaterThan(separatorIndexes[0]);
    expect(markup).toMatch(/class="vai-toolbar__action vai-toolbar__action--preview"[^>]*aria-label="按住预览修改效果"/);
    expect(separatorIndexes[1]).toBeGreaterThan(previewIndex);
    expect(confirmIndex).toBeGreaterThan(separatorIndexes[1]);
    expect(mainToolbarIndex).toBeGreaterThan(confirmIndex);
  });

  it('keeps colored motion-rig actions visible while dragging', async () => {
    const store = createDrawingWorkspaceStore({ port: new PanelPort() });
    await store.getState().load();
    store.setState({
      motionRig: {
        projection: {
          version: 1,
          drawingRef: { drawingId: 'drawing-panels', revision: 12 },
          state: 'ready',
          controlBodyNodeIds: ['circle-1'],
          connectors: [],
          anchor: [10, 20],
          handle: [10, 20],
          keepAnchorFixed: true,
          keepControlBodyRigid: true,
          preserveConnectivity: true,
          allowControlRotation: false,
        },
        phase: 'dragging',
      },
    });

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <WorkspaceToolbar />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toContain('aria-label="姿态编辑操作"');
    expect(markup).toMatch(/class="vai-toolbar__action vai-toolbar__action--cancel"[^>]*aria-label="取消姿态"/);
    expect(markup).toMatch(/class="vai-toolbar__action vai-toolbar__action--confirm"[^>]*aria-label="确认姿态"[^>]*disabled=""/);
  });

  it('shows AI-grounded objects with a transient row state distinct from user selection', async () => {
    const port = new PanelPort();
    port.groundingOverlay = {
      version: 1,
      drawingRef: structuredClone(port.value.ref),
      taskId: 'task-pose',
      stateEpoch: 1,
      disposition: 'active',
      groups: [{
        groundingId: 'ground-arm', partKey: 'arm', label: '左臂', colorIndex: 2,
        role: 'target', nodeIds: ['line-1'], interfaces: [],
      }, {
        groundingId: 'ground-body', partKey: 'fixed-body', label: '固定身体', colorIndex: 3,
        role: 'reference', nodeIds: ['circle-1'], interfaces: [],
      }],
    } as never;
    const store = createDrawingWorkspaceStore({ port });
    await store.getState().load();

    const markup = renderToStaticMarkup(
      <DrawingWorkspaceProvider store={store} autoLoad={false}>
        <ObjectList />
      </DrawingWorkspaceProvider>,
    );

    expect(markup).toMatch(/class="vai-object-row vai-object-row--ai-grounded"[^>]*data-object-id="line-1"/);
    expect(markup).not.toMatch(/class="vai-object-row vai-object-row--ai-grounded"[^>]*data-object-id="circle-1"/);
    expect(markup).not.toContain('vai-object-row--selected');
    expect(markup).not.toContain('data-grounding-object');
    expect(markup).not.toContain('AI 识别：左臂');
    expect(store.getState().selectedIds).toEqual([]);
  });
});
