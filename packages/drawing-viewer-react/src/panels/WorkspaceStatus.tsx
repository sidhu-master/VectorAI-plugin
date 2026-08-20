// SPDX-License-Identifier: Apache-2.0

import { useDrawingWorkspace } from '../hooks';

export function WorkspaceStatus() {
  const snapshot = useDrawingWorkspace((state) => state.snapshot);
  const displaySnapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const preview = useDrawingWorkspace((state) => state.preview);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const mouseWorld = useDrawingWorkspace((state) => state.mouseWorld);
  const selectedIds = useDrawingWorkspace((state) => state.selectedIds);
  const busy = useDrawingWorkspace((state) => state.busy);
  if (snapshot === null) return null;
  return (
    <footer className="vai-status" aria-label="图纸状态">
      <span>{snapshot.ref.drawingId}</span>
      <span>Revision {snapshot.ref.revision}</span>
      <span>{displaySnapshot?.document.unitSystem.length ?? snapshot.document.unitSystem.length}</span>
      {preview === null ? null : <span>Preview {preview.handle}</span>}
      <span>{Math.round(viewport.scale * 100)}%</span>
      <span>{selectedIds.length} 个已选</span>
      <span className="vai-status__coords">
        {mouseWorld === null ? 'X —  Y —' : `X ${mouseWorld[0].toFixed(3)}  Y ${mouseWorld[1].toFixed(3)}`}
      </span>
      {busy ? <span>正在保存…</span> : null}
    </footer>
  );
}
