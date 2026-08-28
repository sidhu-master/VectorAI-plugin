// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing } from '@vectorai/drawing-core';
import type { DrawingSurfaceRuntime } from '@vectorai/drawing-workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import type { PartitionController } from './partition-controller';

function observable<T>(value: T) {
  return { getSnapshot: () => value, subscribe: () => () => undefined };
}

function mutableObservable<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next: T) { value = next; for (const listener of listeners) listener(); },
  };
}

describe('AnnotationWorkspace', () => {
  it('keeps hydrating a cached partition controller until the Host draft is ready', async () => {
    vi.useFakeTimers();
    const testWindow = new EventTarget() as EventTarget & Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
    testWindow.setInterval = globalThis.setInterval;
    testWindow.clearInterval = globalThis.clearInterval;
    vi.stubGlobal('window', testWindow);
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const snapshot = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
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
      actions: { setViewport() {}, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: true, activationEpoch: 12,
      workflow: { status: 'running' as const, workflowId: 'partition-1' },
    });
    const partitionListeners = new Set<() => void>();
    let partitionSnapshot = {
      partition: { version: 1 as const, phase: 'idle' as const, canUndo: false, canRedo: false, updatedAt: 0 },
      busy: false, previewHeld: false, error: null,
    } as PartitionController['state'] extends { getSnapshot(): infer State } ? State : never;
    const refreshPartition = vi.fn(async () => {
      partitionSnapshot = refreshPartition.mock.calls.length === 1
        ? { ...partitionSnapshot, partition: { ...partitionSnapshot.partition, phase: 'analyzing', updatedAt: 1 } }
        : { ...partitionSnapshot, partition: { version: 1, phase: 'editing', drawingRef: snapshot.ref, draft: {
          version: 1, drawingRef: snapshot.ref,
          axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 10, orientation: 'forward' },
          segments: [{ id: 'segment:1', zStart: 0, zEnd: 10, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: [], diagnosticIds: [] }],
          semanticGroups: [{ id: 'group:1', segmentIds: ['segment:1'], semanticType: 'bearing-seat', name: '轴承位', evidenceIds: [] }],
          stepCandidates: [], evidence: [], diagnostics: [],
        }, canUndo: false, canRedo: false, updatedAt: 2 } };
      for (const listener of partitionListeners) listener();
    });
    const partition = {
      state: {
        getSnapshot: () => partitionSnapshot,
        subscribe(listener: () => void) { partitionListeners.add(listener); return () => partitionListeners.delete(listener); },
      },
      actions: { refresh: refreshPartition, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
      />);
    });

    expect(refreshPartition).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(refreshPartition).toHaveBeenCalledTimes(2);
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(1);
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('stops hydrating when the annotation workflow has failed even if the partition phase is stale', async () => {
    vi.useFakeTimers();
    const testWindow = new EventTarget() as EventTarget & Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
    testWindow.setInterval = globalThis.setInterval;
    testWindow.clearInterval = globalThis.clearInterval;
    vi.stubGlobal('window', testWindow);
    const refreshPartition = vi.fn(async () => undefined);
    const runtime = {
      snapshot: observable(null),
      viewport: observable({ x: 0, y: 0, scale: 1, width: 800, height: 600 }),
      selection: observable([]),
      presentation: observable({
        displaySnapshot: null, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport() {}, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: true, activationEpoch: 12,
      workflow: { status: 'failed' as const, workflowId: 'partition-1', error: 'analysis rejected' },
    });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'analyzing', canUndo: false, canRedo: false, updatedAt: 1 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: refreshPartition, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
      />);
    });
    expect(refreshPartition).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(refreshPartition).toHaveBeenCalledOnce();

    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fits the drawing when the specialized workspace first takes over', async () => {
    const testWindow = new EventTarget() as EventTarget & Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
    testWindow.setInterval = globalThis.setInterval;
    testWindow.clearInterval = globalThis.clearInterval;
    vi.stubGlobal('window', testWindow);
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const snapshot = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
    const setViewport = vi.fn();
    const runtime = {
      snapshot: observable(snapshot),
      viewport: observable({ x: -999, y: -999, scale: 9, width: 800, height: 600 }),
      selection: observable([]),
      presentation: observable({
        displaySnapshot: snapshot, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: true, activationEpoch: 1,
      workflow: { status: 'running' as const, workflowId: 'partition-1' },
    });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'editing', drawingRef: snapshot.ref, canUndo: false, canRedo: false, updatedAt: 1 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
      />);
    });
    expect(setViewport).toHaveBeenCalledWith(expect.objectContaining({ width: 800, height: 600 }));
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });

  it('refreshes the partition binding after annotation advances the drawing revision', async () => {
    vi.stubGlobal('window', new EventTarget());
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const first = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
    const second = { ...first, ref: { drawingId: 'drawing-1', revision: 2 } };
    const snapshot = mutableObservable(first);
    const presentation = mutableObservable({
      displaySnapshot: first, preview: null, groundingOverlay: null, motionRig: null,
      sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
      busy: false, error: null,
    });
    const runtime = {
      snapshot,
      viewport: observable({ x: 0, y: 0, scale: 1, width: 800, height: 600 }),
      selection: observable([]), presentation,
      actions: { setViewport() {}, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: true, activationEpoch: 1,
      workflow: { status: 'completed' as const, workflowId: 'annotation-1' },
    });
    const refresh = vi.fn(async () => undefined);
    const partition = {
      state: observable({ partition: { version: 1, phase: 'editing', drawingRef: first.ref, canUndo: false, canRedo: false, updatedAt: 1 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
      />);
    });
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => {
      snapshot.set(second);
      presentation.set({ ...presentation.getSnapshot(), displaySnapshot: second });
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });

  it('keeps refreshing the shared drawing while an imported partition is being analyzed', async () => {
    vi.useFakeTimers();
    const testWindow = new EventTarget() as EventTarget & Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
    testWindow.setInterval = globalThis.setInterval;
    testWindow.clearInterval = globalThis.clearInterval;
    vi.stubGlobal('window', testWindow);
    const refresh = vi.fn(async () => undefined);
    const runtime = {
      snapshot: observable(null),
      viewport: observable({ x: 0, y: 0, scale: 1, width: 800, height: 600 }),
      selection: observable([]),
      presentation: observable({
        displaySnapshot: null, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport() {}, setSelection() {}, refresh },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: true, activationEpoch: 1,
      workflow: { status: 'running' as const, workflowId: 'partition-1' },
    });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'analyzing', canUndo: false, canRedo: false, updatedAt: 1 }, busy: true, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
      />);
    });
    const progress = renderer!.root.findByProps({ 'data-partition-progress': 'analyzing' });
    expect(progress.findAll((node) => node.children.includes('正在识别轴段并进行 AI 语义复核'))).toHaveLength(1);
    expect(refresh).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(2);
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('offers the complete engineering file matrix through the bottom upload control and confirms staged documents', async () => {
    vi.stubGlobal('window', new EventTarget());
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const snapshot = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
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
      actions: { setViewport() {}, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({
      version: 1 as const, workspaceClaimed: false, activationEpoch: 0, workflow: { status: 'idle' as const },
    });
    const stageDocuments = vi.fn(async () => undefined);
    const clearDocuments = vi.fn()
      .mockRejectedValueOnce(new Error('DOCUMENT_CLEAR_FAILED'))
      .mockResolvedValueOnce(undefined);
    const partition = {
      state: observable({ partition: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {}, stageDocuments, clearDocuments }, dispose() {},
    } as unknown as PartitionController;

    const renderer = TestRenderer.create(<AnnotationWorkspace
      sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state} partition={partition}
    />);
    expect(renderer.root.findAllByProps({ 'aria-label': '导入工程文件面板' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-panel': 'import' })).toHaveLength(0);
    const accepts = renderer.root.findAllByType('input').map((input) => input.props.accept as string);
    expect(accepts).toHaveLength(1);
    expect(accepts[0]).toContain('.dxf,application/dxf');
    expect(renderer.root.findAllByType('input').some((input) => input.props.multiple === true)).toBe(true);
    for (const extension of ['.txt', '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp', '.rtf', '.epub']) {
      expect(accepts.some((accept) => accept.includes(extension))).toBe(true);
    }
    const engineeringDocument = new File(['dimensions'], 'dimensions.txt', { type: 'text/plain' });
    await act(async () => {
      renderer.root.findByType('input').props.onChange({ currentTarget: { files: [engineeringDocument], value: 'dimensions.txt' } });
    });
    expect(stageDocuments).toHaveBeenCalledWith([engineeringDocument]);
    expect(renderer.root.findByProps({ role: 'status' }).findByType('span').children.join('')).toContain('已添加 1 份工程资料');
    await act(async () => { renderer.root.findByProps({ 'aria-label': '清除已添加的工程资料' }).props.onClick(); });
    expect(clearDocuments).toHaveBeenCalledOnce();
    const statusStack = renderer.root.findByProps({ 'data-annotation-status-stack': 'true' });
    expect(statusStack.findAllByProps({ role: 'status' })).toHaveLength(1);
    expect(statusStack.findAllByProps({ role: 'alert' })).toHaveLength(1);
    await act(async () => { renderer.root.findByProps({ 'aria-label': '清除已添加的工程资料' }).props.onClick(); });
    expect(clearDocuments).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByProps({ role: 'status' })).toHaveLength(0);
    act(() => renderer.unmount());
    vi.unstubAllGlobals();
  });

  it('hides only the partition overlay from the partition panel visibility switch', async () => {
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [0, 1].map((index) => ({
      id: `line-${index}` as never, type: 'line' as const,
      start: [index * 10, 0] as [number, number], end: [index * 10 + 5, 0] as [number, number],
      visible: true, quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }));
    document.relations = [{
      id: 'relation-1' as never, type: 'constraint', plane: 'constraint', kind: 'parallel',
      geometryIds: ['line-0', 'line-1'] as never, status: 'satisfied',
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];
    document.annotations = [{
      id: 'source-text' as never, type: 'text', position: [5, 5], content: 'SHOULD_HIDE',
      height: 2, rotation: 0, alignment: 'left', verticalAlignment: 'baseline',
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }, {
      id: 'opening-angle' as never, type: 'dimension', dimensionKind: 'angular',
      associationStatus: 'resolved', targets: [], computedValue: 60, displayText: '60°', unit: 'deg',
      textPosition: [4, 0], definitionPoints: [[0, 0], [6, -3], [6, 3], [3, -1.5], [3, 1.5]],
      visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    }];
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
      actions: { setViewport() {}, setSelection() {}, refresh: async () => undefined },
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
        segments: [{ id: 'segment:1', zStart: 0, zEnd: 10, profile: { minRadius: 4, maxRadius: 5, sampleCount: 2 }, boundaryConfidence: 1, geometryNodeIds: [], boundaryEvidenceIds: [], semanticEvidenceIds: ['document:region:1'], diagnosticIds: [] }],
        semanticGroups: [{ id: 'group:1', segmentIds: ['segment:1'], semanticType: 'bearing-seat', name: '轴承位', evidenceIds: ['document:region:1'] }],
        stepCandidates: [], evidence: [{ id: 'document:region:1', origin: 'document', label: '轴承位' }], diagnostics: [],
      }, canUndo: false, canRedo: false, updatedAt: 1 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;

    const createWorkspace = (sessionId: string) => <AnnotationWorkspace
      sessionId={sessionId}
      namespace="engineering-annotation"
      runtime={runtime}
      state={state}
      partition={partition}
      dimensionPlan={{
        draft: {
          version: 1, drawingRef: snapshot.ref, datums: [], intents: [], tolerances: [], chains: [], dependencies: [], diagnostics: [],
        },
        generationOrder: [],
      }}
    />;
    const workspace = createWorkspace('session-1');
    const markup = renderToStaticMarkup(workspace);
    expect(markup).toContain('data-annotation-workspace="true"');
    expect(markup).toContain('aria-label="信息面板工具栏"');
    expect(markup).toContain('vai-activity-bar--overlay');
    expect(markup).not.toContain('aria-label="导入工程文件面板"');
    expect(markup).toContain('aria-label="图纸结构面板"');
    expect(markup).not.toContain('aria-label="标注候选"');
    expect(markup).not.toContain('aria-label="冲突检查"');
    expect(markup).toContain('data-controlled-drawing-surface="true"');
    expect(markup).toContain('data-annotation-candidate-layer="true"');
    expect(markup).not.toContain('data-relation-id="relation-1"');
    expect(markup).not.toContain('SHOULD_HIDE');
    expect(markup).toContain('data-entity-id="opening-angle"');
    expect(markup).toContain('60°');
    expect(markup).toContain('分区草稿待确认');
    expect(markup).toContain('aria-label="取消分区"');
    expect(markup).toContain('aria-label="按住预览分区结果"');
    expect(markup).toContain('aria-label="确认分区"');
    expect(markup).toContain('aria-label="图纸操作工具"');
    expect(markup).toContain('aria-label="适配图纸"');
    expect(markup).toContain('aria-label="撤销"');
    expect(markup).toContain('aria-label="反撤销"');
    expect(markup).toContain('aria-label="上传图纸"');
    expect(markup).toContain('aria-label="导出 DXF"');
    expect(markup).toContain('accept=".dxf');
    expect(markup).toContain('multiple=""');
    expect(markup).not.toContain('aria-label="分区历史"');
    expect(markup).toContain('data-partition-origin="document"');

    const testWindow = new EventTarget() as EventTarget & Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
    testWindow.setInterval = globalThis.setInterval;
    testWindow.clearInterval = globalThis.clearInterval;
    vi.stubGlobal('window', testWindow);
    const storedVisibility = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storedVisibility.get(key) ?? null,
      setItem: (key: string, value: string) => { storedVisibility.set(key, value); },
    });
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(workspace); });
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(1);
    act(() => renderer!.root.findByProps({ 'aria-label': '图纸结构面板' }).props.onClick());
    act(() => renderer!.root.findByProps({ 'aria-label': '隐藏分区框' }).props.onClick());
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ 'aria-label': '显示分区框' })).toHaveLength(1);
    expect(renderer!.root.findAllByProps({ 'aria-label': '确认分区' })).toHaveLength(1);
    act(() => renderer!.unmount());

    await act(async () => { renderer = TestRenderer.create(createWorkspace('session-1')); });
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(0);
    act(() => renderer!.unmount());
    await act(async () => { renderer = TestRenderer.create(createWorkspace('session-2')); });
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(1);
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });
});
