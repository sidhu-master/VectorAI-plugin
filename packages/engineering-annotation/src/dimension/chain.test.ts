// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  analyzeDimensionChain,
  type DimensionChain,
  type DimensionIntent,
  type ToleranceSpec,
} from '../index';

function intent(id: string, nominalValue: number, status: DimensionIntent['status'] = 'confirmed'): DimensionIntent {
  return {
    id,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    kind: 'linear',
    targets: [{ geometryId: `geometry-${id}` as GeometryId, anchor: { kind: 'end' } }],
    datumIds: [], nominalValue, unit: 'mm', functionalRole: id === 'closure' ? 'closure' : 'process',
    source: 'manual', status, evidenceIds: [`manual:${id}`],
  };
}

function tolerance(id: string, upperDeviation: number, lowerDeviation: number): ToleranceSpec {
  return {
    id: `tolerance-${id}`, dimensionIntentId: id, mode: 'bilateral', source: 'manual', inputs: {},
    resolved: { upperDeviation, lowerDeviation, inputDigest: `manual:${id}`, evaluatedAt: 1 },
    status: 'confirmed', evidenceIds: [`manual:tolerance:${id}`], diagnostics: [],
  };
}

function chain(analysisMode: DimensionChain['analysisMode'] = 'worst-case'): DimensionChain {
  return {
    id: 'chain-1', drawingRef: { drawingId: 'drawing-1', revision: 1 }, datumIds: [],
    members: [
      { dimensionIntentId: 'a', coefficient: 1, role: 'component' },
      { dimensionIntentId: 'b', coefficient: 1, role: 'component' },
      { dimensionIntentId: 'closure', coefficient: -1, role: 'closure' },
    ],
    equation: { closureIntentId: 'closure', targetValue: 0 },
    analysisMode, status: 'resolved', evidenceIds: ['manual:chain'], diagnostics: [],
  };
}

describe('dimension-chain analysis', () => {
  it('calculates nominal closure and worst-case bounds with signed members', () => {
    const result = analyzeDimensionChain({
      chain: chain(),
      intents: [intent('a', 10), intent('b', 20), intent('closure', 29.9)],
      tolerances: [tolerance('a', 0.1, -0.2), tolerance('b', 0.3, -0.1), tolerance('closure', 0.4, -0.5)],
    });
    expect(result).toMatchObject({
      chainId: 'chain-1', analysisMode: 'worst-case', nominalClosure: 0.1,
      lowerDeviation: -0.7, upperDeviation: 0.9,
      lowerValue: -0.6, upperValue: 1,
      diagnostics: [],
    });
  });

  it('requires resolved numeric tolerances and non-conflicting member intents', () => {
    const result = analyzeDimensionChain({
      chain: chain(),
      intents: [intent('a', 10), intent('b', 20, 'conflict'), intent('closure', 30)],
      tolerances: [tolerance('a', 0.1, -0.1), tolerance('closure', 0.1, -0.1)],
    });
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'DIMENSION_CHAIN_MEMBER_CONFLICT',
      'DIMENSION_CHAIN_TOLERANCE_MISSING',
    ]);
  });

  it('supports reference-only nominal analysis without tolerances', () => {
    const result = analyzeDimensionChain({
      chain: chain('reference-only'),
      intents: [intent('a', 10), intent('b', 20), intent('closure', 30)],
      tolerances: [],
    });
    expect(result).toMatchObject({ nominalClosure: 0, diagnostics: [] });
    expect(result.lowerDeviation).toBeUndefined();
  });

  it('reports statistical analysis as explicitly unsupported', () => {
    const result = analyzeDimensionChain({
      chain: chain('statistical'),
      intents: [intent('a', 10), intent('b', 20), intent('closure', 30)],
      tolerances: [],
    });
    expect(result.diagnostics[0]?.code).toBe('DIMENSION_CHAIN_STATISTICAL_UNSUPPORTED');
  });
});
