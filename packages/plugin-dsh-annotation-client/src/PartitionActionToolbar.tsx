// SPDX-License-Identifier: Apache-2.0

import type { PartitionController } from './partition-controller';

export function PartitionActionToolbar({ controller, previewHeld }: { controller: PartitionController; previewHeld: boolean }) {
  return <div className="vai-partition-actions" role="toolbar" aria-label="分区确认工具栏">
    <button type="button" className="vai-partition-action vai-partition-action--cancel" aria-label="取消分区" title="取消" onClick={() => void controller.actions.cancel().catch(() => undefined)}>×</button>
    <button type="button" className={`vai-partition-action vai-partition-action--preview${previewHeld ? ' is-held' : ''}`} aria-label="按住预览分区结果" title="按住预览"
      onPointerDown={() => controller.actions.setPreviewHeld(true)} onPointerUp={() => controller.actions.setPreviewHeld(false)} onPointerCancel={() => controller.actions.setPreviewHeld(false)} onPointerLeave={() => controller.actions.setPreviewHeld(false)}>◉</button>
    <button type="button" className="vai-partition-action vai-partition-action--confirm" aria-label="确认分区" title="确认" onClick={() => void controller.actions.confirm().catch(() => undefined)}>✓</button>
  </div>;
}
