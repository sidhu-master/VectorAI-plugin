// SPDX-License-Identifier: Apache-2.0

import type {
  DimensionIntent,
  EngineeringDiagnostic,
  ToleranceSpec,
} from '../dimension/types';
import { canonicalRuleInputDigest } from './digest';
import type {
  RuleInputType,
  ToleranceRuleDescriptor,
  ToleranceRuleProvider,
  ToleranceRuleResult,
} from './rules';

export interface ResolveToleranceSpecOptions {
  intent: DimensionIntent;
  spec: ToleranceSpec;
  provider: ToleranceRuleProvider;
  now: () => number;
}

export interface ResolveToleranceSpecResult {
  spec: ToleranceSpec;
  diagnostics: EngineeringDiagnostic[];
}

export function resolveToleranceSpec(options: ResolveToleranceSpecOptions): ResolveToleranceSpecResult {
  const next = cloneSpec(options.spec);

  if (next.source === 'ai-candidate') {
    return reject(next, diagnostic(next, 'TOLERANCE_AI_AUTHORITY_FORBIDDEN', 'AI 候选只能提出公差意图，不能生成最终数值。'));
  }

  const reference = next.ruleRef;
  if (!reference) {
    return reject(next, diagnostic(next, 'TOLERANCE_RULE_REQUIRED', '公式公差缺少规则标识和版本。'));
  }

  const rules = options.provider.listRules();
  const descriptor = rules.find((rule) => rule.id === reference.id && rule.version === reference.version);
  if (!descriptor) {
    const code = rules.some((rule) => rule.id === reference.id)
      ? 'TOLERANCE_RULE_VERSION_MISMATCH'
      : 'TOLERANCE_RULE_UNKNOWN';
    return reject(next, diagnostic(next, code, `无法解析公差规则 ${reference.id}@${reference.version}。`));
  }

  if (!validInputs(next.inputs, descriptor)) {
    return reject(next, diagnostic(next, 'TOLERANCE_INPUT_INVALID', '公差规则输入与声明的输入结构不一致。'));
  }

  let inputDigest: string;
  try {
    inputDigest = canonicalRuleInputDigest({
      nominalValue: options.intent.nominalValue,
      unit: options.intent.unit,
      inputs: next.inputs,
    });
  } catch {
    return reject(next, diagnostic(next, 'TOLERANCE_INPUT_INVALID', '公差规则输入包含不可确定序列化的值。'));
  }

  let result: ToleranceRuleResult;
  try {
    result = options.provider.evaluate({
      ruleId: descriptor.id,
      ruleVersion: descriptor.version,
      nominalValue: options.intent.nominalValue,
      unit: options.intent.unit,
      inputs: { ...next.inputs },
    });
  } catch {
    return reject(next, diagnostic(next, 'TOLERANCE_RULE_EVALUATION_FAILED', `公差规则 ${descriptor.id}@${descriptor.version} 执行失败。`));
  }

  if (!validResult(result, descriptor)) {
    return reject(next, diagnostic(next, 'TOLERANCE_RESULT_INVALID', '公差规则返回了无效或未声明的结果。'));
  }

  next.mode = result.mode;
  next.resolved = {
    ...copyResolvedFields(result),
    inputDigest,
    evaluatedAt: options.now(),
  };
  next.status = 'resolved';
  next.diagnostics = [];
  return { spec: next, diagnostics: [] };
}

function validInputs(inputs: ToleranceSpec['inputs'], descriptor: ToleranceRuleDescriptor): boolean {
  const expectedKeys = Object.keys(descriptor.inputSchema).sort();
  const actualKeys = Object.keys(inputs).sort();
  if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) return false;
  return expectedKeys.every((key) => validInputValue(inputs[key], descriptor.inputSchema[key]!));
}

function validInputValue(value: unknown, type: RuleInputType): boolean {
  if (typeof value !== type) return false;
  return type !== 'number' || Number.isFinite(value);
}

function validResult(result: ToleranceRuleResult, descriptor: ToleranceRuleDescriptor): boolean {
  if (!descriptor.outputModes.includes(result.mode)) return false;
  const numericFields = [result.upperDeviation, result.lowerDeviation, result.upperLimit, result.lowerLimit];
  if (numericFields.some((value) => value !== undefined && !Number.isFinite(value))) return false;

  switch (result.mode) {
    case 'bilateral':
      return finite(result.upperDeviation) && finite(result.lowerDeviation)
        && result.lowerDeviation <= result.upperDeviation;
    case 'unilateral': {
      if (!finite(result.upperDeviation) && !finite(result.lowerDeviation)) return false;
      return (result.lowerDeviation ?? 0) <= (result.upperDeviation ?? 0);
    }
    case 'limits':
      return finite(result.upperLimit) && finite(result.lowerLimit) && result.lowerLimit <= result.upperLimit;
    case 'fit':
      return typeof result.fitDesignation === 'string'
        && result.fitDesignation.trim().length > 0
        && result.fitDesignation.length <= 32;
  }
}

function finite(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function copyResolvedFields(result: ToleranceRuleResult): Omit<NonNullable<ToleranceSpec['resolved']>, 'inputDigest' | 'evaluatedAt'> {
  return {
    ...(result.upperDeviation === undefined ? {} : { upperDeviation: result.upperDeviation }),
    ...(result.lowerDeviation === undefined ? {} : { lowerDeviation: result.lowerDeviation }),
    ...(result.upperLimit === undefined ? {} : { upperLimit: result.upperLimit }),
    ...(result.lowerLimit === undefined ? {} : { lowerLimit: result.lowerLimit }),
    ...(result.fitDesignation === undefined ? {} : { fitDesignation: result.fitDesignation }),
  };
}

function reject(spec: ToleranceSpec, issue: EngineeringDiagnostic): ResolveToleranceSpecResult {
  spec.status = 'conflict';
  spec.resolved = undefined;
  spec.diagnostics = [issue];
  return { spec, diagnostics: [issue] };
}

function diagnostic(spec: ToleranceSpec, code: string, message: string): EngineeringDiagnostic {
  return {
    id: `${spec.id}:${code}`,
    severity: 'error',
    code,
    message,
    entityIds: [spec.id, spec.dimensionIntentId],
    evidenceIds: [...spec.evidenceIds],
  };
}

function cloneSpec(spec: ToleranceSpec): ToleranceSpec {
  return {
    ...spec,
    ruleRef: spec.ruleRef ? { ...spec.ruleRef } : undefined,
    inputs: { ...spec.inputs },
    resolved: spec.resolved ? { ...spec.resolved } : undefined,
    evidenceIds: [...spec.evidenceIds],
    diagnostics: spec.diagnostics.map((item) => ({
      ...item,
      entityIds: item.entityIds ? [...item.entityIds] : undefined,
      evidenceIds: item.evidenceIds ? [...item.evidenceIds] : undefined,
    })),
  };
}
