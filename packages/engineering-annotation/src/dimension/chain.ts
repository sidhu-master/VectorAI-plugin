// SPDX-License-Identifier: Apache-2.0

import type {
  DimensionChain,
  DimensionIntent,
  EngineeringDiagnostic,
  ToleranceSpec,
} from './types';

export interface DimensionChainAnalysis {
  chainId: string;
  analysisMode: DimensionChain['analysisMode'];
  nominalClosure?: number;
  lowerDeviation?: number;
  upperDeviation?: number;
  lowerValue?: number;
  upperValue?: number;
  diagnostics: EngineeringDiagnostic[];
}

interface DeviationRange {
  lower: number;
  upper: number;
}

export function analyzeDimensionChain(input: {
  chain: DimensionChain;
  intents: DimensionIntent[];
  tolerances: ToleranceSpec[];
}): DimensionChainAnalysis {
  const intentsById = new Map(input.intents.map((intent) => [intent.id, intent]));
  const tolerancesByIntentId = new Map(input.tolerances.map((tolerance) => [tolerance.dimensionIntentId, tolerance]));
  const diagnostics: EngineeringDiagnostic[] = [];
  let nominalClosure = 0;

  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (!intent) {
      diagnostics.push(issue(input.chain, 'DIMENSION_CHAIN_MEMBER_UNKNOWN', '尺寸链引用了不存在的尺寸意图。', member.dimensionIntentId));
      continue;
    }
    nominalClosure += member.coefficient * intent.nominalValue;
  }
  nominalClosure = precise(nominalClosure);

  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (intent && (intent.status === 'conflict' || intent.status === 'stale')) {
      diagnostics.push(issue(input.chain, 'DIMENSION_CHAIN_MEMBER_CONFLICT', '尺寸链成员处于冲突或过期状态。', intent.id));
    }
  }

  const base: DimensionChainAnalysis = {
    chainId: input.chain.id,
    analysisMode: input.chain.analysisMode,
    nominalClosure,
    diagnostics,
  };
  if (input.chain.analysisMode === 'reference-only') return base;
  if (input.chain.analysisMode === 'statistical') {
    diagnostics.push(issue(
      input.chain,
      'DIMENSION_CHAIN_STATISTICAL_UNSUPPORTED',
      '当前里程碑不支持统计尺寸链分析。',
      input.chain.id,
    ));
    return base;
  }

  let lowerDeviation = 0;
  let upperDeviation = 0;
  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (!intent) continue;
    const tolerance = tolerancesByIntentId.get(intent.id);
    const range = toleranceRange(tolerance, intent.nominalValue);
    if (!range) {
      diagnostics.push(issue(
        input.chain,
        'DIMENSION_CHAIN_TOLERANCE_MISSING',
        '最坏情况尺寸链分析需要每个成员都有已解析的数值公差。',
        intent.id,
      ));
      continue;
    }
    if (member.coefficient === 1) {
      lowerDeviation += range.lower;
      upperDeviation += range.upper;
    } else {
      lowerDeviation -= range.upper;
      upperDeviation -= range.lower;
    }
  }
  lowerDeviation = precise(lowerDeviation);
  upperDeviation = precise(upperDeviation);
  return {
    ...base,
    lowerDeviation,
    upperDeviation,
    lowerValue: precise(nominalClosure + lowerDeviation),
    upperValue: precise(nominalClosure + upperDeviation),
  };
}

function toleranceRange(tolerance: ToleranceSpec | undefined, nominalValue: number): DeviationRange | undefined {
  if (!tolerance || !['resolved', 'confirmed'].includes(tolerance.status) || !tolerance.resolved) return undefined;
  const resolved = tolerance.resolved;
  switch (tolerance.mode) {
    case 'bilateral':
      return finiteRange(resolved.lowerDeviation, resolved.upperDeviation);
    case 'unilateral':
      return finiteRange(resolved.lowerDeviation ?? 0, resolved.upperDeviation ?? 0);
    case 'limits':
      return finiteRange(
        resolved.lowerLimit === undefined ? undefined : resolved.lowerLimit - nominalValue,
        resolved.upperLimit === undefined ? undefined : resolved.upperLimit - nominalValue,
      );
    case 'fit':
    case 'formula':
      return undefined;
  }
}

function finiteRange(lower: number | undefined, upper: number | undefined): DeviationRange | undefined {
  if (lower === undefined || upper === undefined || !Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) return undefined;
  return { lower, upper };
}

function precise(value: number): number {
  return Number(value.toPrecision(12));
}

function issue(chain: DimensionChain, code: string, message: string, entityId: string): EngineeringDiagnostic {
  return {
    id: `${chain.id}:${code}:${entityId}`,
    severity: 'error',
    code,
    message,
    entityIds: [entityId],
    evidenceIds: [...chain.evidenceIds],
  };
}
