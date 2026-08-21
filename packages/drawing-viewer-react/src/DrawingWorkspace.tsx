// SPDX-License-Identifier: Apache-2.0

import type {
  DrawingWorkspaceSnapshot,
  DrawingWorkspaceViewport,
} from '@vectorai/drawing-workspace';
import { useState, type ReactNode } from 'react';

import { useDrawingWorkspace } from './hooks';
import { Canvas } from './canvas/Canvas';
import { ObjectList } from './panels/ObjectList';
import { PropertyInspector } from './panels/PropertyInspector';
import { WorkspaceStatus } from './panels/WorkspaceStatus';
import { WorkspaceToolbar } from './panels/WorkspaceToolbar';

export interface PreviewOverlayContext {
  readonly snapshot: DeepReadonly<DrawingWorkspaceSnapshot>;
  readonly viewport: DeepReadonly<DrawingWorkspaceViewport>;
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export interface PreviewOverlayContribution {
  readonly id: string;
  render(context: PreviewOverlayContext): ReactNode;
}

export interface DrawingWorkspaceProps {
  previewContributions?: readonly PreviewOverlayContribution[];
  emptyMessage?: ReactNode;
}

export function DrawingWorkspace({
  previewContributions = [],
  emptyMessage = '还没有图纸',
}: DrawingWorkspaceProps) {
  const [objectsOpen, setObjectsOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const status = useDrawingWorkspace((state) => state.status);
  const snapshot = useDrawingWorkspace((state) => state.snapshot);
  const displaySnapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const busy = useDrawingWorkspace((state) => state.busy);
  const error = useDrawingWorkspace((state) => state.error);
  const undoLast = useDrawingWorkspace((state) => state.undoLast);

  if (status === 'idle' || status === 'loading') {
    return (
      <section className="vai-workspace" aria-label="图纸工作区" data-workspace-state="loading">
        <WorkspaceState title="正在读取本地图纸…" />
      </section>
    );
  }

  if (status === 'error' && snapshot === null) {
    return (
      <section className="vai-workspace" aria-label="图纸工作区" data-workspace-state="error">
        <WorkspaceState title="图纸读取失败" detail={error?.message} alert />
      </section>
    );
  }

  if (snapshot === null) {
    return (
      <section className="vai-workspace" aria-label="图纸工作区" data-workspace-state="empty">
        <WorkspaceState title={emptyMessage} detail="导入图片或工程图文件后即可开始。" />
      </section>
    );
  }

  return (
    <section
      className="vai-workspace"
      aria-label="图纸工作区"
      data-workspace-state="ready"
      data-layout="website-parity"
      data-preview-state={preview === null ? undefined : 'current'}
    >
      <header className="vai-workspace__header">
        <div className="vai-workspace__identity">
          <strong className="vai-workspace__drawing-id">{snapshot.ref.drawingId}</strong>
          <span>R{snapshot.ref.revision}</span>
          {snapshot.provisional ? <span className="vai-workspace__badge">候选几何</span> : null}
          {preview === null ? null : <span className="vai-workspace__badge vai-workspace__badge--preview">候选 Preview</span>}
        </div>
        <WorkspaceToolbar />
        <button
          type="button"
          disabled={busy || preview !== null || !snapshot.lastCommit?.undoable}
          title={preview !== null ? '先处理当前 Preview' : '撤销最近一次图纸提交'}
          onClick={() => { void undoLast(); }}
        >撤销</button>
        <div className="vai-workspace__panel-toggles">
          <button type="button" aria-pressed={objectsOpen} onClick={() => setObjectsOpen(!objectsOpen)}>对象</button>
          <button type="button" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)}>属性</button>
        </div>
        {busy ? <span className="vai-workspace__busy">正在保存…</span> : null}
      </header>
      {error === null ? null : (
        <div className="vai-workspace__error" role="alert">{error.message}</div>
      )}
      <div className="vai-workspace__body" data-workspace-region="viewer">
        {objectsOpen || inspectorOpen ? (
          <aside className="vai-inspector-stack" data-panel="inspector" aria-label="对象与属性">
            {objectsOpen ? <ObjectList /> : null}
            {inspectorOpen ? <PropertyInspector /> : null}
          </aside>
        ) : null}
        <Canvas />
        {previewContributions.map((contribution) => (
          <div key={contribution.id} data-preview-overlay={contribution.id}>
            {contribution.render({ snapshot: displaySnapshot ?? snapshot, viewport })}
          </div>
        ))}
      </div>
      <WorkspaceStatus />
    </section>
  );
}

function WorkspaceState({
  title,
  detail,
  alert = false,
}: {
  title: ReactNode;
  detail?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="vai-workspace__state" role={alert ? 'alert' : undefined}>
      <div className="vai-workspace__state-title">{title}</div>
      {detail === undefined ? null : <div className="vai-workspace__state-detail">{detail}</div>}
    </div>
  );
}
