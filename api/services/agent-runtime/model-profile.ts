import type { AgentModelProfile, AgentModelRole } from './types.js';

export const DEFAULT_AGENT_VISION_MODEL = 'doubao-seed-2.0-lite';
export const DEFAULT_AGENT_TEXT_MODEL = 'Doubao-Seed-2.1-turbo';

type AgentModelProfileInput = Partial<AgentModelProfile>;

function nonEmptyModel(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? value : undefined;
}

function firstModel(...values: Array<string | undefined>): string {
  return values.map(nonEmptyModel).find(Boolean) ?? DEFAULT_AGENT_TEXT_MODEL;
}

export function resolveAgentModelProfile(
  defaults: AgentModelProfileInput = {},
  overrides: AgentModelProfileInput = {},
): AgentModelProfile {
  const planner = firstModel(overrides.planner, defaults.planner);
  const vision = firstModel(
    overrides.vision,
    defaults.vision,
    DEFAULT_AGENT_VISION_MODEL,
  );
  const executor = firstModel(overrides.executor, defaults.executor, planner);
  const repair = firstModel(overrides.repair, defaults.repair, executor, planner);

  return Object.freeze({ planner, vision, executor, repair });
}

export function selectAgentModel(
  profile: AgentModelProfile,
  input: { role: AgentModelRole; hasImage: boolean; isRepair?: boolean },
): string {
  if (input.hasImage) {
    return firstModel(profile.vision, DEFAULT_AGENT_VISION_MODEL);
  }

  if (input.isRepair || input.role === 'repair') {
    return firstModel(profile.repair, profile.executor, profile.planner, profile.vision);
  }

  if (input.role === 'executor') {
    return firstModel(profile.executor, profile.planner, profile.repair, profile.vision);
  }

  return firstModel(profile.planner, profile.executor, profile.repair, profile.vision);
}
