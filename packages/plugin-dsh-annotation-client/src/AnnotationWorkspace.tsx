// SPDX-License-Identifier: Apache-2.0

import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import { DrawingSurface } from '@vectorai/drawing-viewer-react';
import type {
  DrawingSurfaceRuntime,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import type { AnnotationSessionState, EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PartitionController } from './partition-controller';
import { PartitionOverlay } from './PartitionOverlay';
import { PartitionActionToolbar } from './PartitionActionToolbar';
import { PartitionInspector } from './PartitionInspector';
import { DimensionPlanInspector } from './DimensionPlanInspector';
import { SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS } from './engineering-file-policy';
import { classifyEngineeringDrop } from './engineering-drop';
import { engineeringImportErrorText } from './EngineeringDropBridge';

const ENGINEERING_DOCUMENT_ACCEPT = SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',');

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
  const [dxf, setDxf] = useState<File | null>(null);
  const [engineering, setEngineering] = useState<File[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const displaySnapshot = (presentation.displaySnapshot ?? snapshot) as DrawingWorkspaceSnapshot | null;
  const draft = partitionState.partition.draft;
  useEffect(() => {
    const release = () => partition.actions.setPreviewHeld(false);
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); release(); };
  }, [partition]);

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
        {workflowLabel(annotationState.workflow.status)}
      </span>
    </header>
    <div className="vai-annotation-workspace__body">
      <nav className="vai-annotation-workspace__rail" aria-label="标注流程">
        <button type="button" aria-label="导入 DXF" title="导入 DXF" onClick={() => setShowImport(true)}>↥</button>
        <button type="button" aria-label="图纸结构" title="图纸结构">⌗</button>
        <button type="button" aria-label="标注候选" title="标注候选">⌖</button>
        <button type="button" aria-label="冲突检查" title="冲突检查">△</button>
      </nav>
      <main className="vai-annotation-workspace__canvas">
        {displaySnapshot !== null && <DrawingSurface
          snapshot={displaySnapshot}
          viewport={viewport}
          selectedIds={selectedIds}
          display={presentation.display}
          sourceUrl={presentation.sourceUrl}
          className="vai-canvas vai-annotation-workspace__surface"
          onViewportChange={runtime.actions.setViewport}
          onSelectionChange={runtime.actions.setSelection}
          worldLayers={<>
            <g data-annotation-candidate-layer="true" data-preview-active={presentation.preview === null ? undefined : 'true'} pointerEvents="none" />
            {draft && <PartitionOverlay draft={draft} previewHeld={partitionState.previewHeld} scale={viewport.scale}
              onMoveBoundary={(index, z) => void partition.actions.moveBoundary(index, z, Math.max(draft.axis.zMax * 0.003, 0.05)).catch(() => undefined)} />}
          </>}
        />}
        {(displaySnapshot === null || showImport) && <form className="vai-annotation-import" onSubmit={(event) => {
          event.preventDefault();
          if (!dxf) return;
          const decision = classifyEngineeringDrop([dxf, ...engineering]);
          if (decision.kind !== 'import') {
            setImportError(decision.kind === 'reject'
              ? engineeringImportErrorText(decision.code, decision.filenames)
              : '请选择一张 DXF 图纸');
            return;
          }
          setImportError(null);
          void partition.actions.importFiles(decision.dxf, decision.documents)
            .then(() => setShowImport(false))
            .catch((error) => setImportError(engineeringImportErrorText(error instanceof Error ? error.message : String(error))));
        }}>
          <strong>导入轴类工程图</strong>
          <p>DXF 为必选；工程数据文档可选。普通聊天附件不会触发此流程。</p>
          <label>DXF 图纸<input type="file" accept=".dxf,application/dxf" onChange={(event) => setDxf(event.currentTarget.files?.[0] ?? null)} /></label>
          <label>工程数据文档（可多选）<input type="file" multiple accept={ENGINEERING_DOCUMENT_ACCEPT} onChange={(event) => setEngineering(Array.from(event.currentTarget.files ?? []))} /></label>
          {engineering.length > 0 && <ul className="vai-annotation-import__files">
            {engineering.map((file) => <li key={`${file.name}:${file.size}`}>{file.name}</li>)}
          </ul>}
          <button type="submit" disabled={!dxf || partitionState.busy}>{partitionState.busy ? '正在分析…' : '导入并智能分区'}</button>
          {displaySnapshot !== null && <button type="button" className="vai-annotation-import__close" onClick={() => setShowImport(false)}>关闭</button>}
          {(importError ?? partitionState.error) && <p role="alert">{importError ?? partitionState.error}</p>}
        </form>}
        {partitionState.partition.phase === 'editing' && <PartitionActionToolbar controller={partition} previewHeld={partitionState.previewHeld} />}
        {(partitionState.partition.canUndo || partitionState.partition.canRedo) && <div className="vai-partition-history" role="toolbar" aria-label="分区历史">
          <button type="button" aria-label="撤销分区" disabled={!partitionState.partition.canUndo} onClick={() => void partition.actions.undo().catch(() => undefined)}>↶</button>
          <button type="button" aria-label="重做分区" disabled={!partitionState.partition.canRedo} onClick={() => void partition.actions.redo().catch(() => undefined)}>↷</button>
        </div>}
      </main>
      <aside className="vai-annotation-workspace__inspector">
        {dimensionPlan ? <DimensionPlanInspector draft={dimensionPlan.draft} generationOrder={dimensionPlan.generationOrder} />
          : draft && !partitionState.previewHeld ? <PartitionInspector key={partitionState.partition.updatedAt} draft={draft} controller={partition} /> : <><h2>标注检查</h2><dl>
          <dt>流程</dt><dd>{workflowLabel(annotationState.workflow.status)}</dd>
          <dt>候选</dt><dd>{presentation.preview?.diff.createdNodeIds.length ?? 0}</dd>
          <dt>选中</dt><dd>{selectedIds.length}</dd>
        </dl></>}
      </aside>
    </div>
  </section>;
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
