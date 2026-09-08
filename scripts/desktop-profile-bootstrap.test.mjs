// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as profileBootstrap from './desktop-profile-bootstrap.mjs';

const {
  createLocalPackageOverrides,
  localTarballSpecifier,
  pnpmShimContents,
  sanitizeInstalledProfileManifest,
  vectorizerProfileDirectory,
  withLocalPackageOverrides,
} = profileBootstrap;

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

  it('keeps Windows short-path tildes literal in npm file specifiers', () => {
    assert.equal(
      localTarballSpecifier('C:\\Users\\RUNNER~1\\bundle.tgz', 'win32'),
      'file:C:/Users/RUNNER~1/bundle.tgz',
    );
  });

  it('writes local overrides into the pnpm 11 workspace settings', () => {
    assert.deepEqual(withLocalPackageOverrides({ packages: ['.'], nodeLinker: 'hoisted' }, packed), {
      packages: ['.'],
      nodeLinker: 'hoisted',
      overrides: createLocalPackageOverrides(packed),
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

  it('keeps only profile-owned bundles and the platform runtime in the seeded node_modules', async () => {
    assert.equal(typeof profileBootstrap.retainInstalledProfilePackages, 'function');
    const root = await mkdtemp(join(tmpdir(), 'vectorai-profile-prune-'));
    const modules = join(root, 'node_modules');
    try {
      for (const name of [
        '@deepseek-ai/dsh-scope',
        '@newwe/vectorai-plugin-dsh-space',
        '@newwe/vectorai-plugin-dsh-annotation',
        '@newwe/vectorai-vectorizer-darwin-arm64',
        'sharp',
      ]) {
        const directory = join(modules, ...name.split('/'));
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'package.json'), '{}\n');
      }

      await profileBootstrap.retainInstalledProfilePackages(modules, [
        '@newwe/vectorai-plugin-dsh-space',
        '@newwe/vectorai-plugin-dsh-annotation',
        '@newwe/vectorai-vectorizer-darwin-arm64',
      ]);

      await assert.doesNotReject(() => access(join(modules, '@newwe/vectorai-plugin-dsh-space/package.json')));
      await assert.doesNotReject(() => access(join(modules, '@newwe/vectorai-vectorizer-darwin-arm64/package.json')));
      await assert.rejects(() => access(join(modules, '@deepseek-ai/dsh-scope/package.json')), { code: 'ENOENT' });
      await assert.rejects(() => access(join(modules, 'sharp/package.json')), { code: 'ENOENT' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
