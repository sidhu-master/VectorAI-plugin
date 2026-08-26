// SPDX-License-Identifier: Apache-2.0

import type { PartitionRevision } from '@vectorai/plugin-space-contracts';
import { PencilLine } from 'lucide-react';

export function ConfirmedPartitionInspector({
  revision,
  busy,
  onReopen,
}: {
  revision: PartitionRevision;
  busy: boolean;
  onReopen(): Promise<void>;
}) {
  return <div className="vai-partition-inspector vai-confirmed-partition">
    <div className="vai-confirmed-partition__heading">
      <div><h2>轴段分区</h2><span>已确认</span></div>
      <button type="button" aria-label="重新编辑分区" disabled={busy} onClick={() => void onReopen().catch(() => undefined)}>
        <PencilLine size={14} aria-hidden="true" />
        重新编辑
      </button>
    </div>
    <dl className="vai-confirmed-partition__meta">
      <dt>版本</dt><dd>{revision.id}</dd>
      <dt>确认时间</dt><dd>{formatConfirmedAt(revision.confirmedAt)}</dd>
    </dl>
    <ol>{revision.segments.map((segment, index) => <li key={segment.id}>
      <span>{segment.name ?? `轴段 S${index + 1}`}</span>
      <small>{segment.zStart.toFixed(2)} – {segment.zEnd.toFixed(2)} · ⌀{(segment.profile.maxRadius * 2).toFixed(2)}</small>
      {segment.semanticType && <em>{segment.semanticType}</em>}
    </li>)}</ol>
  </div>;
}

function formatConfirmedAt(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
