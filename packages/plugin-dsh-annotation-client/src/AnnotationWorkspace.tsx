// SPDX-License-Identifier: Apache-2.0

import type { DrawingLayerRegistry, DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type { DrawingDocument } from '@vectorai/drawing-core';
import {
  DrawingSurface,
  DrawingLayerManager,
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
import type { AnnotationSessionState, EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { ListTree } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PartitionController } from './partition-controller';
import { PartitionOverlay } from './PartitionOverlay';
import { PartitionActionToolbar } from './PartitionActionToolbar';
import { PartitionInspector } from './PartitionInspector';
import { DimensionPlanInspector } from './DimensionPlanInspector';
import { ConfirmedPartitionInspector } from './ConfirmedPartitionInspector';
import { SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS } from './engineering-file-policy';
import { classifyEngineeringDrop } from './engineering-drop';
import { engineeringImportErrorText } from './EngineeringDropBridge';
import type { PartitionViewMode } from './partition-view-model';
import { ANNOTATION_PARTITION_LAYER, ANNOTATION_PARTITION_LAYER_ID } from './drawing-layers';
import { readLayerVisibility, writeLayerVisibility } from './layer-visibility';

const ENGINEERING_DOCUMENT_ACCEPT = SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',');
const ANNOTATION_UPLOAD_ACCEPT = `.dxf,application/dxf,${ENGINEERING_DOCUMENT_ACCEPT}`;
const PARTITION_HYDRATION_INTERVAL_MS = 500;
const PARTITION_HYDRATION_MAX_ATTEMPTS = 1_200;
type AnnotationPanelId = 'structure';
const FALLBACK_LAYER_DEFINITIONS = [ANNOTATION_PARTITION_LAYER] as const;
const subscribeToNoLayers = () => () => undefined;
const readFallbackLayers = () => FALLBACK_LAYER_DEFINITIONS;

export interface AnnotationWorkspaceProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
  layerRegistry?: DrawingLayerRegistry;
  state: DrawingSurfaceObservable<AnnotationSessionState>;
  partition: PartitionController;
  dimensionPlan?: { draft: EngineeringAnnotationDraft; generationOrder: string[] };
}

