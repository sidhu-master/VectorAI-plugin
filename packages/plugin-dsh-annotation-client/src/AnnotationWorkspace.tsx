// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerRegistry, DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type { DimensionAnnotation, DrawingDocument, ToleranceProjection } from '@vectorai/drawing-core';
import {
  DrawingSurface,
  DrawingLayerManager,
  PreviewLayer,
  WorkspaceActivityBar,
  WorkspaceToolbarView,
  fitViewportToDrawing,
  type WorkspacePanelDefinition,
} from '@vectorai/drawing-viewer-react';
import type {
  DrawingSurfaceRuntime,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import { DRAWING_ANNOTATED_DXF_EXPORT_PATH, type AnnotationSessionState, type EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import type { DrawingFileExport } from '@vectorai/plugin-dsh-space-client';
import { ListTree, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PartitionController } from './partition-controller';
import type { DimensionChainController } from './dimension-chain-controller';
import type { GdtController } from './gdt-controller';
import { runSharedAnnotationHistory } from './annotation-history';
import { DimensionChainOverlay, dimensionChainFitPadding } from './DimensionChainOverlay';
import { DimensionChainInspector } from './DimensionChainInspector';
import { PartitionOverlay } from './PartitionOverlay';
import { PartitionActionToolbar } from './PartitionActionToolbar';
import { PartitionInspector } from './PartitionInspector';
import { DimensionPlanInspector } from './DimensionPlanInspector';
import { GdtOverlay } from './GdtOverlay';
import { GdtInspector } from './GdtInspector';
import { ConfirmedPartitionInspector } from './ConfirmedPartitionInspector';
import { SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS } from './engineering-file-policy';
import { classifyEngineeringDrop } from './engineering-drop';
import { engineeringImportErrorText } from './EngineeringDropBridge';
import type { PartitionViewMode } from './partition-view-model';
import {
  ANNOTATION_OPENING_ANGLE_LAYER,
  ANNOTATION_OPENING_ANGLE_LAYER_ID,
  ANNOTATION_DIAMETER_LAYER,
  ANNOTATION_DIAMETER_LAYER_ID,
  ANNOTATION_DIMENSION_CHAIN_LAYER,
  ANNOTATION_DIMENSION_CHAIN_LAYER_ID,
  ANNOTATION_PARTITION_LAYER,
  ANNOTATION_PARTITION_LAYER_ID,
  ANNOTATION_DATUM_LAYER,
  ANNOTATION_DATUM_LAYER_ID,
  ANNOTATION_GDT_LAYER,
  ANNOTATION_GDT_LAYER_ID,
} from './drawing-layers';
import { readLayerVisibility, writeLayerVisibility } from './layer-visibility';
import { TolerancePopup } from './TolerancePopup';
import type { ToleranceController, ToleranceControllerState, ToleranceTarget } from './tolerance-controller';

const ENGINEERING_DOCUMENT_ACCEPT = SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',');
const ANNOTATION_UPLOAD_ACCEPT = `.dxf,application/dxf,${ENGINEERING_DOCUMENT_ACCEPT}`;
const PARTITION_HYDRATION_INTERVAL_MS = 500;
const PARTITION_HYDRATION_MAX_ATTEMPTS = 1_200;
const ANNOTATION_HYDRATION_INTERVAL_MS = 350;
const dimensionChainLayerId = (chainId: string) => `${ANNOTATION_DIMENSION_CHAIN_LAYER_ID}:${chainId}`;
type AnnotationPanelId = 'structure' | 'tolerance';
const FALLBACK_LAYER_DEFINITIONS = [ANNOTATION_PARTITION_LAYER, ANNOTATION_OPENING_ANGLE_LAYER, ANNOTATION_DIAMETER_LAYER, ANNOTATION_DIMENSION_CHAIN_LAYER, ANNOTATION_DATUM_LAYER, ANNOTATION_GDT_LAYER] as const;
const subscribeToNoLayers = () => () => undefined;
const readFallbackLayers = () => FALLBACK_LAYER_DEFINITIONS;
const EMPTY_DIMENSION_STATE = {
  plan: { version: 1 as const, phase: 'idle' as const, canUndo: false, canRedo: false, updatedAt: 0 },
  busy: false, previewHeld: false, error: null,
};
const EMPTY_DIMENSION_CONTROLLER: DimensionChainController = {
  state: {
    getSnapshot: () => EMPTY_DIMENSION_STATE,
    subscribe: () => () => undefined,
  },
  actions: {
    refresh: async () => undefined,
    setDisplayed: async () => undefined,
    chooseClosure: async () => undefined,
    moveChain: async () => undefined,
    moveCandidate: async () => undefined,
    confirm: async () => undefined,
    cancel: async () => undefined,
    undo: async () => undefined,
    redo: async () => undefined,
    setPreviewHeld: () => undefined,
  },
  dispose: () => undefined,
};
const EMPTY_GDT_STATE = {
  plan: { version: 1 as const, phase: 'idle' as const, canUndo: false, canRedo: false, updatedAt: 0 },
  busy: false, previewHeld: false, error: null,
};
const EMPTY_GDT_CONTROLLER: GdtController = {
  state: { getSnapshot: () => EMPTY_GDT_STATE, subscribe: () => () => undefined },
  actions: {
    refresh: async () => undefined, edit: async () => undefined,
    moveDatum: async () => undefined, moveFrame: async () => undefined,
    setOverride: async () => undefined, clearOverride: async () => undefined,
    confirm: async () => undefined, cancel: async () => undefined, undo: async () => undefined, redo: async () => undefined,
    setPreviewHeld: () => undefined,
  },
  dispose: () => undefined,
};
const EMPTY_TOLERANCE_STATE: ToleranceControllerState = {
  instanceId: 1, visible: false, geometry: { x: 0, y: 0, width: 760, height: 520 }, userPositioned: false,
  tab: 'recommendation', zoom: 1, standardEdition: '2020', target: null, pendingTarget: null,
  catalog: null, fitCatalogs: null, preview: null, canvasPreview: null, selection: null, override: null,
  displayPreference: 'deviations', fit: null, dirty: false, closeDecision: null, busy: false, error: null,
};
const EMPTY_TOLERANCE_CONTROLLER = {
  state: { getSnapshot: () => EMPTY_TOLERANCE_STATE, subscribe: () => () => undefined },
} as unknown as ToleranceController;

export interface AnnotationWorkspaceProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
  layerRegistry?: DrawingLayerRegistry;
  state: DrawingSurfaceObservable<AnnotationSessionState>;
  partition: PartitionController;
  dimensionChain?: DimensionChainController;
  gdt?: GdtController;
  tolerance?: ToleranceController;
  dimensionPlan?: { draft: EngineeringAnnotationDraft; generationOrder: string[] };
  drawingFileExport?: DrawingFileExport;
}

