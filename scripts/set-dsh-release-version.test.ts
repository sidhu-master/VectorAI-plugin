// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { materializeBundleRuntimeDependencies } from './set-dsh-release-version.mjs';

const baseline = {
  version: '0.1.3-alpha.1',
  bundleRuntimeDependencies: {
    '@newwe/vectorai-plugin-dsh-space': [
      '@deepseek-ai/dsh-llm',
      '@deepseek-ai/dsh-tools',
    ],
  },
};

const space = {
  name: '@newwe/vectorai-plugin-dsh-space',
  dependencies: { zod: '4.4.3' },
  peerDependencies: {
    '@deepseek-ai/cordis': '4.0.2',
    '@deepseek-ai/dsh-agent': '0.1.3-alpha.1',
    '@deepseek-ai/dsh-llm': '0.1.3-alpha.1',
    '@deepseek-ai/dsh-tools': '0.1.3-alpha.1',
  },
  peerDependenciesMeta: {
    '@deepseek-ai/dsh-agent': { optional: true },
    '@deepseek-ai/dsh-llm': { optional: true },
    '@deepseek-ai/dsh-tools': { optional: true },
  },
};

describe('DSH release manifest materialization', () => {
  it('promotes built Host runtime imports to exact normal dependencies', () => {
    const result = materializeBundleRuntimeDependencies(space, space.name, baseline);

    expect(result.dependencies).toEqual({
      '@deepseek-ai/dsh-llm': '0.1.3-alpha.1',
      '@deepseek-ai/dsh-tools': '0.1.3-alpha.1',
      zod: '4.4.3',
    });
    expect(result.peerDependencies['@deepseek-ai/dsh-llm']).toBeUndefined();
    expect(result.peerDependencies['@deepseek-ai/dsh-tools']).toBeUndefined();
    expect(result.peerDependenciesMeta['@deepseek-ai/dsh-llm']).toBeUndefined();
    expect(result.peerDependenciesMeta['@deepseek-ai/dsh-tools']).toBeUndefined();
  });

  it('keeps Cordis required and preserves type-only DSH contracts as optional peers', () => {
    const result = materializeBundleRuntimeDependencies(space, space.name, baseline);

    expect(result.peerDependencies['@deepseek-ai/cordis']).toBe('4.0.2');
    expect(result.peerDependenciesMeta['@deepseek-ai/cordis']).toBeUndefined();
    expect(result.peerDependencies['@deepseek-ai/dsh-agent']).toBe('0.1.3-alpha.1');
    expect(result.peerDependenciesMeta['@deepseek-ai/dsh-agent']).toEqual({ optional: true });
  });

  it('does not mutate the development manifest', () => {
    const before = structuredClone(space);
    materializeBundleRuntimeDependencies(space, space.name, baseline);
    expect(space).toEqual(before);
  });

  it('rejects a Bundle without an authoritative runtime inventory', () => {
    expect(() => materializeBundleRuntimeDependencies(
      { ...space, name: '@newwe/vectorai-plugin-dsh-annotation' },
      '@newwe/vectorai-plugin-dsh-annotation',
      baseline,
    )).toThrow(/inventory/i);
  });
});
