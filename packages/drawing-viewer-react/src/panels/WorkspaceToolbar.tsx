// SPDX-License-Identifier: Apache-2.0

import { exportDrawingDxf } from '@vectorai/drawing-core';
import type { DrawingWorkspaceSnapshot, DrawingWorkspaceViewport } from '@vectorai/drawing-workspace';
import { fitViewportToDrawing } from '../canvas/geometry';
import { useDrawingWorkspace } from '../hooks';
import { Check, Download, Eye, Redo2, Scan, Undo2, Upload, X } from 'lucide-react';
import { useEffect, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';

export interface WorkspaceToolbarHistory {
  canUndo: boolean;
  canRedo: boolean;
  undo(): void | Promise<void>;
  redo(): void | Promise<void>;
}

export interface WorkspaceToolbarProps {
  onUploadFiles?: (files: readonly File[]) => void;
  onExport?: () => void;
  motionPreviewHeld?: boolean;
  onMotionPreviewHeldChange?: (held: boolean) => void;
  history?: WorkspaceToolbarHistory;
  uploadAccept?: string;
  uploadMultiple?: boolean;
}

export function WorkspaceToolbar({
  onUploadFiles,
  onExport,
  motionPreviewHeld = false,
  onMotionPreviewHeldChange,
  history,
  uploadAccept = 'image/png,image/jpeg,image/webp,image/gif',
  uploadMultiple = false,
}: WorkspaceToolbarProps) {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const motionRig = useDrawingWorkspace((state) => state.motionRig);
  const canRestoreMotionRig = useDrawingWorkspace((state) => state.canRestoreMotionRig);
  const busy = useDrawingWorkspace((state) => state.busy);
  const setViewport = useDrawingWorkspace((state) => state.setViewport);
  const undoLast = useDrawingWorkspace((state) => state.undoLast);
  const redoLast = useDrawingWorkspace((state) => state.redoLast);
  const confirmMotionRig = useDrawingWorkspace((state) => state.confirmMotionRig);
  const cancelMotionRig = useDrawingWorkspace((state) => state.cancelMotionRig);
  const motionPreviewAvailable = motionRig?.phase === 'preview'
    && onMotionPreviewHeldChange !== undefined;
  useEffect(() => {
    if (!motionPreviewHeld || onMotionPreviewHeldChange === undefined) return;
    if (motionRig?.phase !== 'preview') onMotionPreviewHeldChange(false);
  }, [motionPreviewHeld, motionRig?.phase, onMotionPreviewHeldChange]);
  useEffect(() => {
    if (!motionPreviewHeld || onMotionPreviewHeldChange === undefined || typeof window === 'undefined') return;
    const release = () => onMotionPreviewHeldChange(false);
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, [motionPreviewHeld, onMotionPreviewHeldChange]);
  if (snapshot === null) return null;
  const lastCommit = formalSnapshot?.lastCommit;
  const unavailable = busy || preview !== null || motionRig !== null;
  const beginMotionPreview = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !motionPreviewAvailable) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onMotionPreviewHeldChange(true);
  };
  const endMotionPreview = () => {
    onMotionPreviewHeldChange?.(false);
  };
  const handleMotionPreviewKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!motionPreviewAvailable || event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    onMotionPreviewHeldChange(true);
  };
  const handleMotionPreviewKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    onMotionPreviewHeldChange?.(false);
  };
  return (
    <>
      {motionRig !== null ? (
        <div className="vai-toolbar vai-toolbar--motion-rig" role="toolbar" aria-label="姿态编辑操作">
          <button
            className="vai-toolbar__action vai-toolbar__action--cancel"
            type="button"
            aria-label="取消姿态"
            title="取消姿态"
            onClick={() => { void cancelMotionRig(); }}
          ><X aria-hidden="true" size={17} /></button>
          <span
            className="vai-toolbar__separator vai-toolbar__separator--motion-rig"
            aria-hidden="true"
          />
          <button
            className="vai-toolbar__action vai-toolbar__action--preview"
            type="button"
            aria-label="按住预览修改效果"
            aria-pressed={motionPreviewHeld}
            disabled={!motionPreviewAvailable}
            title="按住预览修改前后位置"
            onPointerDown={beginMotionPreview}
            onPointerUp={endMotionPreview}
            onPointerCancel={endMotionPreview}
            onBlur={endMotionPreview}
            onKeyDown={handleMotionPreviewKeyDown}
            onKeyUp={handleMotionPreviewKeyUp}
            onClick={(event) => event.preventDefault()}
          ><Eye aria-hidden="true" size={17} /></button>
          <span
            className="vai-toolbar__separator vai-toolbar__separator--motion-rig"
            aria-hidden="true"
          />
          <button
            className="vai-toolbar__action vai-toolbar__action--confirm"
            type="button"
            aria-label="确认姿态"
            disabled={motionRig.phase !== 'preview'}
            title="确认姿态"
            onClick={() => { void confirmMotionRig(); }}
          ><Check aria-hidden="true" size={17} /></button>
        </div>
      ) : null}
      <WorkspaceToolbarView
        snapshot={snapshot}
        viewport={viewport}
        unavailable={unavailable}
        canUndo={history?.canUndo ?? Boolean(canRestoreMotionRig || lastCommit?.undoable)}
        canRedo={history?.canRedo ?? Boolean(lastCommit?.redoable)}
        onFit={(next) => setViewport(next)}
        onUndo={() => history ? history.undo() : undoLast()}
        onRedo={() => history ? history.redo() : redoLast()}
        onUploadFiles={onUploadFiles}
        uploadAccept={uploadAccept}
        uploadMultiple={uploadMultiple}
        onExport={onExport}
      />
    </>
  );
}

