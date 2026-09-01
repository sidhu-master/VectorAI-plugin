// SPDX-License-Identifier: Apache-2.0

import { createEmptyDrawing, type DimensionAnnotation } from '@vectorai/drawing-core';
import { applySingleTolerance, type EngineeringAnnotationDraft } from '@vectorai/engineering-annotation';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';
import type { DrawingSurfaceRuntime } from '@vectorai/drawing-workspace';
import type { DrawingLayerRegistry } from '@vectorai/drawing-surface-api';
import { DrawingSurface } from '@vectorai/drawing-viewer-react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { AnnotationWorkspace } from './AnnotationWorkspace';
import { canvasLocalPoint } from './canvas-coordinates';
import type { PartitionController } from './partition-controller';
import type { DimensionChainController } from './dimension-chain-controller';
import type { GdtController } from './gdt-controller';
import { ANNOTATION_OPENING_ANGLE_LAYER, ANNOTATION_PARTITION_LAYER } from './drawing-layers';
import { createToleranceController, type ToleranceRemote } from './tolerance-controller';
import { TolerancePopup } from './TolerancePopup';

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

function toleranceSuccess<T>(value: T) {
  return { ok: true as const, value };
}

function toleranceRemote(
  drawingRef: { drawingId: string; revision: number },
  editTolerance: ToleranceRemote['editTolerance'],
): ToleranceRemote {
  return {
    queryToleranceCatalog: vi.fn(async (_sessionId, request) => toleranceSuccess({
      drawingRef,
      dimensionIntentId: request.dimensionIntentId,
      featureClass: request.featureClass,
      standardRef: { id: 'GB/T 1800', edition: '2020' },
      datasetMetadata: {
        completeness: 'partial' as const,
        catalogClassification: 'unverified' as const,
        numericProvenance: [{ kind: 'plan-reference-vector' as const, referenceId: 'task-8', description: 'test vector' }],
      },
      bands: [{ designation: request.featureClass === 'external' ? 'u6' : 'H7', featureClass: request.featureClass, category: 'unknown' as const, available: true }],
    })),
    previewTolerance: vi.fn(async (_sessionId, request) => {
      if (request.type === 'fit') {
        if (request.secondaryDimensionIntentId === 'intent-3') {
          return { ok: false as const, error: { code: 'REMOTE', message: 'FIT_PAIR_BASIC_SIZE_MISMATCH', details: {} } };
        }
        const holeDimensionIntentId = request.primaryFeatureClass === 'internal'
          ? request.primaryDimensionIntentId : request.secondaryDimensionIntentId;
        const shaftDimensionIntentId = request.primaryFeatureClass === 'external'
          ? request.primaryDimensionIntentId : request.secondaryDimensionIntentId;
        return toleranceSuccess({
          type: 'fit' as const, drawingRef, holeDimensionIntentId, shaftDimensionIntentId, status: 'resolved' as const,
          result: {
            designation: request.designation, basis: request.basis,
            hole: {
              designation: 'H7', featureClass: 'internal' as const, basicSize: 13, unit: 'mm' as const,
              upperDeviation: .018, lowerDeviation: 0, toleranceMagnitude: .018,
              upperLimitSize: 13.018, lowerLimitSize: 13,
              standardRef: { id: 'GB/T 1800', edition: '2020' },
              ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:fit-hole' },
            },
            shaft: {
              designation: 'g6', featureClass: 'external' as const, basicSize: 13, unit: 'mm' as const,
              upperDeviation: -.006, lowerDeviation: -.017, toleranceMagnitude: .011,
              upperLimitSize: 12.994, lowerLimitSize: 12.983,
              standardRef: { id: 'GB/T 1800', edition: '2020' },
              ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:fit-shaft' },
            },
            fitType: 'clearance' as const, minimumClearance: .006, maximumClearance: .035,
          },
        });
      }
      return toleranceSuccess({
        type: 'single' as const,
        drawingRef,
        dimensionIntentId: request.dimensionIntentId,
        status: 'resolved' as const,
        result: {
          designation: request.designation,
          featureClass: request.featureClass,
          basicSize: 13,
          unit: 'mm' as const,
          upperDeviation: .044,
          lowerDeviation: .033,
          toleranceMagnitude: .011,
          upperLimitSize: 13.044,
          lowerLimitSize: 13.033,
          standardRef: { id: 'GB/T 1800', edition: '2020' },
          ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:task-8' },
        },
      });
    }),
    editTolerance,
  };
}

