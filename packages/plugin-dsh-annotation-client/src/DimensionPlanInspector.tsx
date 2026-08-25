// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';

export interface DimensionPlanInspectorProps {
  draft: EngineeringAnnotationDraft;
  generationOrder: string[];
}

export function DimensionPlanInspector({ draft, generationOrder }: DimensionPlanInspectorProps) {
  const intentsById = new Map(draft.intents.map((intent) => [intent.id, intent]));
  const tolerancesByIntentId = new Map(draft.tolerances.map((tolerance) => [tolerance.dimensionIntentId, tolerance]));
  const datumsById = new Map(draft.datums.map((datum) => [datum.id, datum]));
  const orderedIntents = generationOrder.flatMap((id) => {
    const intent = intentsById.get(id);
    return intent === undefined ? [] : [intent];
  });

  return <section className="vai-dimension-plan" aria-label="尺寸计划检查">
    <header>
      <h2>尺寸标注计划</h2>
      <span>{orderedIntents.length} 项</span>
    </header>
    <ol aria-label="尺寸标注顺序">
      {orderedIntents.map((intent, index) => {
        const tolerance = tolerancesByIntentId.get(intent.id);
        const datumNames = intent.datumIds.flatMap((id) => {
          const datum = datumsById.get(id);
          return datum === undefined ? [] : [datum.name];
        });
        const chainRoles = draft.chains.flatMap((chain) => chain.members
          .filter((member) => member.dimensionIntentId === intent.id)
          .map((member) => `${chain.name ?? chain.id} · ${chainRoleLabel(member.role)}`));
        const diagnostics = [
          ...draft.diagnostics.filter(({ entityIds }) => entityIds?.includes(intent.id)),
          ...(tolerance?.diagnostics ?? []),
        ];
        return <li
          key={intent.id}
          data-dimension-intent-id={intent.id}
          aria-label={`标注 ${index + 1}: ${intent.id}`}
        >
          <div className="vai-dimension-plan__row-title">
            <span className="vai-dimension-plan__order">{index + 1}</span>
            <strong>{roleLabel(intent.functionalRole)}</strong>
            <span className={`vai-dimension-badge vai-dimension-badge--${intent.status}`}>{stateLabel(intent.status)}</span>
          </div>
          <div className="vai-dimension-plan__nominal">{intent.nominalValue} {intent.unit}</div>
          <dl>
            <dt>意图</dt><dd>{intent.id}</dd>
            <dt>基准</dt><dd>{datumNames.length === 0 ? '无' : datumNames.map((name) => `基准 ${name}`).join('、')}</dd>
            <dt>尺寸链</dt><dd>{chainRoles.length === 0 ? '无' : chainRoles.join('；')}</dd>
            <dt>公差</dt><dd>{tolerance === undefined ? '未设置' : <>
              <span>{toleranceSourceLabel(tolerance.source)} · {toleranceStateLabel(tolerance.status)}</span>
              {tolerance.ruleRef && <code>{tolerance.ruleRef.id}@{tolerance.ruleRef.version}</code>}
            </>}</dd>
          </dl>
          {diagnostics.length > 0 && <div className="vai-dimension-plan__diagnostics" aria-label={`${intent.id} 诊断`}>
            {diagnostics.map((diagnostic) => <span key={diagnostic.id}>{diagnostic.code}</span>)}
          </div>}
        </li>;
      })}
    </ol>
  </section>;
}

function roleLabel(role: EngineeringAnnotationDraft['intents'][number]['functionalRole']): string {
  return {
    datum: '基准建立', overall: '总体尺寸', functional: '功能尺寸', assembly: '装配尺寸',
    process: '组成尺寸', inspection: '检验尺寸', auxiliary: '辅助尺寸', closure: '闭环尺寸',
  }[role];
}

function stateLabel(status: EngineeringAnnotationDraft['intents'][number]['status']): string {
  return {
    candidate: '候选', resolved: '已解析', confirmed: '已确认', conflict: '冲突', stale: '已过期',
  }[status];
}

function toleranceStateLabel(status: EngineeringAnnotationDraft['tolerances'][number]['status']): string {
  return status === 'candidate' ? '待解析' : stateLabel(status);
}

function toleranceSourceLabel(source: EngineeringAnnotationDraft['tolerances'][number]['source']): string {
  return {
    document: '文档', standard: '标准', 'enterprise-rule': '企业规则', manual: '手动', 'ai-candidate': 'AI 候选',
  }[source];
}

function chainRoleLabel(role: EngineeringAnnotationDraft['chains'][number]['members'][number]['role']): string {
  return { functional: '功能环', component: '组成环', closure: '封闭环' }[role];
}
