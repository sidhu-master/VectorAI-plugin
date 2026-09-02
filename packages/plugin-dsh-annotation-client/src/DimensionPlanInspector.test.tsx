// SPDX-License-Identifier: Apache-2.0

import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DimensionPlanInspector } from './DimensionPlanInspector';

function draft(): EngineeringAnnotationDraft {
  const ref = { drawingId: 'drawing-1', revision: 1 };
  const makeIntent = (
    id: string,
    functionalRole: EngineeringAnnotationDraft['intents'][number]['functionalRole'],
    status: EngineeringAnnotationDraft['intents'][number]['status'] = 'confirmed',
  ): EngineeringAnnotationDraft['intents'][number] => ({
    id, drawingRef: ref, kind: 'linear', targets: [{ geometryId: `line-${id}`, anchor: { kind: 'end' } }],
    datumIds: id === 'datum' ? [] : ['datum-a'], nominalValue: 20, unit: 'mm', functionalRole,
    source: 'manual', status, evidenceIds: [`manual:${id}`],
  });
  return {
    version: 1, drawingRef: ref,
    datums: [{
      id: 'datum-a', drawingRef: ref, name: 'A', geometryId: 'line-datum', anchor: { kind: 'start' },
      role: 'primary', source: 'manual', status: 'confirmed', evidenceIds: ['manual:datum-a'],
    }],
    intents: [
      makeIntent('closure', 'closure', 'conflict'),
      makeIntent('component', 'process'),
      makeIntent('functional', 'functional', 'stale'),
      makeIntent('overall', 'overall'),
      makeIntent('datum', 'datum'),
    ],
    tolerances: [{
      id: 'tolerance-component', dimensionIntentId: 'component', mode: 'formula',
      source: 'enterprise-rule', ruleRef: { id: 'corp-shaft', version: '2026.1' }, inputs: {},
      status: 'candidate', evidenceIds: ['rule:corp-shaft'], diagnostics: [],
    }],
    fitAssignments: [],
    geometricTolerances: [],
    surfaceTextures: [],
    chains: [{
      id: 'chain-1', drawingRef: ref, datumIds: ['datum-a'],
      members: [
        { dimensionIntentId: 'functional', coefficient: 1, role: 'functional' },
        { dimensionIntentId: 'component', coefficient: 1, role: 'component' },
        { dimensionIntentId: 'closure', coefficient: -1, role: 'closure' },
      ],
      equation: { closureIntentId: 'closure' }, analysisMode: 'worst-case', status: 'conflict',
      evidenceIds: ['manual:chain'], diagnostics: [],
    }],
    dependencies: [],
    diagnostics: [{
      id: 'diagnostic:closure', severity: 'error', code: 'DIMENSION_CHAIN_CONFLICT',
      message: '闭环尺寸冲突', entityIds: ['closure'],
    }],
  };
}

describe('DimensionPlanInspector', () => {
  it('renders read-only rows in provided generation order with engineering provenance', () => {
    const markup = renderToStaticMarkup(<DimensionPlanInspector
      draft={draft()}
      generationOrder={['datum', 'overall', 'functional', 'component', 'closure']}
    />);
    const ids = ['datum', 'overall', 'functional', 'component', 'closure'];
    expect(ids.map((id) => markup.indexOf(`data-dimension-intent-id="${id}"`))).toEqual(
      expect.toSatisfy((positions: number[]) => positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]!))),
    );
    expect(markup).toContain('aria-label="尺寸标注顺序"');
    expect(markup).toContain('基准 A');
    expect(markup).toContain('corp-shaft@2026.1');
    expect(markup).toContain('待解析');
    expect(markup).toContain('已过期');
    expect(markup).toContain('冲突');
    expect(markup).toContain('DIMENSION_CHAIN_CONFLICT');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<input');
  });
});
