// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import type { GdtController } from './gdt-controller';

const CHARACTERISTICS = [
  'straightness', 'flatness', 'circularity', 'cylindricity', 'profile-line', 'profile-surface',
  'parallelism', 'perpendicularity', 'angularity', 'position', 'coaxiality', 'symmetry',
  'circular-runout', 'total-runout',
] as const;

export function GdtInspector({ draft, selectedIntentId, selectedGeometryIds, controller, onSelectIntent }: {
  draft: EngineeringAnnotationDraft;
  selectedIntentId: string | null;
  selectedGeometryIds: readonly string[];
  controller: GdtController;
  onSelectIntent(id: string): void;
}) {
  const intent = draft.geometricTolerances.find(({ id }) => id === selectedIntentId) ?? draft.geometricTolerances[0];
  if (!intent) return null;
  const effective = intent.override?.value ?? intent.computed.value;
  return <section className="vai-gdt-inspector" aria-label="形位公差编辑">
    <header><h2>基准与形位公差</h2><span>{draft.geometricTolerances.length} 项</span></header>
    <label>标注
      <select value={intent.id} onChange={(event) => onSelectIntent(event.target.value)}>
        {draft.geometricTolerances.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
      </select>
    </label>
    <label>公差类型
      <select value={intent.characteristic} onChange={(event) => void controller.actions.edit({ type: 'characteristic.set', intentId: intent.id, characteristic: event.target.value as typeof intent.characteristic })}>
        {CHARACTERISTICS.map((value) => <option key={value} value={value}>{characteristicLabel(value)}</option>)}
      </select>
    </label>
    <label>公差带
      <select value={intent.toleranceZone.shape} onChange={(event) => void controller.actions.edit({ type: 'zone.set', intentId: intent.id, zone: { ...intent.toleranceZone, shape: event.target.value as typeof intent.toleranceZone.shape } })}>
        <option value="linear">线性</option><option value="diametrical">直径</option><option value="spherical">球形</option>
      </select>
    </label>
    <label>人工修订值（mm）
      <input type="number" min="0" step="0.001" value={intent.override?.value ?? ''} placeholder={intent.computed.value?.toString() ?? '等待算法计算'}
        onChange={(event) => { const value = Number(event.target.value); if (value > 0) void controller.actions.setOverride(intent.id, value); }} />
    </label>
    <div className="vai-gdt-inspector__value"><span>算法值</span><strong>{intent.computed.value ?? '待计算'}</strong></div>
    <div className="vai-gdt-inspector__value"><span>当前值</span><strong>{effective ?? '待计算'}</strong></div>
    {intent.override && <button type="button" onClick={() => void controller.actions.clearOverride(intent.id)}>恢复算法值</button>}
    {selectedGeometryIds.length > 0 && <button type="button" onClick={() => void controller.actions.edit({
      type: 'controlled-targets.set', intentId: intent.id,
      targets: selectedGeometryIds.map((geometryId) => ({ geometryId, anchor: { kind: 'nearest', point: intent.controlledTargets[0]?.anchor.kind === 'nearest' ? intent.controlledTargets[0].anchor.point : [0, 0] } })),
    })}>使用画布当前选中图元</button>}
    <div className="vai-gdt-inspector__datums">
      <span>基准顺序</span>
      {intent.datumReferenceFrame.map((reference, index) => <select key={`${intent.id}:${index}`} value={reference.datumId} onChange={(event) => {
        const references = intent.datumReferenceFrame.map((item, itemIndex) => itemIndex === index ? { ...item, datumId: event.target.value } : item);
        void controller.actions.edit({ type: 'datum-frame.set', intentId: intent.id, references });
      }}>
        {draft.datums.map((datum) => <option key={datum.id} value={datum.id}>{datum.name}</option>)}
      </select>)}
    </div>
  </section>;
}

function characteristicLabel(value: typeof CHARACTERISTICS[number]): string {
  return {
    straightness: '直线度', flatness: '平面度', circularity: '圆度', cylindricity: '圆柱度',
    'profile-line': '线轮廓度', 'profile-surface': '面轮廓度', parallelism: '平行度', perpendicularity: '垂直度',
    angularity: '倾斜度', position: '位置度', coaxiality: '同轴度', symmetry: '对称度',
    'circular-runout': '圆跳动', 'total-runout': '全跳动',
  }[value];
}