export function AnnotationWorkspace({ sessionId, namespace, runtime, state, partition, dimensionChain: suppliedDimensionChain, gdt: suppliedGdt, tolerance: suppliedTolerance, dimensionPlan, layerRegistry, drawingFileExport }: AnnotationWorkspaceProps) {
  const dimensionChain = suppliedDimensionChain ?? EMPTY_DIMENSION_CONTROLLER;
  const gdt = suppliedGdt ?? EMPTY_GDT_CONTROLLER;
  const tolerance = suppliedTolerance ?? EMPTY_TOLERANCE_CONTROLLER;
  const snapshot = useObservable(runtime.snapshot);
  const viewport = useObservable(runtime.viewport) as DrawingWorkspaceViewport;
  const selectedIds = useObservable(runtime.selection);
  const presentation = useObservable(runtime.presentation);
  const annotationState = useObservable(state);
  const partitionState = useObservable(partition.state);
  const dimensionState = useObservable(dimensionChain.state);
  const gdtState = useObservable(gdt.state);
  const toleranceState = useObservable(tolerance.state);
  const displaySnapshot = (presentation.displaySnapshot ?? snapshot) as DrawingWorkspaceSnapshot | null;
  const [importError, setImportError] = useState<string | null>(null);
  const [stagedDocumentNames, setStagedDocumentNames] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<AnnotationPanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(260);
  const [partitionView, setPartitionView] = useState<PartitionViewMode>('functional');
  const [selectedGdtIntentId, setSelectedGdtIntentId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [dimensionContextMenu, setDimensionContextMenu] = useState<{
    annotationId: string; target: ToleranceTarget; position: { x: number; y: number };
  } | null>(null);
  const [fitAttemptAnnotationId, setFitAttemptAnnotationId] = useState<string | null>(null);
  const registeredLayers = useSyncExternalStore(
    layerRegistry?.subscribeLayers ?? subscribeToNoLayers,
    layerRegistry?.getLayers ?? readFallbackLayers,
    layerRegistry?.getLayers ?? readFallbackLayers,
  );
  const [layerVisibility, setLayerVisibility] = useState(() => readLayerVisibility(
    sessionId,
    registeredLayers,
    typeof sessionStorage === 'undefined' ? null : sessionStorage,
  ));
  const displayedDrawingRef = useRef<string | null>(null);
  const initializedViewportDrawingId = useRef<string | null>(null);
  const openingAngleVisible = layerVisibility[ANNOTATION_OPENING_ANGLE_LAYER_ID]
    ?? ANNOTATION_OPENING_ANGLE_LAYER.defaultVisible;
  const diameterVisible = layerVisibility[ANNOTATION_DIAMETER_LAYER_ID]
    ?? ANNOTATION_DIAMETER_LAYER.defaultVisible;
  const datumVisible = layerVisibility[ANNOTATION_DATUM_LAYER_ID] ?? ANNOTATION_DATUM_LAYER.defaultVisible;
  const gdtVisible = layerVisibility[ANNOTATION_GDT_LAYER_ID] ?? ANNOTATION_GDT_LAYER.defaultVisible;
  const hasOpeningAngle = displaySnapshot?.document.annotations.some((annotation) => (
    annotation.type === 'dimension' && annotation.dimensionKind === 'angular'
  )) ?? false;
  const hasDiameter = displaySnapshot?.document.annotations.some((annotation) => (
    annotation.type === 'dimension' && annotation.dimensionKind === 'diameter'
  )) ?? false;
  const surfaceSnapshot = useMemo(() => displaySnapshot === null ? null : ({
    ...displaySnapshot,
    document: {
      ...displaySnapshot.document,
      // Keep imported hatches and generated engineering dimensions. Source DXF
      // text remains hidden so the clean engineering canvas does not regress.
      annotations: displaySnapshot.document.annotations.filter((annotation) => (
        annotation.type === 'section-hatch'
        || (annotation.type === 'dimension' && (
          (annotation.dimensionKind !== 'angular' || openingAngleVisible)
          && (annotation.dimensionKind !== 'diameter' || diameterVisible)
        ))
      )),
      relations: [],
    },
  }), [diameterVisible, displaySnapshot, openingAngleVisible]);
  const dimensionAnnotations = useMemo(() => surfaceSnapshot?.document.annotations.filter(
    (annotation): annotation is DimensionAnnotation => annotation.type === 'dimension',
  ) ?? [], [surfaceSnapshot]);
  const dimensionById = useMemo(() => new Map(dimensionAnnotations.map((annotation) => [annotation.id, annotation])), [dimensionAnnotations]);
  const annotationByIntentId = useMemo(() => new Map(dimensionAnnotations.flatMap((annotation) => (
    annotation.engineeringIntentId === undefined ? [] : [[annotation.engineeringIntentId, annotation] as const]
  ))), [dimensionAnnotations]);
  const targetForAnnotation = (annotation: DimensionAnnotation, anchor?: { x: number; y: number }): ToleranceTarget | null => {
    if (displaySnapshot === null || annotation.engineeringIntentId === undefined) return null;
    return toleranceTargetFromAnnotation(annotation, displaySnapshot.ref, viewport, anchor);
  };
  const selectedToleranceTarget = selectedIds.flatMap((id) => {
    const annotation = dimensionById.get(id as never);
    const target = annotation === undefined ? null : targetForAnnotation(annotation);
    return target === null || target.classification.status === 'unsupported' ? [] : [target];
  })[0] ?? null;
  const rememberedToleranceTarget = toleranceState.target;
  const activityToleranceTarget = selectedToleranceTarget ?? rememberedToleranceTarget;
  const fitSelectionActive = (toleranceState.tab === 'hole-fit' || toleranceState.tab === 'shaft-fit')
    && toleranceState.fit?.selectingSecondTarget === true;
  const fitSelectionVisible = (toleranceState.tab === 'hole-fit' || toleranceState.tab === 'shaft-fit')
    && toleranceState.fit !== null;
  const primaryFitAnnotationId = toleranceState.target === null
    ? null
    : annotationByIntentId.get(toleranceState.target.dimensionIntentId)?.id ?? null;
  const canvasSelectedIds = fitSelectionVisible && primaryFitAnnotationId !== null
    ? [...new Set([...selectedIds, primaryFitAnnotationId, ...(fitAttemptAnnotationId === null ? [] : [fitAttemptAnnotationId])])]
    : selectedIds;
  const tolerancePreviewAnnotations = useMemo(() => projectTolerancePreview(
    dimensionAnnotations,
    toleranceState.canvasPreview,
  ), [dimensionAnnotations, toleranceState.canvasPreview]);
  const draft = partitionState.partition.draft;
  const confirmed = partitionState.partition.confirmed;
  const dimensionRadialExtent = Math.max(0, ...((draft ?? confirmed)?.segments.map(({ profile }) => profile.maxRadius) ?? []));
  useEffect(() => {
    setLayerVisibility(readLayerVisibility(
      sessionId,
      registeredLayers,
      typeof sessionStorage === 'undefined' ? null : sessionStorage,
    ));
  }, [registeredLayers, sessionId]);
  const updateLayerVisibility = (id: string, visible: boolean) => {
    setLayerVisibility((current) => {
      const next = { ...current, [id]: visible };
      writeLayerVisibility(sessionId, next, typeof sessionStorage === 'undefined' ? null : sessionStorage);
      return next;
    });
  };
  const partitionOverlayVisible = layerVisibility[ANNOTATION_PARTITION_LAYER_ID]
    ?? ANNOTATION_PARTITION_LAYER.defaultVisible;
  const dimensionChainVisible = layerVisibility[ANNOTATION_DIMENSION_CHAIN_LAYER_ID]
    ?? ANNOTATION_DIMENSION_CHAIN_LAYER.defaultVisible;
  const dimensionScheme = dimensionState.plan.draft?.axialScheme ?? dimensionState.plan.confirmed?.axialScheme;
  const sharedDimensionPlan = dimensionState.plan.draft ?? dimensionState.plan.confirmed ?? dimensionPlan?.draft;
  const gdtPlan = gdtState.plan.draft ?? gdtState.plan.confirmed;
  const hasGdt = (gdtPlan?.geometricTolerances.length ?? 0) > 0;
  const hasDatums = (gdtPlan?.datums.length ?? 0) > 0;
  const dimensionChainLayers = useMemo(() => dimensionScheme?.chains.map((chain, index) => ({
    id: dimensionChainLayerId(chain.id),
    label: `尺寸链 ${index + 1}`,
    category: 'engineering' as const,
    icon: 'dimension' as const,
    order: ANNOTATION_DIMENSION_CHAIN_LAYER.order + index + 1,
    defaultVisible: true,
  })) ?? [], [dimensionScheme]);
  const visibleDimensionChainIds = useMemo(() => new Set(
    dimensionScheme?.chains
      .filter((chain) => layerVisibility[dimensionChainLayerId(chain.id)] ?? true)
      .map(({ id }) => id) ?? [],
  ), [dimensionScheme, layerVisibility]);
  const fitPadding = useMemo(() => {
    if (!dimensionScheme || !dimensionChainVisible || !surfaceSnapshot) return 1.2;
    const fitSize = { width: viewport.width, height: viewport.height };
    let padding = 1.2;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const fitted = fitViewportToDrawing(surfaceSnapshot.document, fitSize, padding);
      const next = dimensionChainFitPadding({
        scheme: dimensionScheme,
        radialExtent: dimensionRadialExtent,
        scale: fitted.scale,
        viewport: fitSize,
      });
      if (Math.abs(next - padding) < 0.001) return next;
      padding = next;
    }
    return padding;
  }, [dimensionChainVisible, dimensionRadialExtent, dimensionScheme, surfaceSnapshot, viewport.height, viewport.width]);
  const fitPaddingRef = useRef(fitPadding);
  fitPaddingRef.current = fitPadding;
  const previousViewportSize = useRef<{ width: number; height: number } | null>(null);
  const dimensionHistoryActive = dimensionState.plan.drawingRef !== undefined && (
    dimensionState.plan.phase !== 'idle' || dimensionState.plan.canUndo || dimensionState.plan.canRedo
  );
  const gdtHistoryActive = hasGdt && gdtState.plan.drawingRef !== undefined && (
    gdtState.plan.phase !== 'idle' || gdtState.plan.canUndo || gdtState.plan.canRedo
  );
  useEffect(() => {
    // The controller may have been created by the conversation drop bridge before
    // an AI tool claimed this workspace. The claim is published before semantic
    // review finishes, so continue hydrating while the Host reports `analyzing`.
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const hydrate = async () => {
      attempts += 1;
      await partition.actions.refresh().catch(() => undefined);
      if (!active || attempts >= PARTITION_HYDRATION_MAX_ATTEMPTS) return;
      if (partition.state.getSnapshot().partition.phase !== 'analyzing') return;
      const workflowStatus = state.getSnapshot().workflow.status;
      if (workflowStatus !== 'running' && workflowStatus !== 'reviewing') return;
      timer = setTimeout(() => { void hydrate(); }, PARTITION_HYDRATION_INTERVAL_MS);
    };
    void hydrate();
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [annotationState.activationEpoch, partition, state]);
  useEffect(() => {
    const release = () => {
      partition.actions.setPreviewHeld(false);
      dimensionChain.actions.setPreviewHeld(false);
      gdt.actions.setPreviewHeld(false);
    };
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); release(); };
  }, [dimensionChain, gdt, partition]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const workflowActive = annotationState.workflow.status === 'running'
      || annotationState.workflow.status === 'reviewing';
    const hydrate = async () => {
      await Promise.allSettled([
        runtime.actions.refresh(),
        dimensionChain.actions.refresh(),
        gdt.actions.refresh(),
      ]);
      if (!active || (!workflowActive && !partitionState.busy)) return;
      timer = setTimeout(() => { void hydrate(); }, ANNOTATION_HYDRATION_INTERVAL_MS);
    };
    void hydrate();
    return () => {
      active = false;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [annotationState.workflow.status, dimensionChain, gdt, partitionState.busy, runtime]);
  useEffect(() => {
    if (displaySnapshot === null || viewport.width <= 0 || viewport.height <= 0) return;
    const drawingId = displaySnapshot.ref.drawingId;
    if (initializedViewportDrawingId.current === drawingId) return;
    initializedViewportDrawingId.current = drawingId;
    const stored = readStoredViewport(drawingId);
    runtime.actions.setViewport(stored === null
      ? fitViewportForSnapshot(displaySnapshot, viewport, fitPaddingRef.current)
      : { ...stored, width: viewport.width, height: viewport.height });
  }, [displaySnapshot, runtime, viewport.height, viewport.width]);
  useEffect(() => {
    const previous = previousViewportSize.current;
    previousViewportSize.current = { width: viewport.width, height: viewport.height };
    if (previous === null || (previous.width === viewport.width && previous.height === viewport.height)) return;
    runtime.actions.setViewport({ ...viewport, width: viewport.width, height: viewport.height });
  }, [runtime, viewport]);
  useEffect(() => {
    const drawingId = displaySnapshot?.ref.drawingId;
    if (!drawingId || initializedViewportDrawingId.current !== drawingId || viewport.width <= 0 || viewport.height <= 0) return;
    writeStoredViewport(drawingId, viewport);
  }, [displaySnapshot?.ref.drawingId, viewport]);
  useEffect(() => {
    if (displaySnapshot === null) return;
    const key = `${displaySnapshot.ref.drawingId}@${displaySnapshot.ref.revision}`;
    const previous = displayedDrawingRef.current;
    displayedDrawingRef.current = key;
    if (previous !== null && previous !== key) void partition.actions.refresh().catch(() => undefined);
    if (previous !== null && previous !== key) void dimensionChain.actions.refresh().catch(() => undefined);
    if (previous !== null && previous !== key) void gdt.actions.refresh().catch(() => undefined);
  }, [dimensionChain, displaySnapshot, gdt, partition]);
  useEffect(() => {
    void dimensionChain.actions.refresh().catch(() => undefined);
    void gdt.actions.refresh().catch(() => undefined);
  }, [annotationState.activationEpoch, dimensionChain, gdt]);
  useEffect(() => {
    if (exportNotice === null) return;
    const timer = setTimeout(() => setExportNotice(null), 4_000);
    return () => clearTimeout(timer);
  }, [exportNotice]);

  const exportAnnotatedDxf = () => {
    if (!drawingFileExport || !displaySnapshot) return;
    setExportNotice(null);
    void drawingFileExport.download(sessionId, displaySnapshot, DRAWING_ANNOTATED_DXF_EXPORT_PATH)
      .then(({ filename }) => setExportNotice({ kind: 'success', message: `已导出到下载文件夹：${filename}` }))
      .catch((error: unknown) => setExportNotice({
        kind: 'error',
        message: `DXF 导出失败：${error instanceof Error ? error.message : String(error)}`,
      }));
  };

  const beginImport = (drawing: File, documents: readonly File[]) => {
    setImportError(null);
    void partition.actions.importFiles(drawing, documents)
      .then(() => setActivePanel(null))
      .catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
  };
  const handleToolbarUpload = (files: readonly File[]) => {
    const decision = classifyEngineeringDrop(files);
    if (decision.kind === 'import') { beginImport(decision.dxf, decision.documents); return; }
    if (decision.kind === 'documents') {
      setImportError(null);
      void partition.actions.stageDocuments(decision.documents)
        .then(() => setStagedDocumentNames((current) => [...current, ...decision.documents.map(({ name }) => name)]))
        .catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
      return;
    }
    setImportError(decision.kind === 'reject'
      ? engineeringImportErrorText(decision.code, decision.filenames)
      : '请选择 DXF 图纸或受支持的工程文档');
  };
  const openToleranceTarget = (target: ToleranceTarget, source: 'context' | 'designation' | 'activity') => {
    setDimensionContextMenu(null);
    const operation = source === 'context'
      ? tolerance.actions.openFromContextMenu(target)
      : source === 'designation'
        ? tolerance.actions.openFromDesignationDoubleClick(target)
        : toleranceState.target === null
          ? tolerance.actions.open(target)
          : (tolerance.actions.requestTarget(target), Promise.resolve());
    void operation.catch(() => undefined);
  };
  const openChainCandidateTolerance = (dimensionIntentId: string) => {
    if (displaySnapshot === null) return;
    const annotation = annotationByIntentId.get(dimensionIntentId);
    if (annotation !== undefined) {
      const target = targetForAnnotation(annotation);
      if (target !== null) openToleranceTarget(target, 'context');
      return;
    }
    const intent = sharedDimensionPlan?.intents.find(({ id }) => id === dimensionIntentId);
    if (intent === undefined) return;
    openToleranceTarget({
      dimensionIntentId,
      drawingRef: displaySnapshot.ref,
      anchor: { x: viewport.width / 2, y: viewport.height / 2 },
      viewport: { width: viewport.width, height: viewport.height },
      basicSize: intent.nominalValue,
      label: `${intent.nominalValue} ${intent.unit}`,
      classification: intent.kind === 'linear' || intent.kind === 'aligned' || intent.kind === 'diameter'
        ? { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' }
        : { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' },
      acceptsManualTolerance: intent.unit !== 'deg',
    }, 'context');
  };
  const selectCanvasIds = (ids: readonly string[]) => {
    if (!fitSelectionActive) {
      setFitAttemptAnnotationId(null);
      runtime.actions.setSelection(ids);
      return;
    }
    if (ids.length === 0) {
      setFitAttemptAnnotationId(null);
      const primary = toleranceState.target;
      if (primary !== null) void tolerance.actions.open(primary).catch(() => undefined);
      return;
    }
    const candidateId = ids.at(-1)!;
    setFitAttemptAnnotationId(candidateId);
    const annotation = dimensionById.get(candidateId as never);
    const target = annotation === undefined ? null : targetForAnnotation(annotation);
    if (target === null) {
      const primary = toleranceState.target;
      if (primary !== null) tolerance.actions.selectFitTarget({
        ...primary,
        dimensionIntentId: `missing:${candidateId}`,
        classification: { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' },
      });
      return;
    }
    tolerance.actions.selectFitTarget(target);
  };
  const applyTolerance = () => runSharedAnnotationHistory(
    () => tolerance.actions.apply(),
    [() => dimensionChain.actions.refresh(), () => gdt.actions.refresh()],
  );
  const structurePanel = <div className="vai-annotation-panel">
    {draft && !partitionState.previewHeld && <PartitionInspector key={partitionState.partition.updatedAt} draft={draft} controller={partition} mode={partitionView} onModeChange={setPartitionView} />}
    {!draft && confirmed && <ConfirmedPartitionInspector revision={confirmed} busy={partitionState.busy} mode={partitionView} onModeChange={setPartitionView} onReopen={partition.actions.reopen} />}
    {dimensionPlan && <DimensionPlanInspector draft={dimensionPlan.draft} generationOrder={dimensionPlan.generationOrder} />}
    {dimensionScheme && <DimensionChainInspector
      scheme={dimensionScheme}
      controller={dimensionChain}
      editable={dimensionState.plan.phase === 'editing'}
    />}
    {gdtPlan && hasGdt && <GdtInspector
      draft={gdtPlan}
      selectedIntentId={selectedGdtIntentId}
      selectedGeometryIds={selectedIds}
      controller={gdt}
      onSelectIntent={setSelectedGdtIntentId}
    />}
    {!draft && !confirmed && !dimensionPlan && <><h2>标注检查</h2><dl>
      <dt>流程</dt><dd>{workflowLabel(annotationState.workflow.status)}</dd>
      <dt>候选</dt><dd>{presentation.preview?.diff.createdNodeIds.length ?? 0}</dd>
      <dt>选中</dt><dd>{selectedIds.length}</dd>
    </dl></>}
  </div>;
  const panels: readonly WorkspacePanelDefinition<AnnotationPanelId>[] = [
    { id: 'structure', label: '图纸结构', icon: ListTree, render: () => structurePanel },
    ...(activityToleranceTarget === null ? [] : [{
      id: 'tolerance' as const,
      label: '公差与配合',
      icon: Settings2,
      render: () => null,
    }]),
  ];

  return <section
    className="vai-annotation-workspace"
    data-annotation-workspace="true"
    data-drawing-surface-namespace={namespace}
  >
    <header className="vai-annotation-workspace__header">
      <div>
        <strong>工程图自动标注</strong>
        <span>{displaySnapshot === null ? '等待图纸' : `${displaySnapshot.ref.drawingId} · R${displaySnapshot.ref.revision}`}</span>
        {displaySnapshot?.provisional && <span className="vai-annotation-provisional">候选图纸</span>}
      </div>
      <span data-annotation-workflow={annotationState.workflow.status}>
        {partitionProgressLabel(partitionState.partition.phase, partitionState.busy, annotationState.workflow.status)}
      </span>
    </header>
    <div className="vai-annotation-workspace__body">
      <WorkspaceActivityBar
        overlay
        activePanel={activePanel}
        panelWidth={panelWidth}
        onActivePanelChange={(panel) => {
          if (panel === 'tolerance' && activityToleranceTarget !== null) {
            setActivePanel(null);
            openToleranceTarget(activityToleranceTarget, 'activity');
            return;
          }
          setActivePanel(panel as AnnotationPanelId | null);
        }}
        onPanelWidthChange={setPanelWidth}
        panels={panels}
      />
      <main className="vai-annotation-workspace__canvas">
        {exportNotice && <div className={`vai-export-toast vai-export-toast--${exportNotice.kind}`} role="status">
          {exportNotice.message}
        </div>}
        <DrawingLayerManager
          layers={[...registeredLayers
            .filter(({ id }) => (
              (id === ANNOTATION_PARTITION_LAYER_ID && Boolean(draft || confirmed))
              || (id === ANNOTATION_OPENING_ANGLE_LAYER_ID && hasOpeningAngle)
              || (id === ANNOTATION_DIAMETER_LAYER_ID && hasDiameter)
              || (id === ANNOTATION_DIMENSION_CHAIN_LAYER_ID && Boolean(dimensionScheme))
              || (id === ANNOTATION_DATUM_LAYER_ID && hasDatums)
              || (id === ANNOTATION_GDT_LAYER_ID && hasGdt)
            ))
            .map((definition) => ({
              definition,
              visible: layerVisibility[definition.id] ?? definition.defaultVisible,
              ...(definition.id === ANNOTATION_DIMENSION_CHAIN_LAYER_ID && dimensionChainLayers.length > 0 ? {
                children: dimensionChainLayers.map((childDefinition) => ({
                  definition: childDefinition,
                  visible: layerVisibility[childDefinition.id] ?? childDefinition.defaultVisible,
                })),
              } : {}),
            }))]}
          onVisibilityChange={updateLayerVisibility}
        />
        {(annotationState.workflow.status === 'running' || annotationState.workflow.status === 'reviewing')
          && <AnnotationGenerationProgress
            stage={annotationState.workflow.stage ?? 'deterministic'}
            reviewing={annotationState.workflow.status === 'reviewing'}
          />}
        {(partitionState.busy || stagedDocumentNames.length > 0 || importError !== null || partitionState.error !== null || dimensionState.error !== null || gdtState.error !== null) &&
          <div className="vai-annotation-status-stack" data-annotation-status-stack="true">
            {partitionState.busy && <div className="vai-partition-progress" data-partition-progress={partitionState.partition.phase} role="status">
              <span className="vai-partition-progress__pulse" aria-hidden="true" />
              <span>{partitionProgressLabel(partitionState.partition.phase, true, annotationState.workflow.status)}</span>
            </div>}
            {stagedDocumentNames.length > 0 && <div className="vai-engineering-documents-status" role="status">
              <span>已添加 {stagedDocumentNames.length} 份工程资料；请描述任务后再开始分区</span>
              <button type="button" aria-label="清除已添加的工程资料" onClick={() => {
                setImportError(null);
                void partition.actions.clearDocuments()
                  .then(() => setStagedDocumentNames([]))
                  .catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
              }}>清除</button>
            </div>}
            {(importError ?? partitionState.error) && <p className="vai-partition-error" role="alert">
              {importError ?? `边界未保存：${partitionState.error}`}
            </p>}
            {dimensionState.error && <p className="vai-partition-error" role="alert">
              {`尺寸位置未保存：${dimensionState.error}；请重新拖动后再试`}
            </p>}
            {gdtState.error && <p className="vai-partition-error" role="alert">{`形位公差未保存：${gdtState.error}`}</p>}
          </div>}
        {surfaceSnapshot !== null && <DrawingSurface
          snapshot={surfaceSnapshot}
          viewport={viewport}
          selectedIds={canvasSelectedIds}
          display={presentation.display}
          sourceUrl={presentation.sourceUrl}
          className="vai-canvas vai-annotation-workspace__surface"
          fitToDrawingOnResize={false}
          fitPadding={fitPadding}
          onViewportChange={runtime.actions.setViewport}
          onSelectionChange={selectCanvasIds}
          onNodeContextMenu={(nodeId, event) => {
            const annotation = dimensionById.get(nodeId as never);
            if (annotation === undefined) return;
            const target = targetForAnnotation(annotation, { x: event.clientX, y: event.clientY });
            if (target === null) return;
            setDimensionContextMenu({
              annotationId: nodeId,
              target,
              position: { x: event.clientX, y: event.clientY },
            });
          }}
          worldLayers={<>
            <g data-annotation-candidate-layer="true" data-preview-active={presentation.preview === null ? undefined : 'true'} pointerEvents="none" />
            {partitionOverlayVisible && draft && <PartitionOverlay draft={draft} mode={partitionView} previewHeld={partitionState.previewHeld} scale={viewport.scale}
              onMoveBoundary={(index, z) => partition.actions.moveBoundary(index, z, Math.max(Math.abs(draft.axis.zMax - draft.axis.zMin) * 0.003, 0.05))}
              onMoveSemanticRange={(groupId, edge, z) => partition.actions.moveSemanticRange(groupId, edge, z, Math.max(Math.abs(draft.axis.zMax - draft.axis.zMin) * 0.003, 0.05))}
              onRenameBand={(band, name) => partitionView === 'functional'
                ? partition.actions.renameSemanticGroup(band.id, name)
                : partition.actions.updateSegment(band.segmentIds[0]!, { name })} />}
            {partitionOverlayVisible && !draft && confirmed && <PartitionOverlay draft={confirmed} mode={partitionView} previewHeld scale={viewport.scale} />}
            {dimensionScheme && <DimensionChainOverlay
              scheme={dimensionScheme}
              scale={viewport.scale}
              radialExtent={dimensionRadialExtent}
              visible={dimensionChainVisible}
              visibleChainIds={visibleDimensionChainIds}
              previewHeld={dimensionState.previewHeld}
              onMoveChain={(chainId, normalOffset) => dimensionChain.actions.moveChain(chainId, normalOffset)}
              onMoveCandidate={(candidateId, normalOffset) => dimensionChain.actions.moveCandidate(candidateId, normalOffset)}
              onChooseClosure={(chainId, candidateId) => dimensionChain.actions.chooseClosure(chainId, candidateId)}
              onSetTolerance={openChainCandidateTolerance}
            />}
            {tolerancePreviewAnnotations.length > 0 && <g data-tolerance-preview={toleranceState.target?.dimensionIntentId} pointerEvents="none">
              <PreviewLayer nodes={tolerancePreviewAnnotations} viewport={viewport} />
            </g>}
            {dimensionAnnotations.filter(({ toleranceProjection }) => toleranceProjection !== undefined).map((annotation) => {
              const target = targetForAnnotation(annotation);
              if (target === null) return null;
              return <g
                key={`tolerance-hit:${annotation.id}`}
                data-tolerance-designation={annotation.id}
                transform={`translate(${annotation.textPosition[0]} ${annotation.textPosition[1]})`}
                pointerEvents="all"
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openToleranceTarget(target, 'designation');
                }}
              >
                <rect x={-8 / Math.max(viewport.scale, 1e-6)} y={-12 / Math.max(viewport.scale, 1e-6)}
                  width={64 / Math.max(viewport.scale, 1e-6)} height={24 / Math.max(viewport.scale, 1e-6)} fill="transparent" />
              </g>;
            })}
            {gdtPlan && (hasDatums || hasGdt) && <GdtOverlay
              draft={gdtPlan}
              document={surfaceSnapshot.document}
              scale={viewport.scale}
              viewport={viewport}
              datumVisible={datumVisible}
              gdtVisible={gdtVisible}
              previewHeld={gdtState.previewHeld}
              selectedIntentId={selectedGdtIntentId}
              onSelectIntent={setSelectedGdtIntentId}
              onMoveDatum={(datumId, position) => gdt.actions.moveDatum(datumId, position)}
              onMoveGdtGroup={(intentIds, position) => gdt.actions.moveFrame(intentIds, position)}
            />}
          </>}
        />}
        {dimensionContextMenu !== null && <div
          className="vai-dimension-context-menu"
          data-annotation-dimension-context-menu={dimensionContextMenu.annotationId}
          role="menu"
          style={{ position: 'absolute', left: dimensionContextMenu.position.x, top: dimensionContextMenu.position.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
        >
          <button type="button" role="menuitem" data-action="set-tolerance"
            onClick={() => openToleranceTarget(dimensionContextMenu.target, 'context')}>设置公差</button>
        </div>}
        {toleranceState.visible && toleranceState.target !== null && <TolerancePopup
          geometry={toleranceState.geometry}
          viewport={{ width: viewport.width, height: viewport.height }}
          target={toleranceState.target}
          bands={toleranceState.catalog?.bands ?? []}
          fitCatalogs={toleranceState.fitCatalogs === null ? null : {
            internal: toleranceState.fitCatalogs.internal.bands,
            external: toleranceState.fitCatalogs.external.bands,
          }}
          tab={toleranceState.tab}
          zoom={toleranceState.zoom}
          standardEdition={toleranceState.standardEdition}
          datasetCompleteness={toleranceState.catalog?.datasetMetadata.completeness}
          preview={toleranceState.preview}
          displayPreference={toleranceState.displayPreference}
          dirty={toleranceState.dirty}
          closeDecision={toleranceState.closeDecision}
          pendingTarget={toleranceState.pendingTarget}
          recommendation={toleranceState.catalog?.recommendation?.designation ?? null}
          busy={toleranceState.busy}
          error={toleranceState.error}
          fitStatus={toleranceState.error ?? (fitSelectionActive ? '选择配合对象' : toleranceState.fit?.secondTarget?.label ?? null)}
          override={toleranceState.override}
          onPreview={(designation) => {
            const target = tolerance.state.getSnapshot().target;
            const tab = tolerance.state.getSnapshot().tab;
            if (target === null) return;
            if (tab === 'hole-fit' || tab === 'shaft-fit') {
              return tolerance.actions.preview({ kind: 'fit', basis: tab === 'hole-fit' ? 'hole' : 'shaft', designation });
            }
            if (target.classification.status !== 'resolved') return;
            return tolerance.actions.preview({
              kind: 'single', featureClass: target.classification.featureClass, designation,
            });
          }}
          onApply={applyTolerance}
          onRequestClose={() => tolerance.actions.requestClose()}
          onDiscardClose={() => tolerance.actions.discardAndClose()}
          onApplyClose={() => runSharedAnnotationHistory(
            () => tolerance.actions.applyAndClose(),
            [() => dimensionChain.actions.refresh(), () => gdt.actions.refresh()],
          )}
          onDiscardAndSwitch={() => { void tolerance.actions.discardAndSwitch(); }}
          onApplyAndSwitch={() => runSharedAnnotationHistory(
            () => tolerance.actions.applyAndSwitch(),
            [() => dimensionChain.actions.refresh(), () => gdt.actions.refresh()],
          )}
          onGeometryChange={tolerance.actions.setGeometry}
          onTabChange={(tab) => {
            setFitAttemptAnnotationId(null);
            if (tab === 'hole-fit' || tab === 'shaft-fit') {
              void tolerance.actions.beginFit(tab === 'hole-fit' ? 'hole' : 'shaft').catch(() => undefined);
            } else {
              tolerance.actions.setTab(tab);
            }
          }}
          onZoomChange={tolerance.actions.setZoom}
          onDisplayPreferenceChange={tolerance.actions.setDisplayPreference}
          onOverridePreview={tolerance.actions.previewOverride}
          onRestoreStandard={tolerance.actions.restoreStandard}
          onRestoreRecommendation={() => { void tolerance.actions.restoreRecommendation().catch(() => undefined); }}
          onFeatureClassChoice={(featureClass) => { void tolerance.actions.chooseFeatureClass(featureClass).catch(() => undefined); }}
          onManualPreview={tolerance.actions.previewManual}
        />}
        {gdtState.plan.phase === 'editing' && hasGdt
          ? <PartitionActionToolbar controller={gdt} previewHeld={gdtState.previewHeld} subject="形位公差" />
          : dimensionState.plan.phase === 'editing'
          ? <PartitionActionToolbar controller={dimensionChain} previewHeld={dimensionState.previewHeld} subject="尺寸链" />
          : partitionState.partition.phase === 'editing' && <PartitionActionToolbar controller={partition} previewHeld={partitionState.previewHeld} />}
        {displaySnapshot && <WorkspaceToolbarView
          snapshot={displaySnapshot}
          viewport={viewport}
          unavailable={partitionState.busy}
          fitPadding={1.12}
          canUndo={gdtHistoryActive ? gdtState.plan.canUndo : dimensionHistoryActive ? dimensionState.plan.canUndo : partitionState.partition.canUndo}
          canRedo={gdtHistoryActive ? gdtState.plan.canRedo : dimensionHistoryActive ? dimensionState.plan.canRedo : partitionState.partition.canRedo}
          onFit={(nextViewport) => runtime.actions.setViewport(fitViewportForSnapshot(displaySnapshot, nextViewport, 1.12))}
          onUndo={() => gdtHistoryActive || dimensionHistoryActive
            ? runSharedAnnotationHistory(
              gdtHistoryActive ? () => gdt.actions.undo() : () => dimensionChain.actions.undo(),
              [() => gdt.actions.refresh(), () => dimensionChain.actions.refresh()],
            )
            : partition.actions.undo()}
          onRedo={() => gdtHistoryActive || dimensionHistoryActive
            ? runSharedAnnotationHistory(
              gdtHistoryActive ? () => gdt.actions.redo() : () => dimensionChain.actions.redo(),
              [() => gdt.actions.refresh(), () => dimensionChain.actions.refresh()],
            )
            : partition.actions.redo()}
          onUploadFiles={handleToolbarUpload}
          uploadAccept={ANNOTATION_UPLOAD_ACCEPT}
          uploadMultiple
          onExport={drawingFileExport === undefined ? undefined : exportAnnotatedDxf}
        />}
      </main>
    </div>
  </section>;
}

const ANNOTATION_GENERATION_STAGES = [
  ['deterministic', '基础尺寸'],
  ['dimension-chain', '尺寸链'],
  ['gdt', '基准与形位公差'],
  ['review', '待确认'],
] as const;

function AnnotationGenerationProgress({
  stage,
  reviewing,
}: {
  stage: NonNullable<AnnotationSessionState['workflow']['stage']>;
  reviewing: boolean;
}) {
  const current = ANNOTATION_GENERATION_STAGES.findIndex(([id]) => id === stage);
  return <div className="vai-annotation-generation" role="status" aria-label="自动标注生成进度">
    {ANNOTATION_GENERATION_STAGES.map(([id, label], index) => <div
      key={id}
      className={`vai-annotation-generation__step${index < current ? ' is-complete' : index === current ? ' is-active' : ''}`}
      data-annotation-generation-stage={id}
    >
      <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>
      <strong>{id === 'review' && reviewing ? '等待确认' : label}</strong>
    </div>)}
  </div>;
}

function toleranceTargetFromAnnotation(
  annotation: DimensionAnnotation,
  drawingRef: { drawingId: string; revision: number },
  viewport: DrawingWorkspaceViewport,
  requestedAnchor?: { x: number; y: number },
): ToleranceTarget {
  const screen = {
    x: viewport.x + annotation.textPosition[0] * viewport.scale,
    y: viewport.y - annotation.textPosition[1] * viewport.scale,
  };
  const featureClass = annotation.toleranceProjection?.featureClass;
  const supportsStandardTable = annotation.dimensionKind === 'linear'
    || annotation.dimensionKind === 'aligned'
    || annotation.dimensionKind === 'diameter';
  return {
    dimensionIntentId: annotation.engineeringIntentId!,
    drawingRef,
    anchor: requestedAnchor ?? screen,
    annotationBounds: { x: screen.x - 48, y: screen.y - 14, width: 96, height: 28 },
    viewport: { width: viewport.width, height: viewport.height },
    ...(annotation.computedValue === undefined ? {} : { basicSize: annotation.computedValue }),
    label: annotation.displayText ?? `${annotation.computedValue ?? '—'}${annotation.unit === undefined ? '' : ` ${annotation.unit}`}`,
    classification: featureClass === undefined
      ? supportsStandardTable
        ? { status: 'ambiguous', code: 'TOLERANCE_FEATURE_CLASS_AMBIGUOUS' }
        : { status: 'unsupported', code: 'TOLERANCE_FEATURE_UNSUPPORTED' }
      : { status: 'resolved', featureClass },
    acceptsManualTolerance: annotation.unit !== 'deg' && annotation.dimensionKind !== 'angular',
  };
}

function projectTolerancePreview(
  annotations: readonly DimensionAnnotation[],
  preview: ToleranceControllerState['canvasPreview'],
): DimensionAnnotation[] {
  if (preview === null) return [];
  const host = preview.host;
  if (host.type === 'single') {
    const annotation = annotations.find(({ engineeringIntentId }) => engineeringIntentId === host.dimensionIntentId);
    return annotation === undefined ? [] : [{
      ...structuredClone(annotation),
      toleranceProjection: toleranceProjection(host.result, preview.override, preview.displayPreference, 'bilateral'),
    }];
  }
  return [
    [host.holeDimensionIntentId, host.result.hole] as const,
    [host.shaftDimensionIntentId, host.result.shaft] as const,
  ].flatMap(([dimensionIntentId, result]) => {
    const annotation = annotations.find((candidate) => candidate.engineeringIntentId === dimensionIntentId);
    return annotation === undefined ? [] : [{
      ...structuredClone(annotation),
      toleranceProjection: toleranceProjection(result, null, preview.displayPreference, 'fit'),
    }];
  });
}

function toleranceProjection(
  result: Extract<NonNullable<ToleranceControllerState['preview']>, { type: 'single' }>['result'],
  override: { upperDeviation: number; lowerDeviation: number } | null,
  displayPreference: ToleranceProjection['displayPreference'],
  mode: 'bilateral' | 'fit',
): ToleranceProjection {
  const effective = override ?? result;
  return {
    mode,
    upperDeviation: effective.upperDeviation,
    lowerDeviation: effective.lowerDeviation,
    upperLimit: result.upperLimitSize,
    lowerLimit: result.lowerLimitSize,
    fitDesignation: result.designation,
    unit: result.unit,
    status: 'resolved',
    source: 'standard',
    ruleRef: structuredClone(result.ruleRef),
    featureClass: result.featureClass,
    standardRef: structuredClone(result.standardRef),
    displayPreference,
    evidenceRefs: [],
  };
}

function fitViewportForSnapshot(
  snapshot: DrawingWorkspaceSnapshot,
  viewport: DrawingWorkspaceViewport,
  padding: number,
): DrawingWorkspaceViewport {
  return fitViewportToDrawing({
    ...snapshot.document,
    annotations: snapshot.document.annotations.filter(({ type }) => type === 'section-hatch' || type === 'dimension'),
  } as DrawingDocument, viewport, padding);
}

function viewportStorageKey(drawingId: string): string {
  return `vectorai:annotation:viewport:${drawingId}`;
}

function readStoredViewport(drawingId: string): Pick<DrawingWorkspaceViewport, 'x' | 'y' | 'scale'> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(viewportStorageKey(drawingId)) ?? 'null') as Partial<DrawingWorkspaceViewport> | null;
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.scale) || !(value.scale! > 0)) return null;
    return { x: value.x!, y: value.y!, scale: value.scale! };
  } catch {
    return null;
  }
}

