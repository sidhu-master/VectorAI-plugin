import { describe, expect, it } from 'vitest';

import { resolveAgentModelProfile, selectAgentModel } from './model-profile.js';

describe('Agent model profile', () => {
  it('routes every image-bearing role through the vision model', () => {
    const profile = resolveAgentModelProfile({
      planner: 'planner-text',
      vision: 'vision-image',
      executor: 'executor-text',
      repair: 'repair-text',
    });

    expect(selectAgentModel(profile, { role: 'planner', hasImage: true })).toBe('vision-image');
    expect(selectAgentModel(profile, { role: 'executor', hasImage: true })).toBe('vision-image');
    expect(selectAgentModel(profile, { role: 'repair', hasImage: true })).toBe('vision-image');
  });

  it('uses independently configured models for text-only roles', () => {
    const profile = resolveAgentModelProfile({
      planner: 'planner-text',
      vision: 'vision-image',
      executor: 'executor-text',
      repair: 'repair-text',
    });

    expect(selectAgentModel(profile, { role: 'planner', hasImage: false })).toBe('planner-text');
    expect(selectAgentModel(profile, { role: 'executor', hasImage: false })).toBe('executor-text');
    expect(selectAgentModel(profile, { role: 'repair', hasImage: false })).toBe('repair-text');
    expect(selectAgentModel(profile, { role: 'executor', hasImage: false, isRepair: true })).toBe(
      'repair-text',
    );
  });

  it('provides non-empty defaults and the required default vision model', () => {
    const profile = resolveAgentModelProfile({});

    expect(profile.vision).toBe('doubao-seed-2.0-lite');
    expect(selectAgentModel(profile, { role: 'planner', hasImage: false })).not.toBe('');
    expect(selectAgentModel(profile, { role: 'executor', hasImage: false })).not.toBe('');
    expect(selectAgentModel(profile, { role: 'repair', hasImage: false })).not.toBe('');
  });

  it('merges non-empty request overrides over configured defaults', () => {
    const profile = resolveAgentModelProfile(
      {
        planner: 'default-planner',
        vision: 'default-vision',
        executor: 'default-executor',
        repair: 'default-repair',
      },
      {
        planner: 'request-planner',
        vision: 'request-vision',
        executor: 'request-executor',
        repair: 'request-repair',
      },
    );

    expect(profile).toEqual({
      planner: 'request-planner',
      vision: 'request-vision',
      executor: 'request-executor',
      repair: 'request-repair',
    });
  });

  it('ignores whitespace-only overrides and returns an immutable profile', () => {
    const profile = resolveAgentModelProfile(
      { planner: 'default-planner', vision: 'default-vision' },
      { planner: '   ', vision: '\t' },
    );

    expect(profile.planner).toBe('default-planner');
    expect(profile.vision).toBe('default-vision');
    expect(Object.isFrozen(profile)).toBe(true);
  });
});