export function AnnotationWorkspace({ sessionId, namespace, runtime, state, partition, dimensionPlan, layerRegistry }: AnnotationWorkspaceProps) {
  const snapshot = useObservable(runtime.snapshot);
  const viewport = useObservable(runtime.viewport) as DrawingWorkspaceViewport;
  const selectedIds = useObservable(runtime.selection);
  const presentation = useObservable(runtime.presentation);
  const annotationState = useObservable(state);
  const partitionState = useObservable(partition.state);
  const displaySnapshot = (presentation.displaySnapshot ?? snapshot) as DrawingWorkspaceSnapshot | null;
  const [importError, setImportError] = useState<string | null>(null);
  const [stagedDocumentNames, setStagedDocumentNames] = useState<string[]>([]);
  const [activePanel, setActivePanel] = useState<AnnotationPanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(260);
  const [partitionView, setPartitionView] = useState<PartitionViewMode>('functional');
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
  const fitAfterAnalysis = useRef(partitionState.busy);
  const displayedDrawingRef = useRef<string | null>(null);
  const surfaceSnapshot = useMemo(() => displaySnapshot === null ? null : ({
    ...displaySnapshot,
    document: {
      ...displaySnapshot.document,
      // Keep imported hatches and generated engineering dimensions. Source DXF
      // text remains hidden so the clean engineering canvas does not regress.
      annotations: displaySnapshot.document.annotations.filter(({ type }) => (
        type === 'section-hatch' || type === 'dimension'
      )),
      relations: [],
    },
  }), [displaySnapshot]);
  const draft = partitionState.partition.draft;
  const confirmed = partitionState.partition.confirmed;
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
    const release = () => partition.actions.setPreviewHeld(false);
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); release(); };
  }, [partition]);
  useEffect(() => {
    if (!partitionState.busy) {
      void runtime.actions.refresh().then(() => {
        if (!fitAfterAnalysis.current) return;
        fitAfterAnalysis.current = false;
        fitRuntimeToDrawing(runtime);
      });
      return;
    }
    fitAfterAnalysis.current = true;
    void runtime.actions.refresh();
    const timer = window.setInterval(() => { void runtime.actions.refresh(); }, 500);
    return () => window.clearInterval(timer);
  }, [partitionState.busy, runtime]);
  useEffect(() => {
    if (displaySnapshot === null) return;
    fitRuntimeToDrawing(runtime, displaySnapshot);
  }, [displaySnapshot, runtime]);
  useEffect(() => {
    if (displaySnapshot === null) return;
    const key = `${displaySnapshot.ref.drawingId}@${displaySnapshot.ref.revision}`;
    const previous = displayedDrawingRef.current;
    displayedDrawingRef.current = key;
    if (previous !== null && previous !== key) void partition.actions.refresh().catch(() => undefined);
  }, [displaySnapshot, partition]);

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
  const structurePanel = <div className="vai-annotation-panel">
    {draft && !partitionState.previewHeld && <PartitionInspector key={partitionState.partition.updatedAt} draft={draft} controller={partition} mode={partitionView} onModeChange={setPartitionView} />}
    {!draft && confirmed && <ConfirmedPartitionInspector revision={confirmed} busy={partitionState.busy} mode={partitionView} onModeChange={setPartitionView} onReopen={partition.actions.reopen} />}
    {dimensionPlan && <DimensionPlanInspector draft={dimensionPlan.draft} generationOrder={dimensionPlan.generationOrder} />}
    {!draft && !confirmed && !dimensionPlan && <><h2>标注检查</h2><dl>
      <dt>流程</dt><dd>{workflowLabel(annotationState.workflow.status)}</dd>
      <dt>候选</dt><dd>{presentation.preview?.diff.createdNodeIds.length ?? 0}</dd>
      <dt>选中</dt><dd>{selectedIds.length}</dd>
    </dl></>}
  </div>;
  const panels: readonly WorkspacePanelDefinition<AnnotationPanelId>[] = [
    { id: 'structure', label: '图纸结构', icon: ListTree, render: () => structurePanel },
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
        onActivePanelChange={(panel) => setActivePanel(panel as AnnotationPanelId | null)}
        onPanelWidthChange={setPanelWidth}
        panels={panels}
      />
      <main className="vai-annotation-workspace__canvas">
        <DrawingLayerManager
          layers={(draft || confirmed) ? registeredLayers
            .filter(({ id }) => id === ANNOTATION_PARTITION_LAYER_ID)
            .map((definition) => ({
              definition,
              visible: layerVisibility[definition.id] ?? definition.defaultVisible,
            })) : []}
          onVisibilityChange={updateLayerVisibility}
        />
        {(partitionState.busy || stagedDocumentNames.length > 0 || importError !== null || partitionState.error !== null) &&
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
          </div>}
        {surfaceSnapshot !== null && <DrawingSurface
          snapshot={surfaceSnapshot}
          viewport={viewport}
          selectedIds={selectedIds}
          display={presentation.display}
          sourceUrl={presentation.sourceUrl}
          className="vai-canvas vai-annotation-workspace__surface"
          fitToDrawingOnResize
          onViewportChange={runtime.actions.setViewport}
          onSelectionChange={runtime.actions.setSelection}
          worldLayers={<>
            <g data-annotation-candidate-layer="true" data-preview-active={presentation.preview === null ? undefined : 'true'} pointerEvents="none" />
            {partitionOverlayVisible && draft && <PartitionOverlay draft={draft} mode={partitionView} previewHeld={partitionState.previewHeld} scale={viewport.scale}
              onMoveBoundary={(index, z) => partition.actions.moveBoundary(index, z, Math.max(draft.axis.zMax * 0.003, 0.05))}
              onMoveSemanticRange={(groupId, edge, z) => partition.actions.moveSemanticRange(groupId, edge, z, Math.max(draft.axis.zMax * 0.003, 0.05))}
              onRenameBand={(band, name) => partitionView === 'functional'
                ? partition.actions.renameSemanticGroup(band.id, name)
                : partition.actions.updateSegment(band.segmentIds[0]!, { name })} />}
            {partitionOverlayVisible && !draft && confirmed && <PartitionOverlay draft={confirmed} mode={partitionView} previewHeld scale={viewport.scale} />}
          </>}
        />}
        {partitionState.partition.phase === 'editing' && <PartitionActionToolbar controller={partition} previewHeld={partitionState.previewHeld} />}
        {displaySnapshot && <WorkspaceToolbarView
          snapshot={displaySnapshot}
          viewport={viewport}
          unavailable={partitionState.busy}
          canUndo={partitionState.partition.canUndo}
          canRedo={partitionState.partition.canRedo}
          onFit={runtime.actions.setViewport}
          onUndo={() => partition.actions.undo()}
          onRedo={() => partition.actions.redo()}
          onUploadFiles={handleToolbarUpload}
          uploadAccept={ANNOTATION_UPLOAD_ACCEPT}
          uploadMultiple
        />}
      </main>
    </div>
  </section>;
}

function fitRuntimeToDrawing(runtime: DrawingSurfaceRuntime, snapshot = runtime.snapshot.getSnapshot()): void {
  if (snapshot === null) return;
  const viewport = runtime.viewport.getSnapshot();
  if (viewport.width <= 0 || viewport.height <= 0) return;
  runtime.actions.setViewport(fitViewportToDrawing({
    ...snapshot.document,
    annotations: snapshot.document.annotations.filter(({ type }) => (
      type === 'section-hatch' || type === 'dimension'
    )),
  } as DrawingDocument, viewport));
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
