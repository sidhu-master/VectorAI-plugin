// SPDX-License-Identifier: Apache-2.0

import { fitViewportToDrawing } from '../canvas/geometry';
import { useDrawingWorkspace } from '../hooks';
import { Check, Download, Redo2, Scan, Undo2, Upload, X } from 'lucide-react';
import type { ChangeEvent } from 'react';

export interface WorkspaceToolbarProps {
  onUploadFiles?: (files: readonly File[]) => void;
  onExport?: () => void;
}

export function WorkspaceToolbar({ onUploadFiles, onExport }: WorkspaceToolbarProps) {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const formalSnapshot = useDrawingWorkspace((state) => state.snapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const motionRig = useDrawingWorkspace((state) => state.motionRig);
  const busy = useDrawingWorkspace((state) => state.busy);
  const setViewport = useDrawingWorkspace((state) => state.setViewport);
  const undoLast = useDrawingWorkspace((state) => state.undoLast);
  const redoLast = useDrawingWorkspace((state) => state.redoLast);
  const confirmMotionRig = useDrawingWorkspace((state) => state.confirmMotionRig);
  const cancelMotionRig = useDrawingWorkspace((state) => state.cancelMotionRig);
  if (snapshot === null) return null;
  const lastCommit = formalSnapshot?.lastCommit;
  const unavailable = busy || preview !== null || motionRig !== null;
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) onUploadFiles?.(files);
  };
  return (
    <div className="vai-toolbar" role="toolbar" aria-label="图纸操作工具">
      {motionRig?.phase === 'preview' ? (
        <>
          <button
            type="button"
            aria-label="确认姿态"
            title="确认姿态"
            onClick={() => { void confirmMotionRig(); }}
          ><Check aria-hidden="true" size={17} /></button>
          <button
            type="button"
            aria-label="取消姿态"
            title="取消姿态"
            onClick={() => { void cancelMotionRig(); }}
          ><X aria-hidden="true" size={17} /></button>
          <span className="vai-toolbar__separator" />
        </>
      ) : null}
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
        disabled={unavailable || !lastCommit?.undoable}
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
  );
}
