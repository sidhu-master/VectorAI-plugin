// SPDX-License-Identifier: Apache-2.0

interface ReviewActionController {
  actions: {
    cancel(): Promise<void>;
    confirm(): Promise<void>;
    setPreviewHeld(value: boolean): void;
  };
}

export function PartitionActionToolbar({ controller, previewHeld, subject = '分区' }: { controller: ReviewActionController; previewHeld: boolean; subject?: string }) {
  return <div className="vai-partition-actions" role="toolbar" aria-label={`${subject}确认工具栏`}>
    <button type="button" className="vai-partition-action vai-partition-action--cancel" aria-label={`取消${subject}`} title="取消" onClick={() => void controller.actions.cancel().catch(() => undefined)}>×</button>
    <button type="button" className={`vai-partition-action vai-partition-action--preview${previewHeld ? ' is-held' : ''}`} aria-label={`按住预览${subject}结果`} title="按住预览"
      onPointerDown={() => controller.actions.setPreviewHeld(true)} onPointerUp={() => controller.actions.setPreviewHeld(false)} onPointerCancel={() => controller.actions.setPreviewHeld(false)} onPointerLeave={() => controller.actions.setPreviewHeld(false)}>◉</button>
    <button type="button" className="vai-partition-action vai-partition-action--confirm" aria-label={`确认${subject}`} title="确认" onClick={() => void controller.actions.confirm().catch(() => undefined)}>✓</button>
  </div>;
}