export interface WorkspaceToolbarViewProps {
  snapshot: DrawingWorkspaceSnapshot;
  viewport: DrawingWorkspaceViewport;
  unavailable?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onFit(viewport: ReturnType<typeof fitViewportToDrawing>): void;
  onUndo(): unknown | Promise<unknown>;
  onRedo(): unknown | Promise<unknown>;
  onUploadFiles?: (files: readonly File[]) => void;
  uploadAccept?: string;
  uploadMultiple?: boolean;
  onExport?: () => void;
}

export function WorkspaceToolbarView({
  snapshot,
  viewport,
  unavailable = false,
  canUndo,
  canRedo,
  onFit,
  onUndo,
  onRedo,
  onUploadFiles,
  uploadAccept = 'image/png,image/jpeg,image/webp,image/gif',
  uploadMultiple = false,
  onExport,
}: WorkspaceToolbarViewProps) {
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) onUploadFiles?.(files);
  };
  return <div className="vai-toolbar" role="toolbar" aria-label="图纸操作工具">
      <button
        type="button"
        aria-label="适配图纸"
        title="缩放并居中显示整张图纸"
        onClick={() => onFit(fitViewportToDrawing(snapshot.document, viewport))}
      >
        <Scan aria-hidden="true" size={17} />
      </button>
      <span className="vai-toolbar__separator" />
      <button
        type="button"
        aria-label="撤销"
        disabled={unavailable || !canUndo}
        title="撤销最近一次图纸修改"
        onClick={() => { void onUndo(); }}
      ><Undo2 aria-hidden="true" size={17} /></button>
      <button
        type="button"
        aria-label="反撤销"
        disabled={unavailable || !canRedo}
        title="恢复最近一次撤销"
        onClick={() => { void onRedo(); }}
      ><Redo2 aria-hidden="true" size={17} /></button>
      <span className="vai-toolbar__separator" />
      <label
        className={`vai-toolbar__upload${onUploadFiles === undefined ? ' vai-toolbar__upload--disabled' : ''}`}
        aria-label="上传图纸"
        title="上传图纸"
      >
        <Upload aria-hidden="true" size={17} />
        <input
          type="file"
          accept={uploadAccept}
          multiple={uploadMultiple}
          disabled={onUploadFiles === undefined}
          onChange={handleUpload}
        />
      </label>
      <button
        type="button"
        aria-label="导出 DXF"
        disabled={false}
        title="导出当前 DXF 图纸"
        onClick={onExport ?? (() => exportSnapshotDxf(snapshot))}
      ><Download aria-hidden="true" size={17} /></button>
      </div>
}

function exportSnapshotDxf(snapshot: DrawingWorkspaceSnapshot): void {
  const blob = new Blob([exportDrawingDxf(snapshot.document)], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${snapshot.ref.drawingId}-R${snapshot.ref.revision}.dxf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