function writeStoredViewport(drawingId: string, viewport: DrawingWorkspaceViewport): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(viewportStorageKey(drawingId), JSON.stringify({ x: viewport.x, y: viewport.y, scale: viewport.scale }));
  } catch {
    // Viewport persistence is optional when browser storage is unavailable.
  }
}

function useObservable<T>(observable: DrawingSurfaceObservable<T>): T {
  return useSyncExternalStore(observable.subscribe, observable.getSnapshot, observable.getSnapshot);
}

function workflowLabel(status: AnnotationSessionState['workflow']['status']): string {
  return {
    idle: '待开始',
    running: '分析中',
    reviewing: '检查中',
    completed: '已完成',
    canceled: '已取消',
    failed: '需要处理',
    'needs-rebase': '图纸已变化',
  }[status];
}

function partitionProgressLabel(
  phase: PartitionController['state']['getSnapshot'] extends () => infer State
    ? State extends { partition: { phase: infer Phase } } ? Phase : never
    : never,
  busy: boolean,
  workflowStatus: AnnotationSessionState['workflow']['status'],
): string {
  if (busy || phase === 'analyzing') return '正在识别轴段并进行 AI 语义复核';
  if (phase === 'editing') return '分区草稿待确认';
  if (phase === 'confirmed') return '分区已确认';
  if (phase === 'needs-rebase') return '图纸已变化';
  if (phase === 'failed') return '分区需要处理';
  return workflowLabel(workflowStatus);
}
