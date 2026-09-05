// SPDX-License-Identifier: Apache-2.0

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  formatDshRuntimeCoordinates,
  inspectDshRuntimeDrift,
  readDshRuntimeManifest,
} from './dsh-runtime-manifest.mjs';

const root = resolve(import.meta.dirname, '..');

describe('DSH runtime manifest', () => {
  it('describes the exact latest source runtime and temporary registry SDK baseline', () => {
    const baseline = readDshRuntimeManifest(root);
    expect(baseline).toEqual({
      version: '0.1.3-alpha.1',
      tag: 'dsh-v0.1.3-alpha.1',
      commit: 'd347e703908d0406b7a7ef80e3a0e594d86b2215',
      registrySdkVersion: '0.1.2-rc.1',
      profile: 'web',
      bundleRuntimeDependencies: {
        '@newwe/vectorai-plugin-dsh-space': [
          '@deepseek-ai/dsh-llm',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/dsh-typert-protocol',
        ],
        '@newwe/vectorai-plugin-dsh-annotation': [
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/dsh-typert-protocol',
        ],
      },
    });
    expect(formatDshRuntimeCoordinates(baseline)).toBe(
      '0.1.3-alpha.1\ndsh-v0.1.3-alpha.1\nd347e703908d0406b7a7ef80e3a0e594d86b2215\n',
    );
  });

  it('keeps generated constants and package coordinates synchronized', async () => {
    expect(await inspectDshRuntimeDrift(root)).toEqual([]);
  });

  it('does not ask npm to install host-provided DSH peers', async () => {
    const workspace = await readFile(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
    expect(workspace).toMatch(/^autoInstallPeers: false$/mu);
    const legacyConfig = await readFile(resolve(root, '.npmrc'), 'utf8');
    expect(legacyConfig).toMatch(/^auto-install-peers=false$/mu);
  });
});
