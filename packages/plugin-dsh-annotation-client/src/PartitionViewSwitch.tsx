// SPDX-License-Identifier: Apache-2.0

import type { PartitionViewMode } from './partition-view-model';

export function PartitionViewSwitch({ mode, onChange }: {
  mode: PartitionViewMode;
  onChange(mode: PartitionViewMode): void;
}) {
  return <div className="vai-partition-view-switch" role="group" aria-label="分区显示方式">
    <button type="button" className={mode === 'functional' ? 'is-active' : undefined}
      aria-label="显示功能分区" aria-pressed={mode === 'functional'} onClick={() => onChange('functional')}>
      功能分区
    </button>
    <button type="button" className={mode === 'segments' ? 'is-active' : undefined}
      aria-label="显示连续轴段" aria-pressed={mode === 'segments'} onClick={() => onChange('segments')}>
      连续轴段
    </button>
  </div>;
}
