import { describe, expect, it } from 'vitest';

import { resolveAgentModelProfile, selectAgentModel } from './model-profile.js';

describe('Agent model profile', () => {
  it('routes normal image roles through vision and explicit repair through its fallback model', () => {
    const profile = resolveAgentModelProfile({
      planner: 'planner-text',
      vision: 'vision-image',
      executor: 'executor-text',
      repair: 'repair-text',
    });

    expect(selectAgentModel(profile, { role: 'planner', hasImage: true })).toBe('vision-image');
    expect(selectAgentModel(profile, { role: 'executor', hasImage: true })).toBe('vision-image');
    expect(selectAgentModel(profile, { role: 'repair', hasImage: true, isRepair: true })).toBe(
      'repair-text',
    );
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

  it('defaults primary roles to lite and low-confidence repair to turbo', () => {
    const profile = resolveAgentModelProfile({});

    expect(profile).toEqual({
      planner: 'doubao-seed-2.0-lite',
      vision: 'doubao-seed-2.0-lite',
      executor: 'doubao-seed-2.0-lite',
      repair: 'doubao-seed-2.1-turbo',
    });
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
