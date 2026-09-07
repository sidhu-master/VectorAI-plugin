// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createLocalPackageOverrides,
  pnpmShimContents,
  sanitizeInstalledProfileManifest,
  vectorizerProfileDirectory,
} from './desktop-profile-bootstrap.mjs';

describe('desktop profile bootstrap', () => {
  const packed = [
    { manifest: { name: '@deepseek-ai/dsh-tools', version: '0.1.3-alpha.1' }, tarball: '/tmp/dsh-tools.tgz' },
    { manifest: { name: '@newwe/vectorai-plugin-dsh-space', version: '0.1.0-alpha.1' }, tarball: '/tmp/space.tgz' },
  ];

  it('pins packed dependencies to local tarballs while the profile is assembled', () => {
    assert.deepEqual(createLocalPackageOverrides(packed), {
      '@deepseek-ai/dsh-tools': 'file:///tmp/dsh-tools.tgz',
      '@newwe/vectorai-plugin-dsh-space': 'file:///tmp/space.tgz',
    });
  });

  it('removes temporary overrides and leaves portable exact dependency versions', () => {
    const manifest = {
      name: 'dsh-profile-web',
      dependencies: {
        '@deepseek-ai/dsh-tools': 'file:/tmp/dsh-tools.tgz',
        '@newwe/vectorai-plugin-dsh-space': 'file:/tmp/space.tgz',
        react: '^18.3.1',
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@newwe/vectorai-plugin-dsh-space'] } },
      pnpm: { overrides: createLocalPackageOverrides(packed) },
    };

    assert.deepEqual(sanitizeInstalledProfileManifest(manifest, packed), {
      name: 'dsh-profile-web',
      dependencies: {
        '@deepseek-ai/dsh-tools': '0.1.3-alpha.1',
        '@newwe/vectorai-plugin-dsh-space': '0.1.0-alpha.1',
        react: '^18.3.1',
      },
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@newwe/vectorai-plugin-dsh-space'] } },
    });
  });

  it('places the native vectorizer inside the selected DSH profile', () => {
    assert.equal(
      vectorizerProfileDirectory('/seed', 'web', '@newwe/vectorai-vectorizer-darwin-arm64'),
      '/seed/profiles/web/node_modules/@newwe/vectorai-vectorizer-darwin-arm64',
    );
  });

  it('pins DSH profile mutations to the pnpm version that supports build allowlists', () => {
    assert.match(pnpmShimContents('darwin'), /corepack pnpm@11\.7\.0 "\$@"/u);
    assert.match(pnpmShimContents('win32'), /corepack pnpm@11\.7\.0 %\*/u);
  });
});
