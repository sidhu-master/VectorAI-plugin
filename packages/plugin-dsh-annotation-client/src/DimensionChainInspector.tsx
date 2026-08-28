// SPDX-License-Identifier: Apache-2.0

import type { AxialDimensionScheme } from '@vectorai/plugin-space-contracts';
import type { DimensionChainController } from './dimension-chain-controller';

export function DimensionChainInspector({ scheme, controller }: {
  scheme: AxialDimensionScheme;
  controller: DimensionChainController;
}) {
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const candidate = (id: string) => candidates.get(id);
  return <section className="vai-dimension-chain-inspector" aria-label="尺寸链推断检查">
    <header><h2>轴向尺寸链</h2><span data-dimension-scheme-status={scheme.status}>{statusLabel(scheme.status)}</span></header>
    {scheme.diagnostics.length > 0 && <ul className="vai-dimension-chain-inspector__diagnostics">
      {scheme.diagnostics.map((diagnostic) => <li key={diagnostic.id}>{diagnosticLabel(diagnostic.code)}</li>)}
    </ul>}
    <ol>
      {scheme.chains.map((chain) => {
        const parent = candidate(chain.parentCandidateId);
        const closure = candidate(chain.closureCandidateId);
        return <li key={chain.id} data-dimension-chain-id={chain.id}>
          <strong>{parent?.nominalValue ?? '?'} {scheme.topology.unit}</strong>
          <span>{chain.childCandidateIds.map((id) => candidate(id)?.nominalValue ?? '?').join(' + ')} + {closure?.nominalValue ?? '?'}</span>
          <small>闭环：{closure?.nominalValue ?? '?'} {scheme.topology.unit}</small>
          {chain.alternativeClosureCandidateIds.length > 0 && <div className="vai-dimension-chain-inspector__alternatives">
            {chain.alternativeClosureCandidateIds.map((id) => {
              const item = candidate(id);
              if (!item) return null;
              return <button type="button" key={id} aria-label={`选择候选闭环 ${item.nominalValue} ${scheme.topology.unit}`}
                onClick={() => void controller.actions.chooseClosure(chain.id, id).catch(() => undefined)}>
                改用 {item.nominalValue} {scheme.topology.unit}
              </button>;
            })}
          </div>}
        </li>;
      })}
    </ol>
    <h3>显示尺寸</h3>
    <ul className="vai-dimension-chain-inspector__candidates">
      {scheme.candidates.filter(({ id }) => !scheme.closureCandidateIds.includes(id)).map((item) => {
        const displayed = scheme.displayedCandidateIds.includes(item.id);
        return <li key={item.id}>
          <label><input type="checkbox" checked={displayed} onChange={(event) => {
            void controller.actions.setDisplayed(item.id, event.currentTarget.checked).catch(() => undefined);
          }} />{item.nominalValue} {scheme.topology.unit}</label>
        </li>;
      })}
    </ul>
  </section>;
}

function statusLabel(status: AxialDimensionScheme['status']): string {
  return { resolved: '可确认', 'needs-review': '待复核', conflict: '有冲突', stale: '已过期' }[status];
}

function diagnosticLabel(code: string): string {
  if (code === 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT') return '文档与目标标注冲突';
  if (code === 'DIMENSION_CLOSURE_AMBIGUOUS') return '闭环选择需要确认';
  if (code === 'DIMENSION_CHAIN_INCOMPLETE') return '尺寸链不完整';
  return code;
}
