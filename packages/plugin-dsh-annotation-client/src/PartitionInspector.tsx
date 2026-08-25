// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import type { PartitionController } from './partition-controller';

export function PartitionInspector({ draft, controller }: { draft: PartitionDraft; controller: PartitionController }) {
  return <div className="vai-partition-inspector">
    <h2>轴段分区</h2>
    <ol>{draft.segments.map((segment, index) => <li key={segment.id}>
      <span>{segment.name ?? `轴段 S${index + 1}`}</span>
      <small>{segment.zStart.toFixed(2)} – {segment.zEnd.toFixed(2)} · ⌀{(segment.profile.maxRadius * 2).toFixed(2)}</small>
      <div className="vai-partition-inspector__fields">
        <input aria-label={`轴段 ${index + 1} 名称`} defaultValue={segment.name ?? ''} placeholder="名称" onBlur={(event) => void controller.actions.updateSegment(segment.id, { name: event.currentTarget.value }).catch(() => undefined)} />
        <input aria-label={`轴段 ${index + 1} 类型`} defaultValue={segment.semanticType ?? ''} placeholder="类型" onBlur={(event) => void controller.actions.updateSegment(segment.id, { semanticType: event.currentTarget.value }).catch(() => undefined)} />
      </div>
      <div className="vai-partition-inspector__commands">
        <button type="button" aria-label={`拆分轴段 ${index + 1}`} onClick={() => void controller.actions.splitSegment(segment.id, (segment.zStart + segment.zEnd) / 2, Math.max(draft.axis.zMax * 0.003, 0.05)).catch(() => undefined)}>拆分</button>
        {index > 0 && <button type="button" aria-label={`合并边界 ${index}`} onClick={() => void controller.actions.mergeBoundary(index).catch(() => undefined)}>与前段合并</button>}
      </div>
      {index < draft.segments.length - 1 && <label className="vai-partition-inspector__boundary">结束位置
        <input type="number" step="any" defaultValue={segment.zEnd} aria-label={`边界 ${index + 1} 精确位置`} onKeyDown={(event) => {
          if (event.key === 'Enter') void controller.actions.moveBoundary(index + 1, Number(event.currentTarget.value), 0).catch(() => undefined);
        }} />
      </label>}
    </li>)}</ol>
    {draft.diagnostics.length > 0 && <div className="vai-partition-diagnostics">{draft.diagnostics.map((diagnostic) => <p key={diagnostic.id}>{diagnostic.code}</p>)}</div>}
  </div>;
}
