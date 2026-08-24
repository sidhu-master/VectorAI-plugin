// SPDX-License-Identifier: Apache-2.0

import { fitViewportToDrawing } from '../canvas/geometry';
import { useDrawingWorkspace } from '../hooks';
import { Check, Download, Eye, Redo2, Scan, Undo2, Upload, X } from 'lucide-react';
import { useEffect, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';

export interface WorkspaceToolbarProps {
  onUploadFiles?: (files: readonly File[]) => void;
  onExport?: () => void;
  motionPreviewHeld?: boolean;
  onMotionPreviewHeldChange?: (held: boolean) => void;
}

export function WorkspaceToolbar({
  onUploadFiles,
  onExport,
  motionPreviewHeld = false,
  onMotionPreviewHeldChange,
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
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) onUploadFiles?.(files);
  };
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
      <div className="vai-toolbar" role="toolbar" aria-label="图纸操作工具">
      <button
        type="button"
        aria-label="适配图纸"
        title="缩放并居中显示整张图纸"
        onClick={() => setViewport(fitViewportToDrawing(snapshot.document, viewport))}
      >
        <Scan aria-hidden="true" size={17} />
      </button>
      <span className="vai-toolbar__separator" />
      <button
        type="button"
        aria-label="撤销"
        disabled={unavailable || (!canRestoreMotionRig && !lastCommit?.undoable)}
        title="撤销最近一次图纸修改"
        onClick={() => { void undoLast(); }}
      ><Undo2 aria-hidden="true" size={17} /></button>
      <button
        type="button"
        aria-label="反撤销"
        disabled={unavailable || !lastCommit?.redoable}
        title="恢复最近一次撤销"
        onClick={() => { void redoLast(); }}
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
          accept="image/png,image/jpeg,image/webp,image/gif"
          disabled={onUploadFiles === undefined}
          onChange={handleUpload}
        />
      </label>
      <button
        type="button"
        aria-label="导出 DXF"
        disabled={formalSnapshot === null}
        title="导出当前 DXF 图纸"
        onClick={onExport}
      ><Download aria-hidden="true" size={17} /></button>
      </div>
    </>
  );
}
