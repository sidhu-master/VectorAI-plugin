// SPDX-License-Identifier: Apache-2.0

import type { DrawingSurfaceObservable } from '@vectorai/drawing-surface-api';
import { DrawingSurface } from '@vectorai/drawing-viewer-react';
import type {
  DrawingSurfaceRuntime,
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import type { AnnotationSessionState } from '@vectorai/plugin-space-contracts';
import { useSyncExternalStore } from 'react';

export interface AnnotationWorkspaceProps {
  sessionId: string;
  namespace: string;
  runtime: DrawingSurfaceRuntime;
  state: DrawingSurfaceObservable<AnnotationSessionState>;
}

export function AnnotationWorkspace({ namespace, runtime, state }: AnnotationWorkspaceProps) {
  const snapshot = useObservable(runtime.snapshot);
  const viewport = useObservable(runtime.viewport) as DrawingWorkspaceViewport;
  const selectedIds = useObservable(runtime.selection);
  const presentation = useObservable(runtime.presentation);
  const annotationState = useObservable(state);
  const displaySnapshot = (presentation.displaySnapshot ?? snapshot) as DrawingWorkspaceSnapshot | null;

  return <section
    className="vai-annotation-workspace"
    data-annotation-workspace="true"
    data-drawing-surface-namespace={namespace}
  >
    <header className="vai-annotation-workspace__header">
      <div>
        <strong>工程图自动标注</strong>
        <span>{displaySnapshot === null ? '等待图纸' : `${displaySnapshot.ref.drawingId} · R${displaySnapshot.ref.revision}`}</span>
      </div>
      <span data-annotation-workflow={annotationState.workflow.status}>
        {workflowLabel(annotationState.workflow.status)}
      </span>
    </header>
    <div className="vai-annotation-workspace__body">
      <nav className="vai-annotation-workspace__rail" aria-label="标注流程">
        <button type="button" aria-label="图纸结构" title="图纸结构">⌗</button>
        <button type="button" aria-label="标注候选" title="标注候选">⌖</button>
        <button type="button" aria-label="冲突检查" title="冲突检查">△</button>
      </nav>
      <main className="vai-annotation-workspace__canvas">
        {displaySnapshot === null ? <div className="vai-annotation-workspace__empty">
          自动标注工作区已接管。请先导入一张工程图纸。
        </div> : <DrawingSurface
          snapshot={displaySnapshot}
          viewport={viewport}
          selectedIds={selectedIds}
          display={presentation.display}
          sourceUrl={presentation.sourceUrl}
          className="vai-canvas vai-annotation-workspace__surface"
          onViewportChange={runtime.actions.setViewport}
          onSelectionChange={runtime.actions.setSelection}
          worldLayers={<g
            data-annotation-candidate-layer="true"
            data-preview-active={presentation.preview === null ? undefined : 'true'}
            pointerEvents="none"
          />}
        />}
      </main>
      <aside className="vai-annotation-workspace__inspector">
        <h2>标注检查</h2>
        <dl>
          <dt>流程</dt><dd>{workflowLabel(annotationState.workflow.status)}</dd>
          <dt>候选</dt><dd>{presentation.preview?.diff.createdNodeIds.length ?? 0}</dd>
          <dt>选中</dt><dd>{selectedIds.length}</dd>
        </dl>
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
