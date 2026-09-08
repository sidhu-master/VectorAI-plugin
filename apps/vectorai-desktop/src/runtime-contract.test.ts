import { describe, expect, it } from 'vitest';

import { parseDesktopRuntimeManifest, runtimeTarget } from './runtime-contract.js';

const validManifest = {
  schemaVersion: 1,
  vectoraiVersion: '0.1.0-alpha.1',
  dsh: {
    version: '0.1.3-alpha.1',
    commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
  },
  nodeVersion: '22.19.0',
  profile: 'web',
  bundles: [
    '@newwe/vectorai-plugin-dsh-space',
    '@newwe/vectorai-plugin-dsh-annotation',
  ],
  platform: 'darwin',
  arch: 'arm64',
  entry: 'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
};

describe('desktop runtime contract', () => {
  it('accepts the exact runtime inventory and ordered bundles', () => {
    expect(parseDesktopRuntimeManifest(validManifest)).toEqual(validManifest);
  });

  it('rejects a reversed bundle order before other incomplete fields', () => {
    expect(() => parseDesktopRuntimeManifest({
      ...validManifest,
      bundles: [...validManifest.bundles].reverse(),
    })).toThrow('DESKTOP_RUNTIME_BUNDLE_ORDER_INVALID');
  });

  it('maps only supported native targets', () => {
    expect(runtimeTarget('darwin', 'arm64')).toEqual({
      platform: 'darwin', arch: 'arm64', id: 'darwin-arm64',
    });
    expect(runtimeTarget('darwin', 'x64')).toEqual({
      platform: 'darwin', arch: 'x64', id: 'darwin-x64',
    });
    expect(runtimeTarget('win32', 'x64')).toEqual({
      platform: 'win32', arch: 'x64', id: 'win32-x64',
    });
    expect(() => runtimeTarget('linux', 'x64')).toThrow('DESKTOP_RUNTIME_TARGET_UNSUPPORTED');
  });
});
