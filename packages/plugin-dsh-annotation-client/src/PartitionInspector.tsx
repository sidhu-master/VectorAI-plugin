// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/plugin-space-contracts';
import type { PartitionController } from './partition-controller';
import { partitionBands, type PartitionViewMode } from './partition-view-model';
import { PartitionViewSwitch } from './PartitionViewSwitch';

export function PartitionInspector({ draft, controller, mode, onModeChange }: {
  draft: PartitionDraft;
  controller: PartitionController;
  mode: PartitionViewMode;
  onModeChange(mode: PartitionViewMode): void;
}) {
  const functional = partitionBands(draft, 'functional');
  const classified = new Set(functional.flatMap(({ segmentIds }) => segmentIds));
  return <div className="vai-partition-inspector">
    <div className="vai-partition-inspector__title"><h2>{mode === 'functional' ? '功能分区' : '连续轴段'}</h2>
      <PartitionViewSwitch mode={mode} onChange={onModeChange} />
    </div>
    {mode === 'functional' ? <>
      <ol>{functional.map((band) => <li key={band.id}>
        <span>{band.name ?? band.semanticType ?? '未命名功能区'}</span>
        <small>{band.zStart.toFixed(2)} – {band.zEnd.toFixed(2)} · {sourceLabel(band.origin)}</small>
        {band.semanticType && <em>{band.semanticType}</em>}
      </li>)}</ol>
      <p className="vai-partition-inspector__unclassified">未归入功能区的过渡轴段：{draft.segments.length - classified.size} 段</p>
    </> : <ol>{draft.segments.map((segment, index) => <li key={segment.id}>
      <span>{segment.name ?? `轴段 S${index + 1}`}</span>
      <small>{segment.zStart.toFixed(2)} – {segment.zEnd.toFixed(2)} · ⌀{(segment.profile.maxRadius * 2).toFixed(2)}</small>
      <div className="vai-partition-inspector__fields">
        <input aria-label={`轴段 ${index + 1} 名称`} defaultValue={segment.name ?? ''} placeholder="名称" onBlur={(event) => void controller.actions.updateSegment(segment.id, { name: event.currentTarget.value }).catch(() => undefined)} />
        <input aria-label={`轴段 ${index + 1} 类型`} defaultValue={segment.semanticType ?? ''} placeholder="类型" onBlur={(event) => void controller.actions.updateSegment(segment.id, { semanticType: event.currentTarget.value }).catch(() => undefined)} />
      </div>
      <div className="vai-partition-inspector__commands">
        <button type="button" aria-label={`拆分轴段 ${index + 1}`} onClick={() => void controller.actions.splitSegment(segment.id, (segment.zStart + segment.zEnd) / 2, Math.max(Math.abs(draft.axis.zMax - draft.axis.zMin) * 0.003, 0.05)).catch(() => undefined)}>拆分</button>
        {index > 0 && <button type="button" aria-label={`合并边界 ${index}`} onClick={() => void controller.actions.mergeBoundary(index).catch(() => undefined)}>与前段合并</button>}
      </div>
      {index < draft.segments.length - 1 && <label className="vai-partition-inspector__boundary">结束位置
        <input type="number" step="any" defaultValue={segment.zEnd} aria-label={`边界 ${index + 1} 精确位置`} onKeyDown={(event) => {
          if (event.key === 'Enter') void controller.actions.moveBoundary(index + 1, Number(event.currentTarget.value), 0).catch(() => undefined);
        }} />
      </label>}
    </li>)}</ol>}
    {draft.diagnostics.length > 0 && <div className="vai-partition-diagnostics">{draft.diagnostics.map((diagnostic) => <p key={diagnostic.id}>{diagnostic.code}</p>)}</div>}
  </div>;
}

function sourceLabel(origin: string): string {
  return { document: '文档', ai: 'AI 识别', manual: '人工', fused: '融合', geometry: '几何' }[origin] ?? origin;
}
