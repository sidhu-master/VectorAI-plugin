// SPDX-License-Identifier: Apache-2.0

import type { PartitionRevision } from '@vectorai/plugin-space-contracts';
import { Eye, EyeOff, PencilLine } from 'lucide-react';
import { partitionBands, type PartitionViewMode } from './partition-view-model';
import { PartitionViewSwitch } from './PartitionViewSwitch';

export function ConfirmedPartitionInspector({
  revision,
  busy,
  mode,
  onModeChange,
  overlayVisible,
  onOverlayVisibleChange,
  onReopen,
}: {
  revision: PartitionRevision;
  busy: boolean;
  mode: PartitionViewMode;
  onModeChange(mode: PartitionViewMode): void;
  overlayVisible: boolean;
  onOverlayVisibleChange(visible: boolean): void;
  onReopen(): Promise<void>;
}) {
  const bands = partitionBands(revision, mode);
  return <div className="vai-partition-inspector vai-confirmed-partition">
    <div className="vai-confirmed-partition__heading">
      <div><h2>{mode === 'functional' ? '功能分区' : '连续轴段'}</h2><span>已确认</span></div>
      <div className="vai-confirmed-partition__actions"><button type="button" className="vai-partition-visibility-toggle" aria-label={overlayVisible ? '隐藏分区框' : '显示分区框'} aria-pressed={overlayVisible}
        title={overlayVisible ? '隐藏分区框' : '显示分区框'} onClick={() => onOverlayVisibleChange(!overlayVisible)}>
        {overlayVisible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
      </button>
      <button type="button" aria-label="重新编辑分区" disabled={busy} onClick={() => void onReopen().catch(() => undefined)}>
        <PencilLine size={14} aria-hidden="true" />
        重新编辑
      </button></div>
    </div>
    <PartitionViewSwitch mode={mode} onChange={onModeChange} />
    <dl className="vai-confirmed-partition__meta">
      <dt>版本</dt><dd>{revision.id}</dd>
      <dt>确认时间</dt><dd>{formatConfirmedAt(revision.confirmedAt)}</dd>
    </dl>
    <ol>{bands.map((band, index) => <li key={band.id}>
      <span>{band.name ?? band.semanticType ?? `轴段 S${index + 1}`}</span>
      <small>{band.zStart.toFixed(2)} – {band.zEnd.toFixed(2)} · ⌀{(Math.max(...band.segments.map(({ profile }) => profile.maxRadius)) * 2).toFixed(2)}</small>
      {band.semanticType && <em>{band.semanticType}</em>}
    </li>)}</ol>
  </div>;
}

function formatConfirmedAt(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
