// SPDX-License-Identifier: Apache-2.0

import { useDrawingWorkspace } from '../hooks';
import { fitViewportToDrawing } from '../canvas/geometry';

export function WorkspaceToolbar() {
  const snapshot = useDrawingWorkspace((state) => state.displaySnapshot);
  const viewport = useDrawingWorkspace((state) => state.viewport);
  const display = useDrawingWorkspace((state) => state.display);
  const setViewport = useDrawingWorkspace((state) => state.setViewport);
  const setDisplay = useDrawingWorkspace((state) => state.setDisplay);
  if (snapshot === null) return null;
  const toggles = [
    ['grid', '网格'],
    ['axes', '坐标轴'],
    ['relations', '关系'],
    ['annotations', '标注'],
    ['sourceUnderlay', '源图'],
  ] as const;
  return (
    <div className="vai-toolbar" role="toolbar" aria-label="图纸视图工具">
      <button
        type="button"
        onClick={() => setViewport(fitViewportToDrawing(snapshot.document, viewport))}
      >
        适配图纸
      </button>
      <span className="vai-toolbar__separator" />
      {toggles.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={display[key]}
          onClick={() => setDisplay({ [key]: !display[key] })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
