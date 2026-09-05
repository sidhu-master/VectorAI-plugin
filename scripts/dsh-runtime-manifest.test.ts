// SPDX-License-Identifier: Apache-2.0

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  inspectDshRuntimeDrift,
  readDshRuntimeManifest,
} from './dsh-runtime-manifest.mjs';

const root = resolve(import.meta.dirname, '..');

describe('DSH runtime manifest', () => {
  it('describes the exact latest source runtime and temporary registry SDK baseline', () => {
    expect(readDshRuntimeManifest(root)).toEqual({
      version: '0.1.3-alpha.1',
      tag: 'dsh-v0.1.3-alpha.1',
      commit: 'd347e703725e7e2954a82b08cc00410c7f275c21',
      registrySdkVersion: '0.1.2-rc.1',
      profile: 'web',
    });
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
