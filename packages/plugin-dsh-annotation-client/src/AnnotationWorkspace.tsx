// SPDX-License-Identifier: Apache-2.0

import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import type { DrawingDocument } from '@vectorai/drawing-core';
import {
  DrawingSurface,
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

const ENGINEERING_DOCUMENT_ACCEPT = SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',');
const ANNOTATION_UPLOAD_ACCEPT = `.dxf,application/dxf,${ENGINEERING_DOCUMENT_ACCEPT}`;
type AnnotationPanelId = 'structure';

export interface AnnotationWorkspaceProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
  state: DrawingSurfaceObservable<AnnotationSessionState>;
  partition: PartitionController;
  dimensionPlan?: { draft: EngineeringAnnotationDraft; generationOrder: string[] };
}

export function AnnotationWorkspace({ namespace, runtime, state, partition, dimensionPlan }: AnnotationWorkspaceProps) {
  const snapshot = useObservable(runtime.snapshot);
  const viewport = useObservable(runtime.viewport) as DrawingWorkspaceViewport;
  const selectedIds = useObservable(runtime.selection);
  const presentation = useObservable(runtime.presentation);
  const annotationState = useObservable(state);
  const partitionState = useObservable(partition.state);
  const displaySnapshot = (presentation.displaySnapshot ?? snapshot) as DrawingWorkspaceSnapshot | null;
  const [importError, setImportError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<AnnotationPanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(260);
  const [partitionView, setPartitionView] = useState<PartitionViewMode>('functional');
  const fitAfterAnalysis = useRef(partitionState.busy);
  const surfaceSnapshot = useMemo(() => displaySnapshot === null ? null : ({
    ...displaySnapshot,
    document: {
      ...displaySnapshot.document,
      annotations: displaySnapshot.document.annotations.filter(({ type }) => type === 'section-hatch'),
      relations: [],
    },
  }), [displaySnapshot]);
  const draft = partitionState.partition.draft;
  const confirmed = partitionState.partition.confirmed;
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

  const beginImport = (drawing: File, documents: readonly File[]) => {
    setImportError(null);
    void partition.actions.importFiles(drawing, documents)
      .then(() => setActivePanel(null))
      .catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
  };
  const handleToolbarUpload = (files: readonly File[]) => {
    const decision = classifyEngineeringDrop(files);
    if (decision.kind === 'import') { beginImport(decision.dxf, decision.documents); return; }
    setImportError(decision.kind === 'reject'
      ? engineeringImportErrorText(decision.code, decision.filenames)
      : '请选择 DXF 图纸或受支持的工程文档');
  };
  const structurePanel = <div className="vai-annotation-panel">
    {dimensionPlan ? <DimensionPlanInspector draft={dimensionPlan.draft} generationOrder={dimensionPlan.generationOrder} />
      : draft && !partitionState.previewHeld ? <PartitionInspector key={partitionState.partition.updatedAt} draft={draft} controller={partition} mode={partitionView} onModeChange={setPartitionView} />
        : confirmed && partitionState.partition.phase === 'confirmed'
          ? <ConfirmedPartitionInspector revision={confirmed} busy={partitionState.busy} mode={partitionView} onModeChange={setPartitionView} onReopen={partition.actions.reopen} /> : <><h2>标注检查</h2><dl>
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
        {partitionState.busy && <div className="vai-partition-progress" data-partition-progress={partitionState.partition.phase} role="status">
          <span className="vai-partition-progress__pulse" aria-hidden="true" />
          <span>{partitionProgressLabel(partitionState.partition.phase, true, annotationState.workflow.status)}</span>
        </div>}
        {surfaceSnapshot !== null && <DrawingSurface
          snapshot={surfaceSnapshot}
          viewport={viewport}
          selectedIds={selectedIds}
          display={presentation.display}
          sourceUrl={presentation.sourceUrl}
          className="vai-canvas vai-annotation-workspace__surface"
          fitToDrawingOnResize="geometry"
          onViewportChange={runtime.actions.setViewport}
          onSelectionChange={runtime.actions.setSelection}
          worldLayers={<>
            <g data-annotation-candidate-layer="true" data-preview-active={presentation.preview === null ? undefined : 'true'} pointerEvents="none" />
            {draft && <PartitionOverlay draft={draft} mode={partitionView} previewHeld={partitionState.previewHeld} scale={viewport.scale}
              onMoveBoundary={(index, z) => partition.actions.moveBoundary(index, z, Math.max(draft.axis.zMax * 0.003, 0.05))}
              onMoveSemanticRange={(groupId, edge, z) => partition.actions.moveSemanticRange(groupId, edge, z, Math.max(draft.axis.zMax * 0.003, 0.05))} />}
          </>}
        />}
        {(importError ?? partitionState.error) && <p className="vai-partition-error" role="alert">
          {importError ?? `边界未保存：${partitionState.error}`}
        </p>}
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
  runtime.actions.setViewport(fitViewportToDrawing({ ...snapshot.document, annotations: [] } as DrawingDocument, viewport));
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