describe('AnnotationWorkspace', () => {
  it('opens one tolerance popup from exact drawing entry points and previews without mutating workspace state', async () => {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { requestAnimationFrame: (callback: FrameRequestCallback) => callback(0) }));
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    const dimension = {
      id: 'dimension-1' as never,
      type: 'dimension' as const,
      dimensionKind: 'linear' as const,
      associationStatus: 'resolved' as const,
      targets: [],
      computedValue: 13,
      unit: 'mm' as const,
      textPosition: [20, 10] as [number, number],
      definitionPoints: [[0, 0], [13, 0]] as [number, number][],
      engineeringIntentId: 'intent-1',
      visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    } satisfies DimensionAnnotation;
    const fitDimension = {
      ...structuredClone(dimension),
      id: 'dimension-2' as never,
      engineeringIntentId: 'intent-2',
      textPosition: [40, 10] as [number, number],
    } satisfies DimensionAnnotation;
    const unequalFitDimension = {
      ...structuredClone(fitDimension),
      id: 'dimension-3' as never,
      engineeringIntentId: 'intent-3',
      computedValue: 14,
      textPosition: [60, 10] as [number, number],
    } satisfies DimensionAnnotation;
    document.annotations = [dimension, fitDimension, unequalFitDimension];
    const snapshot = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
    const viewportValue = { x: 17, y: 23, scale: 4, width: 800, height: 600 };
    const selection = mutableObservable<readonly string[]>(['dimension-1']);
    const setSelection = vi.fn((ids: readonly string[]) => selection.set(ids));
    const setViewport = vi.fn();
    const runtime = {
      snapshot: observable(snapshot),
      viewport: observable(viewportValue),
      selection,
      presentation: observable({
        displaySnapshot: snapshot, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport, setSelection, refresh: vi.fn(async () => undefined) },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({ version: 1 as const, workspaceClaimed: true, activationEpoch: 1, workflow: { status: 'completed' as const } });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;
    const dimensionDraft: EngineeringAnnotationDraft = {
      version: 1, drawingRef: snapshot.ref, datums: [],
      intents: [dimension, fitDimension, unequalFitDimension].map((annotation) => ({
        id: annotation.engineeringIntentId!, drawingRef: snapshot.ref, kind: annotation.dimensionKind,
        targets: [], datumIds: [], nominalValue: annotation.computedValue!, unit: annotation.unit,
        functionalRole: 'assembly' as const, source: 'geometry' as const, status: 'resolved' as const, evidenceIds: [],
      })),
      tolerances: [], fitAssignments: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
    };
    const dimensionState = mutableObservable({
      plan: {
        version: 1 as const, phase: 'editing' as const, drawingRef: snapshot.ref, draft: dimensionDraft,
        canUndo: false, canRedo: false, updatedAt: 1,
      },
      busy: false, previewHeld: false, error: null,
    });
    type DimensionTestState = ReturnType<typeof dimensionState.getSnapshot>;
    let appliedSnapshot: DimensionTestState['plan'] = dimensionState.getSnapshot().plan;
    const dimensionRefresh = vi.fn(async () => {
      dimensionState.set({ ...dimensionState.getSnapshot(), plan: appliedSnapshot });
    });
    const dimensionChain = {
      state: dimensionState,
      actions: { refresh: dimensionRefresh, setPreviewHeld() {} }, dispose() {},
    } as unknown as DimensionChainController;
    const gdtRefresh = vi.fn(async () => undefined);
    const gdt = {
      state: observable({ plan: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: gdtRefresh, setPreviewHeld() {} }, dispose() {},
    } as unknown as GdtController;
    const editTolerance = vi.fn(async () => {
      appliedSnapshot = {
        ...dimensionState.getSnapshot().plan,
        draft: applySingleTolerance(dimensionDraft, {
          designation: 'u6', featureClass: 'external', basicSize: 13, unit: 'mm',
          upperDeviation: .044, lowerDeviation: .033, upperLimitSize: 13.044, lowerLimitSize: 13.033,
          standardRef: { id: 'GB/T 1800', edition: '2020' },
          ruleRef: { id: 'GB/T 1800', version: '2020', inputDigest: 'sha256:task-8' },
        }, {
          dimensionIntentId: 'intent-1', selectionSource: 'manual', displayPreference: 'both', evidenceRefs: [],
        }),
        canUndo: true, updatedAt: 2,
      };
      return toleranceSuccess(appliedSnapshot as unknown as DimensionPlanSessionSnapshot);
    });
    const tolerance = createToleranceController({
      sessionId: 'session-1',
      remote: toleranceRemote(snapshot.ref, editTolerance),
      viewport: viewportValue,
    });
    const before = {
      snapshot: structuredClone(snapshot), viewport: structuredClone(viewportValue),
      selection: [...selection.getSnapshot()], dimension: structuredClone(dimensionChain.state.getSnapshot()),
    };
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state}
        partition={partition} dimensionChain={dimensionChain} gdt={gdt} tolerance={tolerance}
      />);
    });
    dimensionRefresh.mockClear();
    gdtRefresh.mockClear();
    setViewport.mockClear();
    const entity = renderer!.root.findByProps({ 'data-entity-id': 'dimension-1' });
    act(() => entity.props.onContextMenu({ clientX: 310, clientY: 170, preventDefault() {}, stopPropagation() {} }));
    const contextMenu = renderer!.root.findByProps({ 'data-annotation-dimension-context-menu': 'dimension-1' });
    await act(async () => { contextMenu.findByProps({ 'data-action': 'set-tolerance' }).props.onClick(); await Promise.resolve(); });

    expect(renderer!.root.findAllByType(TolerancePopup)).toHaveLength(1);
    expect(tolerance.state.getSnapshot()).toMatchObject({ instanceId: 1, target: { dimensionIntentId: 'intent-1' } });
    expect(renderer!.root.findByProps({ 'aria-label': '公差与配合面板' }).props.title).toBe('公差与配合');
    expect(renderer!.root.findAllByProps({ 'data-panel': 'tolerance' })).toHaveLength(0);

    await act(async () => renderer!.root.findByProps({ 'data-feature-class-choice': 'external' }).props.onClick());
    await act(async () => renderer!.root.findByProps({ 'data-tolerance-band': 'u6' }).props.onClick());
    const preview = renderer!.root.findByProps({ 'data-tolerance-preview': 'intent-1' });
    expect(preview.findByProps({ 'data-entity-id': 'dimension-1' }).props['data-preview-diff']).toBe('updated');
    expect(runtime.snapshot.getSnapshot()).toEqual(before.snapshot);
    expect(runtime.viewport.getSnapshot()).toEqual(before.viewport);
    expect(setViewport).not.toHaveBeenCalled();
    expect(runtime.selection.getSnapshot()).toEqual(before.selection);
    expect(dimensionChain.state.getSnapshot()).toEqual(before.dimension);
    expect(editTolerance).not.toHaveBeenCalled();

    await act(async () => renderer!.root.findByType(TolerancePopup).props.onApply());
    expect(editTolerance).toHaveBeenCalledOnce();
    expect(dimensionRefresh).toHaveBeenCalledOnce();
    expect(gdtRefresh).toHaveBeenCalledOnce();
    expect(runtime.viewport.getSnapshot()).toEqual(before.viewport);
    expect(setViewport).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByProps({ 'data-tolerance-designation': 'dimension-1' })).toHaveLength(1);

    tolerance.actions.requestClose();
    await act(async () => { await Promise.resolve(); });
    expect(renderer!.root.findAllByType(TolerancePopup)).toHaveLength(0);
    await act(async () => renderer!.root.findByProps({ 'aria-label': '公差与配合面板' }).props.onClick());
    expect(renderer!.root.findAllByType(TolerancePopup)).toHaveLength(1);
    expect(tolerance.state.getSnapshot().instanceId).toBe(1);
    tolerance.actions.requestClose();
    await act(async () => { await Promise.resolve(); });
    await act(async () => renderer!.root.findByProps({ 'data-tolerance-designation': 'dimension-1' }).props.onDoubleClick({ preventDefault() {}, stopPropagation() {} }));
    expect(renderer!.root.findAllByType(TolerancePopup)).toHaveLength(1);
    expect(tolerance.state.getSnapshot().instanceId).toBe(1);

    await act(async () => renderer!.root.findByType(TolerancePopup).props.onTabChange('hole-fit'));
    await act(async () => renderer!.root.findByType(DrawingSurface).props.onSelectionChange(['dimension-2']));
    expect(tolerance.state.getSnapshot().fit).toMatchObject({
      selectingSecondTarget: false,
      secondTarget: {
        dimensionIntentId: 'intent-2',
        classification: { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' },
      },
    });
    await act(async () => renderer!.root.findByProps({ 'data-fit-feature-class-choice': 'internal' }).props.onClick());
    await act(async () => tolerance.actions.preview({ kind: 'fit', basis: 'hole', designation: 'H7/g6' }));
    expect(tolerance.state.getSnapshot().preview).toMatchObject({ type: 'fit', status: 'resolved' });
    expect(renderer!.root.findByType(DrawingSurface).props.selectedIds).toEqual(['dimension-1', 'dimension-2']);

    await act(async () => renderer!.root.findByType(TolerancePopup).props.onTabChange('hole-fit'));
    await act(async () => renderer!.root.findByType(DrawingSurface).props.onSelectionChange(['dimension-3']));
    await act(async () => renderer!.root.findByProps({ 'data-fit-feature-class-choice': 'internal' }).props.onClick());
    await act(async () => {
      await expect(tolerance.actions.preview({ kind: 'fit', basis: 'hole', designation: 'H7/g6' }))
        .rejects.toThrow('FIT_PAIR_BASIC_SIZE_MISMATCH');
    });
    expect(tolerance.state.getSnapshot()).toMatchObject({ error: 'FIT_PAIR_BASIC_SIZE_MISMATCH', preview: null, canvasPreview: null });
    expect(renderer!.root.findByType(DrawingSurface).props.selectedIds).toEqual(['dimension-1', 'dimension-3']);

    await act(async () => renderer!.root.findByType(TolerancePopup).props.onTabChange('hole-fit'));
    const selectionBeforeBlank = runtime.selection.getSnapshot();
    await act(async () => renderer!.root.findByType(DrawingSurface).props.onSelectionChange([]));
    expect(tolerance.state.getSnapshot()).toMatchObject({
      visible: true, target: { dimensionIntentId: 'intent-1' }, fit: { selectingSecondTarget: false },
    });
    expect(runtime.selection.getSnapshot()).toEqual(selectionBeforeBlank);
    expect(renderer!.root.findByType(DrawingSurface).props.selectedIds).toContain('dimension-1');
    expect(runtime.viewport.getSnapshot()).toEqual(before.viewport);
    expect(setViewport).not.toHaveBeenCalled();

    act(() => renderer!.unmount());
    tolerance.dispose();
    vi.unstubAllGlobals();
  });

  it('converts browser client coordinates to canvas-local popup coordinates', () => {
    expect(canvasLocalPoint({ x: 310, y: 170 }, { left: 110, top: 70 })).toEqual({ x: 200, y: 100 });
  });

  it('does not refit for dimension layout changes but still refits after a viewport resize', async () => {
    vi.stubGlobal('window', new EventTarget());
    const document = createEmptyDrawing({ idFactory: { next: () => 'drawing-1' }, now: () => 1 });
    document.geometry = [{
      id: 'axis-line' as never, type: 'line' as const, start: [0, 0], end: [100, 0], visible: true,
      quality: { status: 'confirmed' as const, evidenceRefs: [] },
    }];
    const snapshot = {
      version: 1 as const, ref: { drawingId: 'drawing-1', revision: 1 }, document,
      capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
    };
    const setViewport = vi.fn();
    const viewport = mutableObservable({ x: 10, y: 20, scale: 3, width: 800, height: 600 });
    const runtime = {
      snapshot: observable(snapshot),
      viewport,
      selection: observable([]),
      presentation: observable({
        displaySnapshot: snapshot, preview: null, groundingOverlay: null, motionRig: null,
        sourceUrl: null, display: { grid: true, axes: true, relations: true, annotations: true, sourceUnderlay: false },
        busy: false, error: null,
      }),
      actions: { setViewport, setSelection() {}, refresh: async () => undefined },
    } as unknown as DrawingSurfaceRuntime;
    const state = observable({ version: 1 as const, workspaceClaimed: true, activationEpoch: 1, workflow: { status: 'completed' as const } });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;
    const axialScheme = {
      topology: {
        axis: { origin: [0, 0], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 100 }, unit: 'mm',
        stations: [{ id: 's0', sourceCoordinate: 0 }, { id: 's1', sourceCoordinate: 100 }], elementarySpans: [],
      },
      candidates: [{ id: 'overall', startStationId: 's0', endStationId: 's1', nominalValue: 100 }],
      displayedCandidateIds: ['overall'], closureCandidateIds: [], chains: [], diagnostics: [],
    };
    const dimensionState = mutableObservable({
      plan: {
        version: 1 as const, phase: 'editing' as const, drawingRef: snapshot.ref,
        draft: { version: 1, drawingRef: snapshot.ref, datums: [], intents: [], tolerances: [], fitAssignments: [], chains: [], dependencies: [], diagnostics: [], axialScheme },
        canUndo: false, canRedo: false, updatedAt: 1,
      },
      busy: false, previewHeld: false, error: null,
    });
    const dimensionChain = {
      state: dimensionState,
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as DimensionChainController;
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state}
        partition={partition} dimensionChain={dimensionChain}
      />);
    });
    setViewport.mockClear();
    await act(async () => {
      dimensionState.set({
        ...dimensionState.getSnapshot(),
        plan: {
          ...dimensionState.getSnapshot().plan,
          draft: { ...dimensionState.getSnapshot().plan.draft, axialScheme: { ...axialScheme, layout: { chainNormalOffsets: [], candidateNormalOffsets: [{ candidateId: 'overall', normalOffset: 20 }] } } },
          updatedAt: 2,
        },
      } as never);
    });
    expect(setViewport).not.toHaveBeenCalled();
    await act(async () => {
      viewport.set({ ...viewport.getSnapshot(), width: 1_000 });
    });
    expect(setViewport).toHaveBeenCalledWith(expect.objectContaining({ width: 1_000, height: 600 }));
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });

  it('surfaces a failed dimension layout save with retry guidance', async () => {
    vi.stubGlobal('window', new EventTarget());
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
    const state = observable({ version: 1 as const, workspaceClaimed: true, activationEpoch: 1, workflow: { status: 'completed' as const } });
    const partition = {
      state: observable({ partition: { version: 1, phase: 'idle', canUndo: false, canRedo: false, updatedAt: 0 }, busy: false, previewHeld: false, error: null }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as PartitionController;
    const dimensionChain = {
      state: observable({
        plan: { version: 1, phase: 'editing', canUndo: false, canRedo: false, updatedAt: 1 },
        busy: false, previewHeld: false, error: 'transport failed',
      }),
      actions: { refresh: async () => undefined, setPreviewHeld() {} }, dispose() {},
    } as unknown as DimensionChainController;

    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AnnotationWorkspace
        sessionId="session-1" namespace="engineering-annotation" runtime={runtime} state={state}
        partition={partition} dimensionChain={dimensionChain}
      />);
    });
    expect(renderer!.root.findByProps({ role: 'alert' }).children.join('')).toContain('请重新拖动后再试');
    act(() => renderer!.unmount());
    vi.unstubAllGlobals();
  });

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

  it('hides only the partition overlay from the upper-right layer manager', async () => {
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
    const registeredLayerDefinitions = [ANNOTATION_PARTITION_LAYER, ANNOTATION_OPENING_ANGLE_LAYER] as const;
    const layerRegistry = {
      getLayers: () => registeredLayerDefinitions,
      subscribeLayers: () => () => undefined,
    } as unknown as DrawingLayerRegistry;

    const createWorkspace = (sessionId: string) => <AnnotationWorkspace
      sessionId={sessionId}
      namespace="engineering-annotation"
      runtime={runtime}
      state={state}
      partition={partition}
      layerRegistry={layerRegistry}
      dimensionPlan={{
        draft: {
          version: 1, drawingRef: snapshot.ref, datums: [], intents: [], tolerances: [], fitAssignments: [], geometricTolerances: [], chains: [], dependencies: [], diagnostics: [],
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
    expect(markup).toContain('aria-label="管理图层"');
    expect(markup).not.toContain('aria-label="隐藏分区框"');

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
    act(() => renderer!.root.findByProps({ 'aria-label': '管理图层' }).props.onClick());
    expect(renderer!.root.findAllByProps({ 'aria-label': '隐藏开角标注' })).toHaveLength(1);
    act(() => renderer!.root.findByProps({ 'aria-label': '隐藏开角标注' }).props.onClick());
    expect(renderer!.root.findAllByProps({ 'data-entity-id': 'opening-angle' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(1);
    act(() => renderer!.root.findByProps({ 'aria-label': '隐藏智能分区' }).props.onClick());
    expect(renderer!.root.findAllByProps({ 'data-partition-overlay': 'true' })).toHaveLength(0);
    expect(renderer!.root.findAllByProps({ 'aria-label': '显示智能分区' })).toHaveLength(1);
    expect(renderer!.root.findAllByProps({ 'aria-label': '确认分区' })).toHaveLength(1);
    act(() => renderer!.root.findByProps({ 'aria-label': '图纸结构面板' }).props.onClick());
    expect(renderer!.root.findAllByProps({ 'aria-label': '隐藏分区框' })).toHaveLength(0);
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
