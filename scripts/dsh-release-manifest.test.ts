// SPDX-License-Identifier: Apache-2.0

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditPackageEntries, auditPackedManifest } from './dsh-package-audit.mjs';

const root = resolve(import.meta.dirname, '..');

const bundles = [
  {
    directory: 'plugin-dsh-space',
    name: '@newwe/vectorai-plugin-dsh-space',
    rowId: 'vectorai-space',
  },
  {
    directory: 'plugin-dsh-annotation',
    name: '@newwe/vectorai-plugin-dsh-annotation',
    rowId: 'vectorai-engineering-annotation',
  },
] as const;

const buildInputs = [
  'plugin-dsh-space-client',
  'plugin-dsh-space-host',
  'plugin-dsh-annotation-client',
  'plugin-dsh-annotation-host',
] as const;

describe('official DSH release manifests', () => {
  it('targets one exact source runtime while recording the temporary registry SDK baseline', async () => {
    const release = JSON.parse(await readFile(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
    expect(release.dsh).toMatchObject({
      version: '0.1.3-alpha.1',
      tag: 'dsh-v0.1.3-alpha.1',
      commit: 'd347e703725e7e2954a82b08cc00410c7f275c21',
      registrySdkVersion: '0.1.2-rc.1',
      profile: 'web',
    });

    for (const bundle of bundles) {
      const manifest = JSON.parse(await readFile(
        resolve(root, 'packages', bundle.directory, 'package.json'),
        'utf8',
      ));
      expect(manifest.peerDependencies['@deepseek-ai/dsh-client-runtime']).toBeUndefined();
      for (const [name, version] of Object.entries(manifest.peerDependencies)) {
        if (!name.startsWith('@deepseek-ai/dsh-')) continue;
        expect(version).toBe('0.1.3-alpha.1');
        expect(manifest.peerDependenciesMeta?.[name]).toEqual({ optional: true });
      }
    }

    for (const directory of buildInputs) {
      const manifest = JSON.parse(await readFile(
        resolve(root, 'packages', directory, 'package.json'),
        'utf8',
      ));
      for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
        if (name.startsWith('@deepseek-ai/dsh-')) expect(version).toBe('0.1.2-rc.1');
      }
    }

    const rootManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    for (const [name, version] of Object.entries(rootManifest.devDependencies ?? {})) {
      if (name.startsWith('@deepseek-ai/dsh-')) expect(version).toBe('0.1.2-rc.1');
    }
  });

  for (const bundle of bundles) {
    it(`${bundle.name} is one prebuilt dual-face Bundle`, async () => {
      const directory = resolve(root, 'packages', bundle.directory);
      const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
      const patch = await readFile(resolve(directory, 'cordis.patch.yml'), 'utf8');

      expect(manifest.publishConfig).toEqual({ access: 'public' });
      expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml');
      expect(manifest.dsh.client.platform).toBe('web');
      expect(manifest.exports['.'].default).toBe('./lib/index.js');
      expect(manifest.exports['./client'].default).toBe('./lib/client.js');
      expect(manifest.exports['./typert'].default).toBe('./lib/typert.js');
      expect(manifest.files).not.toContain('src/**/*.ts');
      expect(manifest.files).not.toContain('src/**/*.tsx');
      expect(manifest.files).not.toContain('lib/vectorai_vectorizer.py');
      expect(JSON.stringify(manifest)).not.toMatch(/workspace:\*|\blink:|\bfile:/);

      expect(patch.match(/\n\s+- id:/g)).toHaveLength(1);
      expect(patch).toContain(`- id: ${bundle.rowId}`);
      expect(patch).toContain(`name: '${bundle.name}'`);
    });
  }

  it('emits both runtime faces only into the two Bundle directories', async () => {
    for (const bundle of bundles) {
      const lib = resolve(root, 'packages', bundle.directory, 'lib');
      const files = await readdir(lib);
      expect(files).toEqual(expect.arrayContaining(['index.js', 'client.js', 'typert.js']));
      expect(files.some((file) => file.endsWith('.map'))).toBe(false);
      for (const file of files.filter((entry) => entry.endsWith('.js'))) {
        const source = await readFile(resolve(lib, file), 'utf8');
        expect(source).not.toMatch(/(?:from\s*|import\(|require\()\s*['"]@vectorai\//);
      }
    }
    const spaceFiles = await readdir(resolve(root, 'packages/plugin-dsh-space/lib'));
    expect(spaceFiles).not.toContain('vectorai_vectorizer.py');
  });

  it('leaves platform runtime versions for the release preparation step', async () => {
    const space = JSON.parse(await readFile(resolve(root, 'packages/plugin-dsh-space/package.json'), 'utf8'));
    const annotation = JSON.parse(await readFile(resolve(root, 'packages/plugin-dsh-annotation/package.json'), 'utf8'));
    expect(space.optionalDependencies).toBeUndefined();
    expect(annotation.optionalDependencies).toBeUndefined();
  });

  it('rejects source and local dependency data from release packages', () => {
    for (const forbidden of [
      'package/src/index.ts',
      'package/lib/index.js.map',
      'package/test/plugin.test.js',
      'package/.git/config',
      'package/lib/vectorai_vectorizer.py',
    ]) {
      expect(() => auditPackageEntries(['package/package.json', forbidden])).toThrow();
    }
    expect(() => auditPackedManifest({
      name: '@newwe/vectorai-plugin-dsh-space',
      publishConfig: { access: 'public' },
      dependencies: { local: 'workspace:*' },
      dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
    })).toThrow(/forbidden local dependency/i);
  });
});
