// SPDX-License-Identifier: Apache-2.0

import type { ResolvedTolerance, ToleranceMode } from '../dimension/types';

export type RuleInputType = 'number' | 'string' | 'boolean';
export type RuleOutputMode = Exclude<ToleranceMode, 'formula'>;

export interface ToleranceRuleDescriptor {
  id: string;
  version: string;
  inputSchema: Record<string, RuleInputType>;
  outputModes: RuleOutputMode[];
}

export interface ToleranceRuleRequest {
  ruleId: string;
  ruleVersion: string;
  nominalValue: number;
  unit: 'mm' | 'cm' | 'm' | 'deg';
  inputs: Record<string, number | string | boolean>;
}

export interface ToleranceRuleResult extends Omit<ResolvedTolerance, 'inputDigest' | 'evaluatedAt'> {
  mode: RuleOutputMode;
}

export interface ToleranceRuleProvider {
  listRules(): ToleranceRuleDescriptor[];
  evaluate(request: ToleranceRuleRequest): ToleranceRuleResult;
}
