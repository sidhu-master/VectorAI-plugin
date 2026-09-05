// SPDX-License-Identifier: Apache-2.0

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  checkDshRegistryReadiness,
  requiredDshRegistryPackages,
} from './check-dsh-registry-readiness.mjs';

const root = resolve(import.meta.dirname, '..');

describe('DSH registry readiness', () => {
  it('collects every exact DSH runtime and build package deterministically', async () => {
    const release = JSON.parse(await readFile(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
    const packages = requiredDshRegistryPackages({ root, release });

    expect(packages).toEqual([...packages].sort((left, right) => left.name.localeCompare(right.name)));
    expect(packages).toEqual(expect.arrayContaining([
      { name: '@deepseek-ai/dsh-llm', version: '0.1.3-alpha.1' },
      { name: '@deepseek-ai/dsh-session', version: '0.1.3-alpha.1' },
      { name: '@deepseek-ai/dsh-tools', version: '0.1.3-alpha.1' },
      { name: '@deepseek-ai/dsh-typert-protocol', version: '0.1.3-alpha.1' },
    ]));
  });

  it('succeeds only when every exact package and SDK baseline are available', async () => {
    const release = fixtureRelease();
    const lookup = vi.fn().mockResolvedValue('0.1.3-alpha.1');

    await expect(checkDshRegistryReadiness({ root, release }, { lookup }))
      .resolves.toEqual({ ready: true });
    expect(lookup).toHaveBeenCalled();
  });

  it('collects all npm 404 packages in one actionable error', async () => {
    const release = fixtureRelease();
    const lookup = vi.fn(async (name: string) => {
      if (name.endsWith('dsh-tools') || name.endsWith('dsh-typert-protocol')) {
        throw Object.assign(new Error('not found'), { code: 'E404' });
      }
      return '0.1.3-alpha.1';
    });

    await expect(checkDshRegistryReadiness({ root, release }, { lookup }))
      .rejects.toThrow(
        'DSH_REGISTRY_PACKAGES_UNAVAILABLE:@deepseek-ai/dsh-tools,@deepseek-ai/dsh-typert-protocol',
      );
  });

  it('does not mislabel registry or authentication failures as missing packages', async () => {
    const release = fixtureRelease();
    const lookup = vi.fn(async (name: string) => {
      if (name.endsWith('dsh-tools')) throw Object.assign(new Error('unauthorized'), { code: 'E401' });
      return '0.1.3-alpha.1';
    });

    await expect(checkDshRegistryReadiness({ root, release }, { lookup }))
      .rejects.toThrow('DSH_REGISTRY_CHECK_FAILED:@deepseek-ai/dsh-tools');
  });

  it('rejects a stale registry SDK baseline after exact packages become available', async () => {
    const release = fixtureRelease();
    release.dsh.registrySdkVersion = '0.1.2-rc.1';

    await expect(checkDshRegistryReadiness(
      { root, release },
      { lookup: vi.fn().mockResolvedValue('0.1.3-alpha.1') },
    )).rejects.toThrow('DSH_REGISTRY_SDK_BASELINE_STALE:0.1.2-rc.1:0.1.3-alpha.1');
  });
});

function fixtureRelease() {
  return {
    dsh: {
      version: '0.1.3-alpha.1',
      registrySdkVersion: '0.1.3-alpha.1',
      bundleRuntimeDependencies: {
        '@newwe/vectorai-plugin-dsh-space': [
          '@deepseek-ai/dsh-llm',
          '@deepseek-ai/dsh-tools',
        ],
        '@newwe/vectorai-plugin-dsh-annotation': [
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-typert-protocol',
        ],
      },
    },
  };
}
